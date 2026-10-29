import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CrewsService } from './crews.service';

const ID = '44444444-4444-4444-4444-444444444444';
const ZONA = '55555555-5555-5555-5555-555555555555';
const OTRA_ZONA = '66666666-6666-6666-6666-666666666666';

describe('CrewsService', () => {
  let prisma: any;
  let service: CrewsService;

  const cuadrilla = (over: Record<string, unknown> = {}) => ({
    id: ID,
    name: 'Cuadrilla Centro 1',
    crewType: 'MUNICIPAL',
    defaultShift: 'MORNING',
    specialty: 'COLLECTION',
    homeZoneId: null,
    leaderUserId: '1',
    leaderName: null,
    organizationId: null,
    organizationName: null,
    active: true,
    createdAt: new Date('2026-08-01T10:00:00.000Z'),
    updatedAt: new Date('2026-08-02T10:00:00.000Z'),
    _count: { members: 0 },
    zoneAssignments: [],
    ...over,
  });

  const reubicacion = (over: Record<string, unknown> = {}) => ({
    id: 'a-1',
    crewId: ID,
    zoneId: ZONA,
    validFrom: new Date('2026-11-02T00:00:00.000Z'),
    validTo: new Date('2026-11-15T00:00:00.000Z'),
    reason: 'Refuerzo por el temporal',
    createdBy: '3',
    createdAt: new Date('2026-10-29T10:00:00.000Z'),
    ...over,
  });

  beforeEach(() => {
    prisma = {
      crew: {
        create: jest.fn().mockResolvedValue(cuadrilla()),
        findUnique: jest.fn().mockResolvedValue(cuadrilla({ members: [] })),
        findMany: jest.fn().mockResolvedValue([cuadrilla()]),
        count: jest.fn().mockResolvedValue(1),
        update: jest.fn().mockResolvedValue(cuadrilla()),
      },
      crewMember: {
        upsert: jest.fn((args: unknown) => args),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      crewZoneAssignment: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([reubicacion()]),
        create: jest.fn().mockResolvedValue(reubicacion()),
      },
      zone: { findUnique: jest.fn().mockResolvedValue({ active: true, name: 'Palermo' }) },
      $executeRaw: jest.fn().mockResolvedValue(1),
      // Las dos formas: array de operaciones (miembros) y callback (reubicaciones).
      $transaction: jest.fn((arg: unknown) =>
        typeof arg === 'function' ? arg(prisma) : Promise.resolve(arg),
      ),
    };
    service = new CrewsService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    const base = { name: 'C1', crewType: 'MUNICIPAL', defaultShift: 'MORNING' };

    it('nace activa y sin cooperativa si no se la pasan', async () => {
      await service.create({ ...base, specialty: 'SWEEPING' } as any);

      expect(prisma.crew.create.mock.calls[0][0].data).toMatchObject({
        active: true,
        leaderUserId: null,
        organizationId: null,
        specialty: 'SWEEPING',
        homeZoneId: null,
        leaderName: null,
        organizationName: null,
      });
    });

    it('el líder se guarda como id de M1 normalizado (#365)', async () => {
      await service.create({ ...base, leaderUserId: '0042' } as any);

      expect(prisma.crew.create.mock.calls[0][0].data.leaderUserId).toBe('42');
    });

    /** Una cuadrilla de cooperativa se identifica por su organización. */
    it('guarda la organización cuando la cuadrilla es de cooperativa', async () => {
      await service.create({
        name: 'Coop Norte',
        crewType: 'COOPERATIVE',
        defaultShift: 'AFTERNOON',
        organizationId: 'org-9',
      } as any);

      expect(prisma.crew.create.mock.calls[0][0].data).toMatchObject({
        crewType: 'COOPERATIVE',
        organizationId: 'org-9',
      });
    });

    it('guarda los nombres del líder y la organización (#454)', async () => {
      await service.create({
        ...base,
        leaderName: 'Marta Gómez',
        organizationName: 'Cooperativa Sur',
      } as any);

      expect(prisma.crew.create.mock.calls[0][0].data).toMatchObject({
        leaderName: 'Marta Gómez',
        organizationName: 'Cooperativa Sur',
      });
    });

    it('con zona base la valida y la guarda', async () => {
      await service.create({ ...base, homeZoneId: ZONA } as any);

      expect(prisma.zone.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: ZONA } }),
      );
      expect(prisma.crew.create.mock.calls[0][0].data.homeZoneId).toBe(ZONA);
    });

    it('una zona base inexistente da 404 y no crea', async () => {
      prisma.zone.findUnique.mockResolvedValue(null);

      await expect(service.create({ ...base, homeZoneId: ZONA } as any)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.crew.create).not.toHaveBeenCalled();
    });

    it('una zona base dada de baja da 400', async () => {
      prisma.zone.findUnique.mockResolvedValue({ active: false, name: 'Vieja' });

      await expect(service.create({ ...base, homeZoneId: ZONA } as any)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('update', () => {
    /** Cambia cómo trabaja la cuadrilla, no qué clase de cuadrilla es. */
    it('el tipo de cuadrilla es inmutable', async () => {
      await service.update(ID, { crewType: 'COOPERATIVE', name: 'Renombrada' } as any);

      expect(prisma.crew.update.mock.calls[0][0].data).toEqual({ name: 'Renombrada' });
    });

    it('deja desasignar el jefe pasando null', async () => {
      await service.update(ID, { leaderUserId: null } as any);

      expect(prisma.crew.update.mock.calls[0][0].data).toEqual({ leaderUserId: null });
    });

    it('cambiar el líder también normaliza el id', async () => {
      await service.update(ID, { leaderUserId: '007' } as any);

      expect(prisma.crew.update.mock.calls[0][0].data).toEqual({ leaderUserId: '7' });
    });

    it('nombres vacíos o null se guardan como null; especialidad y zona se cambian', async () => {
      await service.update(ID, {
        leaderName: '',
        organizationName: null,
        specialty: 'TREES',
        homeZoneId: ZONA,
      } as any);

      expect(prisma.crew.update.mock.calls[0][0].data).toEqual({
        leaderName: null,
        organizationName: null,
        specialty: 'TREES',
        homeZoneId: ZONA,
      });
    });

    it('homeZoneId null deja la cuadrilla sin zona base, sin consultar zonas', async () => {
      await service.update(ID, { homeZoneId: null } as any);

      expect(prisma.zone.findUnique).not.toHaveBeenCalled();
      expect(prisma.crew.update.mock.calls[0][0].data).toEqual({ homeZoneId: null });
    });

    it('una cuadrilla inexistente da 404', async () => {
      prisma.crew.findUnique.mockResolvedValue(null);

      await expect(service.update(ID, {} as any)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    /** Los servicios ya ejecutados apuntan a la cuadrilla que los hizo. */
    it('es baja lógica, no borrado', async () => {
      await service.remove(ID);

      expect(prisma.crew.update).toHaveBeenCalledWith({
        where: { id: ID },
        data: { active: false },
      });
    });
  });

  describe('miembros', () => {
    const upserts = () => prisma.crewMember.upsert.mock.calls.map((c: any[]) => c[0]);

    it('userIds sigue andando: ids normalizados y sin nombre', async () => {
      await service.addMembers(ID, { userIds: ['001', '2'] } as any);

      expect(upserts()).toEqual([
        {
          where: { crewId_userId: { crewId: ID, userId: '1' } },
          create: { crewId: ID, userId: '1', displayName: null },
          update: {},
        },
        {
          where: { crewId_userId: { crewId: ID, userId: '2' } },
          create: { crewId: ID, userId: '2', displayName: null },
          update: {},
        },
      ]);
    });

    it('members guarda el nombre y actualiza el de quien ya estaba (#454)', async () => {
      await service.addMembers(ID, {
        members: [{ userId: '10', displayName: 'Lucía Fernández' }, { userId: '11' }],
      } as any);

      expect(upserts()[0]).toEqual({
        where: { crewId_userId: { crewId: ID, userId: '10' } },
        create: { crewId: ID, userId: '10', displayName: 'Lucía Fernández' },
        update: { displayName: 'Lucía Fernández' },
      });
      // Sin nombre no se pisa el que ya había.
      expect(upserts()[1].update).toEqual({});
    });

    it('un id repetido en userIds y members queda una sola vez, con el nombre', async () => {
      await service.addMembers(ID, {
        userIds: ['10', '12'],
        members: [{ userId: '010', displayName: 'Lucía' }],
      } as any);

      expect(upserts().map((u: any) => u.create)).toEqual([
        { crewId: ID, userId: '10', displayName: 'Lucía' },
        { crewId: ID, userId: '12', displayName: null },
      ]);
    });

    it('devuelve la cuadrilla con sus miembros y nombres', async () => {
      prisma.crew.findUnique.mockResolvedValue(
        cuadrilla({
          _count: { members: 2 },
          members: [
            { userId: '1', displayName: 'Ana' },
            { userId: '2', displayName: null },
          ],
        }),
      );

      const dto = await service.addMembers(ID, { userIds: ['2'] } as any);

      expect(dto.members).toEqual([
        { userId: '1', displayName: 'Ana' },
        { userId: '2', displayName: null },
      ]);
      expect(dto.membersCount).toBe(2);
    });

    it('sumar miembros a una cuadrilla inexistente da 404 sin escribir', async () => {
      prisma.crew.findUnique.mockResolvedValue(null);

      await expect(service.addMembers(ID, { userIds: ['1'] } as any)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.crewMember.upsert).not.toHaveBeenCalled();
    });

    it('quitar a alguien que no es miembro da 404', async () => {
      prisma.crewMember.deleteMany.mockResolvedValue({ count: 0 });

      await expect(service.removeMember(ID, '9')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('quitar a un miembro no devuelve nada', async () => {
      await expect(service.removeMember(ID, '1')).resolves.toBeUndefined();
    });
  });

  describe('listado y detalle', () => {
    it('acumula los filtros que vienen', async () => {
      await service.findAll({
        page: 1,
        pageSize: 20,
        active: true,
        crewType: 'MUNICIPAL',
        defaultShift: 'NIGHT',
        specialty: 'RECYCLING',
      } as any);

      expect(prisma.crew.findMany.mock.calls[0][0].where).toEqual({
        active: true,
        crewType: 'MUNICIPAL',
        defaultShift: 'NIGHT',
        specialty: 'RECYCLING',
      });
    });

    it('el listado no trae los miembros pero sí cuántos son; el detalle trae ambos', async () => {
      prisma.crew.findMany.mockResolvedValue([cuadrilla({ _count: { members: 4 } })]);
      const lista = await service.findAll({ page: 1, pageSize: 20 } as any);
      expect(lista.data[0].members).toBeUndefined();
      expect(lista.data[0].membersCount).toBe(4);

      prisma.crew.findUnique.mockResolvedValue(
        cuadrilla({ _count: { members: 1 }, members: [{ userId: '1', displayName: null }] }),
      );
      const detalle = await service.findOne(ID);
      expect(detalle.members).toEqual([{ userId: '1', displayName: null }]);
      expect(detalle.membersCount).toBe(1);
    });

    it('findOne da 404 si no está', async () => {
      prisma.crew.findUnique.mockResolvedValue(null);

      await expect(service.findOne(ID)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('zoneId filtra por la zona efectiva: reubicación vigente o, sin ella, la base', async () => {
      await service.findAll({ page: 1, pageSize: 20, zoneId: ZONA } as any);

      const { OR } = prisma.crew.findMany.mock.calls[0][0].where;
      expect(OR).toHaveLength(2);
      expect(OR[0].zoneAssignments.some.zoneId).toBe(ZONA);
      expect(OR[0].zoneAssignments.some.validFrom.lte).toBeInstanceOf(Date);
      expect(OR[1].homeZoneId).toBe(ZONA);
      // La base solo cuenta si no hay una reubicación vigente: la misma condición, negada.
      expect(OR[1].zoneAssignments.none).toEqual({
        validFrom: OR[0].zoneAssignments.some.validFrom,
        OR: OR[0].zoneAssignments.some.OR,
      });
    });

    it('effectiveZoneId: la reubicación vigente gana; sin ella, la zona base; sin nada, null', async () => {
      prisma.crew.findMany.mockResolvedValue([
        cuadrilla({ homeZoneId: ZONA, zoneAssignments: [{ zoneId: OTRA_ZONA }] }),
        cuadrilla({ homeZoneId: ZONA }),
        cuadrilla(),
      ]);

      const { data } = await service.findAll({ page: 1, pageSize: 20 } as any);

      expect(data.map((c) => c.effectiveZoneId)).toEqual([OTRA_ZONA, ZONA, null]);
      expect(data[0].homeZoneId).toBe(ZONA);
    });

    it('trae la reubicación vigente de hoy, la más reciente', async () => {
      await service.findAll({ page: 1, pageSize: 20 } as any);

      const { zoneAssignments } = prisma.crew.findMany.mock.calls[0][0].include;
      expect(zoneAssignments).toMatchObject({ orderBy: { validFrom: 'desc' }, take: 1 });
    });
  });

  describe('reubicaciones de zona (#455)', () => {
    const dto = {
      zoneId: ZONA,
      validFrom: '2026-11-02',
      validTo: '2026-11-15',
      reason: 'Refuerzo',
    };

    it('guarda la reubicación con el actor del token y fechas sin hora', async () => {
      const res = await service.createZoneAssignment(ID, dto, '3');

      expect(prisma.crewZoneAssignment.create.mock.calls[0][0].data).toEqual({
        crewId: ID,
        zoneId: ZONA,
        validFrom: new Date('2026-11-02T00:00:00.000Z'),
        validTo: new Date('2026-11-15T00:00:00.000Z'),
        reason: 'Refuerzo',
        createdBy: '3',
      });
      expect(res).toMatchObject({ validFrom: '2026-11-02', validTo: '2026-11-15', createdBy: '3' });
    });

    it('sin validTo queda abierta', async () => {
      prisma.crewZoneAssignment.create.mockResolvedValue(reubicacion({ validTo: null }));

      const res = await service.createZoneAssignment(ID, { ...dto, validTo: undefined }, '3');

      expect(prisma.crewZoneAssignment.create.mock.calls[0][0].data.validTo).toBeNull();
      expect(res.validTo).toBeNull();
    });

    it('validTo anterior a validFrom da 400', async () => {
      await expect(
        service.createZoneAssignment(ID, { ...dto, validTo: '2026-11-01' }, '3'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.crewZoneAssignment.create).not.toHaveBeenCalled();
    });

    it('un período que se pisa con otro da 409', async () => {
      prisma.crewZoneAssignment.findFirst.mockResolvedValue({ id: 'a-0' });

      await expect(service.createZoneAssignment(ID, dto, '3')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.crewZoneAssignment.create).not.toHaveBeenCalled();
    });

    it('toma el lock de la cuadrilla antes de chequear, para serializar altas simultáneas', async () => {
      const orden: string[] = [];
      prisma.$executeRaw.mockImplementation(
        async (strings: TemplateStringsArray, ...vals: unknown[]) => {
          orden.push(`lock:${strings.join('?')}:${vals[0]}`);
          return 1;
        },
      );
      prisma.crewZoneAssignment.findFirst.mockImplementation(async () => {
        orden.push('chequeo');
        return null;
      });
      prisma.crewZoneAssignment.create.mockImplementation(async () => {
        orden.push('alta');
        return reubicacion();
      });

      await service.createZoneAssignment(ID, dto, '3');

      expect(orden).toEqual([
        `lock:SELECT pg_advisory_xact_lock(hashtext(?)):${ID}`,
        'chequeo',
        'alta',
      ]);
    });

    it('el chequeo de superposición es por rango, y sin validTo no tiene tope', async () => {
      await service.createZoneAssignment(ID, dto, '3');
      expect(prisma.crewZoneAssignment.findFirst.mock.calls[0][0].where).toEqual({
        crewId: ID,
        validFrom: { lte: new Date('2026-11-15T00:00:00.000Z') },
        OR: [{ validTo: null }, { validTo: { gte: new Date('2026-11-02T00:00:00.000Z') } }],
      });

      await service.createZoneAssignment(ID, { ...dto, validTo: undefined }, '3');
      expect(prisma.crewZoneAssignment.findFirst.mock.calls[1][0].where).not.toHaveProperty(
        'validFrom',
      );
    });

    it('cuadrilla o zona inexistente da 404; zona dada de baja da 400', async () => {
      prisma.zone.findUnique.mockResolvedValue(null);
      await expect(service.createZoneAssignment(ID, dto, '3')).rejects.toBeInstanceOf(
        NotFoundException,
      );

      prisma.zone.findUnique.mockResolvedValue({ active: false, name: 'Vieja' });
      await expect(service.createZoneAssignment(ID, dto, '3')).rejects.toBeInstanceOf(
        BadRequestException,
      );

      prisma.crew.findUnique.mockResolvedValue(null);
      await expect(service.createZoneAssignment(ID, dto, '3')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('lista el historial, la más reciente primero', async () => {
      const res = await service.listZoneAssignments(ID);

      expect(prisma.crewZoneAssignment.findMany.mock.calls[0][0]).toMatchObject({
        where: { crewId: ID },
        orderBy: [{ validFrom: 'desc' }, { createdAt: 'desc' }],
      });
      expect(res).toHaveLength(1);
      expect(res[0].validFrom).toBe('2026-11-02');
    });

    it('listar las de una cuadrilla inexistente da 404', async () => {
      prisma.crew.findUnique.mockResolvedValue(null);

      await expect(service.listZoneAssignments(ID)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
