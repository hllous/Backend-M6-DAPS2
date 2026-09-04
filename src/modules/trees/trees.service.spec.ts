import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TreesService } from './trees.service';

const ID = '55555555-5555-5555-5555-555555555555';

function prismaError(code: string) {
  return new Prisma.PrismaClientKnownRequestError('x', { code, clientVersion: '5.22.0' });
}

describe('TreesService', () => {
  let prisma: any;
  let service: TreesService;

  const arbol = (over: Record<string, unknown> = {}) => ({
    id: ID,
    surveyCode: 'AR-0001',
    species: 'Jacarandá',
    zoneId: 'z-centro',
    address: 'Av. Mitre 1200',
    lat: new Prisma.Decimal('-34.6037'),
    lng: new Prisma.Decimal('-58.3816'),
    heightM: new Prisma.Decimal('8.50'),
    diameterCm: new Prisma.Decimal('42.0'),
    active: true,
    createdAt: new Date('2026-08-01T10:00:00.000Z'),
    updatedAt: new Date('2026-08-02T10:00:00.000Z'),
    ...over,
  });

  beforeEach(() => {
    prisma = {
      tree: {
        create: jest.fn().mockResolvedValue(arbol()),
        findUnique: jest.fn().mockResolvedValue(arbol()),
        findMany: jest.fn().mockResolvedValue([arbol()]),
        count: jest.fn().mockResolvedValue(1),
        update: jest.fn().mockResolvedValue(arbol()),
      },
    };
    service = new TreesService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('los opcionales ausentes se guardan como null', async () => {
      await service.create({ surveyCode: 'AR-9', zoneId: 'z' } as any);

      expect(prisma.tree.create.mock.calls[0][0].data).toMatchObject({
        species: null,
        address: null,
        lat: null,
        lng: null,
        heightM: null,
        diameterCm: null,
      });
    });

    it('un código de censo repetido da 409', async () => {
      prisma.tree.create.mockRejectedValue(prismaError('P2002'));

      await expect(service.create({ surveyCode: 'AR-0001' } as any)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('una zona inexistente da 404', async () => {
      prisma.tree.create.mockRejectedValue(prismaError('P2003'));

      await expect(service.create({ zoneId: 'no-existe' } as any)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('un error ajeno a Prisma se propaga', async () => {
      prisma.tree.create.mockRejectedValue(new Error('la base se cayó'));

      await expect(service.create({} as any)).rejects.toThrow('la base se cayó');
    });
  });

  describe('findAll', () => {
    /** El operador busca "jacarandá" o "Av. Mitre" sin saber en qué campo está. */
    it('la búsqueda mira especie y dirección a la vez', async () => {
      await service.findAll({ page: 1, pageSize: 20, search: 'jacaranda' } as any);

      expect(prisma.tree.findMany.mock.calls[0][0].where.OR).toEqual([
        { species: { contains: 'jacaranda', mode: 'insensitive' } },
        { address: { contains: 'jacaranda', mode: 'insensitive' } },
      ]);
    });

    it('filtra por zona y estado', async () => {
      await service.findAll({ page: 1, pageSize: 20, zoneId: 'z-sur', active: false } as any);

      expect(prisma.tree.findMany.mock.calls[0][0].where).toEqual({
        zoneId: 'z-sur',
        active: false,
      });
    });

    it('ordena por código de censo', async () => {
      await service.findAll({ page: 1, pageSize: 20 } as any);

      expect(prisma.tree.findMany.mock.calls[0][0].orderBy).toEqual({ surveyCode: 'asc' });
    });
  });

  describe('update', () => {
    /** El código de censo identifica al árbol en todos los relevamientos. */
    it('el código de censo es inmutable', async () => {
      await service.update(ID, { surveyCode: 'OTRO', species: 'Tipa' } as any);

      expect(prisma.tree.update.mock.calls[0][0].data).toEqual({ species: 'Tipa' });
    });

    it('mover el árbol a una zona inexistente da 404', async () => {
      prisma.tree.update.mockRejectedValue(prismaError('P2003'));

      await expect(service.update(ID, { zoneId: 'no-existe' } as any)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('un árbol inexistente da 404', async () => {
      prisma.tree.findUnique.mockResolvedValue(null);

      await expect(service.update(ID, {} as any)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    /** Un árbol extraído sigue teniendo historial de relevamientos. */
    it('es baja lógica, no borrado', async () => {
      await service.remove(ID);

      expect(prisma.tree.update).toHaveBeenCalledWith({
        where: { id: ID },
        data: { active: false },
      });
    });
  });

  describe('medidas en la respuesta', () => {
    it('las convierte a número', async () => {
      const dto = await service.findOne(ID);

      expect(dto).toMatchObject({ lat: -34.6037, heightM: 8.5, diameterCm: 42 });
    });

    it('las que faltan viajan como null', async () => {
      prisma.tree.findUnique.mockResolvedValue(
        arbol({ lat: null, lng: null, heightM: null, diameterCm: null }),
      );

      const dto = await service.findOne(ID);

      expect(dto).toMatchObject({ lat: null, lng: null, heightM: null, diameterCm: null });
    });

    /** Un plantín recién puesto mide casi cero: es un dato, no la falta de dato. */
    it('una medida en cero NO se publica como null', async () => {
      prisma.tree.findUnique.mockResolvedValue(
        arbol({ heightM: new Prisma.Decimal(0), diameterCm: new Prisma.Decimal(0) }),
      );

      const dto = await service.findOne(ID);

      expect(dto.heightM).toBe(0);
      expect(dto.diameterCm).toBe(0);
    });

    it('findOne da 404 si no está', async () => {
      prisma.tree.findUnique.mockResolvedValue(null);

      await expect(service.findOne(ID)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
