import { BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { M6Role } from '../../auth/m6-role';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryRoleAssignmentsDto } from './dto';
import { RoleAssignmentsService } from './role-assignments.service';

const ACTOR = '1';
const TARGET = '42';

function setup(opts: { current?: M6Role[]; otherAdmins?: number; bootstrap?: string[] } = {}) {
  const tx = {
    userRoleAssignment: {
      findMany: jest.fn().mockResolvedValue((opts.current ?? []).map((role) => ({ role }))),
      count: jest.fn().mockResolvedValue(opts.otherAdmins ?? 0),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    roleAssignmentAudit: { createMany: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn((fn: (t: typeof tx) => Promise<void>) => fn(tx)),
    userRoleAssignment: { findMany: jest.fn().mockResolvedValue([]), groupBy: jest.fn() },
  };
  const config = { get: () => opts.bootstrap ?? [] } as unknown as ConfigService;
  const service = new RoleAssignmentsService(prisma as unknown as PrismaService, config);
  return { service, tx, prisma };
}

describe('RoleAssignmentsService', () => {
  it('replace: alta y baja de filas con su auditoría, en la misma transacción', async () => {
    const { service, tx, prisma } = setup({
      current: [M6Role.M6_OFICINA_AMBIENTAL, M6Role.M6_OFICINA_OPERACIONES],
    });
    await service.replace(ACTOR, TARGET, [M6Role.M6_OFICINA_OPERACIONES, M6Role.M6_ADMIN]);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.userRoleAssignment.deleteMany).toHaveBeenCalledWith({
      where: { userId: TARGET, role: { in: [M6Role.M6_OFICINA_AMBIENTAL] } },
    });
    expect(tx.userRoleAssignment.createMany).toHaveBeenCalledWith({
      data: [{ userId: TARGET, role: M6Role.M6_ADMIN }],
    });
    expect(tx.roleAssignmentAudit.createMany).toHaveBeenCalledWith({
      data: [
        { actorUserId: ACTOR, targetUserId: TARGET, action: 'GRANT', role: M6Role.M6_ADMIN },
        {
          actorUserId: ACTOR,
          targetUserId: TARGET,
          action: 'REVOKE',
          role: M6Role.M6_OFICINA_AMBIENTAL,
        },
      ],
    });
  });

  it('replace sin cambios no escribe ni audita', async () => {
    const { service, tx } = setup({ current: [M6Role.M6_AUDITOR] });
    await service.replace(ACTOR, TARGET, [M6Role.M6_AUDITOR, M6Role.M6_AUDITOR]);
    expect(tx.userRoleAssignment.createMany).not.toHaveBeenCalled();
    expect(tx.roleAssignmentAudit.createMany).not.toHaveBeenCalled();
  });

  it.each([
    [M6Role.M6_ADMIN, M6Role.M6_CAMPO_CUADRILLA],
    [M6Role.M6_OFICINA_OPERACIONES, M6Role.M6_CAMPO_INSPECTOR],
    [M6Role.M6_OFICINA_AMBIENTAL, M6Role.M6_CAMPO_CUADRILLA],
  ])('rechaza con 400 mezclar Oficina (%s) y Campo (%s)', async (a, b) => {
    const { service, prisma } = setup();
    await expect(service.replace(ACTOR, TARGET, [a, b])).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('permite los dos de Campo juntos y el auditor con cualquiera', async () => {
    const { service } = setup();
    await expect(
      service.replace(ACTOR, TARGET, [M6Role.M6_CAMPO_CUADRILLA, M6Role.M6_CAMPO_INSPECTOR]),
    ).resolves.toBeDefined();
    await expect(
      service.replace(ACTOR, TARGET, [M6Role.M6_AUDITOR, M6Role.M6_ADMIN]),
    ).resolves.toBeDefined();
  });

  it('409 al quitar el último M6_ADMIN sin admins de bootstrap', async () => {
    const { service, tx } = setup({ current: [M6Role.M6_ADMIN], otherAdmins: 0 });
    await expect(service.replace(ACTOR, TARGET, [])).rejects.toBeInstanceOf(ConflictException);
    expect(tx.userRoleAssignment.deleteMany).not.toHaveBeenCalled();
    expect(tx.roleAssignmentAudit.createMany).not.toHaveBeenCalled();
  });

  it('409 también al cambiarlo por otro rol (deja de ser admin)', async () => {
    const { service } = setup({ current: [M6Role.M6_ADMIN], otherAdmins: 0 });
    await expect(
      service.replace(ACTOR, TARGET, [M6Role.M6_OFICINA_AMBIENTAL]),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('permite quitar un M6_ADMIN si queda otro', async () => {
    const { service, tx } = setup({ current: [M6Role.M6_ADMIN], otherAdmins: 1 });
    await service.remove(ACTOR, TARGET);
    expect(tx.userRoleAssignment.deleteMany).toHaveBeenCalled();
    expect(tx.userRoleAssignment.count).toHaveBeenCalledWith({
      where: { role: M6Role.M6_ADMIN, userId: { not: TARGET } },
    });
  });

  it('permite quitar el último M6_ADMIN de la tabla si hay admins de bootstrap', async () => {
    const { service, tx } = setup({
      current: [M6Role.M6_ADMIN],
      otherAdmins: 0,
      bootstrap: ['7'],
    });
    await service.remove(ACTOR, TARGET);
    expect(tx.userRoleAssignment.deleteMany).toHaveBeenCalled();
  });

  it('un conflicto de serialización se informa como 409', async () => {
    const { service, prisma } = setup();
    prisma.$transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('x', { code: 'P2034', clientVersion: '5' }),
    );
    await expect(service.replace(ACTOR, TARGET, [M6Role.M6_AUDITOR])).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('otros errores de la transacción se propagan', async () => {
    const { service, prisma } = setup();
    prisma.$transaction.mockRejectedValue(new Error('boom'));
    await expect(service.replace(ACTOR, TARGET, [M6Role.M6_AUDITOR])).rejects.toThrow('boom');
  });

  it('findOne devuelve los roles asignados', async () => {
    const { service, prisma } = setup();
    prisma.userRoleAssignment.findMany.mockResolvedValue([
      { userId: TARGET, role: M6Role.M6_CAMPO_CUADRILLA },
    ]);
    await expect(service.findOne(TARGET)).resolves.toEqual({
      userId: TARGET,
      roles: [M6Role.M6_CAMPO_CUADRILLA],
    });
  });

  it('findAll pagina por usuario', async () => {
    const { service, prisma } = setup();
    prisma.userRoleAssignment.groupBy.mockResolvedValue([
      { userId: '1' },
      { userId: '2' },
      { userId: '3' },
    ]);
    prisma.userRoleAssignment.findMany.mockResolvedValue([
      { userId: '2', role: M6Role.M6_AUDITOR },
      { userId: '3', role: M6Role.M6_ADMIN },
      { userId: '3', role: M6Role.M6_OFICINA_AMBIENTAL },
    ]);
    const query = Object.assign(new QueryRoleAssignmentsDto(), { page: 2, pageSize: 2 });
    const res = await service.findAll(query);
    expect(res.data).toEqual([
      { userId: '3', roles: [M6Role.M6_ADMIN, M6Role.M6_OFICINA_AMBIENTAL] },
    ]);
    expect(res.meta).toMatchObject({ total: 3, page: 2, pageSize: 2, totalPages: 2 });
  });

  it('onModuleInit loguea solo la cantidad de admins de bootstrap, no los ids', () => {
    const { service } = setup({ bootstrap: ['123456', '789'] });
    const log = jest.spyOn(service['logger'], 'log').mockImplementation();
    service.onModuleInit();
    const msg = log.mock.calls[0][0] as string;
    expect(msg).toContain('2');
    expect(msg).not.toContain('123456');
  });

  it('onModuleInit avisa cuando no hay admins de bootstrap', () => {
    const { service } = setup();
    const log = jest.spyOn(service['logger'], 'log').mockImplementation();
    service.onModuleInit();
    expect(log.mock.calls[0][0]).toContain('Sin admins de bootstrap');
  });
});
