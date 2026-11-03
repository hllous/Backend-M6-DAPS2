import { timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';

export const BFF_KEY_HEADER = 'x-m6-bff-key';

type PedidoConHeaders = {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
};

/**
 * Clave del contador de `@nestjs/throttler`.
 *
 * El BFF del frontend llama desde un servidor, así que `req.ip` es siempre el
 * suyo y todos los vecinos compartirían balde (#470). El BFF reenvía la IP del
 * vecino en `X-Forwarded-For`, pero confiar en ese header de cualquiera deja a
 * quien llame directo mandar una IP distinta por pedido y saltearse el límite.
 * Por eso solo se lo cree si el pedido trae `X-M6-BFF-Key` igual al secreto
 * compartido, y solo si esa primera entrada es una IP válida (acota la
 * cardinalidad de contadores). Sin secreto configurado, con uno ausente o
 * distinto, o con una entrada que no es IP, vale `req.ip` (con `trust proxy` =
 * 1 es la IP que ve Render). El BFF debe SOBRESCRIBIR el header con la IP que
 * le da Vercel: si reenviara el del navegador, la primera entrada sería del vecino.
 */
export function crearGetTracker(bffKey: string | undefined) {
  const esperada = bffKey ? Buffer.from(bffKey) : undefined;

  return (req: Record<string, unknown>): Promise<string> => {
    const { ip, headers } = req as PedidoConHeaders;
    const recibida = headers[BFF_KEY_HEADER];
    if (esperada && typeof recibida === 'string') {
      const buf = Buffer.from(recibida);
      // timingSafeEqual lanza con largos distintos: se descarta antes. El largo
      // de la clave no es secreto que valga proteger.
      if (buf.length === esperada.length && timingSafeEqual(buf, esperada)) {
        const xff = headers['x-forwarded-for'];
        const primera = (typeof xff === 'string' ? xff : '').split(',')[0].trim();
        if (isIP(primera)) return Promise.resolve(primera);
      }
    }
    return Promise.resolve(ip ?? '');
  };
}
