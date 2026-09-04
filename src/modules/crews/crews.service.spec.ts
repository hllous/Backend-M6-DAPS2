import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CrewsService } from './crews.service';

const ID = '44444444-4444-4444-4444-444444444444';

describe('CrewsService', () => {
  let prisma: any;
  let service: CrewsService;

  const cuadrilla = (over: Record<string, unknown> = {}) => ({
    id: ID,
    name: 'Cuadrilla Centro 1',
    crewType: 'MUNICIPAL',
    defaultShift: 'MORNING',
    leaderUserId: 'u-1',
    organizationId: null,
    active: true,
    createdAt: new Date('2026-08-01T10:00:00.000Z'),
    updatedAt: new Date('2026-08-02T10:00:00.000Z'),
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
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    service = new CrewsService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('nace activa y sin cooperativa si no se la pasan', async () => {
      await service.create({ name: 'C1', crewType: 'MUNICIPAL', defaultShift: 'MORNING' } as any);

      expect(prisma.crew.create.mock.calls[0][0].data).toMatchObject({
        active: true,
        leaderUserId: null,
        organizationId: null,
      });
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
    it('los duplicados se ignoran en silencio', async () => {
      await service.addMembers(ID, { userIds: ['u-1', 'u-2'] } as any);

      expect(prisma.crewMember.createMany).toHaveBeenCalledWith({
        data: [
          { crewId: ID, userId: 'u-1' },
          { crewId: ID, userId: 'u-2' },
        ],
        skipDuplicates: true,
      });
    });

    it('devuelve la cuadrilla con sus miembros', async () => {
      prisma.crew.findUnique.mockResolvedValue(
        cuadrilla({ members: [{ userId: 'u-1' }, { userId: 'u-2' }] }),
      );

      const dto = await service.addMembers(ID, { userIds: ['u-2'] } as any);

      expect(dto.members).toEqual([{ userId: 'u-1' }, { userId: 'u-2' }]);
    });

    it('sumar miembros a una cuadrilla inexistente da 404 sin escribir', async () => {
      prisma.crew.findUnique.mockResolvedValue(null);

      await expect(service.addMembers(ID, { userIds: ['u-1'] } as any)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.crewMember.createMany).not.toHaveBeenCalled();
    });

    it('quitar a alguien que no es miembro da 404', async () => {
      prisma.crewMember.deleteMany.mockResolvedValue({ count: 0 });

      await expect(service.removeMember(ID, 'u-9')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('quitar a un miembro no devuelve nada', async () => {
      await expect(service.removeMember(ID, 'u-1')).resolves.toBeUndefined();
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
      } as any);

      expect(prisma.crew.findMany.mock.calls[0][0].where).toEqual({
        active: true,
        crewType: 'MUNICIPAL',
        defaultShift: 'NIGHT',
      });
    });

    it('el listado no trae los miembros; el detalle sí', async () => {
      const lista = await service.findAll({ page: 1, pageSize: 20 } as any);
      expect(lista.data[0].members).toBeUndefined();

      prisma.crew.findUnique.mockResolvedValue(cuadrilla({ members: [{ userId: 'u-1' }] }));
      const detalle = await service.findOne(ID);
      expect(detalle.members).toEqual([{ userId: 'u-1' }]);
    });

    it('findOne da 404 si no está', async () => {
      prisma.crew.findUnique.mockResolvedValue(null);

      await expect(service.findOne(ID)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
