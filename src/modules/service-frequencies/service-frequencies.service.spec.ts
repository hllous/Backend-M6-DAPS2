import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ServiceMode, Shift } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ServiceFrequenciesService } from './service-frequencies.service';

describe('ServiceFrequenciesService', () => {
  const id = '44444444-4444-4444-4444-444444444444';
  const serviceTypeId = '55555555-5555-5555-5555-555555555555';
  const routeId = '66666666-6666-6666-6666-666666666666';

  let prisma: {
    serviceFrequency: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
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
});
