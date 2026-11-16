import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { REQUEST_ID_HEADER } from '../middleware/request-id.middleware';

/**
 * Opciones de CORS de `main.ts`, aparte para poder probarlas (unitario y e2e).
 *
 * Sin `CORS_ORIGINS` se acepta cualquier origen, que es lo que hace falta en
 * desarrollo; en producción la validación de entorno no deja arrancar sin la
 * URL del frontend (#642). **Nunca** `credentials`: el JWT viaja en un header,
 * no en una cookie, y un comodín con credenciales sería la combinación peligrosa.
 *
 * `allowedHeaders` sin definir: se refleja lo que pide el preflight, así que
 * If-Match e Idempotency-Key ya pasan. ETag (ADR-012), Idempotency-Replayed
 * (ADR-013) y X-Request-Id (ADR-011) se exponen para que el frontend los lea.
 */
export function buildCorsOptions(corsOrigins?: string[]): CorsOptions {
  return {
    ...(corsOrigins?.length ? { origin: corsOrigins } : {}),
    credentials: false,
    exposedHeaders: ['ETag', 'Idempotency-Replayed', REQUEST_ID_HEADER],
  };
}
