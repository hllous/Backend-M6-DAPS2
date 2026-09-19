import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ServiceMode, Shift } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ServiceFrequenciesService } from './service-frequencies.service';
import { QueryServiceFrequenciesDto } from './dto/query-service-frequencies.dto';

describe('ServiceFrequenciesService', () => {
  const id = '44444444-4444-4444-4444-444444444444';
  const serviceTypeId = '55555555-5555-5555-5555-555555555555';
  const routeId = '66666666-6666-6666-6666-666666666666';

  let prisma: {
    serviceFrequency: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
    };
    serviceType: { findUnique: jest.Mock };
    route: { findUnique: jest.Mock };
  };
  let service: ServiceFrequenciesService;

  const row = (over: Record<string, unknown> = {}) => ({
    id,
    serviceTypeId,
    routeId,
    shift: Shift.MORNING,
    validFrom: new Date('2026-09-01T00:00:00.000Z'),
    validTo: null,
    weekdays: [{ weekday: 5 }, { weekday: 2 }],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  });

  beforeEach(() => {
    prisma = {
      serviceFrequency: {
        create: jest.fn().mockResolvedValue(row()),
        findUnique: jest.fn().mockResolvedValue(row()),
        update: jest.fn().mockResolvedValue(row()),
        findMany: jest.fn().mockResolvedValue([row()]),
        count: jest.fn().mockResolvedValue(1),
      },
      serviceType: {
        findUnique: jest.fn().mockResolvedValue({ id: serviceTypeId, mode: ServiceMode.ROUTE }),
      },
      route: { findUnique: jest.fn().mockResolvedValue({ id: routeId }) },
    };
    service = new ServiceFrequenciesService(prisma as unknown as PrismaService);
  });

  const validDto = {
    serviceTypeId,
    routeId,
    weekdays: [2, 5],
    shift: Shift.MORNING,
    validFrom: '2026-09-01',
  };

  it('crea la frecuencia y devuelve los dias ordenados', async () => {
    const result = await service.create(validDto);

    expect(result.weekdays).toEqual([2, 5]);
  });

  it('rechaza un tipo de servicio que no es de modo ROUTE', async () => {
    prisma.serviceType.findUnique.mockResolvedValue({
      id: serviceTypeId,
      mode: ServiceMode.POINT,
    });

    await expect(service.create(validDto)).rejects.toThrow(BadRequestException);
    expect(prisma.serviceFrequency.create).not.toHaveBeenCalled();
  });

  it('rechaza un periodo con validTo anterior a validFrom', async () => {
    await expect(
      service.create({ ...validDto, validFrom: '2026-09-10', validTo: '2026-09-01' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('devuelve 404 si el recorrido referenciado no existe', async () => {
    prisma.route.findUnique.mockResolvedValue(null);

    await expect(service.create(validDto)).rejects.toThrow(NotFoundException);
  });

  it('la baja cierra la vigencia hoy, no borra el registro', async () => {
    await service.remove(id);

    const [[args]] = prisma.serviceFrequency.update.mock.calls;
    const today = new Date().toISOString().slice(0, 10);
    expect(args.where).toEqual({ id });
    expect(args.data.validTo.toISOString().slice(0, 10)).toBe(today);
  });

  it('si la regla todavia no empezo, la cierra en su fecha de inicio', async () => {
    const future = new Date(Date.now() + 30 * 24 * 3600 * 1000);
    prisma.serviceFrequency.findUnique.mockResolvedValue(row({ validFrom: future }));

    await service.remove(id);

    const [[args]] = prisma.serviceFrequency.update.mock.calls;
    expect(args.data.validTo.toISOString().slice(0, 10)).toBe(future.toISOString().slice(0, 10));
  });

  it('al actualizar los dias reemplaza el conjunto completo', async () => {
    await service.update(id, { weekdays: [1, 3] });

    const [[args]] = prisma.serviceFrequency.update.mock.calls;
    expect(args.data.weekdays).toEqual({
      deleteMany: {},
      createMany: { data: [{ weekday: 1 }, { weekday: 3 }] },
    });
  });

  it('devuelve 404 si el tipo de servicio referenciado no existe', async () => {
    prisma.serviceType.findUnique.mockResolvedValue(null);

    await expect(service.create(validDto)).rejects.toThrow(NotFoundException);
  });

  it('findOne devuelve la frecuencia encontrada', async () => {
    const result = await service.findOne(id);
    expect(result.id).toBe(id);
  });

  it('findOne lanza 404 si no existe', async () => {
    prisma.serviceFrequency.findUnique.mockResolvedValue(null);
    await expect(service.findOne('no-existe')).rejects.toThrow(NotFoundException);
  });

  it('update lanza 404 si la frecuencia no existe', async () => {
    prisma.serviceFrequency.findUnique.mockResolvedValue(null);
    await expect(service.update(id, {})).rejects.toThrow(NotFoundException);
  });

  it('update rechaza un periodo invalido combinando lo actual con lo nuevo', async () => {
    await expect(service.update(id, { validTo: '2026-08-01' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('update sin cambios no pisa ningun campo', async () => {
    await service.update(id, {});

    const [[args]] = prisma.serviceFrequency.update.mock.calls;
    expect(args.data).toEqual({});
  });

  it('update con shift y validFrom nuevos los aplica', async () => {
    await service.update(id, { shift: Shift.AFTERNOON, validFrom: '2026-10-01' });

    const [[args]] = prisma.serviceFrequency.update.mock.calls;
    expect(args.data.shift).toBe(Shift.AFTERNOON);
    expect(args.data.validFrom.toISOString().slice(0, 10)).toBe('2026-10-01');
  });

  it('update con validTo nuevo lo aplica', async () => {
    await service.update(id, { validTo: '2026-12-31' });

    const [[args]] = prisma.serviceFrequency.update.mock.calls;
    expect(args.data.validTo.toISOString().slice(0, 10)).toBe('2026-12-31');
  });

  it('remove lanza 404 si la frecuencia no existe', async () => {
    prisma.serviceFrequency.findUnique.mockResolvedValue(null);
    await expect(service.remove('no-existe')).rejects.toThrow(NotFoundException);
  });

  describe('findAll', () => {
    it('sin filtros deja el where vacío', async () => {
      await service.findAll({} as QueryServiceFrequenciesDto);

      const [[args]] = prisma.serviceFrequency.findMany.mock.calls;
      expect(args.where).toEqual({});
    });

    it('filtra por serviceTypeId, routeId, shift y weekday', async () => {
      await service.findAll({
        serviceTypeId,
        routeId,
        shift: Shift.MORNING,
        weekday: 2,
      } as QueryServiceFrequenciesDto);

      const [[args]] = prisma.serviceFrequency.findMany.mock.calls;
      expect(args.where).toEqual({
        serviceTypeId,
        routeId,
        shift: Shift.MORNING,
        weekdays: { some: { weekday: 2 } },
      });
    });

    it('filtra por vigencia en una fecha dada', async () => {
      await service.findAll({ validOn: '2026-09-15' } as QueryServiceFrequenciesDto);

      const [[args]] = prisma.serviceFrequency.findMany.mock.calls;
      expect(args.where.validFrom).toEqual({ lte: new Date('2026-09-15T00:00:00.000Z') });
      expect(args.where.OR).toEqual([
        { validTo: null },
        { validTo: { gte: new Date('2026-09-15T00:00:00.000Z') } },
      ]);
    });
  });
});
