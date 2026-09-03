import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, WasteType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { GreenPointsService } from './green-points.service';

describe('GreenPointsService', () => {
  const id = '77777777-7777-7777-7777-777777777777';
  const zoneId = '88888888-8888-8888-8888-888888888888';

  let prisma: {
    greenPoint: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
  };
  let service: GreenPointsService;

  const row = {
    id,
    code: 'GP-0012',
    name: 'Punto verde Plaza Mitre',
    zoneId,
    address: 'Av. Mitre 1200',
    lat: new Prisma.Decimal('-34.6037'),
    lng: new Prisma.Decimal('-58.3816'),
    active: true,
    wasteTypes: [{ wasteType: WasteType.RECYCLABLE }, { wasteType: WasteType.GREEN }],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const dto = {
    code: 'GP-0012',
    name: 'Punto verde Plaza Mitre',
    zoneId,
    wasteTypes: [WasteType.RECYCLABLE, WasteType.GREEN],
  };

  const prismaError = (code: string) =>
    new Prisma.PrismaClientKnownRequestError('err', { code, clientVersion: '5.22.0' });

  beforeEach(() => {
    prisma = {
      greenPoint: {
        create: jest.fn().mockResolvedValue(row),
        findUnique: jest.fn().mockResolvedValue(row),
        update: jest.fn().mockResolvedValue(row),
      },
    };
    service = new GreenPointsService(prisma as unknown as PrismaService);
  });

  it('convierte los Decimal de lat/lng a number en la respuesta', async () => {
    const result = await service.create(dto);

    expect(result.lat).toBe(-34.6037);
    expect(result.lng).toBe(-58.3816);
    expect(typeof result.lat).toBe('number');
  });

  it('devuelve los tipos de residuo ordenados', async () => {
    const result = await service.create(dto);

    expect(result.wasteTypes).toEqual([WasteType.GREEN, WasteType.RECYCLABLE]);
  });

  it('deja lat/lng en null cuando no vienen', async () => {
    prisma.greenPoint.create.mockResolvedValue({ ...row, lat: null, lng: null });

    const result = await service.create(dto);

    expect(result.lat).toBeNull();
    expect(result.lng).toBeNull();
  });

  it('traduce el codigo duplicado a 409', async () => {
    prisma.greenPoint.create.mockRejectedValue(prismaError('P2002'));

    await expect(service.create(dto)).rejects.toThrow(ConflictException);
  });

  it('traduce la zona inexistente a 404', async () => {
    prisma.greenPoint.create.mockRejectedValue(prismaError('P2003'));

    await expect(service.create(dto)).rejects.toThrow(NotFoundException);
  });

  it('al actualizar los tipos de residuo reemplaza el conjunto completo', async () => {
    await service.update(id, { wasteTypes: [WasteType.BULKY] });

    const [[args]] = prisma.greenPoint.update.mock.calls;
    expect(args.data.wasteTypes).toEqual({
      deleteMany: {},
      createMany: { data: [{ wasteType: WasteType.BULKY }] },
    });
  });

  it('la baja es logica', async () => {
    await service.remove(id);

    expect(prisma.greenPoint.update).toHaveBeenCalledWith({
      where: { id },
      data: { active: false },
    });
  });
});

describe('GreenPointsService — listado y detalle', () => {
  const ID = '77777777-7777-7777-7777-777777777777';

  let prisma: any;
  let service: GreenPointsService;

  const punto = (over: Record<string, unknown> = {}) => ({
    id: ID,
    code: 'GP-0012',
    name: 'Punto verde Plaza Mitre',
    zoneId: 'z-centro',
    address: 'Av. Mitre 1200',
    lat: new Prisma.Decimal('-34.6037'),
    lng: new Prisma.Decimal('-58.3816'),
    active: true,
    wasteTypes: [{ wasteType: WasteType.RECYCLABLE }],
    createdAt: new Date('2026-08-01T10:00:00.000Z'),
    updatedAt: new Date('2026-08-02T10:00:00.000Z'),
    ...over,
  });

  beforeEach(() => {
    prisma = {
      greenPoint: {
        findUnique: jest.fn().mockResolvedValue(punto()),
        findMany: jest.fn().mockResolvedValue([punto()]),
        count: jest.fn().mockResolvedValue(1),
        update: jest.fn().mockResolvedValue(punto()),
      },
    };
    service = new GreenPointsService(prisma as unknown as PrismaService);
  });

  /** El vecino busca "dónde llevo el cartón", no un punto verde por nombre. */
  it('el filtro por tipo de residuo busca en los que recibe cada punto', async () => {
    await service.findAll({ page: 1, pageSize: 20, wasteType: WasteType.GREEN } as any);

    expect(prisma.greenPoint.findMany.mock.calls[0][0].where.wasteTypes).toEqual({
      some: { wasteType: WasteType.GREEN },
    });
  });

  it('la búsqueda mira nombre y dirección a la vez', async () => {
    await service.findAll({ page: 1, pageSize: 20, search: 'mitre' } as any);

    expect(prisma.greenPoint.findMany.mock.calls[0][0].where.OR).toEqual([
      { name: { contains: 'mitre', mode: 'insensitive' } },
      { address: { contains: 'mitre', mode: 'insensitive' } },
    ]);
  });

  it('filtra por zona y estado', async () => {
    await service.findAll({ page: 1, pageSize: 20, zoneId: 'z-sur', active: true } as any);

    expect(prisma.greenPoint.findMany.mock.calls[0][0].where).toEqual({
      zoneId: 'z-sur',
      active: true,
    });
  });

  it('el listado trae los tipos de residuo de cada punto', async () => {
    const { data } = await service.findAll({ page: 1, pageSize: 20 } as any);

    expect(prisma.greenPoint.findMany.mock.calls[0][0].include).toEqual({ wasteTypes: true });
    expect(data[0].wasteTypes).toEqual([WasteType.RECYCLABLE]);
  });

  it('findOne da 404 si no está', async () => {
    prisma.greenPoint.findUnique.mockResolvedValue(null);

    await expect(service.findOne(ID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('actualizar un punto inexistente da 404', async () => {
    prisma.greenPoint.findUnique.mockResolvedValue(null);

    await expect(service.update(ID, {} as any)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('un DTO vacío no toca los tipos de residuo', async () => {
    await service.update(ID, {} as any);

    expect(prisma.greenPoint.update.mock.calls[0][0].data).toEqual({});
  });

  it('un error ajeno a Prisma se propaga', async () => {
    prisma.greenPoint.update.mockRejectedValue(new Error('la base se cayó'));

    await expect(service.update(ID, { name: 'X' } as any)).rejects.toThrow('la base se cayó');
  });
});
