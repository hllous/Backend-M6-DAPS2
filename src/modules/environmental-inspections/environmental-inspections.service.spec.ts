import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  EnvironmentalReportStatus as S,
  InspectionOutcome,
  Severity,
  SuggestedAction,
  ViolationType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EnvironmentalReportsService } from '../environmental-reports/environmental-reports.service';
import { EnvironmentalInspectionsService } from './environmental-inspections.service';

describe('EnvironmentalInspectionsService', () => {
  const INSPECTION_ID = '11111111-1111-1111-1111-111111111111';
  const REPORT_ID = '22222222-2222-2222-2222-222222222222';
  const ESTABLISHMENT = 'EST-004512';

  let prisma: any;
  let outbox: any;
  let reports: EnvironmentalReportsService;
  let service: EnvironmentalInspectionsService;

  const report = (over: Record<string, unknown> = {}) => ({
    id: REPORT_ID,
    reportType: 'ILLEGAL_DUMPSITE',
    status: S.VIOLATION_FOUND,
    address: 'Camino de Cintura 4500',
    lat: null,
    lng: null,
    ticketId: null,
    priority: null,
    deadlineAt: null,
    reporterSnapshot: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  });

  const inspection = (over: Record<string, unknown> = {}) => ({
    id: INSPECTION_ID,
    reportId: REPORT_ID,
    serviceId: null,
    inspectorId: 'user-014',
    inspectedAt: new Date('2026-09-10T11:30:00.000Z'),
    findings: 'Vertido sin tratar',
    outcome: InspectionOutcome.VIOLATION_FOUND,
    nextStep: null,
    checklistItems: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  });

  const noticeDto = {
    violationType: ViolationType.UNTREATED_DISCHARGE,
    severity: Severity.HIGH,
    suggestedAction: SuggestedAction.FINE,
  };

  beforeEach(() => {
    prisma = {
      environmentalInspection: {
        findUnique: jest.fn().mockResolvedValue(inspection()),
        create: jest.fn(),
        update: jest.fn(),
      },
      environmentalReport: {
        findUnique: jest.fn().mockResolvedValue(report()),
        update: jest.fn(),
      },
      violationNotice: {
        findUnique: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(2),
        create: jest.fn((args) => ({ ...args.data, id: 'notice-1', createdAt: new Date() })),
      },
      service: { findUnique: jest.fn() },
      attachment: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    outbox = { enqueue: jest.fn(), enqueueMany: jest.fn() };
    reports = new EnvironmentalReportsService(prisma as unknown as PrismaService, outbox);
    service = new EnvironmentalInspectionsService(
      prisma as unknown as PrismaService,
      outbox,
      reports,
      { get: () => 30 } as never,
    );
  });

  describe('emisión del acta', () => {
    it('cuenta las actas previas del mismo establecimiento', async () => {
      const result = await service.issueNotice(
        INSPECTION_ID,
        { ...noticeDto, establishmentId: ESTABLISHMENT },
        'user-1',
      );

      expect(prisma.violationNotice.count).toHaveBeenCalledWith({
        where: { establishmentId: ESTABLISHMENT },
      });
      expect(result.priorNoticeCount).toBe(2);
    });

    it('publica environmentalViolationDetected cuando hay establecimiento', async () => {
      await service.issueNotice(
        INSPECTION_ID,
        { ...noticeDto, establishmentId: ESTABLISHMENT },
        'user-1',
      );

      const [[, entry]] = outbox.enqueue.mock.calls;
      expect(entry.eventType).toBe('environmentalViolationDetected');
      expect(entry.payload.establishmentId).toBe(ESTABLISHMENT);
      expect(entry.payload.priorNoticeCount).toBe(2);
    });

    it('SIN establecimiento el acta se registra pero NO se deriva a M4', async () => {
      const result = await service.issueNotice(INSPECTION_ID, noticeDto, 'user-1');

      expect(result.establishmentId).toBeNull();
      expect(outbox.enqueue).not.toHaveBeenCalled();
      expect(prisma.violationNotice.create).toHaveBeenCalled();
    });

    it('sin establecimiento no se consulta la reincidencia', async () => {
      await service.issueNotice(INSPECTION_ID, noticeDto, 'user-1');

      // count() se sigue llamando para el numero correlativo, pero nunca
      // filtrando por establishmentId.
      const filtros = prisma.violationNotice.count.mock.calls.map(([a]: [any]) => a.where);
      expect(filtros).not.toContainEqual(
        expect.objectContaining({ establishmentId: expect.anything() }),
      );
    });

    it('el acta es inmutable: no se emite una segunda sobre la misma inspeccion', async () => {
      prisma.violationNotice.findUnique.mockResolvedValue({ id: 'ya-existe' });

      await expect(service.issueNotice(INSPECTION_ID, noticeDto, 'user-1')).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.violationNotice.create).not.toHaveBeenCalled();
    });

    it('no se emite acta sobre una inspeccion sin VIOLATION_FOUND', async () => {
      prisma.environmentalInspection.findUnique.mockResolvedValue(
        inspection({ outcome: InspectionOutcome.NO_VIOLATION }),
      );

      await expect(service.issueNotice(INSPECTION_ID, noticeDto, 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('no se emite acta sobre una inspeccion sin cerrar', async () => {
      prisma.environmentalInspection.findUnique.mockResolvedValue(inspection({ outcome: null }));

      await expect(service.issueNotice(INSPECTION_ID, noticeDto, 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    const conEstablecimiento = { ...noticeDto, establishmentId: ESTABLISHMENT };

    it('el acta viaja con la evidencia de su inspeccion', async () => {
      prisma.attachment.findMany.mockResolvedValue([
        {
          url: 'https://cdn.example.com/e/1.jpg',
          contentType: 'image/jpeg',
          filename: 'medidor-frente.jpg',
        },
      ]);

      await service.issueNotice(INSPECTION_ID, conEstablecimiento, 'user-1');

      const [[, entrada]] = outbox.enqueue.mock.calls;
      expect(entrada.payload.evidence).toEqual([
        { url: 'https://cdn.example.com/e/1.jpg', mimeType: 'image/jpeg' },
      ]);
    });

    /**
     * Las fotos son de la inspeccion, no del acta: `AttachmentOwnerType` no
     * tiene `VIOLATION_NOTICE` porque el acta formaliza lo que la inspeccion
     * encontro, no aporta adjuntos propios.
     */
    it('busca la evidencia de la inspeccion, no la del acta', async () => {
      await service.issueNotice(INSPECTION_ID, conEstablecimiento, 'user-1');

      const [[args]] = prisma.attachment.findMany.mock.calls;
      expect(args.where).toEqual({ ownerType: 'INSPECTION', ownerId: INSPECTION_ID });
    });

    it('sin evidencia el acta viaja igual, con la lista vacia', async () => {
      await service.issueNotice(INSPECTION_ID, conEstablecimiento, 'user-1');

      const [[, entrada]] = outbox.enqueue.mock.calls;
      expect(entrada.payload.evidence).toEqual([]);
    });

    /** Sin establecimiento no se deriva nada, asi que no hay que ir a buscarla. */
    it('un acta que no se deriva no consulta la evidencia', async () => {
      await service.issueNotice(INSPECTION_ID, noticeDto, 'user-1');

      expect(prisma.attachment.findMany).not.toHaveBeenCalled();
    });

    it('fija el plazo de vencimiento sobre el expediente', async () => {
      await service.issueNotice(
        INSPECTION_ID,
        { ...noticeDto, establishmentId: ESTABLISHMENT },
        'user-1',
      );

      const [[args]] = prisma.environmentalReport.update.mock.calls;
      expect(args.data.status).toBe(S.NOTICE_ISSUED);
      expect(args.data.deadlineAt).toBeInstanceOf(Date);
    });

    it('el numero de acta es correlativo por anio', async () => {
      prisma.violationNotice.count
        .mockResolvedValueOnce(2) // reincidencia
        .mockResolvedValueOnce(11); // actas del anio

      const result = await service.issueNotice(
        INSPECTION_ID,
        { ...noticeDto, establishmentId: ESTABLISHMENT },
        'user-1',
      );

      expect(result.noticeNumber).toMatch(/^ACTA-\d{4}-000012$/);
    });
  });

  describe('cierre de la inspección', () => {
    beforeEach(() => {
      prisma.environmentalInspection.findUnique.mockResolvedValue(inspection({ outcome: null }));
      prisma.environmentalReport.findUnique.mockResolvedValue(
        report({ status: S.INSPECTION_SCHEDULED }),
      );
      prisma.environmentalInspection.update.mockResolvedValue(inspection());
    });

    it('VIOLATION_FOUND lleva el expediente hasta VIOLATION_FOUND', async () => {
      await service.complete(INSPECTION_ID, {
        inspectedAt: '2026-09-10T11:30:00.000Z',
        outcome: InspectionOutcome.VIOLATION_FOUND,
      });

      const estados = prisma.environmentalReport.update.mock.calls.map(
        ([a]: [{ data: { status: string } }]) => a.data.status,
      );
      expect(estados).toEqual([S.INSPECTED, S.VIOLATION_FOUND]);
    });

    it('NO_VIOLATION lleva el expediente hasta NO_VIOLATION', async () => {
      await service.complete(INSPECTION_ID, {
        inspectedAt: '2026-09-10T11:30:00.000Z',
        outcome: InspectionOutcome.NO_VIOLATION,
      });

      const estados = prisma.environmentalReport.update.mock.calls.map(
        ([a]: [{ data: { status: string } }]) => a.data.status,
      );
      expect(estados).toEqual([S.INSPECTED, S.NO_VIOLATION]);
    });

    it('INCONCLUSIVE lo deja en INSPECTED, esperando otra inspeccion', async () => {
      await service.complete(INSPECTION_ID, {
        inspectedAt: '2026-09-10T11:30:00.000Z',
        outcome: InspectionOutcome.INCONCLUSIVE,
      });

      const estados = prisma.environmentalReport.update.mock.calls.map(
        ([a]: [{ data: { status: string } }]) => a.data.status,
      );
      expect(estados).toEqual([S.INSPECTED]);
    });

    it('una inspeccion ya cerrada no se vuelve a cerrar', async () => {
      prisma.environmentalInspection.findUnique.mockResolvedValue(inspection());

      await expect(
        service.complete(INSPECTION_ID, {
          inspectedAt: '2026-09-10T11:30:00.000Z',
          outcome: InspectionOutcome.NO_VIOLATION,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });
});
