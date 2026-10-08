import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AggregateTypeName, EventTypeName } from '../event-types';
import { currentTrace, EventTrace } from '../event-context';

/** Lo que el dominio encola. El sobre lo arma el dispatcher al publicar. */
export interface OutboxEntry {
  eventType: EventTypeName;
  aggregateType: AggregateTypeName;
  aggregateId: string;
  /** El objeto del payload. Se castea a InputJsonObject al escribir. */
  payload: Record<string, unknown>;
  /** Cuándo ocurrió el hecho. Por defecto, ahora. */
  occurredAt?: Date;
}

/**
 * El lado de escritura del patrón outbox.
 *
 * `enqueue` **exige el cliente de transacción**, no lo toma del servicio: la
 * fila del outbox y la escritura de dominio tienen que caer juntas o no caer.
 * Si se publicara desde fuera de la transacción habría dos fallas posibles —
 * evento sin cambio, y cambio sin evento— y las dos son peores que fallar.
 *
 * No publica nada: solo deja la fila en PENDING. Publicar es trabajo del
 * dispatcher, y ese desacople es lo que permite que el dominio no dependa de
 * que haya un broker arriba.
 *
 * `correlationId` y `causationId` no los pasa el dominio: salen del handler de
 * inbox en curso (`eventContext`). Fuera de un handler —un endpoint, un
 * barrido— el evento abre un hilo nuevo y no tiene causa.
 */
@Injectable()
export class OutboxService {
  /**
   * @param tx cliente de la transacción en curso — `this.prisma.$transaction(async (tx) => ...)`
   */
  async enqueue(tx: Prisma.TransactionClient, entry: OutboxEntry): Promise<void> {
    await tx.outboxEvent.create({ data: this.fila(entry, currentTrace()) });
  }

  /** Varios eventos del mismo cambio de dominio, en una sola escritura. */
  async enqueueMany(tx: Prisma.TransactionClient, entries: OutboxEntry[]): Promise<void> {
    if (entries.length === 0) return;

    // Una sola traza para todo el lote: es un mismo cambio de dominio, así que
    // fuera de un handler también comparten hilo.
    const trace = currentTrace();
    await tx.outboxEvent.createMany({ data: entries.map((entry) => this.fila(entry, trace)) });
  }

  private fila(entry: OutboxEntry, trace: EventTrace): Prisma.OutboxEventCreateManyInput {
    return {
      eventType: entry.eventType,
      aggregateType: entry.aggregateType,
      aggregateId: entry.aggregateId,
      payload: entry.payload as Prisma.InputJsonObject,
      occurredAt: entry.occurredAt ?? new Date(),
      correlationId: trace.correlationId,
      causationId: trace.causationId,
    };
  }
}
