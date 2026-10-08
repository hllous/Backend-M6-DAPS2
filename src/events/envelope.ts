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

  /** Versión del contrato del evento (M9). `"1.0"` mientras ningún payload cambie de forma. */
  eventVersion: string;

  /**
   * Cuándo ocurrió el hecho de dominio, no cuándo se publicó. ISO 8601 con
   * offset; la `Z` de `toISOString()` cuenta. Con doble r: el `occuredAt` de la
   * tabla de M9 es un typo.
   */
  occurredAt: string;

  /** Módulo emisor. Tiene que coincidir con el del token de módulo del Core. */
  sourceModule: string;

  /** El hilo del flujo entre módulos: el del evento consumido que lo causó, o uno nuevo. */
  correlationId: string;
  /**
   * eventId del evento consumido que causó este. Se omite si nació de una
   * acción directa en M6: el Core lo acepta ausente o `null`, y omitirlo evita
   * mandar una clave vacía.
   */
  causationId?: string;

  /** El payload propio del evento, el que valida contra su `.schema.json`. */
  data: T;
}

/**
 * El sobre tal como **llega** del bus, que no es el mismo que el que emitimos.
 *
 * Somos estrictos al publicar y tolerantes al consumir: conviven el sobre del
 * Core y el de M2 mientras la cohorte migra, así que rechazar un evento por la
 * forma del `producer` sería tirar información de negocio por un campo que ni
 * miramos. `ingest()` usa `eventId`, `eventType`, `data` y, para la traza,
 * `correlationId` y `sourceModule`; el resto se acepta como venga.
 */
export interface InboundEnvelope {
  eventId: string;
  eventType: string;
  data: Record<string, unknown>;

  eventVersion?: string;
  occurredAt?: string;

  /** Sobre del Core. Opcionales: quien no migró todavía no los manda. */
  sourceModule?: string;
  correlationId?: string;
  /** El ejemplo de M9 lo manda `null` cuando no lo causó otro evento. */
  causationId?: string | null;

  /** Sobre de M2, reemplazado por el del Core: puede seguir llegando. */
  specVersion?: string;
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

export function buildEnvelope<T>(params: {
  eventId: string;
  eventType: string;
  occurredAt: Date;
  sourceModule: string;
  correlationId: string;
  causationId: string | null;
  data: T;
}): EventEnvelope<T> {
  return {
    eventId: params.eventId,
    eventType: params.eventType,
    eventVersion: '1.0',
    occurredAt: params.occurredAt.toISOString(),
    sourceModule: params.sourceModule,
    correlationId: params.correlationId,
    ...(params.causationId && { causationId: params.causationId }),
    data: params.data,
  };
}
