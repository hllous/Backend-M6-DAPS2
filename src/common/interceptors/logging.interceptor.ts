import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable, tap } from 'rxjs';

// Parámetros cuyo valor no debe quedar en los logs (ni en los del proxy que los copie).
const SENSITIVE_PARAM =
  /^(token|access_token|refresh_token|id_token|authorization|api_?key|key|secret|password)$/i;

/** Reemplaza el valor de los parámetros sensibles de la query; el resto de la URL queda igual. */
export function redactUrl(url: string): string {
  const i = url.indexOf('?');
  if (i === -1) return url;
  const query = url
    .slice(i + 1)
    .split('&')
    .map((pair) => {
      const name = pair.split('=')[0];
      // Un nombre con % mal formado no debe tirar el request: se compara tal cual.
      let decoded = name;
      try {
        decoded = decodeURIComponent(name);
      } catch {
        // se usa el nombre crudo
      }
      return SENSITIVE_PARAM.test(decoded) ? `${name}=[REDACTED]` : pair;
    })
    .join('&');
  return `${url.slice(0, i)}?${query}`;
}

/**
 * Interceptor global que loguea el tiempo de respuesta de cada request.
 * Formato: METHOD /path → STATUS (Xms). Nunca loguea headers; la query pasa por redactUrl.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const { method, url } = req;
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const res = context.switchToHttp().getResponse();
        const elapsed = Date.now() - start;
        this.logger.log(`${method} ${redactUrl(url)} → ${res.statusCode} (${elapsed}ms)`);
      }),
    );
  }
}
