import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { OutboxEvent, OutboxEventStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EventPublisher } from '../publishers/event-publisher.port';
import { buildEnvelope } from '../envelope';

/** Cuántas filas se toman por barrida. */
export const BATCH_SIZE = 50;

/**
 * Intentos antes de dar la fila por perdida.
 *
 * Al agotarse queda en FAILED y el barrido deja de tomarla, así una falla
 * permanente —un payload que el broker rechaza— no bloquea la cola detrás.
 */
export const MAX_ATTEMPTS = 5;

/**
 * El lado de lectura del outbox: barre las filas PENDING y las publica.
 *
 * ponytail: una sola instancia barriendo, sin lock. Render free tier corre un
 * único contenedor, así que no hay concurrencia real. Si algún día hay más de
 * una réplica hace falta un `SELECT ... FOR UPDATE SKIP LOCKED` o publicar
 * desde un solo worker, o dos instancias publican el mismo evento dos veces.
 */
@Injectable()
export class OutboxDispatcher {
  private readonly logger = new Logger(OutboxDispatcher.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: EventPublisher,
  ) {}

  @Interval(10_000)
  async dispatchPending(): Promise<void> {
    const pending = await this.prisma.outboxEvent.findMany({
      where: { status: OutboxEventStatus.PENDING },
      orderBy: { occurredAt: 'asc' },
      take: BATCH_SIZE,
    });

    if (pending.length === 0) return;

    for (const event of pending) {
      await this.dispatchOne(event);
    }
  }

  /** Expuesto para poder forzar una barrida desde un test o un endpoint interno. */
  async dispatchOne(event: OutboxEvent): Promise<void> {
    try {
      await this.publisher.publish(
        buildEnvelope({
          // El eventId ES el id de la fila: si el dispatcher publica dos veces
          // por un corte entre el send y el update, el consumidor lo deduplica.
          eventId: event.id,
          eventType: event.eventType,
          occurredAt: event.occurredAt,
          subject: event.aggregateId,
          data: event.payload,
        }),
      );

      await this.prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: OutboxEventStatus.SENT,
          publishedAt: new Date(),
          attempts: { increment: 1 },
          lastError: null,
        },
      });
    } catch (error) {
      const attempts = event.attempts + 1;
      const agotado = attempts >= MAX_ATTEMPTS;
      const message = error instanceof Error ? error.message : String(error);

      await this.prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          // Sigue PENDING mientras queden intentos: así el barrido lo reintenta
          // solo, sin necesidad de una cola de reintentos aparte.
          status: agotado ? OutboxEventStatus.FAILED : OutboxEventStatus.PENDING,
          attempts,
          lastError: message.slice(0, 500),
        },
      });

      this.logger[agotado ? 'error' : 'warn'](
        `${event.eventType} (${event.id}) falló en el intento ${attempts}/${MAX_ATTEMPTS}${
          agotado ? ' — se abandona, queda en FAILED' : ''
        }: ${message}`,
      );
    }
  }

  /** Para el health check y para poder ver la cola sin entrar a la base. */
  async stats(): Promise<Record<OutboxEventStatus, number>> {
    const rows = await this.prisma.outboxEvent.groupBy({
      by: ['status'],
      _count: { _all: true },
    });

    const base = {
      [OutboxEventStatus.PENDING]: 0,
      [OutboxEventStatus.SENT]: 0,
      [OutboxEventStatus.FAILED]: 0,
    };
    for (const row of rows) {
      base[row.status] = row._count._all;
    }
    return base;
  }
}

export type { Prisma };
