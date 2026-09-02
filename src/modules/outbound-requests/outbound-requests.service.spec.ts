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

    it('rechazar y finalizar mueven el estado', async () => {
      await service.rejectClosure(REQUEST_ID, 'Se superpone con otro corte');
      await service.endClosure(REQUEST_ID);

      const estados = prisma.streetClosureRequest.update.mock.calls.map(
        ([a]: [{ data: { status: string } }]) => a.data.status,
      );
      expect(estados).toEqual([
        StreetClosureRequestStatus.REJECTED,
        StreetClosureRequestStatus.ENDED,
      ]);
    });
  });
});
