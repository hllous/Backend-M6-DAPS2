import { Logger } from '@nestjs/common';
import { EnvironmentalReportStatus as S } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { InboxService } from '../inbox/inbox.service';
import { OutboxService } from '../outbox/outbox.service';
import { OutboundResponsesConsumer } from './outbound-responses.consumer';
import { SanctionsConsumer } from './sanctions.consumer';
import { TicketsConsumer } from './tickets.consumer';
import { WeatherConsumer } from './weather.consumer';

/**
 * El Core re-serializa el sobre antes de entregarlo a `q.ambiente` (#296): los
 * `null` llegan ausentes (`exclude_none`) y `occurredAt` se normaliza. M9 no
 * confirmó si lo primero alcanza a `data`, así que cada consumer tiene que dar
 * el mismo resultado con un campo `null` que sin él.
 */
const ID = '11111111-1111-1111-1111-111111111111';
const EVENT_ID = '646d19f5-5670-4a7b-9442-30e13b02ba11';

/** Lo que hace `exclude_none`, a cualquier profundidad. */
function sinNulls(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sinNulls);
  if (v && typeof v === 'object') {
    return Object.fromEntries(
      Object.entries(v)
        .filter(([, x]) => x !== null)
        .map(([k, x]) => [k, sinNulls(x)]),
    );
  }
  return v;
}

