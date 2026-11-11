import { ConflictException, Logger, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  RiskLevel,
  RiskType,
  TreeHealthStatus,
  TreeInterventionType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TreesService } from './trees.service';

const ID = '55555555-5555-5555-5555-555555555555';
const ULTIMO = { surveys: { orderBy: { surveyedAt: 'desc' }, take: 1 } };

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
        create: vi.fn().mockResolvedValue(arbol()),
        findUnique: vi.fn().mockResolvedValue(arbol()),
        findMany: vi.fn().mockResolvedValue([arbol()]),
        count: vi.fn().mockResolvedValue(1),
        update: vi.fn().mockResolvedValue(arbol()),
      },
      $queryRaw: vi.fn().mockResolvedValue([]),
    };
    service = new TreesService(prisma as unknown as PrismaService);
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  describe('create', () => {
    // Regla: un árbol nuevo nace activo y con los opcionales en null.
    it('sin opcionales los guarda como null, lo deja activo y pide el último relevamiento', async () => {
      await service.create({ surveyCode: 'AR-9', zoneId: 'z' } as any);

      expect(prisma.tree.create).toHaveBeenCalledWith({
        data: {
          surveyCode: 'AR-9',
          zoneId: 'z',
          species: null,
          address: null,
          lat: null,
          lng: null,
          heightM: null,
          diameterCm: null,
          active: true,
        },
        include: ULTIMO,
      });
    });

    it('respeta los valores dados, incluido active=false', async () => {
      await service.create({
        surveyCode: 'AR-9',
        zoneId: 'z',
        species: 'Tala',
        lat: -34.5,
        lng: -58.4,
        heightM: 7,
        diameterCm: 30,
        active: false,
      } as any);

      expect(prisma.tree.create.mock.calls[0][0].data).toMatchObject({
        species: 'Tala',
        lat: -34.5,
        lng: -58.4,
        heightM: 7,
        diameterCm: 30,
        active: false,
      });
    });

    it('un código de censo repetido da 409 y nombra el código', async () => {
      prisma.tree.create.mockRejectedValue(prismaError('P2002'));

      const pedido = service.create({ surveyCode: 'AR-0001' } as any);

      await expect(pedido).rejects.toBeInstanceOf(ConflictException);
      await expect(pedido).rejects.toThrow("Ya existe un árbol con el código 'AR-0001'");
    });

    it('una zona inexistente da 404 y nombra la zona', async () => {
      prisma.tree.create.mockRejectedValue(prismaError('P2003'));

      const pedido = service.create({ zoneId: 'no-existe' } as any);

      await expect(pedido).rejects.toBeInstanceOf(NotFoundException);
      await expect(pedido).rejects.toThrow("Zona con id 'no-existe' no encontrada");
    });

    it('un error ajeno a Prisma se propaga', async () => {
      prisma.tree.create.mockRejectedValue(new Error('la base se cayó'));

      await expect(service.create({} as any)).rejects.toThrow('la base se cayó');
    });

    // Solo los errores conocidos de Prisma se traducen: uno común con code P2003
    // no es una FK rota, y un código de Prisma distinto no es ni 409 ni 404.
    it('propaga un error ajeno con code P2003 y los de Prisma con otro código', async () => {
      const ajeno = Object.assign(new Error('socket'), { code: 'P2003' });
      prisma.tree.create.mockRejectedValueOnce(ajeno);
      await expect(service.create({ surveyCode: 'AR-9', zoneId: 'z' } as any)).rejects.toBe(ajeno);

      prisma.tree.update.mockRejectedValueOnce(ajeno);
      await expect(service.update(ID, { zoneId: 'z' })).rejects.toBe(ajeno);

      const otroCreate = prismaError('P2024');
      prisma.tree.create.mockRejectedValueOnce(otroCreate);
      await expect(service.create({ surveyCode: 'AR-9', zoneId: 'z' } as any)).rejects.toBe(
        otroCreate,
      );

      const otroUpdate = prismaError('P2002');
      prisma.tree.update.mockRejectedValueOnce(otroUpdate);
      await expect(service.update(ID, { species: 'X' })).rejects.toBe(otroUpdate);
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

    it('riskLevel filtra por el último relevamiento, con el mismo DISTINCT ON del indicador', async () => {
      prisma.$queryRaw.mockResolvedValue([{ id: 't1' }, { id: 't2' }]);

      await service.findAll({ page: 1, pageSize: 20, riskLevel: 'HIGH' } as any);

      expect(String(prisma.$queryRaw.mock.calls[0][0].join(''))).toContain('DISTINCT ON (tree_id)');
      expect(prisma.tree.findMany.mock.calls[0][0].where).toEqual({ id: { in: ['t1', 't2'] } });
      expect(prisma.tree.count.mock.calls[0][0].where).toEqual({ id: { in: ['t1', 't2'] } });
    });

    it('ordena por código de censo', async () => {
      await service.findAll({ page: 1, pageSize: 20 } as any);

      expect(prisma.tree.findMany.mock.calls[0][0].orderBy).toEqual({ surveyCode: 'asc' });
    });

    it('sin filtros no impone where, pagina y no consulta relevamientos crudos', async () => {
      prisma.tree.count.mockResolvedValue(30);

      const res = await service.findAll({ page: 2, pageSize: 10, skip: 10, take: 10 } as any);

      const args = prisma.tree.findMany.mock.calls[0][0];
      expect(args.where).toStrictEqual({});
      expect(args).toMatchObject({ skip: 10, take: 10, include: ULTIMO });
      expect(prisma.tree.count).toHaveBeenCalledWith({ where: {} });
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
      expect(res.meta).toMatchObject({ total: 30, page: 2, pageSize: 10 });
    });
  });

  describe('update', () => {
    /** El código de censo identifica al árbol en todos los relevamientos. */
    it('el código de censo es inmutable', async () => {
      await service.update(ID, { surveyCode: 'OTRO', species: 'Tipa' } as any);

      expect(prisma.tree.update.mock.calls[0][0].data).toStrictEqual({ species: 'Tipa' });
    });

    it('mover el árbol a una zona inexistente da 404 y nombra la zona', async () => {
      prisma.tree.update.mockRejectedValue(prismaError('P2003'));

      const pedido = service.update(ID, { zoneId: 'z-x' } as any);

      await expect(pedido).rejects.toBeInstanceOf(NotFoundException);
      await expect(pedido).rejects.toThrow("Zona con id 'z-x' no encontrada");
    });

    it('un árbol inexistente da 404 con el id y no escribe', async () => {
      prisma.tree.findUnique.mockResolvedValue(null);

      const pedido = service.update(ID, { species: 'X' });

      await expect(pedido).rejects.toBeInstanceOf(NotFoundException);
      await expect(pedido).rejects.toThrow(`Árbol con id '${ID}' no encontrado`);
      expect(prisma.tree.update).not.toHaveBeenCalled();
    });

    // Regla de PATCH: solo viaja lo que vino; 0 y false son valores válidos.
    it('envía únicamente los campos presentes, incluidos 0 y false', async () => {
      await service.update(ID, { heightM: 0, diameterCm: 0, active: false } as any);

      const args = prisma.tree.update.mock.calls[0][0];
      expect(args.where).toEqual({ id: ID });
      expect(args.include).toEqual(ULTIMO);
      expect(args.data).toStrictEqual({ heightM: 0, diameterCm: 0, active: false });
    });

    it('envía cada campo con su valor', async () => {
      const dto = {
        zoneId: 'z-2',
        species: 'Tala',
        address: 'Calle 3',
        lat: 1,
        lng: 2,
        heightM: 3,
        diameterCm: 4,
        active: true,
      };

      await service.update(ID, dto as any);

      expect(prisma.tree.update.mock.calls[0][0].data).toStrictEqual(dto);
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

    it('sobre un árbol inexistente da 404 y no escribe', async () => {
      prisma.tree.findUnique.mockResolvedValue(null);

      await expect(service.remove(ID)).rejects.toThrow(`Árbol con id '${ID}' no encontrado`);
      expect(prisma.tree.update).not.toHaveBeenCalled();
    });
  });

  describe('medidas en la respuesta', () => {
    it('las convierte a número', async () => {
      const dto = await service.findOne(ID);

      expect(dto).toMatchObject({ lat: -34.6037, lng: -58.3816, heightM: 8.5, diameterCm: 42 });
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

    it('findOne consulta por id con el último relevamiento y el 404 nombra el id', async () => {
      await service.findOne(ID);
      expect(prisma.tree.findUnique).toHaveBeenCalledWith({ where: { id: ID }, include: ULTIMO });

      prisma.tree.findUnique.mockResolvedValue(null);
      const pedido = service.findOne(ID);
      await expect(pedido).rejects.toBeInstanceOf(NotFoundException);
      await expect(pedido).rejects.toThrow(`Árbol con id '${ID}' no encontrado`);
    });
  });

  describe('último relevamiento en la respuesta', () => {
    const relevamiento = (over: Record<string, unknown> = {}) => ({
      id: 'rel-1',
      treeId: ID,
      surveyedAt: new Date('2026-08-20T09:00:00.000Z'),
      inspectorId: 'usr-00015',
      healthStatus: TreeHealthStatus.WEAKENED,
      riskLevel: RiskLevel.HIGH,
      riskType: RiskType.FALLING_BRANCH,
      suggestedIntervention: TreeInterventionType.SAFETY_PRUNING,
      requiresStreetClosure: true,
      requiresPublicWorks: false,
      notes: 'Rama principal con fisura',
      createdAt: new Date('2026-08-20T09:30:00.000Z'),
      ...over,
    });

    it('publica el riesgo, para poder pintar el mapa sin pedir árbol por árbol', async () => {
      prisma.tree.findUnique.mockResolvedValue(arbol({ surveys: [relevamiento()] }));

      const dto = await service.findOne(ID);

      expect(dto.lastSurvey).toEqual({
        surveyedAt: new Date('2026-08-20T09:00:00.000Z'),
        healthStatus: TreeHealthStatus.WEAKENED,
        riskLevel: RiskLevel.HIGH,
        riskType: RiskType.FALLING_BRANCH,
        suggestedIntervention: TreeInterventionType.SAFETY_PRUNING,
      });
    });

    /** Es un resumen para el listado, no el detalle: eso sigue en /trees/:id/surveys. */
    it('es un resumen: no arrastra inspector, notas ni derivaciones', async () => {
      prisma.tree.findUnique.mockResolvedValue(arbol({ surveys: [relevamiento()] }));

      const dto = await service.findOne(ID);

      expect(Object.keys(dto.lastSurvey!).sort()).toEqual([
        'healthStatus',
        'riskLevel',
        'riskType',
        'suggestedIntervention',
        'surveyedAt',
      ]);
    });

    /** El seed carga 16 árboles y 6 relevamientos: sin relevar es un estado real. */
    it('un árbol sin relevar viaja como null, no como objeto vacío', async () => {
      prisma.tree.findUnique.mockResolvedValue(arbol({ surveys: [] }));

      expect((await service.findOne(ID)).lastSurvey).toBeNull();
    });

    /**
     * Sin el include acá, editar la dirección de un árbol relevado lo devolvería
     * con `lastSurvey: null` y el frontend lo leería como "sin relevar".
     */
    it('el PATCH también lo trae', async () => {
      prisma.tree.update.mockResolvedValue(arbol({ surveys: [relevamiento()] }));

      const dto = await service.update(ID, { address: 'Av. Mitre 1300' } as any);

      expect(prisma.tree.update.mock.calls[0][0].include).toBeDefined();
      expect(dto.lastSurvey?.riskLevel).toBe(RiskLevel.HIGH);
    });

    it('un árbol recién creado no tiene relevamiento', async () => {
      expect(
        (await service.create({ surveyCode: 'AR-9', zoneId: 'z' } as any)).lastSurvey,
      ).toBeNull();
    });
  });
});
