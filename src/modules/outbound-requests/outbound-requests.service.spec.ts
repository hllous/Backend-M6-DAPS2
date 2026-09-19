import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  RepairDamageType,
  RepairRequestStatus,
  Severity,
  StreetClosureRequestStatus,
  StreetClosureType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OutboundRequestsService } from './outbound-requests.service';
import { ClosureSourceType, DetectedInType } from './dto';
import { QueryRepairRequestsDto, QueryStreetClosureRequestsDto } from './dto/queries';

describe('OutboundRequestsService', () => {
  const SERVICE_ID = '11111111-1111-1111-1111-111111111111';
  const REQUEST_ID = '22222222-2222-2222-2222-222222222222';

  let prisma: any;
  let outbox: any;
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
    status: StreetClosureRequestStatus.REQUESTED,
    closureId: null,
    createdAt: new Date('2026-09-20T09:00:00.000Z'),
    updatedAt: new Date(),
    streets: [
      { id: 's1', streetName: 'Rivadavia', fromCross: 'Mitre', toCross: 'San Martín' },
      { id: 's2', streetName: 'Boyacá', fromCross: 'Rivadavia', toCross: 'Yerbal' },
    ],
    ...over,
  });

  beforeEach(() => {
    prisma = {
      repairRequest: {
        create: jest.fn().mockResolvedValue(repairRow()),
        findUnique: jest.fn().mockResolvedValue(repairRow()),
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
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    outbox = { enqueue: jest.fn(), enqueueMany: jest.fn() };
    service = new OutboundRequestsService(prisma as unknown as PrismaService, outbox);
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
      await service.createRepairRequest(dto);

      expect(enqueued().eventType).toBe('infrastructureRepairRequested');
      expect(enqueued().payload.requestId).toBe(REQUEST_ID);
      expect(enqueued().payload.detectedIn).toBe(SERVICE_ID);
    });

    it('publicSafetyRisk viaja tal cual, no derivado de la gravedad', async () => {
      prisma.repairRequest.create.mockResolvedValue(
        repairRow({ publicSafetyRisk: false, severity: Severity.CRITICAL }),
      );

      await service.createRepairRequest({ ...dto, publicSafetyRisk: false });

      expect(enqueued().payload.publicSafetyRisk).toBe(false);
      expect(enqueued().payload.severity).toBe(Severity.CRITICAL);
    });

    it('si el servicio de origen nacio de un reclamo, el ticketId viaja', async () => {
      prisma.service.findUnique.mockResolvedValue({ ticketId: 'TCK-2026-900' });

      await service.createRepairRequest(dto);

      expect(enqueued().payload.ticketId).toBe('TCK-2026-900');
    });

    it('una deteccion en inspeccion no busca ticket: cuelga de un expediente', async () => {
      await service.createRepairRequest({
        ...dto,
        detectedInType: DetectedInType.INSPECTION,
      });

      expect(prisma.service.findUnique).not.toHaveBeenCalled();
      expect(enqueued().payload).not.toHaveProperty('ticketId');
    });

    it('la fila y el evento se escriben en la misma transaccion', async () => {
      await service.createRepairRequest(dto);

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
        { streetName: 'Rivadavia', fromCross: 'Mitre', toCross: 'San Martín' },
        { streetName: 'Boyacá', fromCross: 'Rivadavia', toCross: 'Yerbal' },
      ],
      requestedFrom: '2026-10-05T07:00:00.000Z',
      requestedTo: '2026-10-05T13:00:00.000Z',
      closureType: StreetClosureType.PARTIAL,
    };

    it('sourceModule viaja como M6, que es lo que dice la tabla de M7', async () => {
      await service.createClosureRequest(dto);

      expect(enqueued().payload.sourceModule).toBe('M6');
      expect(enqueued().payload).not.toHaveProperty('requestingModule');
    });

    it('affectedSections se arma de los tramos, como texto', async () => {
      await service.createClosureRequest(dto);

      expect(enqueued().payload.affectedSections).toEqual([
        'Rivadavia entre Mitre y San Martín',
        'Boyacá entre Rivadavia y Yerbal',
      ]);
    });

    it('sourceRef apunta al trabajo que origina el corte', async () => {
      await service.createClosureRequest(dto);

      expect(enqueued().payload.sourceRef).toBe(SERVICE_ID);
    });

    it('aprobar guarda el identificador de corte de M7', async () => {
      await service.approveClosure(REQUEST_ID, { closureId: 'CL-2026-0342' });

      const [[args]] = prisma.streetClosureRequest.update.mock.calls;
      expect(args.data).toMatchObject({
        status: StreetClosureRequestStatus.APPROVED,
        closureId: 'CL-2026-0342',
      });
    });

    const closureAt = (status: StreetClosureRequestStatus) =>
      prisma.streetClosureRequest.findUnique.mockResolvedValue(closureRow({ status }));

    it('rechazar desde REQUESTED pasa a REJECTED', async () => {
      await service.rejectClosure(REQUEST_ID, 'Se superpone con otro corte');

      const [[args]] = prisma.streetClosureRequest.update.mock.calls;
      expect(args.data.status).toBe(StreetClosureRequestStatus.REJECTED);
    });

    it('finalizar desde APPROVED pasa a ENDED', async () => {
      closureAt(StreetClosureRequestStatus.APPROVED);

      await service.endClosure(REQUEST_ID);

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
        approve: () => service.approveClosure(REQUEST_ID, {}),
        reject: () => service.rejectClosure(REQUEST_ID, 'x'),
        end: () => service.endClosure(REQUEST_ID),
      }[op as 'approve' | 'reject' | 'end']();

      await expect(run).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.streetClosureRequest.update).not.toHaveBeenCalled();
    });

    it('el 409 lista las transiciones válidas', async () => {
      closureAt(StreetClosureRequestStatus.REQUESTED);
      await expect(service.approveClosure(REQUEST_ID, {})).resolves.toBeDefined();

      closureAt(StreetClosureRequestStatus.APPROVED);
      await expect(service.approveClosure(REQUEST_ID, {})).rejects.toThrow(/\[ENDED\]/);
    });

    it('finalizar desde REQUESTED es válido: streetClosureEnded puede adelantarse a Approved', async () => {
      await service.endClosure(REQUEST_ID);

      const [[args]] = prisma.streetClosureRequest.update.mock.calls;
      expect(args.data.status).toBe(StreetClosureRequestStatus.ENDED);
    });

    it('sin closureType, se guarda null', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { closureType, ...sinTipo } = dto;
      await service.createClosureRequest(sinTipo as typeof dto);

      const [[args]] = prisma.streetClosureRequest.create.mock.calls;
      expect(args.data.closureType).toBeNull();
    });

    it('aprobar sin closureId no lo pisa en el update', async () => {
      await service.approveClosure(REQUEST_ID, {});

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

      await expect(service.approveClosure('no-existe', {})).rejects.toBeInstanceOf(
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
      await service.startRepair(REQUEST_ID, { workOrderId: 'OT-1' });

      const [[args]] = prisma.repairRequest.update.mock.calls;
      expect(args.data).toMatchObject({
        status: RepairRequestStatus.IN_PROGRESS,
        workOrderId: 'OT-1',
      });
    });

    it('startRepair no pisa workOrderId cuando no viene', async () => {
      await service.startRepair(REQUEST_ID, {});

      const [[args]] = prisma.repairRequest.update.mock.calls;
      expect(args.data).not.toHaveProperty('workOrderId');
    });

    it('startRepair lanza 404 si la solicitud no existe', async () => {
      prisma.repairRequest.findUnique.mockResolvedValue(null);

      await expect(service.startRepair('no-existe', {})).rejects.toBeInstanceOf(NotFoundException);
    });

    it.each([RepairRequestStatus.REQUESTED, RepairRequestStatus.IN_PROGRESS])(
      'closeRepair cierra la solicitud desde %s',
      async (from) => {
        prisma.repairRequest.findUnique.mockResolvedValue(repairRow({ status: from }));

        await service.closeRepair(REQUEST_ID);

        const [[args]] = prisma.repairRequest.update.mock.calls;
        expect(args.data.status).toBe(RepairRequestStatus.CLOSED);
      },
    );

    it('closeRepair sobre una solicitud ya CLOSED es 409 y no escribe', async () => {
      prisma.repairRequest.findUnique.mockResolvedValue(
        repairRow({ status: RepairRequestStatus.CLOSED }),
      );

      await expect(service.closeRepair(REQUEST_ID)).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.repairRequest.update).not.toHaveBeenCalled();
    });

    it.each([RepairRequestStatus.IN_PROGRESS, RepairRequestStatus.CLOSED])(
      'startRepair desde %s es 409: una CLOSED no se reabre ni una en curso se re-agenda',
      async (from) => {
        prisma.repairRequest.findUnique.mockResolvedValue(repairRow({ status: from }));

        await expect(service.startRepair(REQUEST_ID, {})).rejects.toThrow(/Transiciones válidas/);
        expect(prisma.repairRequest.update).not.toHaveBeenCalled();
      },
    );

    it('ticketOfOrigin no encuentra el servicio: no rompe, ticketId queda undefined', async () => {
      prisma.service.findUnique.mockResolvedValue(null);

      await service.createRepairRequest({
        damageType: RepairDamageType.BLOCKED_DRAIN,
        severity: Severity.HIGH,
        publicSafetyRisk: true,
        detectedInType: DetectedInType.SERVICE,
        detectedInId: SERVICE_ID,
      });

      expect(enqueued().payload).not.toHaveProperty('ticketId');
    });
  });
});
