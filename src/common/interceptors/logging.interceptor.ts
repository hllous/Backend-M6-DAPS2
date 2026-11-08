import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { redactUrl } from '../utils/redact-url';

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
