import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

/** La trazabilidad que un evento publicado hereda del sobre que lo causó (#267). */
export interface EventTrace {
  correlationId: string;
  /** eventId del evento consumido. Null si nació de una acción directa en M6. */
  causationId: string | null;
}

/**
 * El hilo en curso, visible para el `OutboxService`: el del evento consumido
 * que está corriendo (`InboxService.ingest`) o el del request HTTP
 * (`EventTraceInterceptor`).
 *
 * Contexto y no parámetro: entre el handler y el `enqueue` hay servicios de
 * dominio que también se llaman desde endpoints, y pasar la traza por todos
 * ensuciaría firmas que no tienen nada que ver con eventos. El contexto
 * sobrevive a los `await`, incluido el callback de `prisma.$transaction`.
 */
export const eventContext = new AsyncLocalStorage<EventTrace>();

/** Un hilo que arranca en M6, sin evento que lo cause. */
export function nuevaTraza(): EventTrace {
  return { correlationId: randomUUID(), causationId: null };
}

/** Lo que lleva un evento que se encola ahora: el del contexto en curso, o uno nuevo. */
export function currentTrace(): EventTrace {
  return eventContext.getStore() ?? nuevaTraza();
}

/**
 * La forma 8-4-4-4-12 en hex, sin mirar versión ni variante. El Core valida con
 * `uuid.UUID` de Python (acepta v1/v7, el nulo, el máximo...) y lo entrega
 * siempre normalizado así (#296): lo que nos llega ya pasó por él.
 */
const UUID_FORMA = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const esUuidHeredable = (v: unknown): v is string =>
  typeof v === 'string' && UUID_FORMA.test(v);

/**
 * La traza que hereda lo que publique el handler de un evento consumido.
 *
 * Al **heredar** alcanza con la forma de UUID: si el Core lo entregó es que lo
 * aceptó, y exigir RFC estricto cortaría la correlación con un módulo cuyo
 * valor el Core sí admite. Lo que **generamos** nosotros sigue siendo v4. Lo
 * que no tiene la forma no rechaza el consumido (somos tolerantes al
 * consumir): el hilo arranca acá. Quien no migró al sobre del Core no manda
 * `correlationId`, así que su `eventId` abre el hilo para no cortarlo.
 */
export function trazaDelConsumido(eventId: string, correlationId?: string): EventTrace {
  const causa = esUuidHeredable(eventId) ? eventId : null;
  return {
    correlationId: (esUuidHeredable(correlationId) ? correlationId : causa) ?? randomUUID(),
    causationId: causa,
  };
}
