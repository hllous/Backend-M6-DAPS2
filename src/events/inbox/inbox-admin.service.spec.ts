import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InboxAdminService } from './inbox-admin.service';
import { QueryInboxDto } from './inbox-admin.dto';

const fila = (over: Record<string, unknown> = {}) => ({
  id: '11111111-1111-4111-8111-111111111111',
  messageId: 'ev-1',
  eventType: 'ticketUpdated',
  payload: { dni: '30111222' },
  sourceModule: 'tickets',
  receivedAt: new Date('2026-10-28T12:00:00.000Z'),
  processedAt: null,
  occurredAt: null,
  correlationId: null,
  error: null,
  ...over,
});

const query = (over: Partial<QueryInboxDto> = {}): QueryInboxDto =>
  Object.assign(new QueryInboxDto(), over);

describe('InboxAdminService', () => {
  let prisma: any;
  let service: InboxAdminService;

  beforeEach(() => {
    prisma = {
      inboxEvent: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn(),
        count: vi.fn().mockResolvedValue(0),
      },
    };
    service = new InboxAdminService(prisma);
  });

  describe('findAll', () => {
    it('pagina, ordena por receivedAt desc y no pide ni devuelve el payload', async () => {
      prisma.inboxEvent.findMany.mockResolvedValue([fila()]);
      prisma.inboxEvent.count.mockResolvedValue(41);

      const res = await service.findAll(query({ page: 2 }));

      const args = prisma.inboxEvent.findMany.mock.calls[0][0];
      expect(args.select.payload).toBeUndefined();
      expect(args.orderBy[0]).toEqual({ receivedAt: 'desc' });
      expect(args.skip).toBe(20);
      expect(res.meta).toMatchObject({ total: 41, page: 2, pageSize: 20, totalPages: 3 });
      expect(res.data[0]).not.toHaveProperty('payload');
      expect(res.data[0]).not.toHaveProperty('id');
    });

    it('filtra por eventType y sourceModule', async () => {
      await service.findAll(query({ eventType: 'ticketUpdated', sourceModule: 'tickets' }));
      expect(prisma.inboxEvent.findMany.mock.calls[0][0].where).toEqual({
        eventType: 'ticketUpdated',
        sourceModule: 'tickets',
      });
    });

    it.each([
      ['processed', { processedAt: { not: null } }],
      ['failed', { processedAt: null, error: { not: null } }],
      ['pending', { processedAt: null, error: null }],
    ] as const)('traduce el estado %s al where', async (status, where) => {
      await service.findAll(query({ status }));
      expect(prisma.inboxEvent.findMany.mock.calls[0][0].where).toEqual(where);
      expect(prisma.inboxEvent.count).toHaveBeenCalledWith({ where });
    });

    it('deriva el estado de cada fila', async () => {
      prisma.inboxEvent.findMany.mockResolvedValue([
        fila({ processedAt: new Date() }),
        // Procesado tras un fallo previo: el error viejo no lo vuelve failed.
        fila({ processedAt: new Date(), error: 'viejo' }),
        fila({ error: 'boom' }),
        fila(),
      ]);
      const res = await service.findAll(query());
      expect(res.data.map((d) => d.status)).toEqual([
        'processed',
        'processed',
        'failed',
        'pending',
      ]);
    });

    it('acota el error a 500 caracteres', async () => {
      prisma.inboxEvent.findMany.mockResolvedValue([fila({ error: 'x'.repeat(2000) })]);
      const res = await service.findAll(query());
      expect(res.data[0].error).toHaveLength(500);
    });

    it('from/to son días argentinos inclusivos sobre receivedAt', async () => {
      await service.findAll(query({ from: '2026-10-01', to: '2026-10-31' }));
      const { receivedAt } = prisma.inboxEvent.findMany.mock.calls[0][0].where;
      expect(receivedAt.gte).toEqual(new Date('2026-10-01T03:00:00.000Z'));
      expect(receivedAt.lt).toEqual(new Date('2026-11-01T03:00:00.000Z'));
    });

    it('acepta from o to solos', async () => {
      await service.findAll(query({ from: '2026-10-01' }));
      await service.findAll(query({ to: '2026-10-01' }));
      const [soloFrom, soloTo] = prisma.inboxEvent.findMany.mock.calls.map(
        (c: any[]) => c[0].where.receivedAt,
      );
      expect(soloFrom).toEqual({ gte: new Date('2026-10-01T03:00:00.000Z') });
      expect(soloTo).toEqual({ lt: new Date('2026-10-02T03:00:00.000Z') });
    });

    it('rechaza from posterior a to con 400', async () => {
      await expect(
        service.findAll(query({ from: '2026-10-31', to: '2026-10-01' })),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.inboxEvent.findMany).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('devuelve el detalle con el payload', async () => {
      prisma.inboxEvent.findUnique.mockResolvedValue(fila({ error: 'boom' }));
      const res = await service.findOne('ev-1');
      expect(prisma.inboxEvent.findUnique).toHaveBeenCalledWith({ where: { messageId: 'ev-1' } });
      expect(res).toMatchObject({
        messageId: 'ev-1',
        status: 'failed',
        payload: { dni: '30111222' },
      });
    });

    it('404 si no existe', async () => {
      prisma.inboxEvent.findUnique.mockResolvedValue(null);
      await expect(service.findOne('nada')).rejects.toThrow(NotFoundException);
    });
  });
});
