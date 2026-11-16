import { ConflictException, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, WasteType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { GreenPointsService } from './green-points.service';

describe('GreenPointsService', () => {
  const id = '77777777-7777-7777-7777-777777777777';
  const zoneId = '88888888-8888-8888-8888-888888888888';

  let prisma: any;
  let service: GreenPointsService;

  const row = (over: Record<string, unknown> = {}) => ({
    id,
    code: 'GP-0012',
    name: 'Punto verde Plaza Mitre',
    zoneId,
    address: 'Av. Mitre 1200',
    lat: new Prisma.Decimal('-34.6037'),
    lng: new Prisma.Decimal('-58.3816'),
    active: true,
    wasteTypes: [{ wasteType: WasteType.RECYCLABLE }, { wasteType: WasteType.GREEN }],
    createdAt: new Date('2026-08-01T10:00:00.000Z'),
    updatedAt: new Date('2026-08-02T10:00:00.000Z'),
    ...over,
  });

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
        create: vi.fn().mockResolvedValue(row()),
        findUnique: vi.fn().mockResolvedValue(row()),
        findMany: vi.fn().mockResolvedValue([row()]),
        count: vi.fn().mockResolvedValue(41),
        update: vi.fn().mockResolvedValue(row()),
      },
    };
    service = new GreenPointsService(prisma as unknown as PrismaService);
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });
  afterEach(() => vi.restoreAllMocks());

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
    prisma.greenPoint.create.mockResolvedValue(row({ lat: null, lng: null }));

    const result = await service.create(dto);

    expect(result.lat).toBeNull();
    expect(result.lng).toBeNull();
  });

  it('traduce el codigo duplicado a 409 y nombra el código', async () => {
    prisma.greenPoint.create.mockRejectedValue(prismaError('P2002'));

    const pedido = service.create(dto);

    await expect(pedido).rejects.toBeInstanceOf(ConflictException);
    await expect(pedido).rejects.toThrow("Ya existe un punto verde con el código 'GP-0012'");
  });

  it('traduce la zona inexistente a 404 y nombra la zona', async () => {
    prisma.greenPoint.create.mockRejectedValue(prismaError('P2003'));

    const pedido = service.create(dto);

    await expect(pedido).rejects.toBeInstanceOf(NotFoundException);
    await expect(pedido).rejects.toThrow(`Zona con id '${zoneId}' no encontrada`);
  });

  // Solo los errores conocidos de Prisma se traducen: un Error común con
  // `code: 'P2003'` no es una FK rota y debe propagarse tal cual.
  it('al crear propaga un error ajeno con code P2003 y uno de Prisma con otro código', async () => {
    const ajeno = Object.assign(new Error('socket'), { code: 'P2003' });
    prisma.greenPoint.create.mockRejectedValueOnce(ajeno);
    await expect(service.create(dto)).rejects.toBe(ajeno);

    const otro = prismaError('P2024');
    prisma.greenPoint.create.mockRejectedValueOnce(otro);
    await expect(service.create(dto)).rejects.toBe(otro);
  });

  // Regla: opcionales ausentes se persisten como null y el punto nace activo.
  it('al crear sin opcionales guarda null en dirección y coordenadas y lo activa', async () => {
    await service.create({ code: 'GP-1', name: 'N', zoneId, wasteTypes: [WasteType.GREEN] });

    expect(prisma.greenPoint.create).toHaveBeenCalledWith({
      data: {
        code: 'GP-1',
        name: 'N',
        zoneId,
        address: null,
        lat: null,
        lng: null,
        active: true,
        wasteTypes: { createMany: { data: [{ wasteType: WasteType.GREEN }] } },
      },
      include: { wasteTypes: true },
    });
  });

  it('al crear respeta dirección, coordenadas y active=false si vienen', async () => {
    await service.create({
      code: 'GP-1',
      name: 'N',
      zoneId,
      address: 'Calle 1',
      lat: -34.5,
      lng: -58.4,
      active: false,
      wasteTypes: [WasteType.GREEN],
    });

    const { data } = prisma.greenPoint.create.mock.calls[0][0];
    expect(data).toMatchObject({ address: 'Calle 1', lat: -34.5, lng: -58.4, active: false });
  });

  /** El vecino busca "dónde llevo el cartón", no un punto verde por nombre. */
  it('el filtro por tipo de residuo busca en los que recibe cada punto', async () => {
    await service.findAll({ page: 1, pageSize: 20, wasteType: WasteType.GREEN } as any);

    expect(prisma.greenPoint.findMany.mock.calls[0][0].where.wasteTypes).toEqual({
      some: { wasteType: WasteType.GREEN },
    });
  });

  it('la búsqueda mira nombre y dirección a la vez', async () => {
    await service.findAll({ page: 1, pageSize: 20, search: 'mitre' } as any);

    expect(prisma.greenPoint.findMany.mock.calls[0][0].where.OR).toEqual([
      { name: { contains: 'mitre', mode: 'insensitive' } },
      { address: { contains: 'mitre', mode: 'insensitive' } },
    ]);
  });

  it('filtra por zona y estado', async () => {
    await service.findAll({ page: 1, pageSize: 20, zoneId: 'z-sur', active: true } as any);

    expect(prisma.greenPoint.findMany.mock.calls[0][0].where).toEqual({
      zoneId: 'z-sur',
      active: true,
    });
  });

  it('el listado trae los tipos de residuo de cada punto', async () => {
    const { data } = await service.findAll({ page: 1, pageSize: 20 } as any);

    expect(prisma.greenPoint.findMany.mock.calls[0][0].include).toEqual({ wasteTypes: true });
    expect(data[0].wasteTypes).toEqual([WasteType.GREEN, WasteType.RECYCLABLE]);
  });

  it('el listado sin filtros no impone where y ordena por código con paginación', async () => {
    const res = await service.findAll({ page: 3, pageSize: 10, skip: 20, take: 10 } as any);

    const args = prisma.greenPoint.findMany.mock.calls[0][0];
    expect(args.where).toStrictEqual({});
    expect(args).toMatchObject({ skip: 20, take: 10, orderBy: { code: 'asc' } });
    expect(prisma.greenPoint.count).toHaveBeenCalledWith({ where: {} });
    expect(res.meta).toMatchObject({ total: 41, page: 3, pageSize: 10 });
  });

  it('el filtro active=false se aplica (no se confunde con "sin filtro")', async () => {
    await service.findAll({ page: 1, pageSize: 20, active: false } as any);

    expect(prisma.greenPoint.findMany.mock.calls[0][0].where).toStrictEqual({ active: false });
  });

  it('findOne consulta por id con los tipos de residuo y el 404 nombra el id', async () => {
    await service.findOne(id);
    expect(prisma.greenPoint.findUnique).toHaveBeenCalledWith({
      where: { id },
      include: { wasteTypes: true },
    });

    prisma.greenPoint.findUnique.mockResolvedValue(null);
    const pedido = service.findOne(id);
    await expect(pedido).rejects.toBeInstanceOf(NotFoundException);
    await expect(pedido).rejects.toThrow(`Punto verde con id '${id}' no encontrado`);
  });

  it('actualizar un punto inexistente da 404 con el id y no escribe nada', async () => {
    prisma.greenPoint.findUnique.mockResolvedValue(null);

    const pedido = service.update(id, { name: 'X' });

    await expect(pedido).rejects.toBeInstanceOf(NotFoundException);
    await expect(pedido).rejects.toThrow(`Punto verde con id '${id}' no encontrado`);
    expect(prisma.greenPoint.update).not.toHaveBeenCalled();
  });

  it('al actualizar los tipos de residuo reemplaza el conjunto completo', async () => {
    await service.update(id, { wasteTypes: [WasteType.BULKY] });

    const [[args]] = prisma.greenPoint.update.mock.calls;
    expect(args.data.wasteTypes).toEqual({
      deleteMany: {},
      createMany: { data: [{ wasteType: WasteType.BULKY }] },
    });
  });

  it('un PATCH vacío no manda ninguna clave', async () => {
    await service.update(id, {} as any);

    expect(prisma.greenPoint.update.mock.calls[0][0].data).toStrictEqual({});
  });

  // Regla de PATCH: solo viaja lo que vino; active=false y lat=0 son valores válidos.
  it('update envía únicamente los campos presentes, incluidos los falsy válidos', async () => {
    await service.update(id, { active: false, lat: 0 } as any);

    expect(prisma.greenPoint.update.mock.calls[0][0].data).toStrictEqual({
      active: false,
      lat: 0,
    });
  });

  it('update envía cada campo con su valor', async () => {
    await service.update(id, {
      name: 'Nuevo',
      zoneId,
      address: 'Calle 2',
      lat: 1,
      lng: 2,
      active: true,
    } as any);

    const args = prisma.greenPoint.update.mock.calls[0][0];
    expect(args.where).toEqual({ id });
    expect(args.include).toEqual({ wasteTypes: true });
    expect(args.data).toStrictEqual({
      name: 'Nuevo',
      zoneId,
      address: 'Calle 2',
      lat: 1,
      lng: 2,
      active: true,
    });
  });

  it('update traduce la zona inexistente a 404 con su mensaje', async () => {
    prisma.greenPoint.update.mockRejectedValue(prismaError('P2003'));

    await expect(service.update(id, { zoneId })).rejects.toThrow(
      `Zona con id '${zoneId}' no encontrada`,
    );
  });

  it('update propaga otros errores de Prisma, los ajenos con code P2003 y los comunes', async () => {
    const otro = prismaError('P2002');
    prisma.greenPoint.update.mockRejectedValueOnce(otro);
    await expect(service.update(id, { name: 'X' })).rejects.toBe(otro);

    const ajeno = Object.assign(new Error('x'), { code: 'P2003' });
    prisma.greenPoint.update.mockRejectedValueOnce(ajeno);
    await expect(service.update(id, { name: 'X' })).rejects.toBe(ajeno);

    prisma.greenPoint.update.mockRejectedValueOnce(new Error('la base se cayó'));
    await expect(service.update(id, { name: 'X' })).rejects.toThrow('la base se cayó');
  });

  it('la baja es logica', async () => {
    await service.remove(id);

    expect(prisma.greenPoint.update).toHaveBeenCalledWith({
      where: { id },
      data: { active: false },
    });
  });

  it('remove sobre un punto inexistente da 404 y no actualiza nada', async () => {
    prisma.greenPoint.findUnique.mockResolvedValue(null);

    await expect(service.remove(id)).rejects.toThrow(`Punto verde con id '${id}' no encontrado`);
    expect(prisma.greenPoint.update).not.toHaveBeenCalled();
  });
});
