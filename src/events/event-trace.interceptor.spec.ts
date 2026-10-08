import { CallHandler, ExecutionContext } from '@nestjs/common';
import { defer, firstValueFrom, lastValueFrom } from 'rxjs';
import { currentTrace, eventContext, EventTrace } from './event-context';
import { EventTraceInterceptor } from './event-trace.interceptor';

describe('EventTraceInterceptor', () => {
  const interceptor = new EventTraceInterceptor();
  const ctx = {} as ExecutionContext;

  /** Un handler como el de Nest: corre al suscribirse y cruza `await` antes de encolar. */
  const handler = (fn: () => Promise<unknown>): CallHandler => ({ handle: () => defer(fn) });

  const pausa = () => new Promise((r) => setImmediate(r));

  it('todo lo que encola un request comparte el hilo y no tiene causa', async () => {
    const vistas = await firstValueFrom(
      interceptor.intercept(
        ctx,
        handler(async () => {
          const primera = currentTrace();
          await pausa();
          return [primera, currentTrace()];
        }),
      ),
    );
    const [primera, segunda] = vistas as EventTrace[];

    expect(primera.causationId).toBeNull();
    expect(segunda).toBe(primera);
  });

  it('cada request abre su propio hilo, aunque corran intercalados', async () => {
    const correr = () =>
      lastValueFrom(
        interceptor.intercept(
          ctx,
          handler(async () => {
            await pausa();
            return currentTrace().correlationId;
          }),
        ),
      );

    const [a, b] = await Promise.all([correr(), correr()]);

    expect(a).not.toBe(b);
  });

  /** `POST /events/inbox`: `ingest()` abre su contexto adentro del request y gana. */
  it('un contexto abierto adentro (el de ingest) pisa al del request', async () => {
    const delConsumido = { correlationId: 'corr-consumido', causationId: 'evt-consumido' };

    const vista = await firstValueFrom(
      interceptor.intercept(
        ctx,
        handler(() => eventContext.run(delConsumido, async () => currentTrace())),
      ),
    );

    expect(vista).toBe(delConsumido);
  });

  it('propaga el error del handler', async () => {
    const res = interceptor.intercept(
      ctx,
      handler(() => Promise.reject(new Error('falló'))),
    );

    await expect(firstValueFrom(res)).rejects.toThrow('falló');
  });
});
