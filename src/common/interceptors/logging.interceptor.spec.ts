import { lastValueFrom, of } from 'rxjs';
import { CallHandler, ExecutionContext, Logger } from '@nestjs/common';
import { LoggingInterceptor } from './logging.interceptor';
import type { MockInstance } from 'vitest';

describe('LoggingInterceptor', () => {
  let logSpy: MockInstance;

  beforeEach(() => {
    logSpy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('deja pasar la respuesta y loguea método, url y status', async () => {
    const interceptor = new LoggingInterceptor();
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ method: 'GET', url: '/services' }),
        getResponse: () => ({ statusCode: 200 }),
      }),
    } as unknown as ExecutionContext;
    const next: CallHandler = { handle: () => of('resultado') };

    await expect(lastValueFrom(interceptor.intercept(context, next))).resolves.toBe('resultado');

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('GET /services → 200'));
  });

  it('el log no incluye el token de la query ni el header Authorization', async () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          url: '/zones?access_token=SECRETO123',
          headers: { authorization: 'Bearer SECRETO456' },
        }),
        getResponse: () => ({ statusCode: 200 }),
      }),
    } as unknown as ExecutionContext;
    await lastValueFrom(new LoggingInterceptor().intercept(context, { handle: () => of(1) }));
    const salida = JSON.stringify(logSpy.mock.calls);
    expect(salida).not.toContain('SECRETO');
    expect(salida).toContain('access_token=[REDACTED]');
  });
});
