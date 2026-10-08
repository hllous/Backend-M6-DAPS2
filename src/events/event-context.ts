import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

/** La trazabilidad que un evento publicado hereda del sobre que lo causó (#267). */
export interface EventTrace {
  correlationId: string;
  /** eventId del evento consumido. Null si nació de una acción directa en M6. */
  causationId: string | null;
}

/**
 * El evento consumido que está corriendo, visible para el `OutboxService`.
 *
 * Contexto y no parámetro: entre el handler y el `enqueue` hay servicios de
 * dominio que también se llaman desde endpoints, y pasar la traza por todos
 * ensuciaría firmas que no tienen nada que ver con eventos. El contexto
 * sobrevive a los `await`, incluido el callback de `prisma.$transaction`.
 */
export const eventContext = new AsyncLocalStorage<EventTrace>();

/** Lo que lleva un evento que se encola ahora: el del handler en curso, o uno nuevo. */
export function currentTrace(): EventTrace {
  return eventContext.getStore() ?? { correlationId: randomUUID(), causationId: null };
}
