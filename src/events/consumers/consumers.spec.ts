import { Logger } from '@nestjs/common';
import {
  EnvironmentalReportStatus as S,
  RepairRequestStatus,
  SanctionDecision,
  ServiceStatus,
  Severity,
  StreetClosureRequestStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { InboxService } from '../inbox/inbox.service';
import { OutboundResponsesConsumer } from './outbound-responses.consumer';
import { SanctionsConsumer } from './sanctions.consumer';
import { TicketsConsumer } from './tickets.consumer';
import { WeatherConsumer } from './weather.consumer';

/** Registra los handlers y devuelve el de un tipo, para invocarlo directo. */
function registrar(consumer: { onModuleInit: () => void }, inbox: InboxService) {
  consumer.onModuleInit();
  return (tipo: string) =>
    (
      inbox as unknown as { handlers: Map<string, (d: Record<string, unknown>) => Promise<void>> }
    ).handlers.get(tipo)!;
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

    it('streetClosureEnded sobre un corte REJECTED o ENDED se descarta; REQUESTED y APPROVED se aceptan', async () => {
      prisma.streetClosureRequest.findUnique.mockResolvedValue({ id: ID, status: 'ENDED' });
      prisma.streetClosureRequest.updateMany.mockResolvedValue({ count: 0 });
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

      await expect(h('streetClosureEnded')({ closureRequestId: ID })).resolves.toBeUndefined();

      const [[args]] = prisma.streetClosureRequest.updateMany.mock.calls;
      expect(args.where.status).toEqual({
        in: [StreetClosureRequestStatus.REQUESTED, StreetClosureRequestStatus.APPROVED],
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
            in: [StreetClosureRequestStatus.REQUESTED, StreetClosureRequestStatus.APPROVED],
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
            in: [StreetClosureRequestStatus.REQUESTED, StreetClosureRequestStatus.APPROVED],
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
    let h: (d: Record<string, unknown>) => Promise<void>;

    beforeEach(() => {
      h = registrar(
        new TicketsConsumer(prisma as unknown as PrismaService, inbox),
        inbox,
      )('ticketUpdated');
      prisma.environmentalReport.findFirst.mockResolvedValue(null);
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

      expect(prisma.environmentalReport.update).not.toHaveBeenCalled();
    });

    it('REOPENED sí reabre desde CLOSED', async () => {
      prisma.environmentalReport.findFirst.mockResolvedValue({ id: 'rep-1', status: S.CLOSED });

      await h({ ticketId: 'TCK-1', responsibleAreaId: 'M6', updateType: 'REOPENED' });

      expect(prisma.environmentalReport.update).toHaveBeenCalledWith({
        where: { id: 'rep-1' },
        data: { status: S.UNDER_REVIEW },
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
