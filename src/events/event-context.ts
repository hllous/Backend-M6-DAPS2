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
 * RFC 9562: versión 1-8 y variante `10xx`. Deja afuera el UUID nulo y el
 * máximo, que `esUuid` y el `@IsUUID()` del sobre aceptan.
 */
const UUID_RFC = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const esUuidRfc = (v: unknown): v is string => typeof v === 'string' && UUID_RFC.test(v);

/**
 * La traza que hereda lo que publique el handler de un evento consumido.
 *
 * Solo se propaga un UUID RFC estricto: lo reenviamos en nuestro sobre, y si el
 * Core lo valida según la RFC rechazaría el evento derivado sin que nos
 * enteremos. Lo que no pasa no rechaza el consumido (somos tolerantes al
 * consumir): el hilo arranca acá. Quien no migró al sobre del Core no manda
 * `correlationId`, así que su `eventId` abre el hilo para no cortarlo.
 */
export function trazaDelConsumido(eventId: string, correlationId?: string): EventTrace {
  const causa = esUuidRfc(eventId) ? eventId : null;
  return {
    correlationId: (esUuidRfc(correlationId) ? correlationId : causa) ?? randomUUID(),
    causationId: causa,
  };
}
