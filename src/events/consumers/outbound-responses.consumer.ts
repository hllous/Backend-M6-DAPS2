import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RepairRequestStatus, ServiceStatus, StreetClosureRequestStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { InboxService } from '../inbox/inbox.service';
import { ConsumedEvent } from '../inbox/consumed-events';
import {
  CLOSURE_TRANSITIONS,
  REPAIR_TRANSITIONS,
  sourcesOf,
} from '../../modules/outbound-requests/outbound-requests.transitions';

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

    // `updateMany` no pasa por assertTransition: el filtro por estado de origen
    // es el guard, y además es atómico frente a un evento repetido o tardío.
    const { count } = await this.prisma.repairRequest.updateMany({
      where: {
        id: request.id,
        status: { in: sourcesOf(REPAIR_TRANSITIONS, RepairRequestStatus.IN_PROGRESS) },
      },
      data: {
        status: RepairRequestStatus.IN_PROGRESS,
        workOrderId: (data.workOrderId as string) ?? request.workOrderId,
      },
    });
    if (this.applied(count, `Reparación ${request.id}`, 'workOrderScheduled')) {
      this.logger.log(`Reparación ${request.id}: M3 la agendó`);
    }
  }

  private async workOrderCompleted(data: Record<string, unknown>): Promise<void> {
    const request = await this.findRepairRequest(data);
    if (!request) return;

    // Guard por estado de origen, mismo criterio que workOrderScheduled.
    const { count } = await this.prisma.repairRequest.updateMany({
      where: {
        id: request.id,
        status: { in: sourcesOf(REPAIR_TRANSITIONS, RepairRequestStatus.CLOSED) },
      },
      data: { status: RepairRequestStatus.CLOSED },
    });
    if (this.applied(count, `Reparación ${request.id}`, 'workOrderCompleted')) {
      this.logger.log(`Reparación ${request.id}: M3 la completó`);
    }
  }

  // ─── M7 ───────────────────────────────────────────

  /** El corte aprobado **habilita la ejecución del servicio bloqueado**. */
  private async closureApproved(data: Record<string, unknown>): Promise<void> {
    const request = await this.findClosureRequest(data);
    if (!request) return;

    // Guard por estado de origen: un "aprobado" tardío no pisa un corte ya rechazado o terminado.
    const { count } = await this.prisma.streetClosureRequest.updateMany({
      where: {
        id: request.id,
        status: { in: sourcesOf(CLOSURE_TRANSITIONS, StreetClosureRequestStatus.APPROVED) },
      },
      data: {
        status: StreetClosureRequestStatus.APPROVED,
        closureId: (data.streetClosureId as string) ?? (data.closureId as string) ?? null,
      },
    });
    if (this.applied(count, `Corte ${request.id}`, 'streetClosureApproved')) {
      this.logger.log(`Corte ${request.id}: aprobado por M7, el trabajo queda habilitado`);
    }
  }

  /**
   * El rechazo deja el servicio dependiente **marcado para reprogramar**, no
   * cancelado: la decisión de cancelarlo es del operador, y `RESCHEDULED` es
   * exactamente el estado "hay que moverlo pero todavía no sé adónde".
   */
  private async closureRejected(data: Record<string, unknown>): Promise<void> {
    const request = await this.findClosureRequest(data);
    if (!request) return;

    // `rejectionReason` es el campo del contrato de M7; `reason` se tolera por
    // si llega un sobre armado a mano con el nombre viejo.
    const motivo = data.rejectionReason ?? data.reason;

    // Las dos escrituras van juntas: si la del servicio falla, el corte vuelve
    // a REQUESTED y el reintento del inbox completa todo. Sin transacción, el
    // reintento vería el corte ya REJECTED, lo descartaría y el servicio
    // quedaría SCHEDULED para siempre.
    const applied = await this.prisma.$transaction(async (tx) => {
      // Guard por estado de origen. Si no aplicó, tampoco se toca el servicio:
      // un rechazo tardío sobre un corte aprobado no debe reprogramar el trabajo.
      const { count: rejected } = await tx.streetClosureRequest.updateMany({
        where: {
          id: request.id,
          status: { in: sourcesOf(CLOSURE_TRANSITIONS, StreetClosureRequestStatus.REJECTED) },
        },
        data: { status: StreetClosureRequestStatus.REJECTED },
      });
      if (rejected === 0) return false;

      if (request.sourceType === 'SERVICE') {
        // El `where` acota a SCHEDULED, que es el único estado desde el que
        // VALID_TRANSITIONS admite RESCHEDULED. `updateMany` no pasa por
        // assertTransition: el filtro es el guard.
        const { count } = await tx.service.updateMany({
          where: { id: request.sourceId, status: ServiceStatus.SCHEDULED },
          data: {
            status: ServiceStatus.RESCHEDULED,
            statusReason: `M7 rechazó el corte de calle solicitado${motivo ? `: ${String(motivo)}` : ''}`,
          },
        });
        if (count > 0) {
          this.logger.log(
            `Servicio ${request.sourceId}: marcado para reprogramar por el rechazo del corte`,
          );
        }
      }
      return true;
    });
    if (this.applied(applied ? 1 : 0, `Corte ${request.id}`, 'streetClosureRejected')) {
      this.logger.log(`Corte ${request.id}: rechazado por M7`);
    }
  }

  private async closureEnded(data: Record<string, unknown>): Promise<void> {
    const request = await this.findClosureRequest(data);
    if (!request) return;

    // Guard por estado de origen. Se acepta desde REQUESTED porque este evento
    // puede adelantarse a streetClosureApproved (topics distintos, sin orden);
    // en ese caso el id de cierre de M7 se guarda acá, si no lo teníamos.
    const closureId = (data.streetClosureId as string) ?? (data.closureId as string);
    const { count } = await this.prisma.streetClosureRequest.updateMany({
      where: {
        id: request.id,
        status: { in: sourcesOf(CLOSURE_TRANSITIONS, StreetClosureRequestStatus.ENDED) },
      },
      data: {
        status: StreetClosureRequestStatus.ENDED,
        ...(closureId && !request.closureId && { closureId }),
      },
    });
    if (this.applied(count, `Corte ${request.id}`, 'streetClosureEnded')) {
      this.logger.log(`Corte ${request.id}: finalizado, dependencia liberada`);
    }
  }

  /** Si el update no aplicó, el evento llegó tarde o repetido: se descarta con log, sin error. */
  private applied(count: number, what: string, event: string): boolean {
    if (count > 0) return true;
    this.logger.warn(`${what}: ${event} descartado, el estado actual no admite la transición`);
    return false;
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
