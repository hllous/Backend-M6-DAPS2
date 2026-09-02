import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EnvironmentalReportStatus as S, SanctionDecision } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { InboxService } from '../inbox/inbox.service';
import { ConsumedEvent } from '../inbox/consumed-events';

/**
 * Las resoluciones sancionatorias de M4 sobre nuestras actas.
 *
 * `SanctionOutcome` es un **espejo de solo lectura**: no lo editamos, existe
 * para poder cerrar el expediente y mostrar en qué terminó.
 *
 * Correlacionan por `sourceViolationId`, que es el `violationId` que mandamos
 * en el acta. Era el pedido bloqueante con M4 y quedó cerrado el 24/08.
 *
 * ⚠️ **`commercialFineGenerated` sigue rotulado solo "→ Rentas"** en el
 * documento de M4: falta que confirmen que también nos lo rutean. El handler
 * está listo; si no nos llega, el expediente cierra por vencimiento del plazo.
 */
@Injectable()
export class SanctionsConsumer implements OnModuleInit {
  private readonly logger = new Logger(SanctionsConsumer.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inbox: InboxService,
  ) {}

  onModuleInit(): void {
    this.inbox.register(ConsumedEvent.COMMERCIAL_FINE_GENERATED, (d) => this.fineGenerated(d));
    this.inbox.register(ConsumedEvent.CLOSURE_UPDATE, (d) => this.closureUpdate(d));
  }

  private async fineGenerated(data: Record<string, unknown>): Promise<void> {
    await this.recordOutcome(data, SanctionDecision.FINE_ISSUED);
  }

  /**
   * M4 fusionó `closureOrdered` y `closureLifted` en un solo evento con
   * `status: ORDERED | LIFTED`. No fue un pedido nuestro: actualizamos el lado
   * consumidor para seguir la forma que publican hoy.
   */
  private async closureUpdate(data: Record<string, unknown>): Promise<void> {
    const status = String(data.status ?? '').toUpperCase();
    if (status !== 'ORDERED' && status !== 'LIFTED') {
      this.logger.warn(`closureUpdate con status '${status}' desconocido: se descarta`);
      return;
    }
    await this.recordOutcome(
      data,
      status === 'ORDERED' ? SanctionDecision.CLOSURE_ORDERED : SanctionDecision.DISMISSED,
    );
  }

  /**
   * Registra la resolución y cierra el expediente.
   *
   * El expediente pasa a `SANCTIONED` y de ahí a `CLOSED` en la misma
   * operación: una vez que M4 resolvió no queda nada nuestro por hacer, y
   * dejarlo en `SANCTIONED` obligaría a un cierre manual que no aporta.
   */
  private async recordOutcome(
    data: Record<string, unknown>,
    decision: SanctionDecision,
  ): Promise<void> {
    const violationId = (data.sourceViolationId ?? data.violationId) as string | undefined;
    if (!violationId) {
      this.logger.warn(
        'Evento de M4 sin sourceViolationId: no sabemos cuál de nuestras actas resolvieron, se descarta',
      );
      return;
    }

    const notice = await this.prisma.violationNotice.findUnique({
      where: { id: violationId },
      include: { inspection: true, sanctionOutcome: true },
    });
    if (!notice) {
      this.logger.warn(`sourceViolationId '${violationId}' no corresponde a ningún acta nuestra`);
      return;
    }
    if (notice.sanctionOutcome) {
      this.logger.warn(
        `El acta ${notice.noticeNumber} ya tiene resolución registrada (${notice.sanctionOutcome.decision}): se descarta`,
      );
      return;
    }

    const report = await this.prisma.environmentalReport.findUnique({
      where: { id: notice.inspection.reportId },
    });
    if (!report) return;

    await this.prisma.$transaction(async (tx) => {
      await tx.sanctionOutcome.create({
        data: {
          violationNoticeId: notice.id,
          decision,
          // decidedAt y externalRef los confirmaron verbalmente el 24/08 pero
          // su documento todavía no los muestra en el payload de ejemplo.
          decidedAt: data.decidedAt ? new Date(String(data.decidedAt)) : null,
          externalRef: (data.externalRef ?? data.actId) as string | null,
        },
      });

      if (report.status === S.NOTICE_ISSUED) {
        await tx.environmentalReport.update({
          where: { id: report.id },
          data: { status: S.SANCTIONED },
        });
        await tx.environmentalReport.update({
          where: { id: report.id },
          data: { status: S.CLOSED },
        });
      }
    });

    this.logger.log(
      `Acta ${notice.noticeNumber}: M4 resolvió ${decision}, expediente ${report.id} cerrado`,
    );
  }
}
