import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OutboxEvent, OutboxEventStatus, OutboxRetryAudit, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginatedResponseDto } from '../../common/dto';
import { startOfDayArgentina, toDateOnly } from '../../common/utils/date-only';
import {
  OutboxEventDetailResponseDto,
  OutboxEventResponseDto,
  OutboxRetryAuditResponseDto,
  MAX_RETRY_BATCH,
  QueryOutboxDto,
  RetryFailedOutboxDto,
  RetryFailedOutboxResponseDto,
} from './dto';

const DAY_MS = 86_400_000;

/**
 * Todas las columnas menos `payload`: puede traer datos del vecino y solo el
 * detalle lo devuelve. (Prisma 5 no tiene `omit` fuera de preview.)
 */
const SIN_PAYLOAD = {
  id: true,
  eventType: true,
  aggregateType: true,
  aggregateId: true,
  status: true,
  attempts: true,
  lastError: true,
  occurredAt: true,
  publishedAt: true,
  correlationId: true,
  causationId: true,
} satisfies Prisma.OutboxEventSelect;

/**
 * Transiciones que se hacen a mano sobre el outbox. El dispatcher mueve
 * PENDING → SENT/FAILED por su cuenta (outbox-dispatcher.service.ts); lo único
 * que entra por acá es FAILED → PENDING. SENT no se toca: reenviarlo duplicaría
 * un evento que ya salió.
 */
export const OUTBOX_TRANSITIONS: Record<OutboxEventStatus, OutboxEventStatus[]> = {
  PENDING: [OutboxEventStatus.SENT, OutboxEventStatus.FAILED],
  SENT: [],
  FAILED: [OutboxEventStatus.PENDING],
};

/**
 * Consulta y reintento manual de los eventos salientes (QA-CA-008: los
 * fallidos se conservan y los reintentos quedan auditados). Aparte de
 * `OutboxService`, que solo escribe dentro de la transacción del dominio.
 */
@Injectable()
export class OutboxAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryOutboxDto): Promise<PaginatedResponseDto<OutboxEventResponseDto>> {
    if (query.from && query.to && toDateOnly(query.from) > toDateOnly(query.to)) {
      throw new BadRequestException(
        `'from' (${query.from}) no puede ser posterior a 'to' (${query.to})`,
      );
    }

    const where: Prisma.OutboxEventWhereInput = {
      ...(query.status && { status: query.status }),
      ...(query.eventType && { eventType: query.eventType }),
      // `to` es inclusivo: antes de las 00:00 ART del día siguiente.
      ...((query.from || query.to) && {
        occurredAt: {
          ...(query.from && { gte: startOfDayArgentina(query.from) }),
          ...(query.to && { lt: new Date(startOfDayArgentina(query.to).getTime() + DAY_MS) }),
        },
      }),
    };

