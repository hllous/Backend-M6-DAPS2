import { MeController } from './me.controller';
import { MeService } from './me.service';
import { AuthenticatedUser } from './jwt.strategy';
import { M6Role } from './m6-role';
import { PrismaService } from '../prisma/prisma.service';

describe('MeController', () => {
  const findMany = vi.fn();
  const controller = new MeController(
    new MeService({ crew: { findMany } } as unknown as PrismaService),
  );
  const user = (id: string, roles: M6Role[]): AuthenticatedUser => ({
    userId: id,
    subType: 'EMPLEADO',
    m1Role: 'ADMINISTRATIVO',
    actorId: null,
    roles,
  });

  beforeEach(() => {
    findMany.mockReset();
  });

  it('Oficina: identidad y roles, sin cuadrillas ni inspector', async () => {
    findMany.mockResolvedValue([]);
    const u = user('3', [M6Role.M6_OFICINA_OPERACIONES]);
    // actorId es para M2 (updatedBy.id), no se expone en /me.
    const res = await controller.me({ ...u, actorId: '11111111-1111-4111-8111-111111111111' });
    expect(res).not.toHaveProperty('actorId');
    expect(res).toEqual({ ...u, actorId: undefined, crews: [], isAssignedInspector: false });
  });

  it('Campo: responsable e integrante según el id, solo con id, nombre y rol', async () => {
    findMany.mockResolvedValue([
      { id: 'c1', name: 'A', leaderUserId: '101' },
      { id: 'c2', name: 'B', leaderUserId: '999' },
    ]);
    const res = await controller.me(user('101', [M6Role.M6_CAMPO_CUADRILLA]));
    expect(res.crews).toEqual([
      { id: 'c1', name: 'A', role: 'LEADER' },
      { id: 'c2', name: 'B', role: 'MEMBER' },
    ]);
    expect(res.isAssignedInspector).toBe(false);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ leaderUserId: '101' }, { members: { some: { userId: '101' } } }] },
      }),
    );
  });

  it('inspector: el rol efectivo M6_CAMPO_INSPECTOR lo marca', async () => {
    findMany.mockResolvedValue([]);
    const res = await controller.me(
      user('601', [M6Role.M6_CAMPO_CUADRILLA, M6Role.M6_CAMPO_INSPECTOR]),
    );
    expect(res.isAssignedInspector).toBe(true);
  });
});
