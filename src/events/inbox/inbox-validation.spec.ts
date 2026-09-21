import { Logger, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OutboundResponsesConsumer } from '../consumers/outbound-responses.consumer';
import { SanctionsConsumer } from '../consumers/sanctions.consumer';
import { TicketsConsumer } from '../consumers/tickets.consumer';
import { WeatherConsumer } from '../consumers/weather.consumer';
import { InboundEnvelope } from '../envelope';
import { InboxService } from './inbox.service';

type Data = Record<string, unknown>;

describe('validación del payload en el inbox', () => {
  const ID = '11111111-1111-1111-1111-111111111111';
  const ZONA = '22222222-2222-2222-2222-222222222222';
  const EVENT_ID = '646d19f5-5670-4a7b-9442-30e13b02ba11';
  let prisma: any;
  let inbox: InboxService;

  const sobre = (eventType: string, data: Data): InboundEnvelope => ({
    specVersion: '1.0',
    eventId: EVENT_ID,
    eventType,
    occurredAt: '2026-09-02T10:00:00.000Z',
    producer: 'M7',
    subject: 'abc',
    data,
  });

  // Válidos: los que ya usan los consumers.spec (fixtures de M2, M3, M4, M7).
  const validos: [string, Data][] = [
    ['ticketUpdated', { ticketId: 'T-1', updateType: 'ROUTED', responsibleAreaId: 'M6' }],
    ['workOrderScheduled', { sourceRequestId: ID, workOrderId: 'OT-1' }],
    ['workOrderCompleted', { sourceRequestId: ID }],
    ['commercialFineGenerated', { sourceViolationId: ID }],
    ['closureUpdate', { sourceViolationId: ID, status: 'LIFTED' }],
    ['streetClosureApproved', { closureRequestId: ID, streetClosureId: 'C-1' }],
    ['streetClosureRejected', { closureRequestId: ID, rejectionReason: 'x' }],
    ['streetClosureEnded', { closureRequestId: ID }],
    [
      'weatherAlertIssued',
      { severity: 'CRITICAL', zoneIds: [ZONA], from: '2026-10-01', to: '2026-10-02' },
    ],
  ];

  // Inválidos: [evento, data, campo que el mensaje debe nombrar].
  const invalidos: [string, Data, string][] = [
    ['ticketUpdated', {}, 'ticketId'],
    ['ticketUpdated', { ticketId: 'T' }, 'updateType'],
    ['ticketUpdated', { ticketId: 5, updateType: 'ROUTED', responsibleAreaId: 'M6' }, 'ticketId'],
    [
      'ticketUpdated',
      { ticketId: 'T', updateType: 'ESCALATION_CHANGED', responsibleAreaId: 'M6', details: {} },
      'details.escalation.active',
    ],
    [
      'ticketUpdated',
      { ticketId: 'T', updateType: 'PRIORITY_CHANGED', responsibleAreaId: 'M6' },
      'currentPriority',
    ],
    ['workOrderScheduled', {}, 'sourceRequestId'],
    ['workOrderCompleted', { sourceRequestId: 'no-uuid' }, 'sourceRequestId'],
    ['commercialFineGenerated', {}, 'sourceViolationId'],
    ['closureUpdate', { sourceViolationId: ID }, 'status'],
    ['closureUpdate', { sourceViolationId: ID, status: 'OTRO' }, 'status'],
    ['streetClosureApproved', {}, 'closureRequestId'],
    ['streetClosureRejected', { closureRequestId: 42 }, 'closureRequestId'],
    ['streetClosureEnded', {}, 'closureRequestId'],
    ['weatherAlertIssued', {}, 'severity'],
    ['weatherAlertIssued', { severity: 'LOW', zoneIds: [] }, 'zoneIds'],
    ['weatherAlertIssued', { severity: 'HIGH', zoneIds: [ZONA], from: 'mañana' }, 'from'],
  ];

  beforeEach(() => {
    prisma = {
      inboxEvent: {
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    inbox = new InboxService(prisma as unknown as PrismaService);
    const p = prisma as unknown as PrismaService;
    // Los handlers reales no se ejecutan acá: se reemplazan por stubs que
    // conservan la validación registrada.
    for (const c of [
      new TicketsConsumer(p, inbox),
      new OutboundResponsesConsumer(p, inbox),
      new SanctionsConsumer(p, inbox),
      new WeatherConsumer(p, inbox),
    ]) {
      c.onModuleInit();
    }
    (inbox as unknown as { handlers: Map<string, unknown> }).handlers.forEach((_, k) =>
      (inbox as unknown as { handlers: Map<string, unknown> }).handlers.set(
        k,
        jest.fn().mockResolvedValue(undefined),
      ),
    );
  });

  it.each(validos)('%s válido se procesa', async (tipo, data) => {
    const r = await inbox.ingest(sobre(tipo, data));
    expect(r.status).toBe('processed');
  });

  it.each(validos)('%s tolera campos extra', async (tipo, data) => {
    const r = await inbox.ingest(sobre(tipo, { ...data, campoNuevo: 'x', otro: { a: 1 } }));
    expect(r.status).toBe('processed');
  });

  it.each(invalidos)('%s con %j da 400 y nombra %s', async (tipo, data, campo) => {
    const promesa = inbox.ingest(sobre(tipo, data));
    await expect(promesa).rejects.toBeInstanceOf(BadRequestException);
    await expect(promesa).rejects.toThrow(new RegExp(`${tipo}.*${campo.replace('.', '\\.')}`));
  });

  it('el 400 no vuelca el contenido recibido', async () => {
    await expect(
      inbox.ingest(sobre('streetClosureApproved', { closureRequestId: 'SECRETO-123' })),
    ).rejects.not.toThrow(/SECRETO/);
  });

  it('un ticket de otro módulo solo exige lo común', async () => {
    const r = await inbox.ingest(
      sobre('ticketUpdated', {
        ticketId: 'T',
        updateType: 'ESCALATION_CHANGED',
        responsibleAreaId: 'M3',
      }),
    );
    expect(r.status).toBe('processed');
  });

  it('un evento sin handler sigue ignored, con cualquier data', async () => {
    const r = await inbox.ingest(sobre('eventoAjeno', {}));
    expect(r.status).toBe('ignored');
  });

  it('el rechazado no se guarda y el corregido con el mismo eventId se procesa', async () => {
    await expect(inbox.ingest(sobre('streetClosureApproved', {}))).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.inboxEvent.create).not.toHaveBeenCalled();

    const r = await inbox.ingest(sobre('streetClosureApproved', { closureRequestId: ID }));
    expect(r.status).toBe('processed');
    expect(prisma.inboxEvent.create).toHaveBeenCalledTimes(1);
  });

  describe('alias y bordes', () => {
    const ok = (tipo: string, data: Data) =>
      expect(inbox.ingest(sobre(tipo, data))).resolves.toMatchObject({ status: 'processed' });
    const ko = (tipo: string, data: Data) =>
      expect(inbox.ingest(sobre(tipo, data))).rejects.toBeInstanceOf(BadRequestException);

    it('acepta los alias del id de correlación', async () => {
      await ok('workOrderScheduled', { requestId: ID });
      await ok('commercialFineGenerated', { violationId: ID });
      await ok('streetClosureApproved', { sourceRequestId: ID });
    });

    it('el alias con precedencia es el que valida (el mismo que lee el handler)', async () => {
      await ko('workOrderScheduled', { sourceRequestId: 'x', requestId: ID });
      await ko('streetClosureApproved', { closureRequestId: 'x', sourceRequestId: ID });
      await ko('commercialFineGenerated', { sourceViolationId: 'x', violationId: ID });
    });

    it('null equivale a ausente: cae al alias siguiente', async () => {
      await ok('workOrderScheduled', { sourceRequestId: null, requestId: ID });
      await ko('workOrderScheduled', { sourceRequestId: null });
    });

    it('status en minúsculas es válido', async () => {
      await ok('closureUpdate', { sourceViolationId: ID, status: 'lifted' });
    });

    it('severidad HIGH sin to es inválida', async () => {
      await ko('weatherAlertIssued', { severity: 'HIGH', zoneIds: [ZONA], from: '2026-10-01' });
    });

    it('zoneIds con un elemento no uuid: inválido con HIGH, válido con LOW', async () => {
      await ko('weatherAlertIssued', {
        severity: 'HIGH',
        zoneIds: [ZONA, 'z1'],
        from: '2026-10-01',
        to: '2026-10-02',
      });
      await ok('weatherAlertIssued', { severity: 'LOW', zoneIds: ['z1'] });
    });
  });

  it('un eventId ya guardado reenviado con payload inválido da 400, no duplicate', async () => {
    prisma.inboxEvent.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: '5.22.0' }),
    );
    await expect(inbox.ingest(sobre('streetClosureApproved', {}))).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.inboxEvent.create).not.toHaveBeenCalled();
  });

  it('si validate lanza, el evento se procesa y queda el log de error', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const handler = jest.fn().mockResolvedValue(undefined);
    inbox.register('eventoRoto', handler, {
      validate: () => {
        throw new Error('bug del validador');
      },
    });
    const r = await inbox.ingest(sobre('eventoRoto', { secreto: 'SECRETO-123' }));
    expect(r.status).toBe('processed');
    expect(handler).toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(expect.stringContaining('bug del validador'));
    expect(error).not.toHaveBeenCalledWith(expect.stringContaining('SECRETO'));
    error.mockRestore();
  });
});
