/**
 * Límites de tasa más estrictos que el global (`THROTTLE_LIMIT`), por IP y por endpoint (#568).
 *
 * `POST /events/inbox` lo llama el Core (M9) desde una sola IP, así que el tope tiene que
 * tolerar ráfagas de reintentos: 300/min frena un bucle descontrolado, no una entrega normal.
 * `POST /evidence` sube archivos de hasta MAX_EVIDENCE_SIZE_BYTES a memoria: 30/min por
 * dirección alcanza a una cuadrilla cargando fotos y acota el costo de un abuso.
 */
export const INBOX_INGEST = { ttl: 60_000, limit: 300 } as const;

export const EVIDENCE_UPLOAD = { ttl: 60_000, limit: 30 } as const;
