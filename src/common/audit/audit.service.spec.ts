import { M6Role } from '../../auth/m6-role';
import { PrismaService } from '../../prisma/prisma.service';
import { ACTOR } from './audit-test-actor';
import { AuditService } from './audit.service';
import { QueryAuditDto } from './dto';

const ID = '3f2b8c1e-5d4a-4e6f-9a1b-2c3d4e5f6a7b';

describe('AuditService', () => {
  const prisma = {
    domainAuditLog: { findMany: vi.fn(), count: vi.fn() },
  };
  const service = new AuditService(prisma as unknown as PrismaService);

  beforeEach(() => vi.clearAllMocks());

  it('record escribe en el tx con el actor del token y nulos donde no hay estado', async () => {
    const tx = { domainAuditLog: { create: vi.fn() } };
    await service.record(tx as never, {
      entityType: 'CREW',
      entityId: ID,
      action: 'CREATE',
      actor: { userId: '7', roles: [M6Role.M6_OFICINA_OPERACIONES] },
    });

    expect(tx.domainAuditLog.create).toHaveBeenCalledWith({
      data: {
        entityType: 'CREW',
        entityId: ID,
        action: 'CREATE',
        fromStatus: null,
        toStatus: null,
        actorUserId: '7',
        actorRoles: [M6Role.M6_OFICINA_OPERACIONES],
        note: null,
      },
    });
  });

  it('record guarda estados y recorta la nota', async () => {
    const tx = { domainAuditLog: { create: vi.fn() } };
    await service.record(tx as never, {
      entityType: 'CONTAINER',
      entityId: ID,
      action: 'RELOCATE',
      fromStatus: 'ACTIVE',
      toStatus: 'RELOCATING',
      actor: ACTOR,
      note: 'x'.repeat(600),
    });

    const data = tx.domainAuditLog.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ fromStatus: 'ACTIVE', toStatus: 'RELOCATING' });
    expect(data.note).toHaveLength(500);
  });

  it('findAll filtra por entidad y ordena del más nuevo al más viejo', async () => {
    const occurredAt = new Date('2026-11-02T10:00:00.000Z');
    prisma.domainAuditLog.findMany.mockResolvedValue([
      {
        id: 'a',
        entityType: 'CREW',
        entityId: ID,
        action: 'CREATE',
        fromStatus: null,
        toStatus: null,
        actorUserId: '42',
        actorRoles: [M6Role.M6_ADMIN],
        note: null,
        occurredAt,
      },
    ]);
    prisma.domainAuditLog.count.mockResolvedValue(1);
    const query = Object.assign(new QueryAuditDto(), { entityType: 'CREW', entityId: ID });

    const res = await service.findAll(query);

    expect(prisma.domainAuditLog.findMany).toHaveBeenCalledWith({
      where: { entityType: 'CREW', entityId: ID },
      skip: 0,
      take: 20,
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
    });
    expect(res.data[0]).toMatchObject({ id: 'a', actorUserId: '42', occurredAt });
    expect(res.meta.total).toBe(1);
  });

  it('findAll sin filtros no filtra', async () => {
    prisma.domainAuditLog.findMany.mockResolvedValue([]);
    prisma.domainAuditLog.count.mockResolvedValue(0);
    await service.findAll(new QueryAuditDto());
    expect(prisma.domainAuditLog.count).toHaveBeenCalledWith({ where: {} });
  });
});
