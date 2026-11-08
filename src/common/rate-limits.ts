/**
 * Límites de tasa más estrictos que el global (`THROTTLE_LIMIT`), por IP y por endpoint (#568).
 *
 * `POST /events/inbox` es la inyección manual de eventos (M6_ADMIN, herramienta de operación
 * y de prueba): el Core (M9) entrega por AMQP al exchange `muni.inbox`, no por este endpoint.
 * 300/min frena un script o un bucle descontrolado sin molestar a una demo con ráfagas.
 * `POST /evidence` sube archivos de hasta MAX_EVIDENCE_SIZE_BYTES a memoria: 30/min por
 * dirección alcanza a una cuadrilla cargando fotos y acota el costo de un abuso.
 */
export const INBOX_INGEST = { ttl: 60_000, limit: 300 } as const;

export const EVIDENCE_UPLOAD = { ttl: 60_000, limit: 30 } as const;
