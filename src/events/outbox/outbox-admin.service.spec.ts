import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { OutboxEventStatus } from '@prisma/client';
import { OutboxAdminService } from './outbox-admin.service';
import { QueryOutboxDto, RetryFailedOutboxDto } from './dto';
import { ACTOR as LECTOR } from '../../common/audit/audit-test-actor';

const ID = '11111111-1111-4111-8111-111111111111';
const ACTOR = 'usr-admin';

const fila = (over: Record<string, unknown> = {}) => ({
  id: ID,
  eventType: 'containerDamaged',
  aggregateType: 'CONTAINER',
  aggregateId: '22222222-2222-4222-8222-222222222222',
  payload: { containerId: 'c-1' },
  status: OutboxEventStatus.FAILED,
  attempts: 5,
  lastError: 'ECONNREFUSED',
  occurredAt: new Date('2026-10-28T12:00:00.000Z'),
  publishedAt: null,
  correlationId: '33333333-3333-4333-8333-333333333333',
  causationId: null,
  ...over,
});

const query = (over: Partial<QueryOutboxDto> = {}): QueryOutboxDto =>
  Object.assign(new QueryOutboxDto(), over);

describe('OutboxAdminService', () => {
  let prisma: any;
  let service: OutboxAdminService;
  let audit: { recordRead: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    prisma = {
      outboxEvent: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn(),
        count: vi.fn().mockResolvedValue(0),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      outboxRetryAudit: { create: vi.fn(), createMany: vi.fn() },
      $transaction: vi.fn((fn) => fn(prisma)),
    };
    audit = { recordRead: vi.fn().mockResolvedValue(undefined) };
    service = new OutboxAdminService(prisma, audit as never);
  });

  describe('findAll', () => {
    it('pagina, filtra y no pide el payload', async () => {
      // Aunque la fila trajera payload, el DTO de listado no lo copia.
      prisma.outboxEvent.findMany.mockResolvedValue([fila()]);
      prisma.outboxEvent.count.mockResolvedValue(41);

      const res = await service.findAll(
        query({ status: OutboxEventStatus.FAILED, eventType: 'containerDamaged', page: 2 }),
      );

      const args = prisma.outboxEvent.findMany.mock.calls[0][0];
      expect(args.where).toEqual({ status: 'FAILED', eventType: 'containerDamaged' });
      expect(args.select.payload).toBeUndefined();
      expect(args.skip).toBe(20);
      expect(res.meta).toMatchObject({ total: 41, page: 2, pageSize: 20, totalPages: 3 });
      expect(res.data[0]).not.toHaveProperty('payload');
      expect(res.data[0]).toMatchObject({ id: ID, attempts: 5, lastError: 'ECONNREFUSED' });
    });

    it('from/to son días argentinos inclusivos', async () => {
      await service.findAll(query({ from: '2026-10-01', to: '2026-10-31' }));

      const { occurredAt } = prisma.outboxEvent.findMany.mock.calls[0][0].where;
      expect(occurredAt.gte).toEqual(new Date('2026-10-01T03:00:00.000Z'));
      expect(occurredAt.lt).toEqual(new Date('2026-11-01T03:00:00.000Z'));
    });

    it('acepta from o to solos', async () => {
      await service.findAll(query({ from: '2026-10-01' }));
      await service.findAll(query({ to: '2026-10-01' }));

      const [soloFrom, soloTo] = prisma.outboxEvent.findMany.mock.calls.map(
        (c: any[]) => c[0].where.occurredAt,
      );
      expect(soloFrom).toEqual({ gte: new Date('2026-10-01T03:00:00.000Z') });
      expect(soloTo).toEqual({ lt: new Date('2026-10-02T03:00:00.000Z') });
    });

    it('rechaza from posterior a to con 400', async () => {
      await expect(
        service.findAll(query({ from: '2026-10-31', to: '2026-10-01' })),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.outboxEvent.findMany).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('devuelve el payload y los reintentos', async () => {
      const at = new Date('2026-10-28T13:00:00.000Z');
      prisma.outboxEvent.findUnique.mockResolvedValue({
        ...fila(),
        retries: [
          {
            id: 'r1',
            outboxEventId: ID,
            actorUserId: ACTOR,
            at,
            previousAttempts: 5,
            previousError: 'x',
          },
        ],
      });

      const res = await service.findOne(ID, LECTOR);

      expect(res.payload).toEqual({ containerId: 'c-1' });
      // containerDamaged no trae datos Tier 2.
      expect(audit.recordRead).not.toHaveBeenCalled();
      expect(res.retries).toEqual([
        { id: 'r1', actorUserId: ACTOR, at, previousAttempts: 5, previousError: 'x' },
      ]);
    });

    it('404 si no existe', async () => {
      prisma.outboxEvent.findUnique.mockResolvedValue(null);
      await expect(service.findOne(ID, LECTOR)).rejects.toThrow(NotFoundException);
      expect(audit.recordRead).not.toHaveBeenCalled();
    });

    const acta = (payload: Record<string, unknown>) => ({
      ...fila({
        eventType: 'environmentalViolationDetected',
        aggregateType: 'VIOLATION_NOTICE',
        payload,
      }),
      retries: [],
    });

    it('environmentalViolationDetected audita la lectura sobre el acta del payload (#643)', async () => {
      prisma.outboxEvent.findUnique.mockResolvedValue(acta({ violationId: 'vn-1' }));

      const res = await service.findOne(ID, LECTOR);

      expect(res.payload).toEqual({ violationId: 'vn-1' });
      expect(audit.recordRead).toHaveBeenCalledWith(
        [{ entityType: 'VIOLATION_NOTICE', entityId: 'vn-1' }],
        LECTOR,
      );
    });

    it('sin violationId en el payload cae en el aggregateId (el mismo id del acta)', async () => {
      prisma.outboxEvent.findUnique.mockResolvedValue(acta({}));
      await service.findOne(ID, LECTOR);
      expect(audit.recordRead).toHaveBeenCalledWith(
        [{ entityType: 'VIOLATION_NOTICE', entityId: '22222222-2222-4222-8222-222222222222' }],
        LECTOR,
      );
    });

    it.each([null, ['vn-1']])(
      'con payload que no es objeto (%j) no explota y cae en el aggregateId',
      async (payload) => {
        prisma.outboxEvent.findUnique.mockResolvedValue({
          ...acta({}),
          payload,
        });
        await service.findOne(ID, LECTOR);
        expect(audit.recordRead).toHaveBeenCalledWith(
          [{ entityType: 'VIOLATION_NOTICE', entityId: '22222222-2222-4222-8222-222222222222' }],
          LECTOR,
        );
      },
    );

    it('falla cerrado: si no se puede auditar, no entrega el acta', async () => {
      prisma.outboxEvent.findUnique.mockResolvedValue(acta({ violationId: 'vn-1' }));
      audit.recordRead.mockRejectedValueOnce(new Error('db caída'));
      await expect(service.findOne(ID, LECTOR)).rejects.toThrow('db caída');
    });
  });

  describe('retry', () => {
    it('pasa FAILED a PENDING con attempts 0 y audita el estado previo', async () => {
      prisma.outboxEvent.findUnique.mockResolvedValue(fila());

      const res = await service.retry(ID, ACTOR);

      expect(prisma.outboxEvent.updateMany).toHaveBeenCalledWith({
        where: { id: ID, status: 'FAILED' },
        data: { status: 'PENDING', attempts: 0, lastError: null },
      });
      expect(prisma.outboxRetryAudit.create).toHaveBeenCalledWith({
        data: {
          outboxEventId: ID,
          actorUserId: ACTOR,
          previousAttempts: 5,
          previousError: 'ECONNREFUSED',
        },
      });
      expect(res).toMatchObject({ status: 'PENDING', attempts: 0, lastError: null });
      expect(res).not.toHaveProperty('payload');
    });

    it.each([OutboxEventStatus.SENT, OutboxEventStatus.PENDING])(
      '409 si está en %s y no toca nada',
      async (status) => {
        prisma.outboxEvent.findUnique.mockResolvedValue(fila({ status }));

        await expect(service.retry(ID, ACTOR)).rejects.toThrow(ConflictException);
        expect(prisma.outboxEvent.updateMany).not.toHaveBeenCalled();
        expect(prisma.outboxRetryAudit.create).not.toHaveBeenCalled();
      },
    );

    it('404 si no existe', async () => {
      prisma.outboxEvent.findUnique.mockResolvedValue(null);
      await expect(service.retry(ID, ACTOR)).rejects.toThrow(NotFoundException);
    });

    it('409 y sin auditoría si otro pedido lo reencoló en el medio', async () => {
      prisma.outboxEvent.findUnique.mockResolvedValue(fila());
      prisma.outboxEvent.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.retry(ID, ACTOR)).rejects.toThrow(ConflictException);
      expect(prisma.outboxRetryAudit.create).not.toHaveBeenCalled();
    });
  });

  describe('retryFailed', () => {
    const dto = (limit = 100): RetryFailedOutboxDto =>
      Object.assign(new RetryFailedOutboxDto(), { confirm: true, limit });

    it('reencola los FAILED más viejos con el tope, en lote, y audita cada uno', async () => {
      prisma.outboxEvent.findMany.mockResolvedValue([fila(), fila({ id: 'otro', attempts: 3 })]);
      prisma.outboxEvent.updateMany.mockResolvedValue({ count: 2 });
      prisma.outboxEvent.count.mockResolvedValue(4);

      const res = await service.retryFailed(dto(2), ACTOR);

      expect(prisma.outboxEvent.findMany).toHaveBeenCalledWith({
        where: { status: 'FAILED' },
        orderBy: { occurredAt: 'asc' },
        take: 2,
      });
      expect(prisma.outboxEvent.updateMany).toHaveBeenCalledTimes(1);
      expect(prisma.outboxEvent.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [ID, 'otro'] }, status: 'FAILED' },
        data: { status: 'PENDING', attempts: 0, lastError: null },
      });
      expect(prisma.outboxRetryAudit.createMany).toHaveBeenCalledWith({
        data: [
          {
            outboxEventId: ID,
            actorUserId: ACTOR,
            previousAttempts: 5,
            previousError: 'ECONNREFUSED',
          },
          {
            outboxEventId: 'otro',
            actorUserId: ACTOR,
            previousAttempts: 3,
            previousError: 'ECONNREFUSED',
          },
        ],
      });
      expect(res).toEqual({ requeued: 2, remainingFailed: 4 });
    });

    it('sin limit usa el tope', async () => {
      const sinLimit = Object.assign(new RetryFailedOutboxDto(), {
        confirm: true,
        limit: undefined,
      });
      await service.retryFailed(sinLimit as unknown as RetryFailedOutboxDto, ACTOR);

      expect(prisma.outboxEvent.findMany.mock.calls[0][0].take).toBe(100);
    });

    it('si otro reintento ganó alguna fila, 409 y no audita nada', async () => {
      prisma.outboxEvent.findMany.mockResolvedValue([fila(), fila({ id: 'otro' })]);
      prisma.outboxEvent.updateMany.mockResolvedValue({ count: 1 });

      await expect(service.retryFailed(dto(), ACTOR)).rejects.toThrow(ConflictException);
      expect(prisma.outboxRetryAudit.createMany).not.toHaveBeenCalled();
    });

    it('sin FAILED devuelve 0', async () => {
      await expect(service.retryFailed(dto(), ACTOR)).resolves.toEqual({
        requeued: 0,
        remainingFailed: 0,
      });
      expect(prisma.outboxEvent.updateMany).not.toHaveBeenCalled();
    });
  });
});
