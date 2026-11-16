import { PreconditionFailedException } from '@nestjs/common';
import { Prisma, ServiceMode, ServiceOrigin, ServiceStatus as S } from '@prisma/client';
import { etagOf } from '../../common/etag';
import { PrismaService } from '../../prisma/prisma.service';
import { ServicesService } from './services.service';

/** If-Match (ADR-012) en las transiciones de servicio. */
describe('ServicesService — If-Match', () => {
  const ID = '11111111-1111-1111-1111-111111111111';
  const ACTOR = { userId: '4242', roles: [] };
  const updatedAt = new Date('2026-08-02T10:00:00.000Z');
  const vigente = etagOf(updatedAt);

  let prisma: any;
  let outbox: any;
  let audit: any;
  let service: ServicesService;

  const row = (status: S) => ({
    id: ID,
    serviceTypeId: 'st-1',
    mode: ServiceMode.POINT,
    status,
    origin: ServiceOrigin.PLANNED,
    crewId: 'crew-1',
    vehicleId: null,
    ticketId: null,
    targetType: 'ZONE',
    targetId: null,
    scheduledDate: new Date('2099-01-01T00:00:00.000Z'),
    windowFrom: null,
    windowTo: null,
    zones: [{ zoneId: 'z1', sequence: 1 }],
    zoneResults: [{ zoneId: 'z1', status: 'SERVICED' }],
    collectionRecords: [],
    updatedAt,
  });

  beforeEach(() => {
    prisma = {
      service: {
        findUnique: vi.fn().mockResolvedValue(row(S.IN_PROGRESS)),
        update: vi.fn().mockResolvedValue(row(S.SUSPENDED)),
      },
      crew: { count: vi.fn().mockResolvedValue(1) },
      $transaction: vi.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    outbox = { enqueue: vi.fn(), enqueueMany: vi.fn() };
    audit = { record: vi.fn() };
    service = new ServicesService(
      prisma as unknown as PrismaService,
      outbox,
      {} as never,
      audit as never,
    );
  });

  it('con un ETag viejo da 412 y no escribe nada', async () => {
    await expect(service.suspend(ID, ACTOR, 'lluvia', undefined, 'W/"1"')).rejects.toBeInstanceOf(
      PreconditionFailedException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(outbox.enqueueMany).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('con el vigente condiciona el UPDATE por updatedAt', async () => {
    await service.suspend(ID, ACTOR, 'lluvia', undefined, vigente);
    expect(prisma.service.update.mock.calls[0][0].where).toEqual({
      id: ID,
      status: S.IN_PROGRESS,
      updatedAt,
    });
  });

  it('sin If-Match el where es el de siempre', async () => {
    await service.suspend(ID, ACTOR, 'lluvia');
    expect(prisma.service.update.mock.calls[0][0].where).toEqual({
      id: ID,
      status: S.IN_PROGRESS,
    });
  });

  it('P2025 con If-Match da 412', async () => {
    prisma.service.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('x', { code: 'P2025', clientVersion: '5' }),
    );
    await expect(service.suspend(ID, ACTOR, 'lluvia', undefined, vigente)).rejects.toBeInstanceOf(
      PreconditionFailedException,
    );
  });

  describe('update (PATCH de edición)', () => {
    beforeEach(() => {
      prisma.service.findUnique.mockResolvedValue(row(S.SCHEDULED));
    });

    it('con un ETag viejo da 412 y no escribe', async () => {
      await expect(service.update(ID, { notes: 'x' }, ACTOR, 'W/"1"')).rejects.toBeInstanceOf(
        PreconditionFailedException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('con el vigente condiciona el UPDATE por updatedAt', async () => {
      await service.update(ID, { notes: 'x' }, ACTOR, vigente);
      expect(prisma.service.update.mock.calls[0][0].where).toEqual({ id: ID, updatedAt });
    });

    it('sin If-Match el where es solo el id; P2025 con If-Match da 412', async () => {
      await service.update(ID, { notes: 'x' }, ACTOR);
      expect(prisma.service.update.mock.calls[0][0].where).toEqual({ id: ID });

      prisma.service.update.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('x', { code: 'P2025', clientVersion: '5' }),
      );
      await expect(service.update(ID, { notes: 'x' }, ACTOR, vigente)).rejects.toBeInstanceOf(
        PreconditionFailedException,
      );
    });
  });
});
