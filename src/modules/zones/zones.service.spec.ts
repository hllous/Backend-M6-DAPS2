import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ZonesService } from './zones.service';
import { NeighborhoodsCatalogService } from '../../core/neighborhoods-catalog.service';

const ID = '33333333-3333-3333-3333-333333333333';
const COMUNA = '44444444-4444-4444-4444-444444444444';

describe('ZonesService', () => {
  let prisma: any;
  let service: ZonesService;
  let catalog: { disponible: boolean; existe: jest.Mock; list: jest.Mock };

  const zona = (over: Record<string, unknown> = {}) => ({
    id: ID,
    code: 'Z-CENTRO',
    name: 'Zona Centro',
    active: true,
    createdAt: new Date('2026-08-01T10:00:00.000Z'),
    updatedAt: new Date('2026-08-02T10:00:00.000Z'),
    commune: null,
    neighborhoods: [],
    ...over,
  });

  beforeEach(() => {
    prisma = {
      zone: {
        create: jest.fn().mockResolvedValue(zona()),
        findUnique: jest.fn().mockResolvedValue(zona({ neighborhoods: [] })),
        findMany: jest.fn().mockResolvedValue([zona()]),
        count: jest.fn().mockResolvedValue(1),
        update: jest.fn().mockResolvedValue(zona()),
      },
      commune: { findUnique: jest.fn().mockResolvedValue({ id: COMUNA }) },
      zoneNeighborhood: {
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    // Por defecto sin catálogo: es lo que pasa sin CORE_API_URL.
    catalog = {
      disponible: false,
      existe: jest.fn((id: string) => id.startsWith('b-')),
      list: jest.fn().mockReturnValue([]),
    };
    service = new ZonesService(
      prisma as unknown as PrismaService,
      catalog as unknown as NeighborhoodsCatalogService,
    );
  });

  describe('create', () => {
    it('nace activa si el DTO no dice lo contrario', async () => {
      await service.create({ code: 'Z-SUR', name: 'Zona Sur' } as any);

      expect(prisma.zone.create.mock.calls[0][0].data.active).toBe(true);
    });

    it('respeta un active explícito en false', async () => {
      await service.create({ code: 'Z-SUR', name: 'Zona Sur', active: false } as any);

      expect(prisma.zone.create.mock.calls[0][0].data.active).toBe(false);
    });

    it('crea con comuna existente; con una inexistente da 400', async () => {
      await service.create({ code: 'palermo', name: 'Palermo', communeId: COMUNA } as any);
      expect(prisma.zone.create.mock.calls[0][0].data.communeId).toBe(COMUNA);

      prisma.commune.findUnique.mockResolvedValue(null);
      await expect(
        service.create({ code: 'x', name: 'X', communeId: COMUNA } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('un código repetido da 409, no un error de Prisma', async () => {
      prisma.zone.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('dup', {
          code: 'P2002',
          clientVersion: '5.22.0',
        }),
      );

      await expect(service.create({ code: 'Z-CENTRO' } as any)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('un error que no es P2002 se propaga', async () => {
      prisma.zone.create.mockRejectedValue(new Error('la base se cayó'));

      await expect(service.create({} as any)).rejects.toThrow('la base se cayó');
    });
  });

  describe('update', () => {
    /** El código identifica la zona en los recorridos y servicios ya cargados. */
    it('el código es inmutable', async () => {
      await service.update(ID, { code: 'OTRO', name: 'Renombrada' } as any);

      expect(prisma.zone.update.mock.calls[0][0].data).toEqual({ name: 'Renombrada' });
    });

    it('un DTO vacío no escribe nada', async () => {
      await service.update(ID, {} as any);

      expect(prisma.zone.update.mock.calls[0][0].data).toEqual({});
    });

    it('asigna la comuna si existe', async () => {
      await service.update(ID, { communeId: COMUNA } as any);

      expect(prisma.zone.update.mock.calls[0][0].data).toEqual({ communeId: COMUNA });
    });

    it('una comuna inexistente da 400 y no escribe', async () => {
      prisma.commune.findUnique.mockResolvedValue(null);

      await expect(service.update(ID, { communeId: COMUNA } as any)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.zone.update).not.toHaveBeenCalled();
    });

    it('una zona inexistente da 404', async () => {
      prisma.zone.findUnique.mockResolvedValue(null);

      await expect(service.update(ID, {} as any)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    /** Los recorridos y servicios apuntan a la zona: el borrado físico los rompería. */
    it('es baja lógica, no borrado', async () => {
      await service.remove(ID);

      expect(prisma.zone.update).toHaveBeenCalledWith({
        where: { id: ID },
        data: { active: false },
      });
    });

    it('una zona inexistente da 404', async () => {
      prisma.zone.findUnique.mockResolvedValue(null);

      await expect(service.remove(ID)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('barrios del catálogo de M9', () => {
    /**
     * Asignar dos veces el mismo barrio es un no-op, no un error: el frontend
     * manda el set completo y no tiene por qué saber cuáles ya estaban.
     */
    it('los duplicados se ignoran en silencio', async () => {
      await service.addNeighborhoods(ID, { neighborhoodIds: ['b-1', 'b-2'] } as any);

      expect(prisma.zoneNeighborhood.createMany).toHaveBeenCalledWith({
        data: [
          { zoneId: ID, neighborhoodId: 'b-1' },
          { zoneId: ID, neighborhoodId: 'b-2' },
        ],
        skipDuplicates: true,
      });
    });

    it('devuelve la zona con sus barrios, no solo un OK', async () => {
      prisma.zone.findUnique.mockResolvedValue(
        zona({ neighborhoods: [{ neighborhoodId: 'b-1' }, { neighborhoodId: 'b-2' }] }),
      );

      const dto = await service.addNeighborhoods(ID, { neighborhoodIds: ['b-1'] } as any);

      expect(dto.neighborhoods).toEqual([{ neighborhoodId: 'b-1' }, { neighborhoodId: 'b-2' }]);
    });

    it('con catálogo, un id que M9 no tiene da 400 y no escribe nada', async () => {
      catalog.disponible = true;

      await expect(
        service.addNeighborhoods(ID, { neighborhoodIds: ['b-1', 'x-9'] } as any),
      ).rejects.toThrow(/x-9/);
      expect(prisma.zoneNeighborhood.createMany).not.toHaveBeenCalled();
    });

    it('con catálogo, ids válidos se asignan', async () => {
      catalog.disponible = true;

      await service.addNeighborhoods(ID, { neighborhoodIds: ['b-1'] } as any);
      expect(prisma.zoneNeighborhood.createMany).toHaveBeenCalledTimes(1);
    });

    it('sin catálogo degrada: asigna aunque el id sea desconocido', async () => {
      await service.addNeighborhoods(ID, { neighborhoodIds: ['x-9'] } as any);
      expect(prisma.zoneNeighborhood.createMany).toHaveBeenCalledTimes(1);
    });

    it('asignar barrios a una zona inexistente da 404', async () => {
      prisma.zone.findUnique.mockResolvedValue(null);

      await expect(
        service.addNeighborhoods(ID, { neighborhoodIds: ['b-1'] } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.zoneNeighborhood.createMany).not.toHaveBeenCalled();
    });

    /** Quitar algo que no estaba no es idempotente acá: avisa que el pedido no aplicaba. */
    it('quitar un barrio que no está asignado da 404', async () => {
      prisma.zoneNeighborhood.deleteMany.mockResolvedValue({ count: 0 });

      await expect(service.removeNeighborhood(ID, 'b-9')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('quitar un barrio asignado no devuelve nada', async () => {
      await expect(service.removeNeighborhood(ID, 'b-1')).resolves.toBeUndefined();
      expect(prisma.zoneNeighborhood.deleteMany).toHaveBeenCalledWith({
        where: { zoneId: ID, neighborhoodId: 'b-1' },
      });
    });
  });

  describe('listado y detalle', () => {
    it('filtra por estado y busca por nombre sin distinguir mayúsculas', async () => {
      await service.findAll({ page: 1, pageSize: 20, active: true, search: 'centro' } as any);

      expect(prisma.zone.findMany.mock.calls[0][0].where).toEqual({
        active: true,
        name: { contains: 'centro', mode: 'insensitive' },
      });
    });

    it('active en false filtra las inactivas, no se ignora', async () => {
      await service.findAll({ page: 1, pageSize: 20, active: false } as any);

      expect(prisma.zone.findMany.mock.calls[0][0].where).toEqual({ active: false });
    });

    it('el listado no trae los barrios; el detalle sí', async () => {
      const lista = await service.findAll({ page: 1, pageSize: 20 } as any);
      expect(lista.data[0].neighborhoods).toBeUndefined();

      prisma.zone.findUnique.mockResolvedValue(
        zona({ neighborhoods: [{ neighborhoodId: 'b-1' }] }),
      );
      const detalle = await service.findOne(ID);
      expect(detalle.neighborhoods).toEqual([{ neighborhoodId: 'b-1' }]);
    });

    it('filtra por comuna', async () => {
      await service.findAll({ page: 1, pageSize: 20, communeId: COMUNA } as any);

      expect(prisma.zone.findMany.mock.calls[0][0].where).toEqual({ communeId: COMUNA });
    });

    it('expone la comuna y el barrio resuelto del catálogo', async () => {
      catalog.list.mockReturnValue([{ id: 'b-1', codigo: 'palermo', nombre: 'Palermo' }]);
      prisma.zone.findMany.mockResolvedValue([
        zona({
          commune: { id: COMUNA, code: 'comuna-14', name: 'Comuna 14', active: true },
          neighborhoods: [{ neighborhoodId: 'b-1' }],
        }),
      ]);

      const { data } = await service.findAll({ page: 1, pageSize: 20 } as any);

      expect(data[0].commune).toEqual({ id: COMUNA, code: 'comuna-14', name: 'Comuna 14' });
      expect(data[0].neighborhood).toEqual({ id: 'b-1', codigo: 'palermo', nombre: 'Palermo' });
    });

    it('sin catálogo el barrio lleva solo el id; sin barrio ni comuna, null', async () => {
      prisma.zone.findMany.mockResolvedValue([
        zona({ neighborhoods: [{ neighborhoodId: 'b-1' }] }),
        zona(),
      ]);

      const { data } = await service.findAll({ page: 1, pageSize: 20 } as any);

      expect(data[0].neighborhood).toEqual({ id: 'b-1', codigo: undefined, nombre: undefined });
      expect(data[1].neighborhood).toBeNull();
      expect(data[1].commune).toBeNull();
    });

    it('findOne da 404 si no está', async () => {
      prisma.zone.findUnique.mockResolvedValue(null);

      await expect(service.findOne(ID)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
