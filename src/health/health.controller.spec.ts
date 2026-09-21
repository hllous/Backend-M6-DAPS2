import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaService } from '../prisma/prisma.service';

describe('HealthController', () => {
  const queryRaw = jest.fn();
  const controller = new HealthController({ $queryRaw: queryRaw } as unknown as PrismaService);

  beforeEach(() => queryRaw.mockReset());
  afterEach(() => jest.useRealTimers());

  it('liveness devuelve ok sin tocar la base', () => {
    const result = controller.check();
    expect(result.status).toBe('ok');
    expect(result.service).toBe('m6-ambiente-backend');
    expect(typeof result.timestamp).toBe('string');
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('ready devuelve 200 con la base arriba', async () => {
    jest.useFakeTimers();
    queryRaw.mockResolvedValue([{ ok: 1 }]);
    const result = await controller.ready();
    expect(result).toMatchObject({ status: 'ok', database: 'up' });
    // El timeout de la carrera se limpia: si no, queda un timer vivo 3 s.
    expect(jest.getTimerCount()).toBe(0);
  });

  it('ready responde 503 sin filtrar el error de la base', async () => {
    queryRaw.mockRejectedValue(new Error('password authentication failed for user "secret"'));
    const err = await controller.ready().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ServiceUnavailableException);
    expect((err as ServiceUnavailableException).message).toBe('Base de datos no disponible');
    expect(JSON.stringify((err as ServiceUnavailableException).getResponse())).not.toContain(
      'secret',
    );
  });

  it('ready responde 503 si la base no contesta a tiempo', async () => {
    jest.useFakeTimers();
    queryRaw.mockReturnValue(new Promise(() => undefined));
    const pending = controller.ready().catch((e: unknown) => e);
    await jest.advanceTimersByTimeAsync(3000);
    expect(await pending).toBeInstanceOf(ServiceUnavailableException);
  });
});
