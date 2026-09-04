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
      repairRequest: { findUnique: jest.fn(), update: jest.fn() },
      streetClosureRequest: { findUnique: jest.fn(), update: jest.fn() },
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

      expect(prisma.repairRequest.update).toHaveBeenCalledWith({
        where: { id: ID },
        data: { status: RepairRequestStatus.IN_PROGRESS, workOrderId: 'OT-1' },
      });
    });

    it('un sourceRequestId que no es nuestro se descarta sin fallar', async () => {
      prisma.repairRequest.findUnique.mockResolvedValue(null);

      await expect(h('workOrderScheduled')({ sourceRequestId: 'ajeno' })).resolves.toBeUndefined();
      expect(prisma.repairRequest.update).not.toHaveBeenCalled();
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

      await h('streetClosureRejected')({ closureRequestId: ID, reason: 'se superpone' });

      const [[args]] = prisma.service.updateMany.mock.calls;
      expect(args.data.status).toBe(ServiceStatus.RESCHEDULED);
      expect(args.data.statusReason).toContain('se superpone');
    });

    it('el corte aprobado guarda el identificador de M7', async () => {
      prisma.streetClosureRequest.findUnique.mockResolvedValue({ id: ID, sourceType: 'SERVICE' });

      await h('streetClosureApproved')({ closureRequestId: ID, streetClosureId: 'CL-1' });

      expect(prisma.streetClosureRequest.update).toHaveBeenCalledWith({
        where: { id: ID },
        data: { status: StreetClosureRequestStatus.APPROVED, closureId: 'CL-1' },
      });
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

    it('ROUTED abre el expediente y deduce el tipo del texto', async () => {
      await h({
        ticketId: 'TCK-1',
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
      expect(args.data.priority).toBe(Severity.HIGH);
      expect(args.data.reporterSnapshot).toEqual({ isAnonymous: false, citizenId: 'cit-1' });
    });

    it('un ROUTED anonimo no guarda identidad', async () => {
      await h({ ticketId: 'TCK-1', updateType: 'ROUTED', isAnonymous: true, citizenId: 'cit-1' });

      const [[args]] = prisma.environmentalReport.create.mock.calls;
      expect(args.data.reporterSnapshot).toEqual({ isAnonymous: true });
    });

    it('un ROUTED repetido no abre un segundo expediente', async () => {
      prisma.environmentalReport.findFirst.mockResolvedValue({ id: 'ya-existe' });

      await h({ ticketId: 'TCK-1', updateType: 'ROUTED' });

      expect(prisma.environmentalReport.create).not.toHaveBeenCalled();
    });

    it('CANCELLED cancela los servicios programados del reclamo', async () => {
      await h({ ticketId: 'TCK-1', updateType: 'CANCELLED' });

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
      await h({ ticketId: 'TCK-1', updateType: 'CANCELLED' });

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
      ['ESCALATION_CHANGED', { escalation: { escalated: true } }, 'escalated'],
      ['INFORMATION_PROVIDED', { publicMessage: 'El ruido sigue' }, 'citizenResponse'],
      ['PRIORITY_CHANGED', { currentPriority: 'CRITICAL' }, 'priority'],
    ])('%s se acepta aunque el expediente esté cerrado', async (updateType, extra, campo) => {
      prisma.environmentalReport.findFirst.mockResolvedValue({ id: 'rep-1', status: S.CLOSED });

      await h({ ticketId: 'TCK-1', updateType, ...extra });

      const [[args]] = prisma.environmentalReport.updateMany.mock.calls;
      expect(args.where).toEqual({ ticketId: 'TCK-1' });
      expect(args.data).toHaveProperty(campo);
    });

    it('REOPENED no reabre un expediente que no admite la transicion', async () => {
      prisma.environmentalReport.findFirst.mockResolvedValue({
        id: 'rep-1',
        status: S.SANCTIONED,
      });

      await h({ ticketId: 'TCK-1', updateType: 'REOPENED' });

      expect(prisma.environmentalReport.update).not.toHaveBeenCalled();
    });

    it('REOPENED sí reabre desde CLOSED', async () => {
      prisma.environmentalReport.findFirst.mockResolvedValue({ id: 'rep-1', status: S.CLOSED });

      await h({ ticketId: 'TCK-1', updateType: 'REOPENED' });

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
      await h({ ticketId: 'TCK-1', updateType });

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

    it('sin zonas no hay a que aplicarlo', async () => {
      await h({ severity: 'CRITICAL', zoneIds: [] });

      expect(prisma.service.updateMany).not.toHaveBeenCalled();
    });
  });
});
