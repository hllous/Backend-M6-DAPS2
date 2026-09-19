import { lastValueFrom, of } from 'rxjs';
import { CallHandler, ExecutionContext, Logger } from '@nestjs/common';
import { LoggingInterceptor } from './logging.interceptor';

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
});
