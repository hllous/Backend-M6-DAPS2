import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import {
  EnvironmentalReportStatus as S,
  InspectionNextStep,
  InspectionOutcome,
  ServiceMode,
  Severity,
  SuggestedAction,
  ViolationType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EnvironmentalReportsService } from '../environmental-reports/environmental-reports.service';
import { EnvironmentalInspectionsService } from './environmental-inspections.service';
import { CompleteInspectionDto, CreateInspectionDto } from './dto';

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
        findMany: jest.fn(),
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
      service: {
        findUnique: jest.fn().mockResolvedValue({ id: 'svc-1', mode: ServiceMode.POINT }),
      },
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
        nextStep: InspectionNextStep.NOTICE_TO_BE_ISSUED,
      });

      const estados = prisma.environmentalReport.update.mock.calls.map(
        ([a]: [{ data: { status: string } }]) => a.data.status,
      );
      expect(estados).toEqual([S.INSPECTED, S.VIOLATION_FOUND]);
    });

    it('inspectedAt en el futuro da 400', async () => {
      await expect(
        service.complete(INSPECTION_ID, {
          inspectedAt: '2030-01-01T00:00:00.000Z',
          outcome: InspectionOutcome.NO_VIOLATION,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.environmentalInspection.update).not.toHaveBeenCalled();
    });

    it('VIOLATION_FOUND sin nextStep da 400', async () => {
      await expect(
        service.complete(INSPECTION_ID, {
          inspectedAt: '2026-09-10T11:30:00.000Z',
          outcome: InspectionOutcome.VIOLATION_FOUND,
        }),
      ).rejects.toThrow(BadRequestException);
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

    it('con checklist, reemplaza los items existentes', async () => {
      await service.complete(INSPECTION_ID, {
        inspectedAt: '2026-09-10T11:30:00.000Z',
        outcome: InspectionOutcome.NO_VIOLATION,
        checklist: [{ itemCode: 'C1', label: 'Ventilación', result: true }],
      } as CompleteInspectionDto);

      const [[args]] = prisma.environmentalInspection.update.mock.calls;
      expect(args.data.checklistItems.deleteMany).toEqual({});
      expect(args.data.checklistItems.createMany.data).toEqual([
        { itemCode: 'C1', label: 'Ventilación', result: true, observations: null },
      ]);
    });

    it('sin checklist, no toca los items existentes', async () => {
      await service.complete(INSPECTION_ID, {
        inspectedAt: '2026-09-10T11:30:00.000Z',
        outcome: InspectionOutcome.NO_VIOLATION,
      });

      const [[args]] = prisma.environmentalInspection.update.mock.calls;
      expect(args.data).not.toHaveProperty('checklistItems');
    });
  });

  describe('create', () => {
    beforeEach(() => {
      prisma.environmentalReport.findUnique.mockResolvedValue(report({ status: S.UNDER_REVIEW }));
      prisma.environmentalInspection.create.mockResolvedValue(inspection({ outcome: null }));
    });

    it('programa la inspección y lleva el expediente a INSPECTION_SCHEDULED', async () => {
      const result = await service.create(REPORT_ID, {});

      expect(result.id).toBe(INSPECTION_ID);
      const [[args]] = prisma.environmentalReport.update.mock.calls;
      expect(args.data.status).toBe(S.INSPECTION_SCHEDULED);
      // environmentalInspectionScheduled se descartó a propósito (ver ADR):
      // una regresión que lo reintroduzca no debería pasar en silencio.
      expect(outbox.enqueue).not.toHaveBeenCalled();
    });

    it('con serviceId, valida que el servicio sea de modo POINT', async () => {
      await service.create(REPORT_ID, { serviceId: 'svc-1' } as CreateInspectionDto);

      expect(prisma.service.findUnique).toHaveBeenCalledWith({
        where: { id: 'svc-1' },
        select: { id: true, mode: true },
      });
      const [[args]] = prisma.environmentalInspection.create.mock.calls;
      expect(args.data.serviceId).toBe('svc-1');
    });

    it('rechaza un serviceId inexistente', async () => {
      prisma.service.findUnique.mockResolvedValue(null);

      await expect(
        service.create(REPORT_ID, { serviceId: 'svc-x' } as CreateInspectionDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('rechaza un servicio que no es de modo POINT', async () => {
      prisma.service.findUnique.mockResolvedValue({ id: 'svc-1', mode: ServiceMode.ROUTE });

      await expect(
        service.create(REPORT_ID, { serviceId: 'svc-1' } as CreateInspectionDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('sin serviceId no consulta el servicio', async () => {
      await service.create(REPORT_ID, {});
      expect(prisma.service.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('consultas', () => {
    it('findByReport valida que el expediente exista y lista sus inspecciones', async () => {
      prisma.environmentalInspection.findMany.mockResolvedValue([inspection()]);

      const result = await service.findByReport(REPORT_ID);

      expect(prisma.environmentalReport.findUnique).toHaveBeenCalledWith({
        where: { id: REPORT_ID },
      });
      expect(result[0].id).toBe(INSPECTION_ID);
    });

    it('findByReport lanza 404 si el expediente no existe', async () => {
      prisma.environmentalReport.findUnique.mockResolvedValue(null);

      await expect(service.findByReport('no-existe')).rejects.toThrow(NotFoundException);
      expect(prisma.environmentalInspection.findMany).not.toHaveBeenCalled();
    });

    it('findOne devuelve la inspección', async () => {
      const result = await service.findOne(INSPECTION_ID);
      expect(result.id).toBe(INSPECTION_ID);
    });

    it('findOne lanza 404 si no existe', async () => {
      prisma.environmentalInspection.findUnique.mockResolvedValue(null);
      await expect(service.findOne('no-existe')).rejects.toThrow(NotFoundException);
    });

    it('findOne mapea el checklist relevado', async () => {
      prisma.environmentalInspection.findUnique.mockResolvedValue(
        inspection({
          checklistItems: [
            { id: 'ci-1', itemCode: 'C1', label: 'Ventilación', result: 'OK', observations: null },
          ],
        }),
      );

      const result = await service.findOne(INSPECTION_ID);
      expect(result.checklistItems).toEqual([
        { id: 'ci-1', itemCode: 'C1', label: 'Ventilación', result: 'OK', observations: null },
      ]);
    });

    it('findNotice devuelve el acta de la inspección', async () => {
      prisma.violationNotice.findUnique.mockResolvedValue({
        id: 'notice-1',
        noticeNumber: 'ACTA-2026-000001',
        inspectionId: INSPECTION_ID,
        issuedAt: new Date(),
        establishmentId: null,
        violationType: ViolationType.UNTREATED_DISCHARGE,
        severity: Severity.HIGH,
        suggestedAction: SuggestedAction.FINE,
        priorNoticeCount: 0,
        createdAt: new Date(),
      });

      const result = await service.findNotice(INSPECTION_ID);
      expect(result.noticeNumber).toBe('ACTA-2026-000001');
    });

    it('findNotice lanza 404 si la inspección no tiene acta', async () => {
      prisma.violationNotice.findUnique.mockResolvedValue(null);
      await expect(service.findNotice(INSPECTION_ID)).rejects.toThrow(NotFoundException);
    });
  });
});
