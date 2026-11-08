import { lastValueFrom, of } from 'rxjs';
import { CallHandler, ExecutionContext, Logger } from '@nestjs/common';
import { LoggingInterceptor, redactUrl } from './logging.interceptor';

describe('LoggingInterceptor', () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
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

  it('redacta token y similares y respeta el resto de la query', () => {
    expect(redactUrl('/x?search=a&token=abc.def&Access_Token=z&page=2&k=%E0%A4')).toBe(
      '/x?search=a&token=[REDACTED]&Access_Token=[REDACTED]&page=2&k=%E0%A4',
    );
    expect(redactUrl('/services')).toBe('/services');
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
