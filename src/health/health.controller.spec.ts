import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';
import { BusStatus } from '../events/bus-status';
import { PrismaService } from '../prisma/prisma.service';

describe('HealthController', () => {
  const queryRaw = vi.fn();
  const bus = new BusStatus();
  const controller = new HealthController({ $queryRaw: queryRaw } as unknown as PrismaService, bus);

  beforeEach(() => {
    queryRaw.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it('liveness devuelve ok sin tocar la base', () => {
    const result = controller.check();
    expect(result.status).toBe('ok');
    expect(result.service).toBe('m6-ambiente-backend');
    expect(typeof result.timestamp).toBe('string');
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('ready devuelve 200 con la base arriba', async () => {
    vi.useFakeTimers();
    queryRaw.mockResolvedValue([{ ok: 1 }]);
    const result = await controller.ready();
    expect(result).toMatchObject({ status: 'ok', database: 'up', broker: 'disabled' });
    // El timeout de la carrera se limpia: si no, queda un timer vivo 3 s.
    expect(vi.getTimerCount()).toBe(0);
  });

  it('un broker caído no tumba ready: solo se informa', async () => {
    queryRaw.mockResolvedValue([{ ok: 1 }]);
    bus.state = 'reconnecting';
    await expect(controller.ready()).resolves.toMatchObject({
      database: 'up',
      broker: 'reconnecting',
    });
    bus.state = 'disabled';
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
    vi.useFakeTimers();
    queryRaw.mockReturnValue(new Promise(() => undefined));
    const pending = controller.ready().catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(3000);
    expect(await pending).toBeInstanceOf(ServiceUnavailableException);
  });
});
