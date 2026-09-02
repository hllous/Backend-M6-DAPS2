import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RepairRequestStatus, ServiceStatus, StreetClosureRequestStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { InboxService } from '../inbox/inbox.service';
import { ConsumedEvent } from '../inbox/consumed-events';

/**
 * Las respuestas de M3 y M7 a lo que les derivamos.
 *
 * Toda la correlación es por **el id que les mandamos y nos devuelven**:
 * `sourceRequestId` en M3, `closureRequestId` en M7. Sin eso habría que
 * correlacionar por dirección, que es frágil — era el pedido bloqueante con
 * los dos y quedó cerrado (bloqueantes.md, 25/08 y 30/08).
 *
 * Un id que no corresponde a nada nuestro se descarta con log: puede ser una
 * solicitud de M3 que M7 nos rutea por error, y no es motivo para fallar.
 */
@Injectable()
export class OutboundResponsesConsumer implements OnModuleInit {
  private readonly logger = new Logger(OutboundResponsesConsumer.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inbox: InboxService,
  ) {}

  onModuleInit(): void {
    this.inbox.register(ConsumedEvent.WORK_ORDER_SCHEDULED, (d) => this.workOrderScheduled(d));
    this.inbox.register(ConsumedEvent.WORK_ORDER_COMPLETED, (d) => this.workOrderCompleted(d));
    this.inbox.register(ConsumedEvent.STREET_CLOSURE_APPROVED, (d) => this.closureApproved(d));
    this.inbox.register(ConsumedEvent.STREET_CLOSURE_REJECTED, (d) => this.closureRejected(d));
    this.inbox.register(ConsumedEvent.STREET_CLOSURE_ENDED, (d) => this.closureEnded(d));
  }

  // ─── M3 ───────────────────────────────────────────

  /**
   * Sigue abierta la pregunta de **cuándo** dispara M3 este evento: "creada" y
   * "programada" no significan lo mismo, y si es lo segundo, entre que mandamos
   * la solicitud y ellos le ponen fecha no tenemos ninguna señal
   * (bloqueantes.md). No cambia el handler, sí cambia qué tan pronto se entera
   * el operador.
   */
  private async workOrderScheduled(data: Record<string, unknown>): Promise<void> {
    const request = await this.findRepairRequest(data);
    if (!request) return;

    await this.prisma.repairRequest.update({
      where: { id: request.id },
      data: {
        status: RepairRequestStatus.IN_PROGRESS,
        workOrderId: (data.workOrderId as string) ?? request.workOrderId,
      },
    });
    this.logger.log(`Reparación ${request.id}: M3 la agendó`);
  }

  private async workOrderCompleted(data: Record<string, unknown>): Promise<void> {
    const request = await this.findRepairRequest(data);
    if (!request) return;

    await this.prisma.repairRequest.update({
      where: { id: request.id },
      data: { status: RepairRequestStatus.CLOSED },
    });
    this.logger.log(`Reparación ${request.id}: M3 la completó`);
  }

  // ─── M7 ───────────────────────────────────────────

  /** El corte aprobado **habilita la ejecución del servicio bloqueado**. */
  private async closureApproved(data: Record<string, unknown>): Promise<void> {
    const request = await this.findClosureRequest(data);
    if (!request) return;

    await this.prisma.streetClosureRequest.update({
      where: { id: request.id },
      data: {
        status: StreetClosureRequestStatus.APPROVED,
        closureId: (data.streetClosureId as string) ?? (data.closureId as string) ?? null,
      },
    });
    this.logger.log(`Corte ${request.id}: aprobado por M7, el trabajo queda habilitado`);
  }

  /**
   * El rechazo deja el servicio dependiente **marcado para reprogramar**, no
   * cancelado: la decisión de cancelarlo es del operador, y `RESCHEDULED` es
   * exactamente el estado "hay que moverlo pero todavía no sé adónde".
   */
  private async closureRejected(data: Record<string, unknown>): Promise<void> {
    const request = await this.findClosureRequest(data);
    if (!request) return;

    await this.prisma.streetClosureRequest.update({
      where: { id: request.id },
      data: { status: StreetClosureRequestStatus.REJECTED },
    });

    if (request.sourceType === 'SERVICE') {
      const { count } = await this.prisma.service.updateMany({
        where: { id: request.sourceId, status: ServiceStatus.SCHEDULED },
        data: {
          status: ServiceStatus.RESCHEDULED,
          statusReason: `M7 rechazó el corte de calle solicitado${
            data.reason ? `: ${String(data.reason)}` : ''
          }`,
        },
      });
      if (count > 0) {
        this.logger.log(
          `Servicio ${request.sourceId}: marcado para reprogramar por el rechazo del corte`,
        );
      }
    }
    this.logger.log(`Corte ${request.id}: rechazado por M7`);
  }

  private async closureEnded(data: Record<string, unknown>): Promise<void> {
    const request = await this.findClosureRequest(data);
    if (!request) return;

    await this.prisma.streetClosureRequest.update({
      where: { id: request.id },
      data: { status: StreetClosureRequestStatus.ENDED },
    });
    this.logger.log(`Corte ${request.id}: finalizado, dependencia liberada`);
  }

  // ─── Correlación ──────────────────────────────────

  private async findRepairRequest(data: Record<string, unknown>) {
    const id = (data.sourceRequestId ?? data.requestId) as string | undefined;
    if (!id) {
      this.logger.warn('Evento de M3 sin sourceRequestId: no se puede correlacionar, se descarta');
      return null;
    }
    const request = await this.prisma.repairRequest.findUnique({ where: { id } });
    if (!request) {
      this.logger.warn(`sourceRequestId '${id}' no corresponde a ninguna solicitud nuestra`);
    }
    return request;
  }

  private async findClosureRequest(data: Record<string, unknown>) {
    const id = (data.closureRequestId ?? data.sourceRequestId) as string | undefined;
    if (!id) {
      this.logger.warn('Evento de M7 sin closureRequestId: no se puede correlacionar, se descarta');
      return null;
    }
    // requestingModule viene como "Obras"/"Ambiente"; si es de Obras no es nuestro.
    const request = await this.prisma.streetClosureRequest.findUnique({ where: { id } });
    if (!request) {
      this.logger.warn(`closureRequestId '${id}' no corresponde a ningún corte nuestro`);
    }
    return request;
  }
}
