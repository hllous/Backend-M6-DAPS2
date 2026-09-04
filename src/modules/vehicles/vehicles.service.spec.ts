import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { VehiclesService } from './vehicles.service';

const ID = '77777777-7777-7777-7777-777777777777';

function prismaError(code: string) {
  return new Prisma.PrismaClientKnownRequestError('x', { code, clientVersion: '5.22.0' });
}

describe('VehiclesService', () => {
  let prisma: any;
  let service: VehiclesService;

  const vehiculo = (over: Record<string, unknown> = {}) => ({
    id: ID,
    plate: 'AB123CD',
    vehicleType: 'COMPACTOR',
    capacity: new Prisma.Decimal('12.50'),
    active: true,
    createdAt: new Date('2026-08-01T10:00:00.000Z'),
    updatedAt: new Date('2026-08-02T10:00:00.000Z'),
    ...over,
  });

  beforeEach(() => {
    prisma = {
      vehicle: {
        create: jest.fn().mockResolvedValue(vehiculo()),
        findUnique: jest.fn().mockResolvedValue(vehiculo()),
        findMany: jest.fn().mockResolvedValue([vehiculo()]),
        count: jest.fn().mockResolvedValue(1),
        update: jest.fn().mockResolvedValue(vehiculo()),
      },
    };
    service = new VehiclesService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('nace activo y sin capacidad si no se la pasan', async () => {
      await service.create({ plate: 'XX999YY', vehicleType: 'TRUCK' } as any);

      expect(prisma.vehicle.create.mock.calls[0][0].data).toMatchObject({
        active: true,
        capacity: null,
      });
    });

    it('una patente repetida da 409', async () => {
      prisma.vehicle.create.mockRejectedValue(prismaError('P2002'));

      await expect(service.create({ plate: 'AB123CD' } as any)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('un error ajeno a Prisma se propaga', async () => {
      prisma.vehicle.create.mockRejectedValue(new Error('la base se cayó'));

      await expect(service.create({} as any)).rejects.toThrow('la base se cayó');
    });
  });

  describe('update', () => {
    /** Un camión no se convierte en barredora: eso es dar de alta otro vehículo. */
    it('el tipo de vehículo es inmutable', async () => {
      await service.update(ID, { vehicleType: 'SWEEPER', capacity: 9 } as any);

      expect(prisma.vehicle.update.mock.calls[0][0].data).toEqual({ capacity: 9 });
    });

    it('la patente sí se puede corregir', async () => {
      await service.update(ID, { plate: 'ZZ000ZZ' } as any);

      expect(prisma.vehicle.update.mock.calls[0][0].data).toEqual({ plate: 'ZZ000ZZ' });
    });

    it('cambiar a una patente que ya existe da 409', async () => {
      prisma.vehicle.update.mockRejectedValue(prismaError('P2002'));

      await expect(service.update(ID, { plate: 'AB123CD' } as any)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('un vehículo inexistente da 404', async () => {
      prisma.vehicle.findUnique.mockResolvedValue(null);

      await expect(service.update(ID, {} as any)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    /** Los servicios ya ejecutados apuntan al vehículo que los hizo. */
    it('es baja lógica, no borrado', async () => {
      await service.remove(ID);

      expect(prisma.vehicle.update).toHaveBeenCalledWith({
        where: { id: ID },
        data: { active: false },
      });
    });

    it('un vehículo inexistente da 404', async () => {
      prisma.vehicle.findUnique.mockResolvedValue(null);

      await expect(service.remove(ID)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('listado y detalle', () => {
    it('filtra por estado y tipo', async () => {
      await service.findAll({ page: 1, pageSize: 20, active: true, vehicleType: 'TRUCK' } as any);

      expect(prisma.vehicle.findMany.mock.calls[0][0].where).toEqual({
        active: true,
        vehicleType: 'TRUCK',
      });
    });

    it('ordena por patente', async () => {
      await service.findAll({ page: 1, pageSize: 20 } as any);

      expect(prisma.vehicle.findMany.mock.calls[0][0].orderBy).toEqual({ plate: 'asc' });
    });

    it('la capacidad sale como número, y la ausente como null', async () => {
      await expect(service.findOne(ID)).resolves.toMatchObject({ capacity: 12.5 });

      prisma.vehicle.findUnique.mockResolvedValue(vehiculo({ capacity: null }));
      await expect(service.findOne(ID)).resolves.toMatchObject({ capacity: null });
    });

    /** Cero es un dato: un vehículo sin caja de carga, no uno sin medir. */
    it('una capacidad en cero NO se publica como null', async () => {
      prisma.vehicle.findUnique.mockResolvedValue(vehiculo({ capacity: new Prisma.Decimal(0) }));

      await expect(service.findOne(ID)).resolves.toMatchObject({ capacity: 0 });
    });

    it('findOne da 404 si no está', async () => {
      prisma.vehicle.findUnique.mockResolvedValue(null);

      await expect(service.findOne(ID)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
