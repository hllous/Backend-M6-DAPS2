import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ServiceMode, ServiceOrigin, ServiceStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ServicesService } from './services.service';

/**
 * #365: las acciones de ejecución son solo de la cuadrilla del servicio
 * (integrante o líder). Ajeno o servicio sin cuadrilla: 403 NOT_ASSIGNED, antes
 * de mirar el estado y sin escribir nada.
 */
describe('ServicesService — pertenencia de la cuadrilla', () => {
  const USER_ID = '4242';
  const SERVICE_ID = '11111111-1111-1111-1111-111111111111';
  const CREW_ID = '44444444-4444-4444-4444-444444444444';

  let prisma: any;
  let service: ServicesService;

  const serviceRow = (over: Record<string, unknown> = {}) => ({
    id: SERVICE_ID,
    serviceTypeId: 'st-1',
    mode: ServiceMode.POINT,
    status: ServiceStatus.IN_PROGRESS,
    origin: ServiceOrigin.PLANNED,
    crewId: CREW_ID,
    vehicleId: null,
    ticketId: null,
    zones: [],
    zoneResults: [],
    collectionRecords: [],
    ...over,
  });

  beforeEach(() => {
    prisma = {
      service: { findUnique: jest.fn().mockResolvedValue(serviceRow()), update: jest.fn() },
      crew: { count: jest.fn().mockResolvedValue(0) },
      zoneResult: { create: jest.fn() },
      collectionRecord: { create: jest.fn() },
      serviceDelayNotice: { create: jest.fn(), findFirst: jest.fn() },
      $transaction: jest.fn(),
    };
    service = new ServicesService(
      prisma as unknown as PrismaService,
      { enqueue: jest.fn(), enqueueMany: jest.fn() } as never,
      {} as never,
    );
  });

  const acciones: [string, () => Promise<unknown>][] = [
    ['start', () => service.start(SERVICE_ID, USER_ID)],
    ['suspend', () => service.suspend(SERVICE_ID, USER_ID, 'lluvia')],
    ['resume', () => service.resume(SERVICE_ID, USER_ID)],
    ['complete', () => service.complete(SERVICE_ID, {}, USER_ID)],
    [
      'addZoneResult',
      () =>
        service.addZoneResult(SERVICE_ID, { zoneId: 'z', status: 'SERVICED' } as never, USER_ID),
    ],
    ['addCollectionRecord', () => service.addCollectionRecord(SERVICE_ID, {} as never, USER_ID)],
    [
      'addDelayNotice',
      () => service.addDelayNotice(SERVICE_ID, { delayType: 'DURATION' } as never, USER_ID),
    ],
  ];

  it.each(acciones)('%s: un usuario ajeno a la cuadrilla recibe 403 NOT_ASSIGNED', async (_, f) => {
    const error = (await f().catch((e) => e)) as ForbiddenException;

    expect(error).toBeInstanceOf(ForbiddenException);
    expect(error.getResponse()).toMatchObject({ statusCode: 403, code: 'NOT_ASSIGNED' });
    // No dice de quién es el servicio ni cuál es su cuadrilla.
    expect(JSON.stringify(error.getResponse())).not.toContain(CREW_ID);
    expect(prisma.service.update).not.toHaveBeenCalled();
    expect(prisma.zoneResult.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each(acciones)('%s: un servicio sin cuadrilla también es 403', async (_, f) => {
    prisma.service.findUnique.mockResolvedValue(serviceRow({ crewId: null }));

    await expect(f()).rejects.toBeInstanceOf(ForbiddenException);
    // Sin cuadrilla ni se consulta: nadie pertenece a "ninguna".
    expect(prisma.crew.count).not.toHaveBeenCalled();
  });

  it.each(acciones)('%s: un servicio inexistente sigue siendo 404', async (_, f) => {
    prisma.service.findUnique.mockResolvedValue(null);

    await expect(f()).rejects.toBeInstanceOf(NotFoundException);
  });

  it('la pertenencia es líder o integrante de la cuadrilla del servicio', async () => {
    prisma.crew.count.mockResolvedValue(1);
    prisma.service.update.mockResolvedValue(serviceRow({ status: ServiceStatus.SUSPENDED }));
    prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(prisma));

    await service.suspend(SERVICE_ID, USER_ID, 'lluvia');

    expect(prisma.crew.count).toHaveBeenCalledWith({
      where: {
        id: CREW_ID,
        OR: [{ leaderUserId: USER_ID }, { members: { some: { userId: USER_ID } } }],
      },
    });
    expect(prisma.service.update).toHaveBeenCalled();
  });
});
