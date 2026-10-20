import { Logger } from '@nestjs/common';
import { ServiceStatus, StreetClosureRequestStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CLOSURE_EXPIRY_GRACE_MS,
  StreetClosureExpirySweeper,
} from './street-closure-expiry.sweeper';

describe('StreetClosureExpirySweeper', () => {
  let prisma: any;
  let sweeper: StreetClosureExpirySweeper;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    prisma = {
      streetClosureRequest: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      service: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    sweeper = new StreetClosureExpirySweeper(prisma as unknown as PrismaService);
  });

  afterEach(() => jest.restoreAllMocks());

  it('la gracia es de 6 horas', () => {
    expect(CLOSURE_EXPIRY_GRACE_MS).toBe(6 * 60 * 60 * 1000);
  });

  it('busca solo APPROVED con approvedTo + gracia vencido (sin approvedTo no entra)', async () => {
    const now = new Date('2026-10-20T12:00:00Z');
    await sweeper.expireClosures(now);

    const [[args]] = prisma.streetClosureRequest.findMany.mock.calls;
    expect(args.where).toEqual({
      status: StreetClosureRequestStatus.APPROVED,
      approvedTo: { lt: new Date(now.getTime() - CLOSURE_EXPIRY_GRACE_MS) },
    });
  });

  it('vence el corte y reprograma el servicio no iniciado, en la misma transaccion', async () => {
    prisma.streetClosureRequest.findMany.mockResolvedValue([
      { id: 'c1', sourceType: 'SERVICE', sourceId: 's1' },
    ]);

    await sweeper.expireClosures();

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const [[upd]] = prisma.streetClosureRequest.updateMany.mock.calls;
    expect(upd.where).toMatchObject({ id: 'c1', status: StreetClosureRequestStatus.APPROVED });
    expect(upd.where.approvedTo.lt).toBeInstanceOf(Date);
    expect(upd.data).toEqual({ status: StreetClosureRequestStatus.EXPIRED });

    const [[svc]] = prisma.service.updateMany.mock.calls;
    expect(svc.where).toEqual({ id: 's1', status: ServiceStatus.SCHEDULED });
    expect(svc.data.status).toBe(ServiceStatus.RESCHEDULED);
    expect(svc.data.statusReason).toBe('venció la ventana autorizada del corte');
  });

  it('si el corte ya no esta APPROVED (carrera con Ended) no toca el servicio', async () => {
    prisma.streetClosureRequest.findMany.mockResolvedValue([
      { id: 'c1', sourceType: 'SERVICE', sourceId: 's1' },
    ]);
    prisma.streetClosureRequest.updateMany.mockResolvedValue({ count: 0 });

    await sweeper.expireClosures();

    expect(prisma.service.updateMany).not.toHaveBeenCalled();
  });

  it('un corte de arbolado se vence sin tocar ningun servicio', async () => {
    prisma.streetClosureRequest.findMany.mockResolvedValue([
      { id: 'c2', sourceType: 'TREE_INTERVENTION', sourceId: 't1' },
    ]);

    await sweeper.expireClosures();

    expect(prisma.streetClosureRequest.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.service.updateMany).not.toHaveBeenCalled();
  });

  it('si la transaccion de un corte falla, los demas se procesan y no lanza', async () => {
    prisma.streetClosureRequest.findMany.mockResolvedValue(
      ['c1', 'c2', 'c3'].map((id) => ({ id, sourceType: 'TREE_INTERVENTION', sourceId: id })),
    );
    let n = 0;
    prisma.$transaction.mockImplementation((cb: (tx: unknown) => unknown) =>
      ++n === 2 ? Promise.reject(new Error('boom')) : cb(prisma),
    );
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    await expect(sweeper.expireClosures()).resolves.toBeUndefined();

    const ids = prisma.streetClosureRequest.updateMany.mock.calls.map(([a]: any) => a.where.id);
    expect(ids).toEqual(['c1', 'c3']);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('c2'));
  });

  it('onModuleInit barre al arrancar y no propaga el error', async () => {
    prisma.streetClosureRequest.findMany.mockRejectedValue(new Error('db caida'));
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    await expect(sweeper.onModuleInit()).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('db caida'));
  });
});
