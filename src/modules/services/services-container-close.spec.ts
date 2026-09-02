import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import {
  ContainerStatus,
  ServiceMode,
  ServiceOrigin,
  ServiceStatus,
  ZoneResultStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ServicesService } from './services.service';
import { ServiceTargetType } from './dto';

/**
 * Issue #63: cerrar un Service POINT que atiende un contenedor tiene que
 * transicionar el contenedor en la misma transacción.
 */
describe('ServicesService — cierre encadenado del contenedor', () => {
  const SERVICE_ID = '11111111-1111-1111-1111-111111111111';
  const CONTAINER_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  const ZONE = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  let prisma: any;
  let outbox: any;
  let service: ServicesService;

  const serviceRow = (over: Record<string, unknown> = {}) => ({
    id: SERVICE_ID,
    serviceTypeId: '22222222-2222-2222-2222-222222222222',
    mode: ServiceMode.POINT,
    status: ServiceStatus.IN_PROGRESS,
    statusReason: null,
    origin: ServiceOrigin.PLANNED,
    routeId: null,
    targetType: ServiceTargetType.CONTAINER,
    targetId: CONTAINER_ID,
    scheduledDate: new Date('2026-09-15T00:00:00.000Z'),
    windowFrom: null,
    windowTo: null,
    crewId: null,
    vehicleId: null,
    ticketId: null,
    notes: null,
    createdBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    zones: [{ zoneId: ZONE, sequence: 1 }],
    zoneResults: [{ id: 'r1', zoneId: ZONE, status: ZoneResultStatus.SERVICED }],
    collectionRecords: [],
    ...over,
  });

  const container = (status: ContainerStatus) => ({
    id: CONTAINER_ID,
    code: 'CT-0442',
    status,
    address: 'Vieja 100',
  });

  beforeEach(() => {
    prisma = {
      service: {
        findUnique: jest.fn().mockResolvedValue(serviceRow()),
        update: jest.fn(async () => serviceRow()),
      },
      container: {
        findUnique: jest.fn().mockResolvedValue(container(ContainerStatus.OVERFLOWED)),
        update: jest.fn(async (args: unknown) => args),
      },
      outboxEvent: { create: jest.fn(), createMany: jest.fn() },
      // complete() usa la forma de callback; otros metodos, la de array.
      $transaction: jest.fn((arg: unknown) =>
        typeof arg === 'function'
          ? (arg as (tx: unknown) => unknown)(prisma)
          : Promise.all(arg as Promise<unknown>[]),
      ),
    };
    outbox = { enqueue: jest.fn(), enqueueMany: jest.fn() };
    service = new ServicesService(prisma as unknown as PrismaService, outbox);
  });

  /** Los argumentos con los que se actualizo el contenedor. */
  const containerOp = () => prisma.container.update.mock.calls[0][0];

  it('un contenedor OVERFLOWED vuelve a ACTIVE al cerrar (vaciado)', async () => {
    await service.complete(SERVICE_ID);

    expect(prisma.container.update).toHaveBeenCalledTimes(1);
    expect(containerOp().data).toMatchObject({ status: ContainerStatus.ACTIVE });
    expect(containerOp().where).toEqual({ id: CONTAINER_ID });
  });

  it('un contenedor UNDER_REPAIR vuelve a ACTIVE y limpia los campos de daño', async () => {
    prisma.container.findUnique.mockResolvedValue(container(ContainerStatus.UNDER_REPAIR));

    await service.complete(SERVICE_ID);

    expect(containerOp().data).toEqual({
      status: ContainerStatus.ACTIVE,
      damageType: null,
      severity: null,
      requiresPublicWorks: null,
    });
  });

  it('un contenedor RELOCATING exige la ubicacion nueva', async () => {
    prisma.container.findUnique.mockResolvedValue(container(ContainerStatus.RELOCATING));

    await expect(service.complete(SERVICE_ID)).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('un contenedor RELOCATING se reubica con la ubicacion nueva', async () => {
    prisma.container.findUnique.mockResolvedValue(container(ContainerStatus.RELOCATING));

    await service.complete(SERVICE_ID, {
      containerLocation: { address: 'Av. Santa Fe 2800', lat: -34.5955, lng: -58.4016 },
    });

    expect(containerOp().data).toEqual({
      status: ContainerStatus.ACTIVE,
      address: 'Av. Santa Fe 2800',
      lat: -34.5955,
      lng: -58.4016,
    });
  });

  it('un cierre PARCIAL no toca el contenedor: el trabajo no se hizo', async () => {
    prisma.service.findUnique.mockResolvedValue(
      serviceRow({
        zoneResults: [{ id: 'r1', zoneId: ZONE, status: ZoneResultStatus.NOT_SERVICED }],
      }),
    );

    await service.complete(SERVICE_ID);

    expect(prisma.container.update).not.toHaveBeenCalled();
    expect(prisma.container.findUnique).not.toHaveBeenCalled();
  });

  it('un contenedor ACTIVE no transiciona: no habia trabajo pendiente', async () => {
    prisma.container.findUnique.mockResolvedValue(container(ContainerStatus.ACTIVE));

    await service.complete(SERVICE_ID);

    expect(prisma.container.update).not.toHaveBeenCalled();
  });

  it('un contenedor DAMAGED no transiciona: falta pasar por start-repair', async () => {
    prisma.container.findUnique.mockResolvedValue(container(ContainerStatus.DAMAGED));

    await service.complete(SERVICE_ID);

    expect(prisma.container.update).not.toHaveBeenCalled();
  });

  it('un servicio ROUTE no mira contenedores', async () => {
    prisma.service.findUnique.mockResolvedValue(
      serviceRow({ mode: ServiceMode.ROUTE, targetType: null, targetId: null }),
    );

    await service.complete(SERVICE_ID);

    expect(prisma.container.findUnique).not.toHaveBeenCalled();
    expect(prisma.container.update).not.toHaveBeenCalled();
  });

  it('404 si el contenedor que el servicio dice atender no existe', async () => {
    prisma.container.findUnique.mockResolvedValue(null);

    await expect(service.complete(SERVICE_ID)).rejects.toThrow(NotFoundException);
  });

  it('sigue rechazando el cierre si falta el resultado de una zona', async () => {
    prisma.service.findUnique.mockResolvedValue(serviceRow({ zoneResults: [] }));

    await expect(service.complete(SERVICE_ID)).rejects.toThrow(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
