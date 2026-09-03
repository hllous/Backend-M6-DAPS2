import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { GreenSpacesService } from './green-spaces.service';

const ID = '88888888-8888-8888-8888-888888888888';

function prismaError(code: string) {
  return new Prisma.PrismaClientKnownRequestError('x', { code, clientVersion: '5.22.0' });
}

describe('GreenSpacesService', () => {
  let prisma: any;
  let service: GreenSpacesService;

  const espacio = (over: Record<string, unknown> = {}) => ({
    id: ID,
    name: 'Plaza Mitre',
    spaceType: 'SQUARE',
    zoneId: 'z-centro',
    areaM2: new Prisma.Decimal('2400.00'),
    active: true,
    createdAt: new Date('2026-08-01T10:00:00.000Z'),
    updatedAt: new Date('2026-08-02T10:00:00.000Z'),
    ...over,
  });

  beforeEach(() => {
    prisma = {
      greenSpace: {
        create: jest.fn().mockResolvedValue(espacio()),
        findUnique: jest.fn().mockResolvedValue(espacio()),
        findMany: jest.fn().mockResolvedValue([espacio()]),
        count: jest.fn().mockResolvedValue(1),
        update: jest.fn().mockResolvedValue(espacio()),
      },
    };
    service = new GreenSpacesService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('nace activo y sin superficie si no se la pasan', async () => {
      await service.create({ name: 'Parque Sur', spaceType: 'PARK', zoneId: 'z' } as any);

      expect(prisma.greenSpace.create.mock.calls[0][0].data).toMatchObject({
        active: true,
        areaM2: null,
      });
    });

    it('una zona inexistente da 404', async () => {
      prisma.greenSpace.create.mockRejectedValue(prismaError('P2003'));

      await expect(service.create({ zoneId: 'no-existe' } as any)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('un error ajeno a Prisma se propaga', async () => {
      prisma.greenSpace.create.mockRejectedValue(new Error('la base se cayó'));

      await expect(service.create({} as any)).rejects.toThrow('la base se cayó');
    });
  });

  describe('update', () => {
    /** Una plaza no se convierte en cantero: eso es otro registro. */
    it('el tipo de espacio es inmutable', async () => {
      await service.update(ID, { spaceType: 'MEDIAN', name: 'Plaza San Martín' } as any);

      expect(prisma.greenSpace.update.mock.calls[0][0].data).toEqual({ name: 'Plaza San Martín' });
    });

    it('mover el espacio a una zona inexistente da 404', async () => {
      prisma.greenSpace.update.mockRejectedValue(prismaError('P2003'));

      await expect(service.update(ID, { zoneId: 'no-existe' } as any)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('un espacio inexistente da 404', async () => {
      prisma.greenSpace.findUnique.mockResolvedValue(null);

      await expect(service.update(ID, {} as any)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    it('es baja lógica, no borrado', async () => {
      await service.remove(ID);

      expect(prisma.greenSpace.update).toHaveBeenCalledWith({
        where: { id: ID },
        data: { active: false },
      });
    });
  });

  describe('listado y detalle', () => {
    it('acumula los filtros que vienen', async () => {
      await service.findAll({
        page: 1,
        pageSize: 20,
        active: true,
        spaceType: 'PARK',
        zoneId: 'z-sur',
        search: 'mitre',
      } as any);

      expect(prisma.greenSpace.findMany.mock.calls[0][0].where).toEqual({
        active: true,
        spaceType: 'PARK',
        zoneId: 'z-sur',
        name: { contains: 'mitre', mode: 'insensitive' },
      });
    });

    it('la superficie sale como número, y la ausente como null', async () => {
      await expect(service.findOne(ID)).resolves.toMatchObject({ areaM2: 2400 });

      prisma.greenSpace.findUnique.mockResolvedValue(espacio({ areaM2: null }));
      await expect(service.findOne(ID)).resolves.toMatchObject({ areaM2: null });
    });

    it('una superficie en cero NO se publica como null', async () => {
      prisma.greenSpace.findUnique.mockResolvedValue(espacio({ areaM2: new Prisma.Decimal(0) }));

      await expect(service.findOne(ID)).resolves.toMatchObject({ areaM2: 0 });
    });

    it('findOne da 404 si no está', async () => {
      prisma.greenSpace.findUnique.mockResolvedValue(null);

      await expect(service.findOne(ID)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