function crearPrisma() {
  const prisma: any = {
    inboxEvent: {
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    },
    repairRequest: {
      findUnique: jest.fn().mockResolvedValue({ id: ID, workOrderId: null }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    streetClosureRequest: {
      findUnique: jest.fn().mockResolvedValue({ id: ID, sourceType: 'SERVICE', sourceId: 'srv-1' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    service: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    violationNotice: {
      findUnique: jest.fn().mockResolvedValue({
        id: ID,
        noticeNumber: 'ACTA-1',
        inspection: { reportId: 'rep-1' },
        sanctionOutcome: null,
      }),
    },
    environmentalReport: {
      findUnique: jest.fn().mockResolvedValue({ id: 'rep-1', status: S.NOTICE_ISSUED }),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: ID, reportType: 'NOISE' }),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    sanctionOutcome: { create: jest.fn() },
    $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
  };
  return prisma;
}

/** Todas las llamadas de dominio, sin las del inbox (que guarda el payload tal cual llegó). */
function llamadas(prisma: Record<string, unknown>): [string, unknown][] {
  return Object.entries(prisma)
    .filter(([k]) => k !== 'inboxEvent' && k !== '$transaction')
    .flatMap(([k, repo]) =>
      Object.entries(repo as Record<string, jest.Mock>).map(([m, fn]): [string, unknown] => [
        `${k}.${m}`,
        fn.mock.calls,
      ]),
    );
}

async function correr(
  eventType: string,
  data: Record<string, unknown>,
  occurredAt?: string,
): Promise<{ status: string; calls: [string, unknown][] }> {
  const prisma = crearPrisma();
  const inbox = new InboxService(prisma as unknown as PrismaService);
  const p = prisma as unknown as PrismaService;
  [
    new OutboundResponsesConsumer(p, inbox),
    new SanctionsConsumer(p, inbox),
    new TicketsConsumer(p, inbox, new OutboxService()),
    new WeatherConsumer(p, inbox),
  ].forEach((c) => c.onModuleInit());
  const { status } = await inbox.ingest({ eventId: EVENT_ID, eventType, occurredAt, data });
  return { status, calls: llamadas(prisma) };
}

describe('sobre re-serializado por el Core (#296)', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });
  afterEach(() => jest.restoreAllMocks());

  describe('un campo ausente se trata igual que null en data', () => {
    const ROUTED = {
      ticketId: 'TCK-1',
      publicId: null,
      responsibleAreaId: 'M6',
      updateType: 'ROUTED',
      currentPriority: null,
      isAnonymous: false,
      citizenId: null,
      publicMessage: null,
      details: {
        escalation: null,
        routing: {
          requestType: 'Ruidos molestos',
          summary: 'Bar',
          location: { addressLine: 'Rivadavia 100', latitude: null, longitude: null },
        },
      },
    };

    it.each([
      ['workOrderScheduled', { sourceRequestId: ID, workOrderId: null, workOrderNumber: null }],
      ['workOrderCompleted', { sourceRequestId: ID, workOrderId: null, outcome: null }],
      [
        'streetClosureApproved',
        { closureRequestId: ID, streetClosureId: null, closureId: null, notes: null },
      ],
      [
        'streetClosureRejected',
        { closureRequestId: ID, rejectionReason: null, reason: null, notes: null },
      ],
      ['streetClosureEnded', { closureRequestId: ID, streetClosureId: null, closureId: null }],
      [
        'commercialFineGenerated',
        { sourceViolationId: ID, externalRef: null, actId: null, decidedAt: null },
      ],
      [
        'closureUpdate',
        { sourceViolationId: ID, status: 'ORDERED', externalRef: null, decidedAt: null },
      ],
      [
        'weatherAlertIssued',
        {
          alertType: null,
          severity: 'CRITICAL',
          zoneIds: [ID],
          from: '2026-10-01T00:00:00.000Z',
          to: '2026-10-02T00:00:00.000Z',
        },
      ],
      ['ticketUpdated', ROUTED],
      [
        'ticketUpdated',
        {
          ticketId: 'TCK-1',
          responsibleAreaId: 'M6',
          updateType: 'ESCALATION_CHANGED',
          details: { escalation: { active: true, reason: null }, routing: null },
        },
      ],
      [
        'ticketUpdated',
        {
          ticketId: 'TCK-1',
          responsibleAreaId: 'M6',
          updateType: 'INFORMATION_PROVIDED',
          details: { informationResponse: { message: 'listo', attachments: null }, purpose: null },
        },
      ],
    ])('%s: mismo efecto con null explícito y sin el campo', async (tipo, data) => {
      const conNull = await correr(tipo, data);
      const ausente = await correr(tipo, sinNulls(data) as Record<string, unknown>);

      expect(conNull.status).toBe('processed');
      expect(ausente).toEqual(conNull);
    });

    it('con el ROUTED sin los nulls el snapshot sale igual de completo', async () => {
      // Sin esto, "iguales" podría ser "los dos no hicieron nada".
      const { calls } = await correr('ticketUpdated', sinNulls(ROUTED) as Record<string, unknown>);

      const create = calls.find(([n]) => n === 'environmentalReport.create');
      expect((create?.[1] as unknown[]).length).toBe(1);
    });

    // El caso contrario: con los campos presentes se usan, no solo "ausente == null".
    it.each(['commercialFineGenerated', 'closureUpdate'])(
      '%s con externalRef y decidedAt presentes los registra',
      async (tipo) => {
        const { status, calls } = await correr(tipo, {
          sourceViolationId: ID,
          status: 'ORDERED',
          externalRef: 'REF-9',
          decidedAt: '2026-10-01T10:00:00.000Z',
        });

        const create = calls.find(([n]) => n === 'sanctionOutcome.create')![1] as [
          [{ data: { externalRef: string; decidedAt: Date } }],
        ];
        expect(status).toBe('processed');
        expect(create[0][0].data.externalRef).toBe('REF-9');
        expect(create[0][0].data.decidedAt).toEqual(new Date('2026-10-01T10:00:00.000Z'));
      },
    );
  });

  describe('occurredAt normalizado a seis decimales con offset', () => {
    const normalizado = '2026-10-20T09:15:30.500000-03:00';

    it('el inbox lo acepta y procesa', async () => {
      const { status } = await correr(
        'weatherAlertIssued',
        { severity: 'LOW', zoneIds: [ID] },
        normalizado,
      );

      expect(status).toBe('processed');
    });

    describe('TicketsConsumer ordena comparando Date, no strings', () => {
      /**
       * El expediente con la marca de prioridad ya puesta y un `updateMany` que
       * evalúa el `lt` como la base. Devuelve el `count` que ve el handler.
       */
      async function conMarca(marca: Date, occurredAt: string) {
        const prisma = crearPrisma();
        prisma.environmentalReport.findFirst.mockResolvedValue({
          id: 'rep-1',
          ticketId: 'TCK-1',
          status: S.UNDER_REVIEW,
        });
        prisma.environmentalReport.updateMany.mockImplementation(
          async ({ where }: { where: { OR: { priorityChangedAt: { lt?: Date } | null }[] } }) => {
            const limite = where.OR[1].priorityChangedAt?.lt;
            return { count: limite && marca < limite ? 1 : 0 };
          },
        );
        const inbox = new InboxService(prisma as unknown as PrismaService);
        new TicketsConsumer(
          prisma as unknown as PrismaService,
          inbox,
          new OutboxService(),
        ).onModuleInit();
        await inbox.ingest({
          eventId: EVENT_ID,
          eventType: 'ticketUpdated',
          occurredAt,
          data: {
            ticketId: 'TCK-1',
            responsibleAreaId: 'M6',
            updateType: 'PRIORITY_CHANGED',
            currentPriority: 'HIGH',
          },
        });
        const [[args]] = prisma.environmentalReport.updateMany.mock.calls;
        const { count } = await prisma.environmentalReport.updateMany.mock.results[0].value;
        return { args, count };
      }

      it('el filtro recibe un Date: los microsegundos se pierden sin romper nada', async () => {
        const { args } = await conMarca(
          new Date('2026-10-20T12:15:30.400Z'),
          '2026-10-20T09:15:30.500000-03:00',
        );

        const { lt } = args.where.OR[1].priorityChangedAt;
        expect(lt).toBeInstanceOf(Date);
        expect(lt.toISOString()).toBe('2026-10-20T12:15:30.500Z');
      });

      it('con el mismo instante que la marca no aplica: la igualdad queda a favor de lo ya aplicado', async () => {
        // La marca guardada vino de un `.5` y el reintento llega como `.500000`.
        const { count } = await conMarca(
          new Date('2026-10-20T09:15:30.5-03:00'),
          '2026-10-20T09:15:30.500000-03:00',
        );

        expect(count).toBe(0);
      });

      it('un instante posterior aplica aunque como texto sea "menor"', async () => {
        // Como texto, '2026-10-20T09:15:31...-03:00' < '2026-10-20T12:00:00Z'; como Date es posterior.
        const { count } = await conMarca(
          new Date('2026-10-20T12:00:00Z'),
          '2026-10-20T09:15:31.000000-03:00',
        );

        expect(count).toBe(1);
      });
    });
  });
});
