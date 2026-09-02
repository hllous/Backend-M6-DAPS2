import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RoutesService } from './routes.service';

describe('RoutesService — secuencia de paradas', () => {
  const routeId = '33333333-3333-3333-3333-333333333333';
  const zoneA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const zoneB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  let prisma: {
    route: { findUnique: jest.Mock };
    zone: { findMany: jest.Mock };
    routeStop: { deleteMany: jest.Mock; createMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let service: RoutesService;

  beforeEach(() => {
    prisma = {
      route: {
        findUnique: jest.fn().mockResolvedValue({
          id: routeId,
          code: 'R-03',
          name: 'Troncal',
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          stops: [],
        }),
      },
      zone: {
        // Se comporta como el findMany real: devuelve solo los ids del `in`.
        findMany: jest.fn(async (args) => args.where.id.in.map((id: string) => ({ id }))),
      },
      routeStop: {
        deleteMany: jest.fn().mockReturnValue('delete-op'),
        createMany: jest.fn().mockReturnValue('create-op'),
      },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    service = new RoutesService(prisma as unknown as PrismaService);
  });

  it('asigna sequence por el orden del array, 1-indexed', async () => {
    await service.setStops(routeId, {
      stops: [
        { zoneId: zoneB, estimatedDurationMin: 30 },
        { zoneId: zoneA, estimatedDurationMin: 90 },
      ],
    });

    expect(prisma.routeStop.createMany).toHaveBeenCalledWith({
      data: [
        { routeId, zoneId: zoneB, sequence: 1, estimatedDurationMin: 30 },
        { routeId, zoneId: zoneA, sequence: 2, estimatedDurationMin: 90 },
      ],
    });
  });

  it('borra y recrea dentro de una sola transaccion, borrado primero', async () => {
    await service.setStops(routeId, { stops: [{ zoneId: zoneA, estimatedDurationMin: 60 }] });

    // Sin esto, intercambiar dos paradas choca con @@unique([routeId, sequence]).
    expect(prisma.$transaction).toHaveBeenCalledWith(['delete-op', 'create-op']);
  });

  it('rechaza una zona repetida: romperia ServiceZone al copiar el recorrido', async () => {
    await expect(
      service.setStops(routeId, {
        stops: [
          { zoneId: zoneA, estimatedDurationMin: 30 },
          { zoneId: zoneA, estimatedDurationMin: 60 },
        ],
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('devuelve 404 nombrando las zonas que no existen', async () => {
    prisma.zone.findMany.mockResolvedValue([{ id: zoneA }]); // zoneB no existe

    await expect(
      service.setStops(routeId, {
        stops: [
          { zoneId: zoneA, estimatedDurationMin: 30 },
          { zoneId: zoneB, estimatedDurationMin: 60 },
        ],
      }),
    ).rejects.toThrow(new NotFoundException(`Zonas no encontradas: ${zoneB}`));
  });

  it('acepta el array vacio para dejar el recorrido sin paradas', async () => {
    await service.setStops(routeId, { stops: [] });

    expect(prisma.zone.findMany).not.toHaveBeenCalled();
    expect(prisma.routeStop.createMany).toHaveBeenCalledWith({ data: [] });
  });

  it('devuelve 404 si el recorrido no existe', async () => {
    prisma.route.findUnique.mockResolvedValue(null);

    await expect(service.setStops(routeId, { stops: [] })).rejects.toThrow(NotFoundException);
  });
});
