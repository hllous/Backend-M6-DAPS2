import { Logger } from '@nestjs/common';
import {
  EnvironmentalReportStatus as S,
  Prisma,
  RepairRequestStatus,
  SanctionDecision,
  ServiceStatus,
  Severity,
  StreetClosureRequestStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { InboxService } from '../inbox/inbox.service';
import { OutboxService } from '../outbox/outbox.service';
import { OutboundResponsesConsumer } from './outbound-responses.consumer';
import { SanctionsConsumer } from './sanctions.consumer';
import { TicketsConsumer } from './tickets.consumer';
import { WeatherConsumer } from './weather.consumer';

type Handler = (d: Record<string, unknown>, occurredAt?: Date | null) => Promise<void>;

/** Registra los handlers y devuelve el de un tipo, para invocarlo directo. */
function registrar(consumer: { onModuleInit: () => void }, inbox: InboxService) {
  consumer.onModuleInit();
  return (tipo: string) =>
    (inbox as unknown as { handlers: Map<string, Handler> }).handlers.get(tipo)!;
}

describe('consumidores de eventos', () => {
  const ID = '11111111-1111-1111-1111-111111111111';
  let prisma: any;
  let inbox: InboxService;

  beforeEach(() => {
    prisma = {
      repairRequest: {
        findUnique: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      streetClosureRequest: {
        findUnique: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      service: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      violationNotice: { findUnique: jest.fn() },
      environmentalReport: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: ID, reportType: 'NOISE' }),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      sanctionOutcome: { create: jest.fn() },
      // Estado del ticket en M2 (#303): sin dato por defecto.
      ticketM2State: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    inbox = new InboxService(prisma as unknown as PrismaService);
  });

  describe('respuestas de M3 y M7', () => {
    let h: (t: string) => (d: Record<string, unknown>) => Promise<void>;

    beforeEach(() => {
      h = registrar(
        new OutboundResponsesConsumer(prisma as unknown as PrismaService, inbox),
        inbox,
      );
    });

    it('workOrderScheduled correlaciona por sourceRequestId', async () => {
      prisma.repairRequest.findUnique.mockResolvedValue({ id: ID, workOrderId: null });

      await h('workOrderScheduled')({ sourceRequestId: ID, workOrderId: 'OT-1' });

      expect(prisma.repairRequest.updateMany).toHaveBeenCalledWith({
        where: { id: ID, status: { in: [RepairRequestStatus.REQUESTED] } },
        data: { status: RepairRequestStatus.IN_PROGRESS, workOrderId: 'OT-1' },
      });
    });

    it('un sourceRequestId que no es nuestro se descarta sin fallar', async () => {
      prisma.repairRequest.findUnique.mockResolvedValue(null);

      await expect(h('workOrderScheduled')({ sourceRequestId: 'ajeno' })).resolves.toBeUndefined();
      expect(prisma.repairRequest.updateMany).not.toHaveBeenCalled();
    });

    it('workOrderScheduled tardío o repetido (ya no REQUESTED) se descarta con log, sin fallar', async () => {
      prisma.repairRequest.findUnique.mockResolvedValue({ id: ID, status: 'CLOSED' });
      prisma.repairRequest.updateMany.mockResolvedValue({ count: 0 });
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

      await expect(h('workOrderScheduled')({ sourceRequestId: ID })).resolves.toBeUndefined();

      expect(warn).toHaveBeenCalledWith(expect.stringContaining('descartado'));
      warn.mockRestore();
    });

    it('workOrderCompleted solo aplica desde REQUESTED o IN_PROGRESS; un cierre repetido se descarta', async () => {
      prisma.repairRequest.findUnique.mockResolvedValue({ id: ID, status: 'CLOSED' });
      prisma.repairRequest.updateMany.mockResolvedValue({ count: 0 });
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

      await expect(h('workOrderCompleted')({ sourceRequestId: ID })).resolves.toBeUndefined();

      const [[args]] = prisma.repairRequest.updateMany.mock.calls;
      expect(args.where.status.in).toEqual(
        expect.arrayContaining([RepairRequestStatus.REQUESTED, RepairRequestStatus.IN_PROGRESS]),
      );
      expect(args.where.status.in).not.toContain(RepairRequestStatus.CLOSED);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('descartado'));
      warn.mockRestore();
    });

    it('un evento sin id de correlacion se descarta sin fallar', async () => {
      await expect(h('workOrderCompleted')({})).resolves.toBeUndefined();
      expect(prisma.repairRequest.findUnique).not.toHaveBeenCalled();
    });

    it('el rechazo del corte marca el servicio para reprogramar, no lo cancela', async () => {
      prisma.streetClosureRequest.findUnique.mockResolvedValue({
        id: ID,
        sourceType: 'SERVICE',
        sourceId: 'srv-1',
      });

      await h('streetClosureRejected')({
        closureRequestId: ID,
        rejectionReason: 'se superpone',
      });

      const [[args]] = prisma.service.updateMany.mock.calls;
      expect(args.data.status).toBe(ServiceStatus.RESCHEDULED);
      expect(args.data.statusReason).toContain('se superpone');
    });

    it('el rechazo del corte tolera el nombre viejo `reason`', async () => {
      prisma.streetClosureRequest.findUnique.mockResolvedValue({
        id: ID,
        sourceType: 'SERVICE',
        sourceId: 'srv-1',
      });

      await h('streetClosureRejected')({ closureRequestId: ID, reason: 'fuera de horario' });

      const [[args]] = prisma.service.updateMany.mock.calls;
      expect(args.data.statusReason).toContain('fuera de horario');
    });

    it('el corte aprobado persiste la ventana autorizada en approvedFrom/approvedTo', async () => {
      prisma.streetClosureRequest.findUnique.mockResolvedValue({ id: ID, sourceType: 'SERVICE' });

      await h('streetClosureApproved')({
        closureRequestId: ID,
        streetClosureId: 'CL-1',
        startDate: '2030-01-01T08:00:00Z',
        endDate: '2030-01-02T18:00:00Z',
      });

      const [[args]] = prisma.streetClosureRequest.updateMany.mock.calls;
      expect(args.data.approvedFrom).toEqual(new Date('2030-01-01T08:00:00Z'));
      expect(args.data.approvedTo).toEqual(new Date('2030-01-02T18:00:00Z'));
    });

    it('un reintento de Approved sobre un corte ya APPROVED no pisa la ventana', async () => {
      prisma.streetClosureRequest.findUnique.mockResolvedValue({ id: ID, status: 'APPROVED' });
      prisma.streetClosureRequest.updateMany.mockResolvedValue({ count: 0 });
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

      await h('streetClosureApproved')({ closureRequestId: ID, endDate: '2031-01-01T00:00:00Z' });

      const [[args]] = prisma.streetClosureRequest.updateMany.mock.calls;
      expect(args.where).toEqual({
        id: ID,
        status: { in: [StreetClosureRequestStatus.REQUESTED] },
      });
      warn.mockRestore();
    });

    it('fechas ausentes o ilegibles no tumban el handler ni se guardan', async () => {
      prisma.streetClosureRequest.findUnique.mockResolvedValue({ id: ID, sourceType: 'SERVICE' });

      await expect(
        h('streetClosureApproved')({
          closureRequestId: ID,
          startDate: 'no-es-fecha',
          endDate: 12345,
        }),
      ).resolves.toBeUndefined();

      const [[args]] = prisma.streetClosureRequest.updateMany.mock.calls;
      expect(args.data).not.toHaveProperty('approvedFrom');
      expect(args.data).not.toHaveProperty('approvedTo');
    });

    it('el corte aprobado guarda el identificador de M7', async () => {
      prisma.streetClosureRequest.findUnique.mockResolvedValue({ id: ID, sourceType: 'SERVICE' });

      await h('streetClosureApproved')({ closureRequestId: ID, streetClosureId: 'CL-1' });

      expect(prisma.streetClosureRequest.updateMany).toHaveBeenCalledWith({
        where: { id: ID, status: { in: [StreetClosureRequestStatus.REQUESTED] } },
        data: { status: StreetClosureRequestStatus.APPROVED, closureId: 'CL-1' },
      });
    });

    it('un aprobado tardío sobre un corte ya rechazado o terminado se descarta sin fallar', async () => {
      prisma.streetClosureRequest.findUnique.mockResolvedValue({ id: ID, status: 'REJECTED' });
      prisma.streetClosureRequest.updateMany.mockResolvedValue({ count: 0 });
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

      await expect(h('streetClosureApproved')({ closureRequestId: ID })).resolves.toBeUndefined();

      expect(warn).toHaveBeenCalledWith(expect.stringContaining('descartado'));
      warn.mockRestore();
    });

    it('un rechazo tardío sobre un corte ya aprobado no reprograma el servicio', async () => {
      prisma.streetClosureRequest.findUnique.mockResolvedValue({
        id: ID,
        status: 'APPROVED',
        sourceType: 'SERVICE',
        sourceId: 'srv-1',
      });
      prisma.streetClosureRequest.updateMany.mockResolvedValue({ count: 0 });
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

      await expect(h('streetClosureRejected')({ closureRequestId: ID })).resolves.toBeUndefined();

      expect(prisma.service.updateMany).not.toHaveBeenCalled();
      warn.mockRestore();
    });

    it('streetClosureEnded sobre un corte REJECTED o ENDED se descarta; REQUESTED, APPROVED y EXPIRED se aceptan', async () => {
      prisma.streetClosureRequest.findUnique.mockResolvedValue({ id: ID, status: 'ENDED' });
      prisma.streetClosureRequest.updateMany.mockResolvedValue({ count: 0 });
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

      await expect(h('streetClosureEnded')({ closureRequestId: ID })).resolves.toBeUndefined();

      const [[args]] = prisma.streetClosureRequest.updateMany.mock.calls;
      expect(args.where.status).toEqual({
        in: [
          StreetClosureRequestStatus.REQUESTED,
          StreetClosureRequestStatus.APPROVED,
          StreetClosureRequestStatus.EXPIRED,
        ],
      });
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('descartado'));
      warn.mockRestore();
    });

    it('orden de llegada Ended antes que Approved: el Ended guarda el closureId y el Approved posterior se descarta', async () => {
      prisma.streetClosureRequest.findUnique.mockResolvedValue({
        id: ID,
        status: 'REQUESTED',
        closureId: null,
      });

      await h('streetClosureEnded')({ closureRequestId: ID, streetClosureId: 'CL-9' });

      expect(prisma.streetClosureRequest.updateMany).toHaveBeenLastCalledWith({
        where: {
          id: ID,
          status: {
            in: [
              StreetClosureRequestStatus.REQUESTED,
              StreetClosureRequestStatus.APPROVED,
              StreetClosureRequestStatus.EXPIRED,
            ],
          },
        },
        data: { status: StreetClosureRequestStatus.ENDED, closureId: 'CL-9' },
      });

      // Ahora el corte está ENDED: el Approved rezagado no matchea el filtro.
      prisma.streetClosureRequest.findUnique.mockResolvedValue({ id: ID, status: 'ENDED' });
      prisma.streetClosureRequest.updateMany.mockResolvedValue({ count: 0 });
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

      await expect(h('streetClosureApproved')({ closureRequestId: ID })).resolves.toBeUndefined();

      expect(warn).toHaveBeenCalledWith(expect.stringContaining('descartado'));
      warn.mockRestore();
    });

    it('orden normal Approved y luego Ended: el Ended no pisa un closureId ya guardado', async () => {
      prisma.streetClosureRequest.findUnique.mockResolvedValue({
        id: ID,
        status: 'APPROVED',
        closureId: 'CL-1',
      });

      await h('streetClosureEnded')({ closureRequestId: ID, streetClosureId: 'CL-1' });

      const [[args]] = prisma.streetClosureRequest.updateMany.mock.calls;
      expect(args.data).toEqual({ status: StreetClosureRequestStatus.ENDED });
    });

    it('rechazo: si falla la escritura del servicio el error se propaga y el corte no queda rechazado', async () => {
      // La transacción se revierte entera: simulamos el rollback con un estado
      // que solo se confirma si el callback termina sin error.
      let corte = 'REQUESTED';
      prisma.$transaction = jest.fn(async (cb: (tx: unknown) => unknown) => {
        const antes = corte;
        try {
          return await cb(prisma);
        } catch (e) {
          corte = antes;
          throw e;
        }
      });
      prisma.streetClosureRequest.updateMany.mockImplementation(async () => {
        corte = 'REJECTED';
        return { count: 1 };
      });
      prisma.service.updateMany.mockRejectedValue(new Error('db caída'));
      prisma.streetClosureRequest.findUnique.mockResolvedValue({
        id: ID,
        status: 'REQUESTED',
        sourceType: 'SERVICE',
        sourceId: 'srv-1',
      });

      await expect(h('streetClosureRejected')({ closureRequestId: ID })).rejects.toThrow(
        'db caída',
      );
      expect(corte).toBe('REQUESTED');
    });

    it('el corte aprobado acepta closureId como alias de streetClosureId', async () => {
      prisma.streetClosureRequest.findUnique.mockResolvedValue({ id: ID, sourceType: 'SERVICE' });

      await h('streetClosureApproved')({ closureRequestId: ID, closureId: 'CL-2' });

      const [[args]] = prisma.streetClosureRequest.updateMany.mock.calls;
      expect(args.data.closureId).toBe('CL-2');
    });

    it('el corte aprobado sin ningun identificador de M7 guarda null', async () => {
      prisma.streetClosureRequest.findUnique.mockResolvedValue({ id: ID, sourceType: 'SERVICE' });

      await h('streetClosureApproved')({ closureRequestId: ID });

      const [[args]] = prisma.streetClosureRequest.updateMany.mock.calls;
      expect(args.data.closureId).toBeNull();
    });

    it('workOrderCompleted cierra la solicitud cuando la correlaciona', async () => {
      prisma.repairRequest.findUnique.mockResolvedValue({ id: ID });

      await h('workOrderCompleted')({ sourceRequestId: ID });

      expect(prisma.repairRequest.updateMany).toHaveBeenCalledWith({
        where: {
          id: ID,
          status: { in: [RepairRequestStatus.REQUESTED, RepairRequestStatus.IN_PROGRESS] },
        },
        data: { status: RepairRequestStatus.CLOSED },
      });
    });

    it('closureEnded libera la dependencia', async () => {
      prisma.streetClosureRequest.findUnique.mockResolvedValue({ id: ID, sourceType: 'SERVICE' });

      await h('streetClosureEnded')({ closureRequestId: ID });

      expect(prisma.streetClosureRequest.updateMany).toHaveBeenCalledWith({
        where: {
          id: ID,
          status: {
            in: [
              StreetClosureRequestStatus.REQUESTED,
              StreetClosureRequestStatus.APPROVED,
              StreetClosureRequestStatus.EXPIRED,
            ],
          },
        },
        data: { status: StreetClosureRequestStatus.ENDED, closureId: undefined },
      });
    });

    it('un closureRequestId que no es nuestro se descarta sin fallar', async () => {
      prisma.streetClosureRequest.findUnique.mockResolvedValue(null);

      await expect(h('streetClosureEnded')({ closureRequestId: 'ajeno' })).resolves.toBeUndefined();
      expect(prisma.streetClosureRequest.updateMany).not.toHaveBeenCalled();
    });

    it('un evento de M7 sin id de correlacion se descarta sin fallar', async () => {
      await expect(h('streetClosureEnded')({})).resolves.toBeUndefined();
      expect(prisma.streetClosureRequest.findUnique).not.toHaveBeenCalled();
    });

    it('el rechazo de un corte que no viene de un Service no toca ningun servicio', async () => {
      prisma.streetClosureRequest.findUnique.mockResolvedValue({
        id: ID,
        sourceType: 'TREE_INTERVENTION',
        sourceId: 'ti-1',
      });

      await h('streetClosureRejected')({ closureRequestId: ID });

      expect(prisma.service.updateMany).not.toHaveBeenCalled();
    });

    it('el rechazo sin motivo no agrega el detalle al statusReason', async () => {
      prisma.streetClosureRequest.findUnique.mockResolvedValue({
        id: ID,
        sourceType: 'SERVICE',
        sourceId: 'srv-1',
      });

      await h('streetClosureRejected')({ closureRequestId: ID });

      const [[args]] = prisma.service.updateMany.mock.calls;
      expect(args.data.statusReason).toBe('M7 rechazó el corte de calle solicitado');
    });

    it('si el servicio ya no está SCHEDULED, el rechazo no lo reprograma', async () => {
      prisma.streetClosureRequest.findUnique.mockResolvedValue({
        id: ID,
        sourceType: 'SERVICE',
        sourceId: 'srv-1',
      });
      prisma.service.updateMany.mockResolvedValue({ count: 0 });
      const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();

      await expect(h('streetClosureRejected')({ closureRequestId: ID })).resolves.toBeUndefined();

      expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining('marcado para reprogramar'));
      logSpy.mockRestore();
    });
  });

  describe('resoluciones de M4', () => {
    let h: (t: string) => (d: Record<string, unknown>) => Promise<void>;

    beforeEach(() => {
      h = registrar(new SanctionsConsumer(prisma as unknown as PrismaService, inbox), inbox);
      prisma.violationNotice.findUnique.mockResolvedValue({
        id: ID,
        noticeNumber: 'ACTA-2026-000001',
        inspection: { reportId: 'rep-1' },
        sanctionOutcome: null,
      });
      prisma.environmentalReport.findUnique.mockResolvedValue({
        id: 'rep-1',
        status: S.NOTICE_ISSUED,
      });
    });

    it('la multa crea el SanctionOutcome y cierra el expediente', async () => {
      await h('commercialFineGenerated')({ sourceViolationId: ID, externalRef: 'REF-9' });

      expect(prisma.sanctionOutcome.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          decision: SanctionDecision.FINE_ISSUED,
          externalRef: 'REF-9',
        }),
      });
      const estados = prisma.environmentalReport.update.mock.calls.map(
        ([a]: [{ data: { status: string } }]) => a.data.status,
      );
      expect(estados).toEqual([S.SANCTIONED, S.CLOSED]);
    });

    it('closureUpdate ORDERED registra la clausura', async () => {
      await h('closureUpdate')({ sourceViolationId: ID, status: 'ORDERED' });

      expect(prisma.sanctionOutcome.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ decision: SanctionDecision.CLOSURE_ORDERED }),
      });
    });

    it('closureUpdate LIFTED registra el levantamiento', async () => {
      await h('closureUpdate')({ sourceViolationId: ID, status: 'LIFTED' });

      expect(prisma.sanctionOutcome.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ decision: SanctionDecision.DISMISSED }),
      });
    });

    it('un acta que ya tiene resolucion no se resuelve dos veces', async () => {
      prisma.violationNotice.findUnique.mockResolvedValue({
        id: ID,
        noticeNumber: 'ACTA-1',
        inspection: { reportId: 'rep-1' },
        sanctionOutcome: { decision: SanctionDecision.FINE_ISSUED },
      });

      await h('commercialFineGenerated')({ sourceViolationId: ID });

      expect(prisma.sanctionOutcome.create).not.toHaveBeenCalled();
    });

    it('sin sourceViolationId no sabemos que acta resolvieron: se descarta', async () => {
      await h('commercialFineGenerated')({});

      expect(prisma.violationNotice.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('ticketUpdated de M2', () => {
    let h: Handler;
    let outbox: { enqueue: jest.Mock };

    beforeEach(() => {
      outbox = { enqueue: jest.fn().mockResolvedValue(undefined) };
      h = registrar(
        new TicketsConsumer(prisma as unknown as PrismaService, inbox, outbox as never),
        inbox,
      )('ticketUpdated');
      prisma.environmentalReport.findFirst.mockResolvedValue(null);
    });

    describe('qué payload guarda el inbox', () => {
      const ingerir = async (data: Record<string, unknown>) => {
        prisma.inboxEvent = {
          create: jest.fn().mockResolvedValue({}),
          update: jest.fn().mockResolvedValue({}),
        };
        await inbox.ingest({
          specVersion: '1.0',
          eventId: '646d19f5-5670-4a7b-9442-30e13b02ba11',
          eventType: 'ticketUpdated',
          occurredAt: '2026-09-02T10:00:00.000Z',
          producer: 'M2',
          subject: 'TCK-1',
          data,
        } as unknown as Parameters<InboxService['ingest']>[0]);
        return prisma.inboxEvent.create.mock.calls[0][0].data.payload;
      };

      it.each([
        ['M3', { responsibleAreaId: 'M3' }],
        ['ausente', {}],
        ['null', { responsibleAreaId: null }],
        ['número', { responsibleAreaId: 6 }],
        ["'m6'", { responsibleAreaId: 'm6' }],
        ["'M6 '", { responsibleAreaId: 'M6 ' }],
      ])('redacta el ticket con responsibleAreaId %s', async (_n, extra) => {
        const payload = await ingerir({ ticketId: 'TCK-1', updateType: 'ROUTED', ...extra });

        expect(payload).toEqual({ redacted: expect.any(String) });
      });

      it('conserva el payload completo de M6, incluso con un updateType descartado', async () => {
        const data = { ticketId: 'TCK-1', responsibleAreaId: 'M6', updateType: 'CLOSED' };

        expect(await ingerir(data)).toEqual(data);
      });
    });

    /**
     * La forma de la v1.6: `requestType`, `summary` y `location` viven dentro
     * de `details.routing` (§7.4) y `requestType` es un string plano (§5.5).
     *
     * Es el caso que rompía: leyéndolos del nivel raíz —como pedía la v1.5—
     * el expediente se abría sin dirección y con el tipo por defecto, sin
     * error ni log que lo delatara.
     */
    it('ROUTED lee el snapshot de details.routing y deduce el tipo del texto', async () => {
      await h({
        ticketId: 'TCK-1',
        publicId: 'TK-2026-000123',
        responsibleAreaId: 'M6',
        updateType: 'ROUTED',
        currentPriority: 'HIGH',
        isAnonymous: false,
        citizenId: 'cit-1',
        details: {
          routing: {
            requestType: 'Ruidos molestos',
            summary: 'Bar con música fuerte',
            location: { addressLine: 'Rivadavia 100' },
          },
        },
      });

      const [[args]] = prisma.environmentalReport.create.mock.calls;
      expect(args.data.ticketId).toBe('TCK-1');
      expect(args.data.publicId).toBe('TK-2026-000123');
      expect(args.data.reportType).toBe('NOISE');
      expect(args.data.address).toBe('Rivadavia 100');
      expect(args.data.priority).toBe(Severity.HIGH);
      expect(args.data.reporterSnapshot).toEqual({ isAnonymous: false, citizenId: 'cit-1' });
    });

    /**
     * El contrato ya cambió de opinión una vez sobre dónde viven estos campos,
     * así que aceptamos las dos formas: es gratis y nos deja indiferentes a
     * cuál terminen publicando.
     */
    it('ROUTED sigue aceptando la forma v1.5, con los campos en la raíz', async () => {
      await h({
        ticketId: 'TCK-1',
        responsibleAreaId: 'M6',
        updateType: 'ROUTED',
        requestType: { name: 'Ruidos molestos' },
        summary: 'Bar con música fuerte',
        location: { addressLine: 'Rivadavia 100', latitude: -34.6, longitude: -58.4 },
        currentPriority: 'HIGH',
        isAnonymous: false,
        citizenId: 'cit-1',
      });

      const [[args]] = prisma.environmentalReport.create.mock.calls;
      expect(args.data.reportType).toBe('NOISE');
      expect(args.data.address).toBe('Rivadavia 100');
      expect(args.data.lat).toBe(-34.6);
      expect(args.data.priority).toBe(Severity.HIGH);
    });

    /**
     * La v1.6 (§5.4) sacó `latitude`/`longitude` de `location` y parte la
     * dirección en `street` + `streetNumber`. Guardar la calle sin la altura
     * dejaría el expediente sin poder ubicarse en el mapa ni en la calle.
     */
    it('ROUTED recompone la dirección cuando no viene addressLine', async () => {
      await h({
        ticketId: 'TCK-1',
        responsibleAreaId: 'M6',
        updateType: 'ROUTED',
        details: {
          routing: {
            requestType: 'Ruidos molestos',
            location: { street: 'Rivadavia', streetNumber: '100' },
          },
        },
      });

      const [[args]] = prisma.environmentalReport.create.mock.calls;
      expect(args.data.address).toBe('Rivadavia 100');
      expect(args.data.lat).toBeNull();
      expect(args.data.lng).toBeNull();
    });

    it('un ROUTED anonimo no guarda identidad', async () => {
      await h({
        ticketId: 'TCK-1',
        responsibleAreaId: 'M6',
        updateType: 'ROUTED',
        isAnonymous: true,
        citizenId: 'cit-1',
      });

      const [[args]] = prisma.environmentalReport.create.mock.calls;
      expect(args.data.reporterSnapshot).toEqual({ isAnonymous: true });
    });

    it('un ROUTED repetido no abre un segundo expediente', async () => {
      prisma.environmentalReport.findFirst.mockResolvedValue({ id: 'ya-existe' });

      await h({ ticketId: 'TCK-1', responsibleAreaId: 'M6', updateType: 'ROUTED' });

      expect(prisma.environmentalReport.create).not.toHaveBeenCalled();
      // El re-entregado (#170) tampoco reescribe marcas ni snapshot.
      expect(prisma.environmentalReport.updateMany).not.toHaveBeenCalled();
    });

    /**
     * M2 informa el estado del ticket en `currentStatus` de todo `ticketUpdated`.
     * Lo guardamos porque de eso depende elegir STARTED o PROGRESS al informar
     * la programación (#303).
     */
    describe('estado del ticket en M2 (#303)', () => {
      const nuestro = { ticketId: 'TCK-1', responsibleAreaId: 'M6' };

      it('guarda el currentStatus como RECEIVED, con data.updatedAt como marca de orden', async () => {
        await h({
          ...nuestro,
          updateType: 'ROUTED',
          currentStatus: 'ROUTED',
          updatedAt: '2026-10-20T10:00:00.000Z',
        });

        expect(prisma.ticketM2State.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { ticketId: 'TCK-1' },
            create: expect.objectContaining({
              status: 'ROUTED',
              source: 'RECEIVED',
              receivedAt: new Date('2026-10-20T10:00:00.000Z'),
            }),
          }),
        );
      });

      it('sin updatedAt usa el occurredAt del sobre', async () => {
        const occurredAt = new Date('2026-10-20T09:00:00.000Z');

        await h({ ...nuestro, updateType: 'CLOSED', currentStatus: 'CLOSED' }, occurredAt);

        expect(prisma.ticketM2State.upsert.mock.calls[0][0].create.receivedAt).toEqual(occurredAt);
      });

      it('también lo guarda en un updateType que no tiene otro efecto', async () => {
        await h({ ...nuestro, updateType: 'CONTENT_UPDATED', currentStatus: 'IN_PROGRESS' });

        expect(prisma.ticketM2State.upsert).toHaveBeenCalledTimes(1);
      });

      it('uno más viejo que el último recibido no lo pisa', async () => {
        prisma.ticketM2State.findUnique.mockResolvedValue({
          receivedAt: new Date('2026-10-20T10:00:00.000Z'),
        });

        await h({
          ...nuestro,
          updateType: 'STATUS_CHANGED',
          currentStatus: 'IN_REVIEW',
          updatedAt: '2026-10-20T09:00:00.000Z',
        });

        expect(prisma.ticketM2State.upsert).not.toHaveBeenCalled();
      });

      it('no persiste nada de un ticket que no es nuestro', async () => {
        await h({
          ticketId: 'TCK-9',
          responsibleAreaId: 'M3',
          updateType: 'ROUTED',
          currentStatus: 'ROUTED',
        });

        expect(prisma.ticketM2State.findUnique).not.toHaveBeenCalled();
        expect(prisma.ticketM2State.upsert).not.toHaveBeenCalled();
      });

      it.each(['BASURA', 'X'.repeat(5000), 'IN_PROGRESS\nFALSO'])(
        'un currentStatus fuera de la lista de M2 (%.20s) no se persiste y no rompe el handler',
        async (valor) => {
          const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

          await expect(
            h({ ...nuestro, updateType: 'CLOSED', currentStatus: valor }),
          ).resolves.toBeUndefined();

          expect(prisma.ticketM2State.upsert).not.toHaveBeenCalled();
          // El valor es de un tercero: al log va saneado y acotado.
          const logueado = warn.mock.calls.map(([m]) => String(m)).join('\n');
          expect(logueado).toContain('currentStatus');
          expect(logueado).not.toContain('\n'.concat('FALSO'));
          expect(logueado.length).toBeLessThan(400);
          warn.mockRestore();
        },
      );

      it.each([undefined, null, 7, ''])('con currentStatus %j no escribe', async (valor) => {
        await h({ ...nuestro, updateType: 'CLOSED', currentStatus: valor });

        expect(prisma.ticketM2State.upsert).not.toHaveBeenCalled();
      });
    });

    describe('segundo ROUTED de un ticket devuelto (#170)', () => {
      const rerouted = {
        ticketId: 'TCK-1',
        responsibleAreaId: 'M6',
        updateType: 'ROUTED',
        currentPriority: 'HIGH',
        details: { routing: { summary: 'Ruido nuevo', location: { addressLine: 'Lima 100' } } },
      };

      it('reactiva el expediente devuelto con el snapshot nuevo, sin crear otro', async () => {
        prisma.environmentalReport.findFirst.mockResolvedValue({
          id: 'exp-1',
          status: 'FORWARDED',
        });

        await h(rerouted);

        expect(prisma.environmentalReport.create).not.toHaveBeenCalled();
        const [[args]] = prisma.environmentalReport.updateMany.mock.calls;
        expect(args.where).toEqual({ id: 'exp-1', status: 'FORWARDED' });
        expect(args.data).toMatchObject({
          status: 'UNDER_REVIEW',
          address: 'Lima 100',
          priority: 'HIGH',
        });
        expect(args.data).not.toHaveProperty('ticketId');
      });

      // M2 (20/10): reactivar es tomar la gestión otra vez, y el vecino lo ve
      // como un STARTED (#309).
      describe('avisa a M2 al reactivar (#309)', () => {
        const forwarded = { id: 'exp-1', status: 'FORWARDED', ticketId: 'TCK-1' };

        beforeEach(() => {
          prisma.environmentalReport.findFirst.mockResolvedValue(forwarded);
        });

        it('publica un STARTED, una sola vez, en la misma operación', async () => {
          await h(rerouted);

          expect(outbox.enqueue).toHaveBeenCalledTimes(1);
          const [tx, entry] = outbox.enqueue.mock.calls[0];
          expect(tx).toBe(prisma);
          expect(entry).toMatchObject({
            eventType: 'updateTicketStatus',
            aggregateType: 'ENVIRONMENTAL_REPORT',
            aggregateId: 'exp-1',
            payload: {
              ticketId: 'TCK-1',
              updateType: 'STARTED',
              publicMessage: 'Su denuncia ambiental está en análisis.',
              updatedBy: { type: 'SYSTEM', id: null },
            },
          });
          expect(prisma.$transaction).toHaveBeenCalled();
        });

        it('con el ticket ya IN_PROGRESS manda PROGRESS', async () => {
          prisma.ticketM2State.findUnique.mockResolvedValue({ status: 'IN_PROGRESS' });

          await h({ ...rerouted, currentStatus: undefined });

          expect(outbox.enqueue.mock.calls[0][1].payload).toMatchObject({
            updateType: 'PROGRESS',
            publicMessage: 'Su denuncia ambiental está en análisis.',
          });
        });

        it('con el ROUTED recibido (currentStatus) manda STARTED', async () => {
          prisma.ticketM2State.findUnique.mockResolvedValue({ status: 'ROUTED' });

          await h({ ...rerouted, currentStatus: 'ROUTED' });

          expect(outbox.enqueue.mock.calls[0][1].payload).toMatchObject({ updateType: 'STARTED' });
        });

        it('un reintento que ya no encuentra el expediente en FORWARDED no lo duplica', async () => {
          prisma.environmentalReport.updateMany.mockResolvedValue({ count: 0 });

          await h(rerouted);

          expect(outbox.enqueue).not.toHaveBeenCalled();
        });

        it('un expediente que no está FORWARDED no publica nada', async () => {
          prisma.environmentalReport.findFirst.mockResolvedValue({
            ...forwarded,
            status: 'UNDER_REVIEW',
          });

          await h(rerouted);

          expect(outbox.enqueue).not.toHaveBeenCalled();
        });

        it('un expediente sin ticketId no publica', async () => {
          prisma.environmentalReport.findFirst.mockResolvedValue({ ...forwarded, ticketId: null });

          await h(rerouted);

          expect(prisma.environmentalReport.updateMany).toHaveBeenCalled();
          expect(outbox.enqueue).not.toHaveBeenCalled();
        });

        it('un ROUTED de otra área no publica nada', async () => {
          await h({ ...rerouted, responsibleAreaId: 'M4' });

          expect(outbox.enqueue).not.toHaveBeenCalled();
        });

        // Por el inbox y con el OutboxService real: el handler corre dentro de
        // eventContext, así que el evento hereda el hilo y su causa es el ROUTED.
        it('el evento sale con causationId = eventId del ROUTED y su correlationId', async () => {
          const EVENT_ID = '646d19f5-5670-4a7b-9442-30e13b02ba11';
          const CORRELATION = '5b0c0d39-8c1d-4c8a-9c50-0a8d3f1c6e11';
          prisma.inboxEvent = {
            create: jest.fn().mockResolvedValue({}),
            update: jest.fn().mockResolvedValue({}),
          };
          prisma.outboxEvent = { create: jest.fn() };
          // Un inbox propio: el de la suite ya tiene registrado su handler.
          const inboxReal = new InboxService(prisma as unknown as PrismaService);
          new TicketsConsumer(
            prisma as unknown as PrismaService,
            inboxReal,
            new OutboxService(),
          ).onModuleInit();

          await inboxReal.ingest({
            specVersion: '1.0',
            eventId: EVENT_ID,
            correlationId: CORRELATION,
            eventType: 'ticketUpdated',
            occurredAt: '2026-10-20T10:00:00.000Z',
            producer: 'M2',
            subject: 'TCK-1',
            data: rerouted,
          } as unknown as Parameters<InboxService['ingest']>[0]);

          const { data } = prisma.outboxEvent.create.mock.calls[0][0];
          expect(data).toMatchObject({
            eventType: 'updateTicketStatus',
            causationId: EVENT_ID,
            correlationId: CORRELATION,
          });
        });
      });

      it('un ROUTED más viejo que el último cambio del expediente no lo reactiva', async () => {
        prisma.environmentalReport.findFirst.mockResolvedValue({
          id: 'exp-1',
          status: 'FORWARDED',
        });

        await h({ ...rerouted, updatedAt: '2026-10-05T10:00:00.000Z' });

        const [[args]] = prisma.environmentalReport.updateMany.mock.calls;
        expect(args.where.OR).toEqual([
          { ticketStatusAt: null },
          { ticketStatusAt: { lt: new Date('2026-10-05T10:00:00.000Z') } },
        ]);
      });

      it.each(['DISMISSED', 'NO_VIOLATION', 'CLOSED', 'UNDER_REVIEW'])(
        'un expediente en %s no se reactiva',
        async (status) => {
          prisma.environmentalReport.findFirst.mockResolvedValue({ id: 'exp-1', status });

          await h(rerouted);

          expect(prisma.environmentalReport.create).not.toHaveBeenCalled();
          expect(prisma.environmentalReport.updateMany).not.toHaveBeenCalled();
        },
      );

      it('un ROUTED de otra área cierra el expediente que habíamos devuelto, sin leer su contenido', async () => {
        await h({
          ticketId: 'TCK-1',
          responsibleAreaId: 'M4',
          updateType: 'ROUTED',
          updatedAt: '2026-10-05T10:00:00.000Z',
          details: { routing: { summary: 'no se persiste' } },
        });

        const [[args]] = prisma.environmentalReport.updateMany.mock.calls;
        expect(args.where).toMatchObject({ ticketId: 'TCK-1', status: 'FORWARDED' });
        expect(args.data).toEqual({ status: 'CLOSED' });
        expect(prisma.environmentalReport.create).not.toHaveBeenCalled();
      });

      it('un evento de otra área que no es ROUTED no toca el expediente', async () => {
        await h({ ticketId: 'TCK-1', responsibleAreaId: 'M4', updateType: 'PRIORITY_CHANGED' });

        expect(prisma.environmentalReport.updateMany).not.toHaveBeenCalled();
      });

      it('si M2 cancela el ticket que habíamos devuelto, el expediente se cierra', async () => {
        prisma.environmentalReport.findFirst.mockResolvedValue({
          id: 'exp-1',
          status: 'FORWARDED',
        });

        await h({ ticketId: 'TCK-1', responsibleAreaId: 'M6', updateType: 'CANCELLED' });

        expect(prisma.environmentalReport.updateMany).toHaveBeenCalledWith({
          where: { id: 'exp-1', status: 'FORWARDED' },
          data: { status: 'CLOSED' },
        });
      });

      it('si el expediente cambió de estado entre la lectura y el update, no falla', async () => {
        prisma.environmentalReport.findFirst.mockResolvedValue({
          id: 'exp-1',
          status: 'FORWARDED',
        });
        prisma.environmentalReport.updateMany.mockResolvedValue({ count: 0 });

        await expect(h(rerouted)).resolves.not.toThrow();
        expect(prisma.environmentalReport.create).not.toHaveBeenCalled();
      });
    });

    /**
     * ticketUpdated es un broadcast: llega a todos los modulos, y
     * responsibleAreaId dice a quien le toca (§2). Sin este filtro, un
     * reclamo derivado a M3 o M7 abriria igual un expediente de este lado.
     */
    it.each(['M3', 'M7', undefined])(
      'un ROUTED con responsibleAreaId=%s no nos pertenece, se descarta',
      async (area) => {
        await h({ ticketId: 'TCK-1', responsibleAreaId: area, updateType: 'ROUTED' });

        expect(prisma.environmentalReport.create).not.toHaveBeenCalled();
      },
    );

    it('el filtro de responsibleAreaId tambien protege a los updateType que actuan sobre un expediente ya abierto', async () => {
      await h({ ticketId: 'TCK-1', responsibleAreaId: 'M3', updateType: 'CANCELLED' });

      expect(prisma.service.updateMany).not.toHaveBeenCalled();
    });

    it('CANCELLED cancela los servicios programados del reclamo', async () => {
      await h({ ticketId: 'TCK-1', responsibleAreaId: 'M6', updateType: 'CANCELLED' });

      const [[args]] = prisma.service.updateMany.mock.calls;
      expect(args.data.status).toBe(ServiceStatus.CANCELLED);
      expect(args.where.ticketId).toBe('TCK-1');
    });

    /**
     * `updateMany` no pasa por `assertTransition`: el filtro del `where` es el
     * único guard. Tiene que coincidir con los estados desde los que
     * `VALID_TRANSITIONS` admite `CANCELLED`, o M2 haría una transición que la
     * API rechaza.
     */
    it('CANCELLED solo toca los estados desde los que se puede cancelar', async () => {
      await h({ ticketId: 'TCK-1', responsibleAreaId: 'M6', updateType: 'CANCELLED' });

      const [[args]] = prisma.service.updateMany.mock.calls;
      expect(args.where.status).toEqual({
        in: [ServiceStatus.SCHEDULED, ServiceStatus.RESCHEDULED],
      });
    });

    // ─── Decisión del 04/09/2026: qué pasa sobre un expediente cerrado ──

    /**
     * Son datos del reclamo, no cambios de estado nuestros: perderlos es peor
     * que guardarlos tarde. Ver bloqueantes.md.
     */
    it.each([
      ['ESCALATION_CHANGED', { details: { escalation: { active: true } } }, 'escalated', true],
      [
        'INFORMATION_PROVIDED',
        { details: { informationResponse: { message: 'El ruido sigue' } } },
        'citizenResponse',
        'El ruido sigue',
      ],
      ['PRIORITY_CHANGED', { currentPriority: 'CRITICAL' }, 'priority', Severity.CRITICAL],
    ])(
      '%s se acepta aunque el expediente esté cerrado',
      async (updateType, extra, campo, valor) => {
        prisma.environmentalReport.findFirst.mockResolvedValue({ id: 'rep-1', status: S.CLOSED });

        await h({ ticketId: 'TCK-1', responsibleAreaId: 'M6', updateType, ...extra });

        const [[args]] = prisma.environmentalReport.updateMany.mock.calls;
        expect(args.where).toEqual({ ticketId: 'TCK-1' });
        expect(args.data[campo]).toEqual(valor);
      },
    );

    // ─── #144: la forma del contrato, con el valor y no solo la clave ──

    it('ESCALATION_CHANGED con active=false desmarca el escalado', async () => {
      await h({
        ticketId: 'TCK-1',
        responsibleAreaId: 'M6',
        updateType: 'ESCALATION_CHANGED',
        details: { escalation: { active: false, reasonCode: null, escalatedAt: null } },
      });

      const [[args]] = prisma.environmentalReport.updateMany.mock.calls;
      expect(args.data).toEqual({ escalated: false });
    });

    it('ESCALATION_CHANGED sin details.escalation.active no toca el flag', async () => {
      await h({
        ticketId: 'TCK-1',
        responsibleAreaId: 'M6',
        updateType: 'ESCALATION_CHANGED',
        escalation: { escalated: true },
      });

      expect(prisma.environmentalReport.updateMany).not.toHaveBeenCalled();
    });

    it('ROUTED toma el escalamiento del snapshot', async () => {
      await h({
        ticketId: 'TCK-1',
        responsibleAreaId: 'M6',
        updateType: 'ROUTED',
        details: {
          routing: {
            requestType: 'Ruidos molestos',
            escalation: {
              active: true,
              reasonCode: 'CRITICAL_PRIORITY',
              escalatedAt: '2026-09-11T10:00:00Z',
            },
          },
        },
      });

      const [[args]] = prisma.environmentalReport.create.mock.calls;
      expect(args.data.escalated).toBe(true);
    });

    it('INFORMATION_PROVIDED guarda lo que contestó el vecino, no la glosa de M2', async () => {
      await h({
        ticketId: 'TCK-1',
        responsibleAreaId: 'M6',
        updateType: 'INFORMATION_PROVIDED',
        publicMessage: 'El ciudadano aportó la información solicitada.',
        details: { informationResponse: { message: 'Frente al 1240, de noche' } },
      });

      const [[args]] = prisma.environmentalReport.updateMany.mock.calls;
      expect(args.data.citizenResponse).toBe('Frente al 1240, de noche');
    });

    it('INFORMATION_PROVIDED de una reclasificación (purpose) se ignora aunque el área sea M6', async () => {
      // Ejemplo de M2 v1.77: responsibleAreaId es el provisional, que para un ticket
      // que devolvimos sigue siendo M6. No es una respuesta a un pedido nuestro.
      await h({
        ticketId: 'TCK-1',
        responsibleAreaId: 'M6',
        updateType: 'INFORMATION_PROVIDED',
        currentStatus: 'IN_REVIEW',
        details: {
          informationResponse: {
            message: 'M2 recibió los datos solicitados para revisar la clasificación.',
            purpose: 'RECLASSIFICATION',
          },
        },
      });

      expect(prisma.environmentalReport.updateMany).not.toHaveBeenCalled();
    });

    // #169: la respuesta cierra la solicitud pendiente; en el mismo update, así que
    // el orden por updatedAt vale para las dos cosas y una respuesta vieja no reabre nada.
    it('INFORMATION_PROVIDED cierra la solicitud pendiente junto con guardar la respuesta', async () => {
      await h({
        ticketId: 'TCK-1',
        responsibleAreaId: 'M6',
        updateType: 'INFORMATION_PROVIDED',
        updatedAt: '2026-10-20T12:00:00Z',
        details: { informationResponse: { message: 'Acá va la foto' } },
      });

      const [[args]] = prisma.environmentalReport.updateMany.mock.calls;
      expect(args.data).toMatchObject({
        citizenResponse: 'Acá va la foto',
        citizenResponseAt: new Date('2026-10-20T12:00:00Z'),
        informationRequestedAt: null,
        informationRequestMessage: null,
        informationRequestRequiredBy: null,
      });
      // El guard por orden: uno más viejo que la última respuesta no se aplica.
      expect(args.where.OR).toEqual([
        { citizenResponseAt: null },
        { citizenResponseAt: { lt: new Date('2026-10-20T12:00:00Z') } },
      ]);
    });

    it('INFORMATION_PROVIDED sin solicitud pendiente guarda la respuesta igual', async () => {
      await h({
        ticketId: 'TCK-1',
        responsibleAreaId: 'M6',
        updateType: 'INFORMATION_PROVIDED',
        details: { informationResponse: { message: 'Sin que se la pidieran' } },
      });

      const [[args]] = prisma.environmentalReport.updateMany.mock.calls;
      expect(args.data.citizenResponse).toBe('Sin que se la pidieran');
      expect(args.where.informationRequestedAt).toBeUndefined();
    });

    describe('cierre de la solicitud de información por el estado recibido (#169)', () => {
      const nuestro = { ticketId: 'TCK-1', responsibleAreaId: 'M6' };
      const cierres = () =>
        prisma.environmentalReport.updateMany.mock.calls.filter(
          ([a]: any) => a.where.informationRequestedAt?.not === null,
        );

      it.each(['CANCELLED', 'IN_PROGRESS', 'ROUTED', 'IN_REVIEW', 'CLOSED'])(
        'un ticketUpdated con currentStatus %s limpia la solicitud pendiente',
        async (currentStatus) => {
          await h({
            ...nuestro,
            updateType: 'STATUS_CHANGED',
            currentStatus,
            updatedAt: '2026-10-20T12:00:00Z',
          });

          const [[args]] = cierres();
          expect(args.where.ticketId).toBe('TCK-1');
          expect(args.data).toEqual({
            informationRequestedAt: null,
            informationRequestMessage: null,
            informationRequestRequiredBy: null,
          });
          // No pisa una respuesta más nueva: mismo guard por citizenResponseAt.
          expect(args.where.OR).toEqual([
            { citizenResponseAt: null },
            { citizenResponseAt: { lt: new Date('2026-10-20T12:00:00Z') } },
          ]);
        },
      );

      it('PENDING_INFORMATION no la cierra', async () => {
        await h({
          ...nuestro,
          updateType: 'INFORMATION_REQUIRED',
          currentStatus: 'PENDING_INFORMATION',
        });
        expect(cierres()).toHaveLength(0);
      });

      it('un currentStatus fuera de los 9 de M2 no la cierra', async () => {
        await h({ ...nuestro, updateType: 'STATUS_CHANGED', currentStatus: 'INVENTADO' });
        expect(cierres()).toHaveLength(0);
      });

      it('una reclasificación (purpose) no la cierra aunque el ticket siga en revisión', async () => {
        await h({
          ...nuestro,
          updateType: 'INFORMATION_PROVIDED',
          currentStatus: 'IN_REVIEW',
          details: { informationResponse: { message: 'm', purpose: 'RECLASSIFICATION' } },
        });
        await h({
          ...nuestro,
          updateType: 'INFORMATION_REQUIRED',
          currentStatus: 'IN_REVIEW',
          details: { informationRequest: { purpose: 'RECLASSIFICATION' } },
        });
        expect(cierres()).toHaveLength(0);
      });

      it('un ticketUpdated más viejo que el último estado recibido no la cierra', async () => {
        prisma.ticketM2State.findUnique.mockResolvedValue({
          status: 'PENDING_INFORMATION',
          receivedAt: new Date('2026-10-20T13:00:00Z'),
        });

        await h({
          ...nuestro,
          updateType: 'STATUS_CHANGED',
          currentStatus: 'IN_PROGRESS',
          updatedAt: '2026-10-20T12:00:00Z',
        });

        expect(cierres()).toHaveLength(0);
      });

      it('de un ticket ajeno no toca nada', async () => {
        await h({
          ticketId: 'TCK-9',
          responsibleAreaId: 'M3',
          updateType: 'STATUS_CHANGED',
          currentStatus: 'CANCELLED',
        });
        expect(prisma.environmentalReport.updateMany).not.toHaveBeenCalled();
      });
    });

    it('INFORMATION_PROVIDED con solo adjuntos se registra sin romper', async () => {
      await h({
        ticketId: 'TCK-1',
        responsibleAreaId: 'M6',
        updateType: 'INFORMATION_PROVIDED',
        publicMessage: null,
        details: { informationResponse: { message: null } },
        attachments: [
          { fileName: 'foto-nocturna.jpg', contentType: 'image/jpeg', url: 'https://m2/adj/955' },
        ],
      });

      const [[args]] = prisma.environmentalReport.updateMany.mock.calls;
      expect(args.data.citizenResponse).toBe('foto-nocturna.jpg: https://m2/adj/955');
    });

    it('INFORMATION_PROVIDED sin message ni adjuntos se descarta', async () => {
      await h({
        ticketId: 'TCK-1',
        responsibleAreaId: 'M6',
        updateType: 'INFORMATION_PROVIDED',
        publicMessage: 'El ciudadano aportó la información solicitada.',
      });

      expect(prisma.environmentalReport.updateMany).not.toHaveBeenCalled();
    });

    it('REOPENED no reabre un expediente que no admite la transicion', async () => {
      prisma.environmentalReport.findFirst.mockResolvedValue({
        id: 'rep-1',
        status: S.SANCTIONED,
      });

      await h({ ticketId: 'TCK-1', responsibleAreaId: 'M6', updateType: 'REOPENED' });

      expect(prisma.environmentalReport.updateMany).not.toHaveBeenCalled();
    });

    it('REOPENED sí reabre desde CLOSED, con el estado leído como guard', async () => {
      prisma.environmentalReport.findFirst.mockResolvedValue({ id: 'rep-1', status: S.CLOSED });

      await h({ ticketId: 'TCK-1', responsibleAreaId: 'M6', updateType: 'REOPENED' });

      expect(prisma.environmentalReport.updateMany).toHaveBeenCalledWith({
        where: { id: 'rep-1', status: S.CLOSED },
        data: { status: S.UNDER_REVIEW },
      });
    });

    it('CANCELLED descarta el expediente en UNDER_REVIEW', async () => {
      prisma.environmentalReport.findFirst.mockResolvedValue({
        id: 'rep-1',
        status: S.UNDER_REVIEW,
      });

      await h({ ticketId: 'TCK-1', responsibleAreaId: 'M6', updateType: 'CANCELLED' });

      expect(prisma.environmentalReport.updateMany).toHaveBeenCalledWith({
        where: { id: 'rep-1', status: S.UNDER_REVIEW },
        data: { status: S.DISMISSED },
      });
    });

    // ─── #270: un reintento atrasado no pisa un dato más nuevo ──

    describe('orden por occurredAt', () => {
      const T1 = new Date('2026-10-01T10:00:00.000Z');
      const T2 = new Date('2026-10-01T10:05:00.000Z');
      let fila: Record<string, unknown>;
      let existe: boolean;
      let warn: jest.SpyInstance;

      /**
       * El expediente en memoria, con un `updateMany` que evalúa el `where`
       * como la base: así el test mira el estado final y no solo la consulta.
       * Con `existe = false` todavía no se abrió, y el `create` del ROUTED lo
       * abre (#275).
       */
      beforeEach(() => {
        fila = {
          id: 'rep-1',
          ticketId: 'TCK-1',
          status: S.CLOSED,
          priority: null,
          escalated: false,
          citizenResponse: null,
          priorityChangedAt: null,
          escalationChangedAt: null,
          citizenResponseAt: null,
          ticketStatusAt: null,
        };
        existe = true;
        const cumple = (where: Record<string, unknown>): boolean =>
          Object.entries(where).every(([k, v]) => {
            if (k === 'OR') return (v as Record<string, unknown>[]).some(cumple);
            if (v && typeof v === 'object' && 'lt' in v) {
              return fila[k] != null && (fila[k] as Date) < (v as { lt: Date }).lt;
            }
            return fila[k] === v;
          });
        prisma.environmentalReport.findFirst.mockImplementation(async () =>
          existe ? { ...fila } : null,
        );
        prisma.environmentalReport.create.mockImplementation(async ({ data }: { data: object }) => {
          existe = true;
          Object.assign(fila, data);
          return { ...fila };
        });
        prisma.environmentalReport.updateMany.mockImplementation(
          async ({ where, data }: { where: Record<string, unknown>; data: object }) => {
            if (!existe || !cumple(where)) return { count: 0 };
            Object.assign(fila, data);
            return { count: 1 };
          },
        );
        warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      });

      afterEach(() => warn.mockRestore());

      const evento = (updateType: string, extra: object = {}) => ({
        ticketId: 'TCK-1',
        responsibleAreaId: 'M6',
        updateType,
        ...extra,
      });

      // [updateType, payload viejo, payload nuevo, campo, valor nuevo, marca]
      it.each([
        [
          'PRIORITY_CHANGED',
          { currentPriority: 'LOW' },
          { currentPriority: 'HIGH' },
          'priority',
          Severity.HIGH,
          'priorityChangedAt',
        ],
        [
          'ESCALATION_CHANGED',
          { details: { escalation: { active: true } } },
          { details: { escalation: { active: false } } },
          'escalated',
          false,
          'escalationChangedAt',
        ],
        [
          'INFORMATION_PROVIDED',
          { details: { informationResponse: { message: 'vieja' } } },
          { details: { informationResponse: { message: 'nueva' } } },
          'citizenResponse',
          'nueva',
          'citizenResponseAt',
        ],
      ])(
        '%s atrasado no pisa al más nuevo y se ignora sin fallar',
        async (updateType, viejo, nuevo, campo, valor, marca) => {
          await h(evento(updateType, nuevo), T2);
          // El reintento del Core llega después con el occurredAt guardado.
          await expect(h(evento(updateType, viejo), T1)).resolves.toBeUndefined();

          expect(fila[campo]).toEqual(valor);
          expect(fila[marca]).toEqual(T2);
          expect(warn).toHaveBeenCalledWith(expect.stringContaining('se ignora'));
        },
      );

      it.each([
        ['PRIORITY_CHANGED', { currentPriority: 'LOW' }, { currentPriority: 'HIGH' }, 'priority'],
        [
          'ESCALATION_CHANGED',
          { details: { escalation: { active: false } } },
          { details: { escalation: { active: true } } },
          'escalated',
        ],
      ])('%s más nuevo sí aplica', async (updateType, viejo, nuevo, campo) => {
        await h(evento(updateType, viejo), T1);
        await h(evento(updateType, nuevo), T2);

        expect(fila[campo]).toEqual(campo === 'priority' ? Severity.HIGH : true);
      });

      it('ordena por data.updatedAt y no por el occurredAt del sobre, que puede ser de una publicación demorada (M2, 20/10)', async () => {
        const T3 = new Date('2026-10-01T10:10:00.000Z');
        await h(
          evento('PRIORITY_CHANGED', { currentPriority: 'HIGH', updatedAt: T2.toISOString() }),
          T2,
        );
        // El cambio viejo se publicó tarde: su occurredAt (T3) es posterior, su updatedAt (T1) no.
        await h(
          evento('PRIORITY_CHANGED', { currentPriority: 'LOW', updatedAt: T1.toISOString() }),
          T3,
        );

        expect(fila.priority).toEqual(Severity.HIGH);
        expect(fila.priorityChangedAt).toEqual(T2);
      });

      it('con un updatedAt ilegible o en el futuro ordena por el occurredAt del sobre', async () => {
        await h(evento('PRIORITY_CHANGED', { currentPriority: 'HIGH', updatedAt: 'ayer' }), T2);
        await h(
          evento('PRIORITY_CHANGED', {
            currentPriority: 'LOW',
            updatedAt: new Date(Date.now() + 3_600_000).toISOString(),
          }),
          T1,
        );

        expect(fila.priority).toEqual(Severity.HIGH);
        expect(fila.priorityChangedAt).toEqual(T2);
      });

      it('una marca por campo: un PRIORITY_CHANGED nuevo no descarta un ESCALATION_CHANGED atrasado', async () => {
        await h(evento('PRIORITY_CHANGED', { currentPriority: 'HIGH' }), T2);
        await h(evento('ESCALATION_CHANGED', { details: { escalation: { active: true } } }), T1);

        expect(fila.escalated).toBe(true);
      });

      it('sin occurredAt aplica como antes, aunque haya marca, y lo loguea', async () => {
        fila.priorityChangedAt = T2;

        await h(evento('PRIORITY_CHANGED', { currentPriority: 'LOW' }), null);

        expect(fila.priority).toBe(Severity.LOW);
        expect(fila.priorityChangedAt).toEqual(T2);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('sin occurredAt'));
      });

      // ─── #275: el ROUTED que abre el expediente llega después ──

      describe('antes del ROUTED', () => {
        const T0 = new Date('2026-10-01T09:55:00.000Z');
        const T1_MENOS_1MS = new Date(T1.getTime() - 1);
        const routed = evento('ROUTED', {
          currentPriority: 'LOW',
          details: { routing: { requestType: 'Ruidos molestos', escalation: { active: false } } },
        });

        beforeEach(() => {
          existe = false;
        });

        // [updateType, payload, campo, valor, marca]
        it.each([
          [
            'PRIORITY_CHANGED',
            { currentPriority: 'HIGH' },
            'priority',
            Severity.HIGH,
            'priorityChangedAt',
          ],
          [
            'ESCALATION_CHANGED',
            { details: { escalation: { active: true } } },
            'escalated',
            true,
            'escalationChangedAt',
          ],
          [
            'INFORMATION_PROVIDED',
            { details: { informationResponse: { message: 'Frente al 1240' } } },
            'citizenResponse',
            'Frente al 1240',
            'citizenResponseAt',
          ],
        ])(
          '%s sin expediente falla, y su reintento aplica tras el ROUTED',
          async (updateType, extra, campo, valor, marca) => {
            // El mensaje lleva el ticketId y nada del payload.
            await expect(h(evento(updateType, extra), T2)).rejects.toThrow(
              new Error(
                `ticketUpdated/${updateType}: el expediente todavía no existe para el ticket TCK-1; se reintenta tras el ROUTED`,
              ),
            );

            await h(routed, T1);
            await h(evento(updateType, extra), T2);

            expect(fila[campo]).toEqual(valor);
            expect(fila[marca]).toEqual(T2);
          },
        );

        it('sin occurredAt también falla: el expediente no existe igual', async () => {
          await expect(
            h(evento('PRIORITY_CHANGED', { currentPriority: 'HIGH' }), null),
          ).rejects.toThrow('se reintenta tras el ROUTED');
        });

        it('si el ROUTED abre el expediente entre el update y la lectura, se reintenta', async () => {
          prisma.environmentalReport.updateMany.mockResolvedValueOnce({ count: 0 });
          await h(routed, T1);

          await expect(
            h(evento('PRIORITY_CHANGED', { currentPriority: 'HIGH' }), T2),
          ).rejects.toThrow('se reintenta tras el ROUTED');
        });

        it('el ROUTED deja las marcas justo antes de su occurredAt: un cambio anterior que reintenta después no pisa el snapshot', async () => {
          await h(routed, T1);

          expect(fila).toMatchObject({
            ticketStatusAt: T1_MENOS_1MS,
            priorityChangedAt: T1_MENOS_1MS,
            escalationChangedAt: T1_MENOS_1MS,
            citizenResponseAt: null,
          });

          await h(evento('PRIORITY_CHANGED', { currentPriority: 'CRITICAL' }), T0);
          await h(evento('ESCALATION_CHANGED', { details: { escalation: { active: true } } }), T0);
          await h(evento('REOPENED'), T0);

          expect(fila).toMatchObject({
            priority: Severity.LOW,
            escalated: false,
            status: S.RECEIVED,
          });
          expect(warn).toHaveBeenCalledWith(expect.stringContaining('se ignora'));
        });

        it('un cambio explícito del mismo instante que el ROUTED le gana al snapshot', async () => {
          // M2 deriva y escala en la misma transacción: mismo now() en los dos.
          await h(routed, T1);
          await h(evento('ESCALATION_CHANGED', { details: { escalation: { active: true } } }), T1);
          await h(evento('PRIORITY_CHANGED', { currentPriority: 'HIGH' }), T1);

          expect(fila).toMatchObject({
            escalated: true,
            escalationChangedAt: T1,
            priority: Severity.HIGH,
            priorityChangedAt: T1,
          });

          // El reintento de ese mismo cambio ya aplicado sí se reconoce.
          await h(evento('ESCALATION_CHANGED', { details: { escalation: { active: false } } }), T1);
          expect(fila.escalated).toBe(true);
        });

        it('una respuesta del vecino anterior al ROUTED se guarda igual: el snapshot no la trae', async () => {
          await h(routed, T1);

          await h(
            evento('INFORMATION_PROVIDED', {
              details: { informationResponse: { message: 'Frente al 1240' } },
            }),
            T0,
          );

          expect(fila.citizenResponse).toBe('Frente al 1240');
        });

        it('el ROUTED no marca lo que su snapshot no trae', async () => {
          await h(evento('ROUTED'), T1);

          expect(fila).toMatchObject({
            ticketStatusAt: T1_MENOS_1MS,
            priorityChangedAt: null,
            escalationChangedAt: null,
          });
        });

        it('el ROUTED sin occurredAt no deja marcas, como antes', async () => {
          await h(routed, null);

          expect(fila).toMatchObject({
            ticketStatusAt: null,
            priorityChangedAt: null,
            escalationChangedAt: null,
          });
        });

        it('REOPENED sin expediente no reintenta: no hay nada que reabrir', async () => {
          await expect(h(evento('REOPENED'), T2)).resolves.toBeUndefined();

          expect(prisma.environmentalReport.updateMany).not.toHaveBeenCalled();
        });

        describe('por el inbox', () => {
          const eventId = '646d19f5-5670-4a7b-9442-30e13b02ba11';
          const sobre = (data: Record<string, unknown>) => ({
            eventId,
            eventType: 'ticketUpdated',
            occurredAt: T2.toISOString(),
            data,
          });

          beforeEach(() => {
            prisma.inboxEvent = {
              create: jest.fn().mockResolvedValue({}),
              update: jest.fn().mockResolvedValue({}),
              updateMany: jest.fn().mockResolvedValue({ count: 1 }),
              findUniqueOrThrow: jest.fn(),
            };
          });

          it('sale failed, y el reintento del Core lo aplica tras el ROUTED', async () => {
            const data = evento('PRIORITY_CHANGED', { currentPriority: 'HIGH' });

            const primero = await inbox.ingest(sobre(data));
            expect(primero.status).toBe('failed');

            await h(routed, T1);

            // El reintento: la fila ya existe y se reproduce con lo guardado.
            prisma.inboxEvent.create.mockRejectedValue(
              new Prisma.PrismaClientKnownRequestError('dup', {
                code: 'P2002',
                clientVersion: '5.22.0',
              }),
            );
            prisma.inboxEvent.findUniqueOrThrow.mockResolvedValue({
              payload: data,
              correlationId: null,
              occurredAt: T2,
            });
            const reintento = await inbox.ingest(sobre(data));

            expect(reintento.status).toBe('processed');
            expect(fila.priority).toBe(Severity.HIGH);
          });

          it('un ticket ajeno sin expediente sale processed, sin reintento', async () => {
            const { status } = await inbox.ingest(
              sobre({
                ...evento('PRIORITY_CHANGED', { currentPriority: 'HIGH' }),
                responsibleAreaId: 'M3',
              }),
            );

            expect(status).toBe('processed');
            expect(prisma.environmentalReport.updateMany).not.toHaveBeenCalled();
          });
        });
      });

      it('un REOPENED atrasado no revive el expediente de un reclamo cancelado después', async () => {
        await h(evento('CANCELLED'), T2);
        await expect(h(evento('REOPENED'), T1)).resolves.toBeUndefined();

        expect(fila.status).toBe(S.CLOSED);
        expect(fila.ticketStatusAt).toEqual(T2);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('se ignora'));
      });

      it('un REOPENED más nuevo que la marca sí reabre', async () => {
        fila.ticketStatusAt = T1;

        await h(evento('REOPENED'), T2);

        expect(fila.status).toBe(S.UNDER_REVIEW);
        expect(fila.ticketStatusAt).toEqual(T2);
      });

      it('un CANCELLED atrasado no toca servicios ni expediente', async () => {
        Object.assign(fila, { status: S.UNDER_REVIEW, ticketStatusAt: T2 });

        await h(evento('CANCELLED'), T1);

        expect(prisma.service.updateMany).not.toHaveBeenCalled();
        expect(fila.status).toBe(S.UNDER_REVIEW);
      });

      // Igual a la marca = ya aplicado: re-aplicarlo no es idempotente.
      it('un REOPENED con occurredAt igual a la marca no reabre lo que el operador volvió a cerrar', async () => {
        await h(evento('REOPENED'), T1);
        fila.status = S.CLOSED;

        await h(evento('REOPENED'), T1);

        expect(fila.status).toBe(S.CLOSED);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('se ignora'));
      });

      it('un CANCELLED con occurredAt igual a la marca no vuelve a cancelar servicios', async () => {
        fila.ticketStatusAt = T1;

        await h(evento('CANCELLED'), T1);

        expect(prisma.service.updateMany).not.toHaveBeenCalled();
      });

      it('CANCELLED sobre UNDER_REVIEW descarta el expediente y deja la marca', async () => {
        fila.status = S.UNDER_REVIEW;

        await h(evento('CANCELLED'), T2);

        expect(fila.status).toBe(S.DISMISSED);
        expect(fila.ticketStatusAt).toEqual(T2);
        expect(prisma.service.updateMany).toHaveBeenCalled();
      });

      it('CANCELLED: si la marca avanzó entre la lectura y la transacción, no cancela servicios', async () => {
        prisma.environmentalReport.findFirst.mockImplementationOnce(async () => {
          const leida = { ...fila };
          fila.ticketStatusAt = T2; // un REOPENED(T2) que entra en el medio
          return leida;
        });

        await h(evento('CANCELLED'), T1);

        expect(prisma.service.updateMany).not.toHaveBeenCalled();
        expect(fila.ticketStatusAt).toEqual(T2);
      });

      it('CANCELLED con occurredAt pero sin expediente cancela los servicios igual', async () => {
        prisma.environmentalReport.findFirst.mockResolvedValue(null);

        await h(evento('CANCELLED'), T1);

        expect(prisma.service.updateMany).toHaveBeenCalled();
        expect(fila.ticketStatusAt).toBeNull();
      });

      it('por el inbox, un occurredAt en el futuro se aplica sin ordenar y no deja marca', async () => {
        fila.priorityChangedAt = T2;
        prisma.inboxEvent = {
          create: jest.fn().mockResolvedValue({}),
          update: jest.fn().mockResolvedValue({}),
        };

        await inbox.ingest({
          eventId: '646d19f5-5670-4a7b-9442-30e13b02ba11',
          eventType: 'ticketUpdated',
          occurredAt: '2999-12-31T23:59:59Z',
          data: evento('PRIORITY_CHANGED', { currentPriority: 'HIGH' }),
        });

        expect(fila.priority).toBe(Severity.HIGH);
        expect(fila.priorityChangedAt).toEqual(T2);
      });

      it('por el inbox, el atrasado sale processed: reintentarlo no lo haría más nuevo', async () => {
        fila.escalationChangedAt = T2;
        prisma.inboxEvent = {
          create: jest.fn().mockResolvedValue({}),
          update: jest.fn().mockResolvedValue({}),
        };

        const { status } = await inbox.ingest({
          eventId: '646d19f5-5670-4a7b-9442-30e13b02ba11',
          eventType: 'ticketUpdated',
          occurredAt: T1.toISOString(),
          data: evento('ESCALATION_CHANGED', { details: { escalation: { active: true } } }),
        });

        expect(status).toBe('processed');
        expect(fila.escalated).toBe(false);
      });
    });

    it.each([
      'CONTENT_UPDATED',
      'PROGRESS',
      'DUPLICATE_LINKED',
      'STATUS_CHANGED',
      'RESOLVED',
      'CLOSED',
    ])('%s se descarta a proposito, sin efecto', async (updateType) => {
      await h({ ticketId: 'TCK-1', responsibleAreaId: 'M6', updateType });

      expect(prisma.environmentalReport.create).not.toHaveBeenCalled();
      expect(prisma.environmentalReport.update).not.toHaveBeenCalled();
      expect(prisma.environmentalReport.updateMany).not.toHaveBeenCalled();
      expect(prisma.service.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('alerta meteorológica simulada', () => {
    let h: (d: Record<string, unknown>) => Promise<void>;

    beforeEach(() => {
      h = registrar(
        new WeatherConsumer(prisma as unknown as PrismaService, inbox),
        inbox,
      )('weatherAlertIssued');
    });

    it('una alerta severa marca los servicios de la zona para reprogramar', async () => {
      await h({
        alertType: 'TORMENTA',
        severity: 'CRITICAL',
        zoneIds: ['z1', 'z2'],
        from: '2026-10-01T00:00:00.000Z',
        to: '2026-10-02T00:00:00.000Z',
      });

      const [[args]] = prisma.service.updateMany.mock.calls;
      expect(args.data.status).toBe(ServiceStatus.RESCHEDULED);
      expect(args.where.zones).toEqual({ some: { zoneId: { in: ['z1', 'z2'] } } });
    });

    it('una alerta leve avisa pero no reprograma', async () => {
      await h({ alertType: 'LLUVIA', severity: 'LOW', zoneIds: ['z1'] });

      expect(prisma.service.updateMany).not.toHaveBeenCalled();
    });

    it('una alerta severa sin ventana from/to se descarta: no reprograma todas las fechas', async () => {
      await h({ severity: 'CRITICAL', zoneIds: ['z1'], from: '2026-10-01T00:00:00.000Z' });
      await h({ severity: 'CRITICAL', zoneIds: ['z1'], to: '2026-10-02T00:00:00.000Z' });
      await h({ severity: 'CRITICAL', zoneIds: ['z1'], from: 'mañana', to: 'pasado' });

      expect(prisma.service.updateMany).not.toHaveBeenCalled();
    });

    it('la ventana acota los servicios por scheduledDate', async () => {
      await h({
        severity: 'HIGH',
        zoneIds: ['z1'],
        from: '2026-10-01T00:00:00.000Z',
        to: '2026-10-02T00:00:00.000Z',
      });

      const [[args]] = prisma.service.updateMany.mock.calls;
      expect(args.where.scheduledDate).toEqual({
        gte: new Date('2026-10-01T00:00:00.000Z'),
        lte: new Date('2026-10-02T00:00:00.000Z'),
      });
    });

    it.each([
      ['hora distinta de 00:00', '2026-10-01T06:00:00.000Z', '2026-10-02T18:30:00.000Z'],
      ['offset -03:00', '2026-10-01T10:00:00-03:00', '2026-10-02T20:00:00-03:00'],
    ])('la ventana se trunca al día (%s): entra el servicio del 1/10', async (_, from, to) => {
      await h({ severity: 'CRITICAL', zoneIds: ['z1'], from, to });

      const [[args]] = prisma.service.updateMany.mock.calls;
      expect(args.where.scheduledDate).toEqual({
        gte: new Date('2026-10-01T00:00:00.000Z'),
        lte: new Date('2026-10-02T00:00:00.000Z'),
      });
    });

    it('sin zonas no hay a que aplicarlo', async () => {
      await h({ severity: 'CRITICAL', zoneIds: [] });

      expect(prisma.service.updateMany).not.toHaveBeenCalled();
    });
  });
});