    const [rows, total] = await Promise.all([
      this.prisma.outboxEvent.findMany({
        where,
        select: SIN_PAYLOAD,
        orderBy: [{ occurredAt: 'desc' }, { id: 'asc' }],
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.outboxEvent.count({ where }),
    ]);

    return new PaginatedResponseDto(
      rows.map((r) => this.toResponseDto(r)),
      total,
      query.page,
      query.pageSize,
    );
  }

  async findOne(id: string): Promise<OutboxEventDetailResponseDto> {
    const event = await this.prisma.outboxEvent.findUnique({
      where: { id },
      include: { retries: { orderBy: { at: 'asc' } } },
    });
    if (!event) throw new NotFoundException(`Evento del outbox ${id} no encontrado`);

    return {
      ...this.toResponseDto(event),
      payload: event.payload as Record<string, unknown>,
      retries: event.retries.map((r) => this.toRetryDto(r)),
    };
  }

  /** FAILED → PENDING con attempts = 0; el dispatcher lo toma en la próxima barrida. */
  async retry(id: string, actorUserId: string): Promise<OutboxEventResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const event = await tx.outboxEvent.findUnique({ where: { id } });
      if (!event) throw new NotFoundException(`Evento del outbox ${id} no encontrado`);

      this.assertTransition(event.status, OutboxEventStatus.PENDING);

      if (!(await this.requeue(tx, event, actorUserId))) {
        // Otro pedido lo reencoló entre la lectura y el update.
        throw new ConflictException(`El evento ${id} ya no está en FAILED`);
      }
      return this.toResponseDto({
        ...event,
        status: OutboxEventStatus.PENDING,
        attempts: 0,
        lastError: null,
      });
    });
  }

  /**
   * Reencola los FAILED más viejos, hasta `dto.limit`; la confirmación la valida el DTO.
   * En lote y no fila por fila: una transacción interactiva con cientos de queries
   * revienta el timeout por defecto (P2028) contra una base remota.
   */
  async retryFailed(
    dto: RetryFailedOutboxDto,
    actorUserId: string,
  ): Promise<RetryFailedOutboxResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const failed = await tx.outboxEvent.findMany({
        where: { status: OutboxEventStatus.FAILED },
        orderBy: { occurredAt: 'asc' },
        take: dto.limit ?? MAX_RETRY_BATCH,
      });

      let requeued = 0;
      if (failed.length > 0) {
        // El status del where es el guard de la transición (FAILED → PENDING, ver
        // OUTBOX_TRANSITIONS). Si el count no coincide con lo leído, otro reintento
        // ganó alguna fila y no hay forma de saber cuál: se deshace todo antes que
        // auditar a nombre de este actor un reintento que hizo otro.
        const { count } = await tx.outboxEvent.updateMany({
          where: { id: { in: failed.map((e) => e.id) }, status: OutboxEventStatus.FAILED },
          data: { status: OutboxEventStatus.PENDING, attempts: 0, lastError: null },
        });
        if (count !== failed.length) {
          throw new ConflictException(
            'Otro reintento tocó eventos de esta tanda a la vez; repetí el pedido',
          );
        }
        await tx.outboxRetryAudit.createMany({
          data: failed.map((e) => ({
            outboxEventId: e.id,
            actorUserId,
            previousAttempts: e.attempts,
            previousError: e.lastError,
          })),
        });
        requeued = count;
      }

      const remainingFailed = await tx.outboxEvent.count({
        where: { status: OutboxEventStatus.FAILED },
      });
      return { requeued, remainingFailed };
    });
  }

  /**
   * El `status: FAILED` del where es el guard de la transición (la tabla ya se
   * chequeó antes): si otro pedido ganó la carrera no se pisa ni se audita dos
   * veces. El estado previo queda en la auditoría porque el reintento borra
   * `lastError` y `attempts`.
   */
  private async requeue(
    tx: Prisma.TransactionClient,
    event: Pick<OutboxEvent, 'id' | 'attempts' | 'lastError'>,
    actorUserId: string,
  ): Promise<boolean> {
    const { count } = await tx.outboxEvent.updateMany({
      where: { id: event.id, status: OutboxEventStatus.FAILED },
      data: { status: OutboxEventStatus.PENDING, attempts: 0, lastError: null },
    });
    if (count === 0) return false;

    await tx.outboxRetryAudit.create({
      data: {
        outboxEventId: event.id,
        actorUserId,
        previousAttempts: event.attempts,
        previousError: event.lastError,
      },
    });
    return true;
  }

  private assertTransition(from: OutboxEventStatus, to: OutboxEventStatus): void {
    const allowed = OUTBOX_TRANSITIONS[from] ?? [];
    if (!allowed.includes(to)) {
      throw new ConflictException(
        `Solo se puede reintentar un evento FAILED; este está en '${from}'`,
      );
    }
  }

  private toResponseDto(event: Omit<OutboxEvent, 'payload'>): OutboxEventResponseDto {
    return {
      id: event.id,
      eventType: event.eventType,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      status: event.status,
      attempts: event.attempts,
      lastError: event.lastError,
      occurredAt: event.occurredAt,
      publishedAt: event.publishedAt,
      correlationId: event.correlationId,
      causationId: event.causationId,
    };
  }

  private toRetryDto(r: OutboxRetryAudit): OutboxRetryAuditResponseDto {
    return {
      id: r.id,
      actorUserId: r.actorUserId,
      at: r.at,
      previousAttempts: r.previousAttempts,
      previousError: r.previousError,
    };
  }
}
