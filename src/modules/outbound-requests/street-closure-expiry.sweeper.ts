import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ServiceStatus, StreetClosureRequestStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Cuánto se espera después de `approvedTo` antes de vencer un corte aprobado.
 *
 * Un corte que sí estuvo ACTIVE termina por su cuenta en M7, que publica
 * `streetClosureEnded` al vencer su `endDate`; la gracia deja que ese evento
 * llegue antes de que lo declaremos expirado. Si llega igual después, se
 * acepta desde EXPIRED.
 */
export const CLOSURE_EXPIRY_GRACE_MS = 6 * 60 * 60 * 1000;

/**
 * Vence los cortes aprobados que M7 deja expirar sin publicar nada (#321).
 *
 * Mismo criterio que `ReportDeadlineSweeper`: si el otro módulo no avisa,
 * vencemos por tiempo y asumimos que una expiración y una demora se ven
 * igual. Un corte sin `approvedTo` (aprobado antes de guardarlo) no se vence:
 * no se inventan fechas. No se publica nada hacia M7, el corte ya expiró allá.
 */
@Injectable()
export class StreetClosureExpirySweeper implements OnModuleInit {
  private readonly logger = new Logger(StreetClosureExpirySweeper.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Barre también al arrancar (el free tier duerme el proceso; ver ReportDeadlineSweeper). No propaga el error. */
  async onModuleInit(): Promise<void> {
    try {
      await this.expireClosures();
    } catch (error) {
      this.logger.warn(
        `El barrido de cortes vencidos falló al arrancar; se reintenta en la próxima hora: ${
          (error as Error).message
        }`,
      );
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async expireClosures(now: Date = new Date()): Promise<void> {
    const limit = new Date(now.getTime() - CLOSURE_EXPIRY_GRACE_MS);
    const vencidos = await this.prisma.streetClosureRequest.findMany({
      where: { status: StreetClosureRequestStatus.APPROVED, approvedTo: { lt: limit } },
      select: { id: true, sourceType: true, sourceId: true },
    });

    let expired = 0;
    for (const corte of vencidos) {
      // Una transacción por corte: el corte y su servicio cambian juntos, y uno
      // que falla no frena a los demás (se reintenta en la próxima hora).
      const applied = await this.prisma.$transaction(async (tx) => {
        // `updateMany` no pasa por assertTransition: el estado y la fecha en el
        // `where` son el guard (APPROVED→EXPIRED está en CLOSURE_TRANSITIONS) y
        // lo hacen atómico frente a un `streetClosureEnded` concurrente.
        const { count } = await tx.streetClosureRequest.updateMany({
          where: {
            id: corte.id,
            status: StreetClosureRequestStatus.APPROVED,
            approvedTo: { lt: limit },
          },
          data: { status: StreetClosureRequestStatus.EXPIRED },
        });
        if (count === 0) return false;

        // Mismo criterio acotado que el rechazo (closureRejected): solo un
        // servicio todavía SCHEDULED se marca para reprogramar; uno iniciado o
        // cerrado no se toca. Una TreeIntervention tampoco: el rechazo no la
        // modifica, así que expirar no puede ser más agresivo.
        if (corte.sourceType === 'SERVICE') {
          await tx.service.updateMany({
            where: { id: corte.sourceId, status: ServiceStatus.SCHEDULED },
            data: {
              status: ServiceStatus.RESCHEDULED,
              statusReason: 'el corte autorizado venció sin activarse',
            },
          });
        }
        return true;
      });
      if (applied) expired += 1;
    }

    if (expired > 0) {
      this.logger.log(`${expired} corte/s aprobado/s vencido/s sin activarse (M7 no avisa)`);
    }
  }
}
