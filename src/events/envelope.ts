/**
 * El sobre del Core (M9), el que exige `muni.inbox`.
 *
 * Reemplaza al de M2 (`specVersion`, `producer`, `subject`), que adoptamos
 * mientras M9 no tenía uno escrito. Importa la forma exacta porque el Core
 * rechaza campos extra: un campo de más es rechazo, no se ignora.
 */
export interface EventEnvelope<T = unknown> {
  /** Identificador único de este mensaje. Es el id de la fila del outbox, lo que hace la publicación idempotente del lado del consumidor. */
  eventId: string;

  /** Nombre del evento en camelCase, ej. `urbanServiceScheduled`. */
  eventType: string;

  /** Versión del sobre. Constante `"1.0"`. */
  eventVersion: string;

  /**
   * Cuándo ocurrió el hecho de dominio, no cuándo se publicó. ISO 8601 con
   * offset; la `Z` de `toISOString()` cuenta. Con doble r: el `occuredAt` de la
   * tabla de M9 es un typo.
   */
  occurredAt: string;

  /** Módulo emisor. Tiene que coincidir con el del token de módulo del Core. */
  sourceModule: string;

  // Opcionales en el Core; por ahora no se mandan (#267).
  correlationId?: string;
  causationId?: string;

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
 * Ya no viaja en el sobre (#260). Queda solo porque `TicketsConsumer` lo usa
 * para reconocer nuestros tickets por el `responsibleAreaId` de M2.
 */
export const PRODUCER: EventProducer = {
  moduleId: 'M6',
  service: 'urban-services-api',
};

export function buildEnvelope<T>(params: {
  eventId: string;
  eventType: string;
  occurredAt: Date;
  sourceModule: string;
  data: T;
}): EventEnvelope<T> {
  return {
    eventId: params.eventId,
    eventType: params.eventType,
    eventVersion: '1.0',
    occurredAt: params.occurredAt.toISOString(),
    sourceModule: params.sourceModule,
    data: params.data,
  };
}
