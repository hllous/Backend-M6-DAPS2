import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InboxEvent, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditActor, AuditService, AuditTarget } from '../../common/audit/audit.service';
import { PaginatedResponseDto } from '../../common/dto';
import { startOfDayArgentina, toDateOnly } from '../../common/utils/date-only';
import {
  InboxEventDetailResponseDto,
  InboxEventResponseDto,
  InboxStatus,
  QueryInboxDto,
} from './inbox-admin.dto';
import { ConsumedEvent } from './consumed-events';
import { esRedactado } from './inbox.service';
import { esUuid } from './payload-validation';

const DAY_MS = 86_400_000;
const MAX_ERROR_LENGTH = 500;

/** Todas las columnas menos `payload`: es de terceros y solo el detalle lo devuelve. */
const SIN_PAYLOAD = {
  messageId: true,
  eventType: true,
  sourceModule: true,
  receivedAt: true,
  processedAt: true,
  occurredAt: true,
  correlationId: true,
  error: true,
} satisfies Prisma.InboxEventSelect;

/** Dónde cae cada estado derivado; el inverso es `statusOf`. */
const WHERE_BY_STATUS: Record<InboxStatus, Prisma.InboxEventWhereInput> = {
  processed: { processedAt: { not: null } },
  failed: { processedAt: null, error: { not: null } },
  pending: { processedAt: null, error: null },
};

/**
 * Entrantes cuyo payload trae datos Tier 2 (ADR-005, #643): `ticketUpdated` trae
 * la identidad del denunciante (`citizenId`, salvo anónimo) y los dos de M4, la
 * resolución sobre un acta. Su lectura se audita en `findOne`.
 */
export const TIER2_INBOX_EVENTS: readonly string[] = [
  ConsumedEvent.TICKET_UPDATED,
  ConsumedEvent.COMMERCIAL_FINE_GENERATED,
  ConsumedEvent.CLOSURE_UPDATE,
];

/** Consulta de solo lectura de los eventos entrantes, para el Monitor de integración. */
@Injectable()
export class InboxAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(query: QueryInboxDto): Promise<PaginatedResponseDto<InboxEventResponseDto>> {
    if (query.from && query.to && toDateOnly(query.from) > toDateOnly(query.to)) {
      throw new BadRequestException(
        `'from' (${query.from}) no puede ser posterior a 'to' (${query.to})`,
      );
    }

    const where: Prisma.InboxEventWhereInput = {
      ...(query.status && WHERE_BY_STATUS[query.status]),
      ...(query.eventType && { eventType: query.eventType }),
      ...(query.sourceModule && { sourceModule: query.sourceModule }),
      // `to` es inclusivo: antes de las 00:00 ART del día siguiente.
      ...((query.from || query.to) && {
        receivedAt: {
          ...(query.from && { gte: startOfDayArgentina(query.from) }),
          ...(query.to && { lt: new Date(startOfDayArgentina(query.to).getTime() + DAY_MS) }),
        },
      }),
    };

    const [rows, total] = await Promise.all([
      this.prisma.inboxEvent.findMany({
        where,
        select: SIN_PAYLOAD,
        orderBy: [{ receivedAt: 'desc' }, { messageId: 'asc' }],
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.inboxEvent.count({ where }),
    ]);

    return new PaginatedResponseDto(
      rows.map((r) => this.toResponseDto(r)),
      total,
      query.page,
      query.pageSize,
    );
  }

  /**
   * Si el payload trae datos Tier 2, la lectura se audita antes de responder y, si
   * la fila no se escribe, el error sube sin entregar el payload. Un payload
   * redactado (ticket de otro módulo) no entrega nada y no se audita.
   */
  async findOne(messageId: string, actor: AuditActor): Promise<InboxEventDetailResponseDto> {
    const event = await this.prisma.inboxEvent.findUnique({ where: { messageId } });
    if (!event) throw new NotFoundException(`Evento entrante ${messageId} no encontrado`);

    if (TIER2_INBOX_EVENTS.includes(event.eventType) && !esRedactado(event.payload)) {
      await this.audit.recordRead([await this.readTarget(event)], actor);
    }

    return { ...this.toResponseDto(event), payload: event.payload as Record<string, unknown> };
  }

  /**
   * El recurso de M6 que describe ese payload: el expediente del ticket o la
   * resolución del acta. Si todavía no existe (el handler falló o el acta no es
   * nuestra) o el payload no es un objeto, el dato igual sale en la respuesta,
   * así que la fila queda sobre el propio evento (`INBOX_EVENT` + el `id` UUID de
   * la fila del inbox, no el `messageId`, que no siempre es UUID y el front valida
   * `entityId` como tal) en vez de no registrar o de colgarla de un id que no es
   * de esa entidad.
   */
  private async readTarget(event: InboxEvent): Promise<AuditTarget> {
    const fallback: AuditTarget = { entityType: 'INBOX_EVENT', entityId: event.id };
    const payload = event.payload;
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return fallback;

    if (event.eventType === ConsumedEvent.TICKET_UPDATED) {
      // Un ticket mapea a un solo expediente: la re-derivación lo reutiliza (tickets.consumer.ts).
      const report =
        typeof payload.ticketId === 'string'
          ? await this.prisma.environmentalReport.findFirst({
              where: { ticketId: payload.ticketId },
              select: { id: true },
            })
          : null;
      if (report) return { entityType: 'ENVIRONMENTAL_REPORT', entityId: report.id };
    } else {
      // Mismo orden que el consumidor de M4 (sanctions.consumer.ts).
      const violationId = payload.sourceViolationId ?? payload.violationId;
      const outcome = esUuid(violationId)
        ? await this.prisma.sanctionOutcome.findUnique({
            where: { violationNoticeId: violationId as string },
            select: { id: true },
          })
        : null;
      if (outcome) return { entityType: 'SANCTION_OUTCOME', entityId: outcome.id };
    }
    return fallback;
  }

  private statusOf(e: Pick<InboxEvent, 'processedAt' | 'error'>): InboxStatus {
    if (e.processedAt) return 'processed';
    return e.error ? 'failed' : 'pending';
  }

  private toResponseDto(e: Omit<InboxEvent, 'payload' | 'id'>): InboxEventResponseDto {
    return {
      messageId: e.messageId,
      eventType: e.eventType,
      sourceModule: e.sourceModule,
      status: this.statusOf(e),
      receivedAt: e.receivedAt,
      processedAt: e.processedAt,
      occurredAt: e.occurredAt,
      correlationId: e.correlationId,
      error: e.error === null ? null : e.error.slice(0, MAX_ERROR_LENGTH),
    };
  }
}
