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
