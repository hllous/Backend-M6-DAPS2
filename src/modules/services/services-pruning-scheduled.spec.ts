import { ServiceStatus, TreeInterventionType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OutboxService } from '../../events/outbox/outbox.service';
import { ServicesService } from './services.service';

const SERVICE_ID = '11111111-1111-1111-1111-111111111111';
const INTERVENTION_ID = '22222222-2222-2222-2222-222222222222';
const CREW = '33333333-3333-3333-3333-333333333333';

const hora = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`);

/**
 * #324: treePruningScheduled se difiere si al asociar el servicio faltan
 * cuadrilla o franja; tiene que salir, una sola vez, cuando el servicio los completa.
 */
describe('ServicesService — treePruningScheduled diferido', () => {
  let prisma: any;
  let outbox: any;
  let service: ServicesService;

  const servicio = (over: Record<string, unknown> = {}) => ({
    id: SERVICE_ID,
    mode: 'POINT',
    status: ServiceStatus.SCHEDULED,
    scheduledDate: new Date('2026-09-15T00:00:00.000Z'),
    windowFrom: null,
    windowTo: null,
    crewId: null,
    vehicleId: null,
    ticketId: null,
    zones: [{ zoneId: 'z-centro', sequence: 1 }],
    zoneResults: [],
    collectionRecords: [],
    ...over,
  });

  const intervencion = (over: Record<string, unknown> = {}) => ({
    id: INTERVENTION_ID,
    interventionType: TreeInterventionType.SAFETY_PRUNING,
    requiresStreetClosure: false,
    address: 'Av. Mitre 1200',
    pruningScheduledAt: null,
    trees: [{ treeId: 'ar-1' }],
    ...over,
  });

  /** El servicio tal como queda después del update, según el estado de partida. */
  const conServicio = (actual: Record<string, unknown>) => {
    prisma.service.findUnique.mockResolvedValue(servicio(actual));
    prisma.service.update.mockImplementation(({ data }: any) =>
      Promise.resolve(servicio({ ...actual, ...data })),
    );
  };

  beforeEach(() => {
    prisma = {
      service: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
      },
      crew: { findUnique: jest.fn().mockResolvedValue({ id: CREW, active: true, name: 'N' }) },
      tree: { findUnique: jest.fn().mockResolvedValue({ id: 'ar-1', address: 'Mitre 1200' }) },
      treeIntervention: {
        findUnique: jest.fn().mockResolvedValue(intervencion()),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      ticketM2State: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    outbox = { enqueue: jest.fn(), enqueueMany: jest.fn() };
    service = new ServicesService(
      prisma as unknown as PrismaService,
      outbox as unknown as OutboxService,
      {} as never,
    );
  });

  it('asignar cuadrilla sin franja sigue diferido', async () => {
    conServicio({});

    await service.assignCrew(SERVICE_ID, { crewId: CREW });

    expect(outbox.enqueue).not.toHaveBeenCalled();
    expect(prisma.treeIntervention.updateMany).not.toHaveBeenCalled();
  });

  it('asignar cuadrilla cuando ya hay franja emite el evento y deja la marca', async () => {
    conServicio({ windowFrom: hora('07:00'), windowTo: hora('11:00') });

    await service.assignCrew(SERVICE_ID, { crewId: CREW });

    expect(prisma.treeIntervention.updateMany).toHaveBeenCalledWith({
      where: { id: INTERVENTION_ID, pruningScheduledAt: null },
      data: { pruningScheduledAt: expect.any(Date) },
    });
    expect(outbox.enqueue).toHaveBeenCalledTimes(1);
    const [tx, entrada] = outbox.enqueue.mock.calls[0];
    expect(tx).toBe(prisma);
    expect(entrada).toMatchObject({
      eventType: 'treePruningScheduled',
      aggregateType: 'TREE_INTERVENTION',
      aggregateId: INTERVENTION_ID,
    });
    expect(entrada.payload).toMatchObject({
      interventionId: INTERVENTION_ID,
      serviceId: SERVICE_ID,
      crewId: CREW,
      timeWindow: { from: '07:00', to: '11:00' },
    });
  });

  it('completar la franja cuando ya hay cuadrilla emite el evento', async () => {
    conServicio({ crewId: CREW });

    await service.update(SERVICE_ID, { windowFrom: '07:00', windowTo: '11:00' });

    expect(outbox.enqueue).toHaveBeenCalledTimes(1);
    expect(outbox.enqueue.mock.calls[0][1].eventType).toBe('treePruningScheduled');
  });

  it('una franja parcial (solo desde) no alcanza', async () => {
    conServicio({ crewId: CREW });

    await service.update(SERVICE_ID, { windowFrom: '07:00' });

    expect(outbox.enqueue).not.toHaveBeenCalled();
  });

  it('confirmar la reprogramación con cuadrilla y franja emite el evento', async () => {
    conServicio({
      status: ServiceStatus.RESCHEDULED,
      crewId: CREW,
      windowFrom: hora('07:00'),
      windowTo: hora('11:00'),
    });

    await service.confirmReschedule(SERVICE_ID, { scheduledDate: '2099-01-01' });

    expect(outbox.enqueue).toHaveBeenCalledTimes(1);
    expect(outbox.enqueue.mock.calls[0][1].eventType).toBe('treePruningScheduled');
  });

  it('si ya se emitió, un cambio posterior no lo reenvía', async () => {
    conServicio({ windowFrom: hora('07:00'), windowTo: hora('11:00') });
    prisma.treeIntervention.findUnique.mockResolvedValue(
      intervencion({ pruningScheduledAt: new Date() }),
    );

    await service.assignCrew(SERVICE_ID, { crewId: CREW });

    expect(prisma.treeIntervention.updateMany).not.toHaveBeenCalled();
    expect(outbox.enqueue).not.toHaveBeenCalled();
  });

  it('si otra transacción ganó la marca, no se emite dos veces', async () => {
    conServicio({ windowFrom: hora('07:00'), windowTo: hora('11:00') });
    prisma.treeIntervention.updateMany.mockResolvedValue({ count: 0 });

    await service.assignCrew(SERVICE_ID, { crewId: CREW });

    expect(outbox.enqueue).not.toHaveBeenCalled();
  });

  it('un servicio que no ejecuta una intervención no emite nada', async () => {
    conServicio({ windowFrom: hora('07:00'), windowTo: hora('11:00') });
    prisma.treeIntervention.findUnique.mockResolvedValue(null);

    await service.assignCrew(SERVICE_ID, { crewId: CREW });

    expect(outbox.enqueue).not.toHaveBeenCalled();
  });
});
