import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, ServiceCategory, ServiceMode } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ServiceTypesService } from './service-types.service';

describe('ServiceTypesService', () => {
  let prisma: {
    serviceType: {
      create: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };
  let service: ServiceTypesService;

  const row = {
    id: '11111111-1111-1111-1111-111111111111',
    code: 'REC-DOM',
    name: 'Recolección domiciliaria',
    category: ServiceCategory.WASTE_COLLECTION,
    mode: ServiceMode.ROUTE,
    requiresVehicle: true,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    prisma = {
      serviceType: {
        create: jest.fn().mockResolvedValue(row),
        findMany: jest.fn().mockResolvedValue([row]),
        count: jest.fn().mockResolvedValue(1),
        findUnique: jest.fn().mockResolvedValue(row),
        update: jest.fn().mockResolvedValue(row),
      },
    };
    service = new ServiceTypesService(prisma as unknown as PrismaService);
  });

  it('crea un tipo de servicio y devuelve el DTO, no la entidad', async () => {
    const result = await service.create({
      code: 'REC-DOM',
      name: 'Recolección domiciliaria',
      category: ServiceCategory.WASTE_COLLECTION,
      mode: ServiceMode.ROUTE,
    });

    expect(prisma.serviceType.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ code: 'REC-DOM', requiresVehicle: false, active: true }),
    });
    expect(result).toEqual(expect.objectContaining({ code: 'REC-DOM' }));
  });

  it('traduce el codigo duplicado a 409', async () => {
    prisma.serviceType.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: '5.22.0',
      }),
    );

    await expect(
      service.create({
        code: 'REC-DOM',
        name: 'x',
        category: ServiceCategory.WASTE_COLLECTION,
        mode: ServiceMode.ROUTE,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('devuelve 404 cuando el tipo no existe', async () => {
    prisma.serviceType.findUnique.mockResolvedValue(null);

    await expect(service.findOne(row.id)).rejects.toThrow(NotFoundException);
  });

  it('la baja es logica: marca active=false, no borra', async () => {
    await service.remove(row.id);

    expect(prisma.serviceType.update).toHaveBeenCalledWith({
      where: { id: row.id },
      data: { active: false },
    });
  });

  it('arma los filtros de busqueda sobre el where', async () => {
    await service.findAll({
      page: 1,
      pageSize: 20,
      skip: 0,
      take: 20,
      category: ServiceCategory.TREES,
      search: 'poda',
    } as never);

    expect(prisma.serviceType.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          category: ServiceCategory.TREES,
          name: { contains: 'poda', mode: 'insensitive' },
        },
      }),
    );
  });
});
