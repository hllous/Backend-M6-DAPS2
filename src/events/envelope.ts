/**
 * El sobre común de la cohorte.
 *
 * Lo definió M2 en su contrato y es **el único envelope escrito que existe**:
 * M9 nunca publicó el suyo (ver docs/bloqueantes.md). Lo adoptamos tal cual en
 * vez de inventar uno propio, para que el día que el Core fije un estándar la
 * diferencia sea mínima.
 *
 * Actualizado a la **v1.6** (§4), que cambió tres cosas respecto de lo que
 * teníamos: `producer` pasó a ser un objeto, `eventVersion` desapareció de la
 * tabla y `specVersion` es la versión del contrato de integración —constante
 * `"1.0"`—, no la del documento de M2. Importa porque §13 fija
 * `additionalProperties: false`: un campo de más es rechazo, no se ignora.
 */
export interface EventEnvelope<T = unknown> {
  /** Versión del contrato/schema de integración. Constante `"1.0"` por §4. */
  specVersion: string;

  /** Identificador único de este mensaje. Es el id de la fila del outbox, lo que hace la publicación idempotente del lado del consumidor. */
  eventId: string;

  /** Nombre del evento en camelCase, ej. `urbanServiceScheduled`. */
  eventType: string;

  /** Cuándo ocurrió el hecho de dominio, no cuándo se publicó. */
  occurredAt: string;

  /** Módulo y servicio que emitió el evento. Objeto desde la v1.6 (§5.1). */
  producer: EventProducer;

  /**
   * El agregado sobre el que ocurrió.
   *
   * Para los eventos que consume M2 es obligatoriamente `tickets/{ticketId}`
   * (§4); para el resto es el id de nuestro agregado —el servicio, el
   * contenedor, el árbol—. Lo resuelve `subjectFor()` en el dispatcher.
   */
  subject: string;

  /** El payload propio del evento, el que valida contra su `.schema.json`. */
  data: T;
}

/**
 * El sobre tal como **llega** del bus, que no es el mismo que el que emitimos.
 *
 * Somos estrictos al publicar y tolerantes al consumir: cada módulo de la
 * cohorte asume un sobre distinto —M9 nunca publicó el suyo—, así que rechazar
 * un evento por la forma del `producer` sería tirar información de negocio por
 * un campo que ni miramos. `ingest()` solo usa `eventId`, `eventType` y `data`;
 * el resto se acepta como venga.
 */
export interface InboundEnvelope {
  eventId: string;
  eventType: string;
  data: Record<string, unknown>;

  specVersion?: string;
  /** Ya no existe en el sobre de la v1.6, pero puede seguir llegando. */
  eventVersion?: string;
  occurredAt?: string;
  /** String en los módulos que no adoptaron la v1.6, objeto en los que sí. */
  producer?: string | EventProducer;
  subject?: string;
}

/** §5.1 de la v1.6. Antes mandábamos el string `'M6'` suelto. */
export interface EventProducer {
  /** Identificador canónico del módulo en el namespace M1…M9. */
  moduleId: string;

  /** Nombre lógico del servicio que emitió el evento. */
  service: string;
}

/**
 * Versión del contrato de integración, no la del documento de M2.
 *
 * §4 la declara `const "1.0"`. Mandábamos `'1.5'` por confundir una cosa con la
 * otra: la guía va por la v1.6 y el `specVersion` sigue siendo `"1.0"`.
 */
export const SPEC_VERSION = '1.0';

export const PRODUCER: EventProducer = {
  moduleId: 'M6',
  service: 'urban-services-api',
};

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
    occurredAt: params.occurredAt.toISOString(),
    producer: PRODUCER,
    subject: params.subject,
    data: params.data,
  };
}
