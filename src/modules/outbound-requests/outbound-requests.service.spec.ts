import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import {
  EnvironmentalReportType,
  InspectionOutcome,
  RepairDamageType,
  RepairRequestStatus,
  Severity,
  StreetClosureRequestStatus,
  StreetClosureType,
  StreetDirection,
  TreeInterventionStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ACTOR } from '../../common/audit/audit-test-actor';
import { AuditService } from '../../common/audit/audit.service';
import { OutboundRequestsService } from './outbound-requests.service';
import { ClosureSourceType, DetectedInType } from './dto';
import { QueryRepairRequestsDto, QueryStreetClosureRequestsDto } from './dto/queries';

describe('OutboundRequestsService', () => {
  const SERVICE_ID = '11111111-1111-1111-1111-111111111111';
  const REQUEST_ID = '22222222-2222-2222-2222-222222222222';

  let prisma: any;
  let outbox: any;
  let audit: any;
  let service: OutboundRequestsService;

  const repairRow = (over: Record<string, unknown> = {}) => ({
    id: REQUEST_ID,
    damageType: RepairDamageType.BLOCKED_DRAIN,
    severity: Severity.HIGH,
    publicSafetyRisk: true,
    detectedInType: DetectedInType.SERVICE,
    detectedInId: SERVICE_ID,
    address: 'Rivadavia 4500',
    status: RepairRequestStatus.REQUESTED,
    workOrderId: null,
    requestedAt: new Date('2026-09-15T10:00:00.000Z'),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  });

  const closureRow = (over: Record<string, unknown> = {}) => ({
    id: REQUEST_ID,
    sourceType: ClosureSourceType.TREE_INTERVENTION,
    sourceId: SERVICE_ID,
    reason: 'Extracción con riesgo de caída',
    closureFrom: new Date('2026-10-05T07:00:00.000Z'),
    closureTo: new Date('2026-10-05T13:00:00.000Z'),
    closureType: StreetClosureType.PARTIAL,
    approvedFrom: null,
    approvedTo: null,
    rejectionReason: null,
    status: StreetClosureRequestStatus.REQUESTED,
    closureId: null,
    createdAt: new Date('2026-09-20T09:00:00.000Z'),
    updatedAt: new Date(),
    streets: [
      {
        id: 's1',
        streetName: 'Rivadavia',
        fromCross: 'Mitre',
        toCross: 'San Martín',
        direction: 'BOTH',
      },
      {
        id: 's2',
        streetName: 'Boyacá',
        fromCross: 'Rivadavia',
        toCross: 'Yerbal',
        direction: 'FORWARD',
      },
    ],
    ...over,
  });

  const inspectionRow = (
    outcome: InspectionOutcome | null = InspectionOutcome.VIOLATION_FOUND,
    reportType: EnvironmentalReportType = EnvironmentalReportType.WATER_DISCHARGE,
    ticketId: string | null = null,
  ) => ({ outcome, report: { reportType, ticketId } });

  beforeEach(() => {
    prisma = {
      repairRequest: {
        create: jest.fn().mockResolvedValue(repairRow()),
        findUnique: jest.fn().mockResolvedValue(repairRow()),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue(repairRow()),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      streetClosureRequest: {
        create: jest.fn().mockResolvedValue(closureRow()),
        findUnique: jest.fn().mockResolvedValue(closureRow()),
        update: jest.fn().mockResolvedValue(closureRow()),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      service: { findUnique: jest.fn().mockResolvedValue({ ticketId: null }) },
      treeIntervention: {
        findUnique: jest.fn().mockResolvedValue({ id: SERVICE_ID, status: 'AUTHORIZED' }),
      },
      environmentalInspection: { findUnique: jest.fn().mockResolvedValue(inspectionRow()) },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    outbox = { enqueue: jest.fn(), enqueueMany: jest.fn() };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    service = new OutboundRequestsService(
      prisma as unknown as PrismaService,
      outbox,
      audit as unknown as AuditService,
    );
  });

  const enqueued = () => outbox.enqueue.mock.calls[0][1];

  describe('reparación hacia M3', () => {
    const dto = {
      damageType: RepairDamageType.BLOCKED_DRAIN,
      severity: Severity.HIGH,
      publicSafetyRisk: true,
      detectedInType: DetectedInType.SERVICE,
      detectedInId: SERVICE_ID,
      address: 'Rivadavia 4500',
    };

    it('publica infrastructureRepairRequested al crear', async () => {
      await service.createRepairRequest(dto, ACTOR);

      expect(enqueued().eventType).toBe('infrastructureRepairRequested');
      expect(enqueued().payload.requestId).toBe(REQUEST_ID);
      expect(enqueued().payload.detectedIn).toBe(SERVICE_ID);
    });

    it('publicSafetyRisk viaja tal cual, no derivado de la gravedad', async () => {
      prisma.repairRequest.create.mockResolvedValue(
        repairRow({ publicSafetyRisk: false, severity: Severity.CRITICAL }),
      );

      await service.createRepairRequest({ ...dto, publicSafetyRisk: false }, ACTOR);

      expect(enqueued().payload.publicSafetyRisk).toBe(false);
      expect(enqueued().payload.severity).toBe(Severity.CRITICAL);
    });

    it('si el servicio de origen nacio de un reclamo, el ticketId viaja', async () => {
      prisma.service.findUnique.mockResolvedValue({ ticketId: 'TCK-2026-900' });

      await service.createRepairRequest(dto, ACTOR);

      expect(enqueued().payload.ticketId).toBe('TCK-2026-900');
    });

    it('una deteccion en inspeccion lleva el ticketId de su expediente', async () => {
      prisma.environmentalInspection.findUnique.mockResolvedValue(
        inspectionRow(InspectionOutcome.VIOLATION_FOUND, 'WATER_DISCHARGE', 'TCK-2026-77'),
      );

      await service.createRepairRequest(
        {
          ...dto,
          detectedInType: DetectedInType.INSPECTION,
        },
        ACTOR,
      );

      expect(prisma.service.findUnique).not.toHaveBeenCalled();
      expect(enqueued().payload.ticketId).toBe('TCK-2026-77');
    });

    it('una inspeccion de un expediente sin ticket no manda ticketId', async () => {
      await service.createRepairRequest(
        { ...dto, detectedInType: DetectedInType.INSPECTION },
        ACTOR,
      );

      expect(enqueued().payload).not.toHaveProperty('ticketId');
    });

    it.each([
      [
        'SERVICE',
        DetectedInType.SERVICE,
        'service',
        `Servicio con id '${SERVICE_ID}' no encontrado`,
      ],
      [
        'INSPECTION',
        DetectedInType.INSPECTION,
        'environmentalInspection',
        `Inspección con id '${SERVICE_ID}' no encontrada`,
      ],
    ])(
      'origen %s inexistente: 404 y no se crea ni se encola nada',
      async (_n, type, model, message) => {
        prisma[model].findUnique.mockResolvedValue(null);

        await expect(
          service.createRepairRequest({ ...dto, detectedInType: type }, ACTOR),
        ).rejects.toThrow(new NotFoundException(message));
        expect(prisma.$transaction).not.toHaveBeenCalled();
        expect(prisma.repairRequest.create).not.toHaveBeenCalled();
        expect(outbox.enqueue).not.toHaveBeenCalled();
      },
    );

    it('origen INSPECTION existente: se crea y se encola', async () => {
      await service.createRepairRequest(
        { ...dto, detectedInType: DetectedInType.INSPECTION },
        ACTOR,
      );

      expect(prisma.environmentalInspection.findUnique).toHaveBeenCalledWith({
        where: { id: SERVICE_ID },
        select: { outcome: true, report: { select: { reportType: true, ticketId: true } } },
      });
      expect(prisma.service.findUnique).not.toHaveBeenCalled();
      expect(outbox.enqueue).toHaveBeenCalledTimes(1);
    });

    describe('origen INSPECTION que no justifica reparación (409)', () => {
      const fromInspection = { ...dto, detectedInType: DetectedInType.INSPECTION };

      it.each([
        ['sin cerrar', null, 'WATER_DISCHARGE', /todavía no se cerró/],
        ['NO_VIOLATION', InspectionOutcome.NO_VIOLATION, 'WATER_DISCHARGE', /NO_VIOLATION/],
        ['expediente NOISE', InspectionOutcome.VIOLATION_FOUND, 'NOISE', /NOISE no admite/],
        ['expediente ODOR', InspectionOutcome.INCONCLUSIVE, 'ODOR', /ODOR no admite/],
        [
          'expediente PEST_INFESTATION',
          InspectionOutcome.VIOLATION_FOUND,
          'PEST_INFESTATION',
          /no admite/,
        ],
        ['expediente AIR_EMISSION', InspectionOutcome.VIOLATION_FOUND, 'AIR_EMISSION', /no admite/],
      ] as const)('%s', async (_n, outcome, reportType, message) => {
        prisma.environmentalInspection.findUnique.mockResolvedValue(
          inspectionRow(outcome, reportType),
        );

        await expect(service.createRepairRequest(fromInspection, ACTOR)).rejects.toThrow(
          ConflictException,
        );
        await expect(service.createRepairRequest(fromInspection, ACTOR)).rejects.toThrow(message);
        expect(prisma.$transaction).not.toHaveBeenCalled();
        expect(outbox.enqueue).not.toHaveBeenCalled();
      });

      it.each([
        [InspectionOutcome.VIOLATION_FOUND, 'DUMPING'],
        [InspectionOutcome.INCONCLUSIVE, 'ILLEGAL_DUMPSITE'],
        [InspectionOutcome.VIOLATION_FOUND, 'OTHER'],
      ] as const)('%s en %s sí se deriva', async (outcome, reportType) => {
        prisma.environmentalInspection.findUnique.mockResolvedValue(
          inspectionRow(outcome, reportType),
        );

        await service.createRepairRequest(fromInspection, ACTOR);

        expect(outbox.enqueue).toHaveBeenCalledTimes(1);
      });
    });

    it('un pedido abierto para el mismo origen y daño: 409 y no se crea ni se encola', async () => {
      prisma.repairRequest.findFirst.mockResolvedValue({ id: 'abierta-1' });

      await expect(service.createRepairRequest(dto, ACTOR)).rejects.toThrow(ConflictException);

      expect(prisma.repairRequest.findFirst).toHaveBeenCalledWith({
        where: {
          detectedInType: dto.detectedInType,
          detectedInId: dto.detectedInId,
          damageType: dto.damageType,
          status: { not: RepairRequestStatus.CLOSED },
        },
        select: { id: true },
      });
      expect(prisma.repairRequest.create).not.toHaveBeenCalled();
      expect(outbox.enqueue).not.toHaveBeenCalled();
    });

    it('la fila y el evento se escriben en la misma transaccion', async () => {
      await service.createRepairRequest(dto, ACTOR);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(outbox.enqueue.mock.calls[0][0]).toBe(prisma);
    });
  });

  describe('corte de calle hacia M7', () => {
    const dto = {
      sourceType: ClosureSourceType.TREE_INTERVENTION,
      sourceId: SERVICE_ID,
      reason: 'Extracción con riesgo de caída',
      sections: [
        {
          streetName: 'Rivadavia',
          fromCross: 'Mitre',
          toCross: 'San Martín',
          direction: StreetDirection.BOTH,
        },
        {
          streetName: 'Boyacá',
          fromCross: 'Rivadavia',
          toCross: 'Yerbal',
          direction: StreetDirection.FORWARD,
        },
      ],
      requestedFrom: '2026-10-05T07:00:00.000Z',
      requestedTo: '2026-10-05T13:00:00.000Z',
      closureType: StreetClosureType.PARTIAL,
    };

    it('un corte que termina antes de empezar se rechaza', async () => {
      await expect(
        service.createClosureRequest(
          {
            ...dto,
            requestedFrom: '2026-10-05T13:00:00.000Z',
            requestedTo: '2026-10-05T07:00:00.000Z',
          },
          ACTOR,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.streetClosureRequest.create).not.toHaveBeenCalled();
    });

    it.each([
      [
        'SERVICE',
        ClosureSourceType.SERVICE,
        'service',
        `Servicio con id '${SERVICE_ID}' no encontrado`,
      ],
      [
        'TREE_INTERVENTION',
        ClosureSourceType.TREE_INTERVENTION,
        'treeIntervention',
        `Intervención con id '${SERVICE_ID}' no encontrada`,
      ],
    ])(
      'origen %s inexistente: 404 y no se crea ni se encola nada',
      async (_n, type, model, message) => {
        prisma[model].findUnique.mockResolvedValue(null);

        await expect(
          service.createClosureRequest({ ...dto, sourceType: type }, ACTOR),
        ).rejects.toThrow(new NotFoundException(message));
        expect(prisma.$transaction).not.toHaveBeenCalled();
        expect(prisma.streetClosureRequest.create).not.toHaveBeenCalled();
        expect(outbox.enqueue).not.toHaveBeenCalled();
      },
    );

    it('intervención AUTHORIZED: se crea y se encola', async () => {
      await service.createClosureRequest(dto, ACTOR);

      expect(prisma.treeIntervention.findUnique).toHaveBeenCalledWith({
        where: { id: SERVICE_ID },
        select: { id: true, status: true },
      });
      expect(outbox.enqueue).toHaveBeenCalledTimes(1);
    });

    it.each(
      Object.values(TreeInterventionStatus).filter((s) => s !== TreeInterventionStatus.AUTHORIZED),
    )('intervención en %s: 409 y no se crea ni se encola nada', async (status) => {
      prisma.treeIntervention.findUnique.mockResolvedValue({ id: SERVICE_ID, status });

      await expect(service.createClosureRequest(dto, ACTOR)).rejects.toThrow(
        new ConflictException(
          `La intervención '${SERVICE_ID}' está en estado ${status}: solo se puede pedir un corte de una intervención autorizada`,
        ),
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.streetClosureRequest.create).not.toHaveBeenCalled();
      expect(outbox.enqueue).not.toHaveBeenCalled();
    });

    it('origen SERVICE existente: se crea y se encola', async () => {
      await service.createClosureRequest({ ...dto, sourceType: ClosureSourceType.SERVICE }, ACTOR);

      expect(prisma.service.findUnique).toHaveBeenCalledWith({
        where: { id: SERVICE_ID },
        select: { id: true },
      });
      expect(prisma.treeIntervention.findUnique).not.toHaveBeenCalled();
      expect(outbox.enqueue).toHaveBeenCalledTimes(1);
    });

    it('sourceModule viaja como M6, que es lo que dice la tabla de M7', async () => {
      await service.createClosureRequest(dto, ACTOR);

      expect(enqueued().payload.sourceModule).toBe('M6');
      expect(enqueued().payload).not.toHaveProperty('requestingModule');
    });

    it('affectedSections se arma de los tramos {street, from, to, direction}', async () => {
      await service.createClosureRequest(dto, ACTOR);

      expect(enqueued().payload.affectedSections).toEqual([
        { street: 'Rivadavia', from: 'Mitre', to: 'San Martín', direction: 'BOTH' },
        { street: 'Boyacá', from: 'Rivadavia', to: 'Yerbal', direction: 'FORWARD' },
      ]);
    });

    it('sourceRef apunta al trabajo que origina el corte', async () => {
      await service.createClosureRequest(dto, ACTOR);

      expect(enqueued().payload.sourceRef).toBe(SERVICE_ID);
    });

    it('aprobar guarda el identificador de corte de M7', async () => {
      await service.approveClosure(REQUEST_ID, { closureId: 'CL-2026-0342' }, ACTOR);

      const [[args]] = prisma.streetClosureRequest.update.mock.calls;
      expect(args.data).toMatchObject({
        status: StreetClosureRequestStatus.APPROVED,
        closureId: 'CL-2026-0342',
      });
    });

    const closureAt = (status: StreetClosureRequestStatus, over: Record<string, unknown> = {}) =>
      prisma.streetClosureRequest.findUnique.mockResolvedValue(closureRow({ status, ...over }));

    it('rechazar desde REQUESTED pasa a REJECTED', async () => {
      await service.rejectClosure(REQUEST_ID, 'Se superpone con otro corte', ACTOR);

      const [[args]] = prisma.streetClosureRequest.update.mock.calls;
      expect(args.data.status).toBe(StreetClosureRequestStatus.REJECTED);
    });

    it('rechazar guarda el motivo para devolverlo en la respuesta', async () => {
      await service.rejectClosure(REQUEST_ID, 'Se superpone con otro corte', ACTOR);

      const [[args]] = prisma.streetClosureRequest.update.mock.calls;
      expect(args.data.rejectionReason).toBe('Se superpone con otro corte');
    });

    it('la respuesta expone la ventana autorizada y el motivo de rechazo (null si no hay)', async () => {
      const approvedFrom = new Date('2026-10-05T08:00:00.000Z');
      const approvedTo = new Date('2026-10-05T12:00:00.000Z');
      closureAt(StreetClosureRequestStatus.APPROVED, { approvedFrom, approvedTo });
      await expect(service.findClosureRequest(REQUEST_ID)).resolves.toMatchObject({
        approvedFrom,
        approvedTo,
        rejectionReason: null,
      });

      closureAt(StreetClosureRequestStatus.REJECTED, { rejectionReason: 'Obra vecina' });
      await expect(service.findClosureRequest(REQUEST_ID)).resolves.toMatchObject({
        approvedFrom: null,
        approvedTo: null,
        rejectionReason: 'Obra vecina',
      });
    });

    it('finalizar desde APPROVED pasa a ENDED', async () => {
      closureAt(StreetClosureRequestStatus.APPROVED);

      await service.endClosure(REQUEST_ID, ACTOR);

      const [[args]] = prisma.streetClosureRequest.update.mock.calls;
      expect(args.data.status).toBe(StreetClosureRequestStatus.ENDED);
    });

    it.each([
      ['approve', StreetClosureRequestStatus.APPROVED],
      ['approve', StreetClosureRequestStatus.REJECTED],
      ['approve', StreetClosureRequestStatus.ENDED],
      ['reject', StreetClosureRequestStatus.APPROVED],
      ['reject', StreetClosureRequestStatus.REJECTED],
      ['reject', StreetClosureRequestStatus.ENDED],
      ['end', StreetClosureRequestStatus.REJECTED],
      ['end', StreetClosureRequestStatus.ENDED],
    ])('%s desde %s es una transición inválida: 409 y no escribe', async (op, from) => {
      closureAt(from);
      const run = {
        approve: () => service.approveClosure(REQUEST_ID, {}, ACTOR),
        reject: () => service.rejectClosure(REQUEST_ID, 'x', ACTOR),
        end: () => service.endClosure(REQUEST_ID, ACTOR),
      }[op as 'approve' | 'reject' | 'end']();

      await expect(run).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.streetClosureRequest.update).not.toHaveBeenCalled();
    });

    it('el 409 lista las transiciones válidas', async () => {
      closureAt(StreetClosureRequestStatus.REQUESTED);
      await expect(service.approveClosure(REQUEST_ID, {}, ACTOR)).resolves.toBeDefined();

      closureAt(StreetClosureRequestStatus.APPROVED);
      await expect(service.approveClosure(REQUEST_ID, {}, ACTOR)).rejects.toThrow(
        /\[ENDED, EXPIRED\]/,
      );
    });

    it('finalizar desde EXPIRED es válido: un streetClosureEnded tardío o el /end manual', async () => {
      closureAt(StreetClosureRequestStatus.EXPIRED);
      await service.endClosure(REQUEST_ID, ACTOR);

      const [[args]] = prisma.streetClosureRequest.update.mock.calls;
      expect(args.data.status).toBe(StreetClosureRequestStatus.ENDED);
    });

    it('finalizar desde REQUESTED es válido: streetClosureEnded puede adelantarse a Approved', async () => {
      await service.endClosure(REQUEST_ID, ACTOR);

      const [[args]] = prisma.streetClosureRequest.update.mock.calls;
      expect(args.data.status).toBe(StreetClosureRequestStatus.ENDED);
    });

    it('guarda direction en cada tramo', async () => {
      await service.createClosureRequest(dto, ACTOR);

      const [[args]] = prisma.streetClosureRequest.create.mock.calls;
      expect(
        args.data.streets.createMany.data.map((s: { direction: string }) => s.direction),
      ).toEqual(['BOTH', 'FORWARD']);
    });

    it('aprobar sin closureId no lo pisa en el update', async () => {
      await service.approveClosure(REQUEST_ID, {}, ACTOR);

      const [[args]] = prisma.streetClosureRequest.update.mock.calls;
      expect(args.data).not.toHaveProperty('closureId');
    });

    it('findClosureRequests filtra por status y por sourceId', async () => {
      prisma.streetClosureRequest.findMany.mockResolvedValue([]);
      prisma.streetClosureRequest.count.mockResolvedValue(0);

      await service.findClosureRequests({
        status: StreetClosureRequestStatus.REQUESTED,
        sourceId: SERVICE_ID,
        page: 1,
        pageSize: 10,
      } as QueryStreetClosureRequestsDto);

      const [[args]] = prisma.streetClosureRequest.findMany.mock.calls;
      expect(args.where).toEqual({
        status: StreetClosureRequestStatus.REQUESTED,
        sourceId: SERVICE_ID,
      });
    });

    it('findClosureRequests sin filtros deja el where vacío y mapea los resultados', async () => {
      prisma.streetClosureRequest.findMany.mockResolvedValue([closureRow()]);
      prisma.streetClosureRequest.count.mockResolvedValue(1);

      const result = await service.findClosureRequests({
        page: 1,
        pageSize: 10,
      } as QueryStreetClosureRequestsDto);

      const [[args]] = prisma.streetClosureRequest.findMany.mock.calls;
      expect(args.where).toEqual({});
      expect(result.data[0].id).toBe(REQUEST_ID);
    });

    it('findClosureRequest lanza 404 si no existe', async () => {
      prisma.streetClosureRequest.findUnique.mockResolvedValue(null);

      await expect(service.findClosureRequest('no-existe')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('approveClosure lanza 404 si la solicitud no existe', async () => {
      prisma.streetClosureRequest.findUnique.mockResolvedValue(null);

      await expect(service.approveClosure('no-existe', {}, ACTOR)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('helpers de reparación', () => {
    it('findRepairRequests filtra por status, damageType, severity y detectedInId', async () => {
      prisma.repairRequest.findMany.mockResolvedValue([]);
      prisma.repairRequest.count.mockResolvedValue(0);

      await service.findRepairRequests({
        status: RepairRequestStatus.REQUESTED,
        damageType: RepairDamageType.BLOCKED_DRAIN,
        severity: Severity.HIGH,
        detectedInId: SERVICE_ID,
        page: 1,
        pageSize: 10,
      } as QueryRepairRequestsDto);

      const [[args]] = prisma.repairRequest.findMany.mock.calls;
      expect(args.where).toEqual({
        status: RepairRequestStatus.REQUESTED,
        damageType: RepairDamageType.BLOCKED_DRAIN,
        severity: Severity.HIGH,
        detectedInId: SERVICE_ID,
      });
    });

    it('findRepairRequests sin filtros deja el where vacío y mapea los resultados', async () => {
      prisma.repairRequest.findMany.mockResolvedValue([repairRow()]);
      prisma.repairRequest.count.mockResolvedValue(1);

      const result = await service.findRepairRequests({
        page: 1,
        pageSize: 10,
      } as QueryRepairRequestsDto);

      const [[args]] = prisma.repairRequest.findMany.mock.calls;
      expect(args.where).toEqual({});
      expect(result.data[0].id).toBe(REQUEST_ID);
    });

    it('findRepairRequest lanza 404 si no existe', async () => {
      prisma.repairRequest.findUnique.mockResolvedValue(null);

      await expect(service.findRepairRequest('no-existe')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('startRepair guarda el workOrderId cuando viene', async () => {
      await service.startRepair(REQUEST_ID, { workOrderId: 'OT-1' }, ACTOR);

      const [[args]] = prisma.repairRequest.update.mock.calls;
      expect(args.data).toMatchObject({
        status: RepairRequestStatus.IN_PROGRESS,
        workOrderId: 'OT-1',
      });
    });

    it('startRepair no pisa workOrderId cuando no viene', async () => {
      await service.startRepair(REQUEST_ID, {}, ACTOR);

      const [[args]] = prisma.repairRequest.update.mock.calls;
      expect(args.data).not.toHaveProperty('workOrderId');
    });

    it('startRepair lanza 404 si la solicitud no existe', async () => {
      prisma.repairRequest.findUnique.mockResolvedValue(null);

      await expect(service.startRepair('no-existe', {}, ACTOR)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it.each([RepairRequestStatus.REQUESTED, RepairRequestStatus.IN_PROGRESS])(
      'closeRepair cierra la solicitud desde %s',
      async (from) => {
        prisma.repairRequest.findUnique.mockResolvedValue(repairRow({ status: from }));

        await service.closeRepair(REQUEST_ID, ACTOR);

        const [[args]] = prisma.repairRequest.update.mock.calls;
        expect(args.data.status).toBe(RepairRequestStatus.CLOSED);
      },
    );

    it('closeRepair sobre una solicitud ya CLOSED es 409 y no escribe', async () => {
      prisma.repairRequest.findUnique.mockResolvedValue(
        repairRow({ status: RepairRequestStatus.CLOSED }),
      );

      await expect(service.closeRepair(REQUEST_ID, ACTOR)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.repairRequest.update).not.toHaveBeenCalled();
    });

    it.each([RepairRequestStatus.IN_PROGRESS, RepairRequestStatus.CLOSED])(
      'startRepair desde %s es 409: una CLOSED no se reabre ni una en curso se re-agenda',
      async (from) => {
        prisma.repairRequest.findUnique.mockResolvedValue(repairRow({ status: from }));

        await expect(service.startRepair(REQUEST_ID, {}, ACTOR)).rejects.toThrow(
          /Transiciones válidas/,
        );
        expect(prisma.repairRequest.update).not.toHaveBeenCalled();
      },
    );
  });

  // ─── Auditoría (#460) ───────────────────────────────

  describe('auditoría', () => {
    const closureDto = {
      sourceType: ClosureSourceType.TREE_INTERVENTION,
      sourceId: SERVICE_ID,
      reason: 'Extracción',
      requestedFrom: '2026-10-05T07:00:00.000Z',
      requestedTo: '2026-10-05T13:00:00.000Z',
      closureType: StreetClosureType.PARTIAL,
      sections: [{ streetName: 'Rivadavia', fromCross: 'Mitre', toCross: 'Boyacá' }],
    } as any;

    it('el pedido de reparación audita su alta en la misma transacción', async () => {
      await service.createRepairRequest(
        {
          damageType: RepairDamageType.BLOCKED_DRAIN,
          severity: Severity.HIGH,
          publicSafetyRisk: true,
          detectedInType: DetectedInType.SERVICE,
          detectedInId: SERVICE_ID,
        } as any,
        ACTOR,
      );

      expect(audit.record).toHaveBeenCalledWith(prisma, {
        entityType: 'REPAIR_REQUEST',
        entityId: REQUEST_ID,
        action: 'CREATE',
        toStatus: RepairRequestStatus.REQUESTED,
        actor: ACTOR,
      });
    });

    it('start y close de la reparación auditan origen y destino', async () => {
      await service.startRepair(REQUEST_ID, {}, ACTOR);
      expect(audit.record).toHaveBeenLastCalledWith(prisma, {
        entityType: 'REPAIR_REQUEST',
        entityId: REQUEST_ID,
        action: 'START',
        fromStatus: RepairRequestStatus.REQUESTED,
        toStatus: RepairRequestStatus.IN_PROGRESS,
        actor: ACTOR,
      });

      prisma.repairRequest.findUnique.mockResolvedValue(
        repairRow({ status: RepairRequestStatus.IN_PROGRESS }),
      );
      await service.closeRepair(REQUEST_ID, ACTOR);
      expect(audit.record).toHaveBeenLastCalledWith(prisma, {
        entityType: 'REPAIR_REQUEST',
        entityId: REQUEST_ID,
        action: 'CLOSE',
        fromStatus: RepairRequestStatus.IN_PROGRESS,
        toStatus: RepairRequestStatus.CLOSED,
        actor: ACTOR,
      });
    });

    it('el pedido de corte audita su alta', async () => {
      await service.createClosureRequest(closureDto, ACTOR);

      expect(audit.record).toHaveBeenCalledWith(prisma, {
        entityType: 'STREET_CLOSURE_REQUEST',
        entityId: REQUEST_ID,
        action: 'CREATE',
        toStatus: StreetClosureRequestStatus.REQUESTED,
        actor: ACTOR,
      });
    });

    it.each([
      [
        'APPROVE',
        StreetClosureRequestStatus.APPROVED,
        (s: OutboundRequestsService) => s.approveClosure(REQUEST_ID, {}, ACTOR),
      ],
      [
        'REJECT',
        StreetClosureRequestStatus.REJECTED,
        (s: OutboundRequestsService) => s.rejectClosure(REQUEST_ID, 'sin permiso', ACTOR),
      ],
      [
        'END',
        StreetClosureRequestStatus.ENDED,
        (s: OutboundRequestsService) => s.endClosure(REQUEST_ID, ACTOR),
      ],
    ])('%s del corte audita la transición', async (action, to, run) => {
      await run(service);

      expect(audit.record).toHaveBeenCalledWith(prisma, {
        entityType: 'STREET_CLOSURE_REQUEST',
        entityId: REQUEST_ID,
        action,
        fromStatus: StreetClosureRequestStatus.REQUESTED,
        toStatus: to,
        actor: ACTOR,
      });
    });

    it('una transición rechazada no audita', async () => {
      prisma.streetClosureRequest.findUnique.mockResolvedValue(
        closureRow({ status: StreetClosureRequestStatus.REJECTED }),
      );

      await expect(service.endClosure(REQUEST_ID, ACTOR)).rejects.toBeInstanceOf(ConflictException);
      expect(audit.record).not.toHaveBeenCalled();
    });
  });
});
