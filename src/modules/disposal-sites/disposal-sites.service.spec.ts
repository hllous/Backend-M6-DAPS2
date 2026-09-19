import { ConflictException, NotFoundException } from '@nestjs/common';
import { DisposalSiteType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DisposalSitesService } from './disposal-sites.service';
import { QueryDisposalSitesDto } from './dto/query-disposal-sites.dto';

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

  it('findOne devuelve el sitio encontrado', async () => {
    const result = await service.findOne(row.id);
    expect(result.code).toBe('DS-CEAMSE');
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

  it('remove lanza 404 si el sitio no existe', async () => {
    prisma.disposalSite.findUnique.mockResolvedValue(null);
    await expect(service.remove('no-existe')).rejects.toThrow(NotFoundException);
  });

  it('un error de prisma que no es P2002 se relanza tal cual', async () => {
    const error = new Prisma.PrismaClientKnownRequestError('otro', {
      code: 'P2025',
      clientVersion: '5.22.0',
    });
    prisma.disposalSite.create.mockRejectedValue(error);

    await expect(
      service.create({ code: 'DS-X', name: 'x', siteType: DisposalSiteType.LANDFILL }),
    ).rejects.toBe(error);
  });

  it('un error que no es de prisma tambien se relanza', async () => {
    const error = new Error('boom');
    prisma.disposalSite.create.mockRejectedValue(error);

    await expect(
      service.create({ code: 'DS-X', name: 'x', siteType: DisposalSiteType.LANDFILL }),
    ).rejects.toBe(error);
  });

  it('update lanza 404 si el sitio no existe', async () => {
    prisma.disposalSite.findUnique.mockResolvedValue(null);
    await expect(service.update('no-existe', {})).rejects.toThrow(NotFoundException);
  });

  it('update sin cambios no pisa ningun campo', async () => {
    await service.update(row.id, {});

    const [[args]] = prisma.disposalSite.update.mock.calls;
    expect(args.data).toEqual({});
  });

  it('update con todos los campos los aplica', async () => {
    await service.update(row.id, {
      name: 'Nuevo nombre',
      siteType: DisposalSiteType.RECYCLING_PLANT,
      active: false,
    });

    const [[args]] = prisma.disposalSite.update.mock.calls;
    expect(args.data).toEqual({
      name: 'Nuevo nombre',
      siteType: DisposalSiteType.RECYCLING_PLANT,
      active: false,
    });
  });

  describe('findAll', () => {
    it('sin filtros deja el where vacío', async () => {
      await service.findAll({} as QueryDisposalSitesDto);

      const [[args]] = prisma.disposalSite.findMany.mock.calls;
      expect(args.where).toEqual({});
    });

    it('filtra por active, siteType y busca por nombre', async () => {
      await service.findAll({
        active: false,
        siteType: DisposalSiteType.RECYCLING_PLANT,
        search: 'norte',
      } as QueryDisposalSitesDto);

      const [[args]] = prisma.disposalSite.findMany.mock.calls;
      expect(args.where).toEqual({
        active: false,
        siteType: DisposalSiteType.RECYCLING_PLANT,
        name: { contains: 'norte', mode: 'insensitive' },
      });
    });
  });
});
