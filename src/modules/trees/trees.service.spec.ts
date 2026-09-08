import { ConflictException, NotFoundException } from '@nestjs/common';
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

    it('pide el más reciente, y uno solo', async () => {
      await service.findAll({ skip: 0, take: 20, page: 1, pageSize: 20 } as any);

      expect(prisma.tree.findMany.mock.calls[0][0].include).toEqual({
        surveys: { orderBy: { surveyedAt: 'desc' }, take: 1 },
      });
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
