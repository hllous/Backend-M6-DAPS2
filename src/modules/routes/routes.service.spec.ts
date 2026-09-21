import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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

describe('RoutesService — CRUD', () => {
  const ID = '33333333-3333-3333-3333-333333333333';

  let prisma: any;
  let service: RoutesService;

  const recorrido = (over: Record<string, unknown> = {}) => ({
    id: ID,
    code: 'R-03',
    name: 'Troncal Centro',
    active: true,
    createdAt: new Date('2026-08-01T10:00:00.000Z'),
    updatedAt: new Date('2026-08-02T10:00:00.000Z'),
    ...over,
  });

  beforeEach(() => {
    prisma = {
      route: {
        create: jest.fn().mockResolvedValue(recorrido()),
        findUnique: jest.fn().mockResolvedValue(recorrido({ stops: [] })),
        findMany: jest.fn().mockResolvedValue([recorrido()]),
        count: jest.fn().mockResolvedValue(1),
        update: jest.fn().mockResolvedValue(recorrido()),
      },
    };
    service = new RoutesService(prisma as unknown as PrismaService);
  });

  it('nace activo y sin paradas', async () => {
    await service.create({ code: 'R-09', name: 'Nuevo' } as any);

    expect(prisma.route.create.mock.calls[0][0].data).toEqual({
      code: 'R-09',
      name: 'Nuevo',
      active: true,
    });
  });

  it('un código repetido da 409, no un error de Prisma', async () => {
    prisma.route.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: '5.22.0' }),
    );

    await expect(service.create({ code: 'R-03' } as any)).rejects.toBeInstanceOf(ConflictException);
  });

  it('un error ajeno a Prisma se propaga', async () => {
    prisma.route.create.mockRejectedValue(new Error('la base se cayó'));

    await expect(service.create({} as any)).rejects.toThrow('la base se cayó');
  });

  /** El código identifica al recorrido en los servicios ya programados. */
  it('el código es inmutable', async () => {
    await service.update(ID, { code: 'OTRO', name: 'Renombrado' } as any);

    expect(prisma.route.update.mock.calls[0][0].data).toEqual({ name: 'Renombrado' });
  });

  it('actualizar un recorrido inexistente da 404', async () => {
    prisma.route.findUnique.mockResolvedValue(null);

    await expect(service.update(ID, {} as any)).rejects.toBeInstanceOf(NotFoundException);
  });

  /** Los Service ya programados guardan routeId: el borrado físico los rompería. */
  it('la baja es lógica', async () => {
    await service.remove(ID);

    expect(prisma.route.update).toHaveBeenCalledWith({
      where: { id: ID },
      data: { active: false },
    });
  });

  /** "Recorridos que pasan por esta zona" se resuelve por las paradas. */
  it('el filtro por zona busca en las paradas', async () => {
    await service.findAll({ page: 1, pageSize: 20, zoneId: 'z-centro' } as any);

    expect(prisma.route.findMany.mock.calls[0][0].where.stops).toEqual({
      some: { zoneId: 'z-centro' },
    });
  });

  it('filtra por estado y busca por nombre', async () => {
    await service.findAll({ page: 1, pageSize: 20, active: false, search: 'troncal' } as any);

    expect(prisma.route.findMany.mock.calls[0][0].where).toMatchObject({
      active: false,
      name: { contains: 'troncal', mode: 'insensitive' },
    });
  });

  it('el detalle trae las paradas en orden y con su zona', async () => {
    await service.findOne(ID);

    expect(prisma.route.findUnique.mock.calls[0][0].include).toEqual({
      stops: { orderBy: { sequence: 'asc' }, include: { zone: true } },
    });
  });

  /**
   * El codigo y el nombre de la zona viajan embebidos para que quien dibuje el
   * recorrido no tenga que pedir /zones aparte solo para traducir el UUID.
   */
  it('cada parada expone el codigo y el nombre de su zona', async () => {
    prisma.route.findUnique.mockResolvedValue(
      recorrido({
        stops: [
          {
            id: 'stop-1',
            sequence: 1,
            zoneId: 'zona-uuid',
            estimatedDurationMin: 90,
            zone: { code: 'Z-BEL', name: 'Belgrano' },
          },
        ],
      }),
    );

    const detalle = await service.findOne(ID);

    expect(detalle.stops).toEqual([
      {
        id: 'stop-1',
        sequence: 1,
        zoneId: 'zona-uuid',
        zoneCode: 'Z-BEL',
        zoneName: 'Belgrano',
        estimatedDurationMin: 90,
      },
    ]);
  });

  /**
   * #216: el listado trae las paradas igual que el detalle. Sin esto el frontend
   * mostraba "Sin paradas" en todos los recorridos del catálogo.
   */
  it('el listado pide las paradas con el mismo include que el detalle', async () => {
    await service.findAll({ page: 1, pageSize: 20 } as any);
    await service.findOne(ID);

    const includeListado = prisma.route.findMany.mock.calls[0][0].include;
    expect(includeListado).toEqual({
      stops: { orderBy: { sequence: 'asc' }, include: { zone: true } },
    });
    expect(includeListado).toEqual(prisma.route.findUnique.mock.calls[0][0].include);
  });

  it('el listado devuelve las paradas con el mismo shape que el detalle', async () => {
    const stops = [
      {
        id: 'stop-1',
        sequence: 1,
        zoneId: 'zona-bel',
        estimatedDurationMin: 90,
        zone: { code: 'Z-BEL', name: 'Belgrano' },
      },
      {
        id: 'stop-2',
        sequence: 2,
        zoneId: 'zona-pal',
        estimatedDurationMin: 45,
        zone: { code: 'Z-PAL', name: 'Palermo' },
      },
    ];
    prisma.route.findMany.mockResolvedValue([
      recorrido({ stops }),
      recorrido({ id: 'r-2', stops: [] }),
    ]);
    prisma.route.findUnique.mockResolvedValue(recorrido({ stops }));

    const listado = await service.findAll({ page: 1, pageSize: 20 } as any);
    const detalle = await service.findOne(ID);

    expect(listado.data[0].stops).toEqual(detalle.stops);
    expect(listado.data[0].stops!.map((s) => s.sequence)).toEqual([1, 2]);
    expect(listado.data[0].stops![1]).toMatchObject({ zoneCode: 'Z-PAL', zoneName: 'Palermo' });
    expect(listado.data[1].stops).toEqual([]);
  });

  it('findOne da 404 si no está', async () => {
    prisma.route.findUnique.mockResolvedValue(null);

    await expect(service.findOne(ID)).rejects.toBeInstanceOf(NotFoundException);
  });
});
