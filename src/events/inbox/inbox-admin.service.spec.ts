import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InboxAdminService } from './inbox-admin.service';
import { QueryInboxDto } from './inbox-admin.dto';
import { REDACTED_PAYLOAD } from './inbox.service';
import { ACTOR } from '../../common/audit/audit-test-actor';

const VIOLATION_ID = '22222222-2222-4222-8222-222222222222';
const FILA_ID = '11111111-1111-4111-8111-111111111111';

const fila = (over: Record<string, unknown> = {}) => ({
  id: FILA_ID,
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
  let audit: { recordRead: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    prisma = {
      inboxEvent: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn(),
        count: vi.fn().mockResolvedValue(0),
      },
      environmentalReport: { findFirst: vi.fn().mockResolvedValue(null) },
      sanctionOutcome: { findUnique: vi.fn().mockResolvedValue(null) },
    };
    audit = { recordRead: vi.fn().mockResolvedValue(undefined) };
    service = new InboxAdminService(prisma, audit as never);
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
      const res = await service.findOne('ev-1', ACTOR);
      expect(prisma.inboxEvent.findUnique).toHaveBeenCalledWith({ where: { messageId: 'ev-1' } });
      expect(res).toMatchObject({
        messageId: 'ev-1',
        status: 'failed',
        payload: { dni: '30111222' },
      });
    });

    it('404 si no existe', async () => {
      prisma.inboxEvent.findUnique.mockResolvedValue(null);
      await expect(service.findOne('nada', ACTOR)).rejects.toThrow(NotFoundException);
      expect(audit.recordRead).not.toHaveBeenCalled();
    });

    describe('auditoría de lectura Tier 2 (#643)', () => {
      it('ticketUpdated se audita sobre el expediente del ticket', async () => {
        prisma.inboxEvent.findUnique.mockResolvedValue(
          fila({ payload: { ticketId: 'TK-1', citizenId: 'c-9', isAnonymous: false } }),
        );
        prisma.environmentalReport.findFirst.mockResolvedValue({ id: 'rep-1' });

        await service.findOne('ev-1', ACTOR);

        expect(prisma.environmentalReport.findFirst).toHaveBeenCalledWith({
          where: { ticketId: 'TK-1' },
          select: { id: true },
        });
        expect(audit.recordRead).toHaveBeenCalledWith(
          [{ entityType: 'ENVIRONMENTAL_REPORT', entityId: 'rep-1' }],
          ACTOR,
        );
      });

      it('ticketUpdated sin expediente se audita sobre el propio evento', async () => {
        prisma.inboxEvent.findUnique.mockResolvedValue(fila({ payload: { ticketId: 'TK-1' } }));

        await service.findOne('ev-1', ACTOR);

        expect(audit.recordRead).toHaveBeenCalledWith(
          [{ entityType: 'INBOX_EVENT', entityId: FILA_ID }],
          ACTOR,
        );
      });

      it('un evento de M4 se audita sobre la resolución del acta', async () => {
        prisma.inboxEvent.findUnique.mockResolvedValue(
          fila({ eventType: 'closureUpdate', payload: { sourceViolationId: VIOLATION_ID } }),
        );
        prisma.sanctionOutcome.findUnique.mockResolvedValue({ id: 'so-1' });

        await service.findOne('ev-1', ACTOR);

        expect(prisma.sanctionOutcome.findUnique).toHaveBeenCalledWith({
          where: { violationNoticeId: VIOLATION_ID },
          select: { id: true },
        });
        expect(audit.recordRead).toHaveBeenCalledWith(
          [{ entityType: 'SANCTION_OUTCOME', entityId: 'so-1' }],
          ACTOR,
        );
      });

      it('un evento de M4 sin resolución (o con id inválido) se audita sobre el evento', async () => {
        prisma.inboxEvent.findUnique.mockResolvedValue(
          fila({ eventType: 'commercialFineGenerated', payload: { violationId: 'no-uuid' } }),
        );

        await service.findOne('ev-1', ACTOR);

        expect(prisma.sanctionOutcome.findUnique).not.toHaveBeenCalled();
        expect(audit.recordRead).toHaveBeenCalledWith(
          [{ entityType: 'INBOX_EVENT', entityId: FILA_ID }],
          ACTOR,
        );
      });

      it.each([{}, { ticketId: 5 }])(
        'ticketUpdated con ticketId que no es string (%j) va al respaldo sin buscar expediente',
        async (payload) => {
          prisma.inboxEvent.findUnique.mockResolvedValue(fila({ payload }));

          await service.findOne('ev-1', ACTOR);

          expect(prisma.environmentalReport.findFirst).not.toHaveBeenCalled();
          expect(audit.recordRead).toHaveBeenCalledWith(
            [{ entityType: 'INBOX_EVENT', entityId: FILA_ID }],
            ACTOR,
          );
        },
      );

      it.each([
        ['ticketUpdated', null],
        ['ticketUpdated', ['x']],
        ['closureUpdate', null],
        ['commercialFineGenerated', [VIOLATION_ID]],
      ])('%s con payload que no es objeto (%j) va al respaldo', async (eventType, payload) => {
        prisma.inboxEvent.findUnique.mockResolvedValue(fila({ eventType, payload }));

        await service.findOne('ev-1', ACTOR);

        expect(prisma.environmentalReport.findFirst).not.toHaveBeenCalled();
        expect(prisma.sanctionOutcome.findUnique).not.toHaveBeenCalled();
        expect(audit.recordRead).toHaveBeenCalledWith(
          [{ entityType: 'INBOX_EVENT', entityId: FILA_ID }],
          ACTOR,
        );
      });

      it('un payload con `redacted` y otros campos no cuenta como redactado: se audita', async () => {
        prisma.inboxEvent.findUnique.mockResolvedValue(
          fila({ payload: { ...REDACTED_PAYLOAD, citizenId: 'x' } }),
        );
        const res = await service.findOne('ev-1', ACTOR);
        expect(audit.recordRead).toHaveBeenCalledWith(
          [{ entityType: 'INBOX_EVENT', entityId: FILA_ID }],
          ACTOR,
        );
        expect(res.payload).toEqual({ redacted: 'contenido no persistido', citizenId: 'x' });
      });

      it('otro tipo de evento no se audita', async () => {
        prisma.inboxEvent.findUnique.mockResolvedValue(fila({ eventType: 'weatherAlertIssued' }));
        await service.findOne('ev-1', ACTOR);
        expect(audit.recordRead).not.toHaveBeenCalled();
      });

      it('un payload redactado no entrega nada y no se audita', async () => {
        prisma.inboxEvent.findUnique.mockResolvedValue(fila({ payload: REDACTED_PAYLOAD }));
        await service.findOne('ev-1', ACTOR);
        expect(audit.recordRead).not.toHaveBeenCalled();
      });

      it('falla cerrado: si no se puede auditar, no entrega el payload', async () => {
        prisma.inboxEvent.findUnique.mockResolvedValue(fila());
        audit.recordRead.mockRejectedValueOnce(new Error('db caída'));
        await expect(service.findOne('ev-1', ACTOR)).rejects.toThrow('db caída');
      });
    });
  });
});
