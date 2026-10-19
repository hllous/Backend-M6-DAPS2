import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { eventContext, nuevaTraza } from './event-context';

/**
 * Un hilo por request HTTP (#267): todo lo que encole una misma acción
 * directa —el acta hacia M4 y su `updateTicketStatus` hacia M2, aunque salgan
 * de `enqueue` distintos— comparte `correlationId`. `POST /events/inbox` abre
 * su propio contexto en `ingest()`, que pisa a este.
 *
 * Interceptor y no middleware de Express: `app.use()` corre antes que el
 * body-parser de Nest, y que el contexto llegue al handler dependería de cómo
 * Node propaga el contexto por los eventos del stream del body (en Node 22 llega,
 * pero es un detalle del runtime). Acá el body ya está leído.
 *
 * `handle()` y `subscribe` van dentro del `run` para que el handler corra en el
 * contexto sin depender de cómo Nest difiere la cadena.
 */
@Injectable()
export class EventTraceInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return new Observable((subscriber) =>
      eventContext.run(nuevaTraza(), () => next.handle().subscribe(subscriber)),
    );
  }
}
