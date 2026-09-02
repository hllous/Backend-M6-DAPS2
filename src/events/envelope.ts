/**
 * El sobre común de la cohorte.
 *
 * Lo definió M2 en su contrato v1.5 y es **el único envelope escrito que
 * existe**: M9 nunca publicó el suyo (ver docs/bloqueantes.md). Lo adoptamos
 * tal cual en vez de inventar uno propio, para que el día que el Core fije un
 * estándar la diferencia sea mínima.
 */
export interface EventEnvelope<T = unknown> {
  /** Versión del sobre, no del evento. */
  specVersion: string;

  /** Identificador único de este mensaje. Es el id de la fila del outbox, lo que hace la publicación idempotente del lado del consumidor. */
  eventId: string;

  /** Nombre del evento en camelCase, ej. `urbanServiceScheduled`. */
  eventType: string;

  /** Versión del payload de ese evento. */
  eventVersion: string;

  /** Cuándo ocurrió el hecho de dominio, no cuándo se publicó. */
  occurredAt: string;

  /** Siempre `M6`. */
  producer: string;

  /** El agregado sobre el que ocurrió: id del servicio, del contenedor, del árbol. */
  subject: string;

  /** El payload propio del evento, el que valida contra su `.schema.json`. */
  data: T;
}

export const SPEC_VERSION = '1.5';
export const EVENT_VERSION = '1.0';
export const PRODUCER = 'M6';

export function buildEnvelope<T>(params: {
  eventId: string;
  eventType: string;
  occurredAt: Date;
  subject: string;
  data: T;
}): EventEnvelope<T> {
  return {
    specVersion: SPEC_VERSION,
    eventId: params.eventId,
    eventType: params.eventType,
    eventVersion: EVENT_VERSION,
    occurredAt: params.occurredAt.toISOString(),
    producer: PRODUCER,
    subject: params.subject,
    data: params.data,
  };
}
