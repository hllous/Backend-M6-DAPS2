import { ConflictException, NotFoundException } from '@nestjs/common';
import { DisposalSiteType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DisposalSitesService } from './disposal-sites.service';

describe('DisposalSitesService', () => {
  let prisma: {
    disposalSite: {
      create: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };
  let service: DisposalSitesService;

  const row = {
    id: '22222222-2222-2222-2222-222222222222',
    code: 'DS-CEAMSE',
    name: 'Relleno sanitario Norte III',
    siteType: DisposalSiteType.LANDFILL,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    prisma = {
      disposalSite: {
        create: jest.fn().mockResolvedValue(row),
        findMany: jest.fn().mockResolvedValue([row]),
        count: jest.fn().mockResolvedValue(1),
        findUnique: jest.fn().mockResolvedValue(row),
        update: jest.fn().mockResolvedValue(row),
      },
    };
    service = new DisposalSitesService(prisma as unknown as PrismaService);
  });

  it('crea un sitio de disposicion activo por defecto', async () => {
    await service.create({
      code: 'DS-CEAMSE',
      name: 'Relleno sanitario Norte III',
      siteType: DisposalSiteType.LANDFILL,
    });

    expect(prisma.disposalSite.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ code: 'DS-CEAMSE', active: true }),
    });
  });

  it('traduce el codigo duplicado a 409', async () => {
    prisma.disposalSite.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: '5.22.0',
      }),
    );

    await expect(
      service.create({ code: 'DS-CEAMSE', name: 'x', siteType: DisposalSiteType.LANDFILL }),
    ).rejects.toThrow(ConflictException);
  });

  it('devuelve 404 cuando el sitio no existe', async () => {
    prisma.disposalSite.findUnique.mockResolvedValue(null);

    await expect(service.findOne(row.id)).rejects.toThrow(NotFoundException);
  });

  it('la baja es logica para no romper el historico de CollectionRecord', async () => {
    await service.remove(row.id);

    expect(prisma.disposalSite.update).toHaveBeenCalledWith({
      where: { id: row.id },
      data: { active: false },
    });
  });
});
