import { M6Role } from '../../auth/m6-role';
import { PrismaService } from '../../prisma/prisma.service';
import { M4_ACTOR_ID } from './audit-actors';
import { ACTOR } from './audit-test-actor';
import { AuditService } from './audit.service';
import { QueryAuditDto } from './dto';
import { PaginationQueryDto } from '../dto';

const ID = '3f2b8c1e-5d4a-4e6f-9a1b-2c3d4e5f6a7b';

describe('AuditService', () => {
  const prisma = {
    domainAuditLog: { findMany: vi.fn(), count: vi.fn(), createMany: vi.fn() },
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

  it('recordRead deja una fila READ por recurso, sin estados ni nota', async () => {
    await service.recordRead(
      [
        { entityType: 'VIOLATION_NOTICE', entityId: ID },
        { entityType: 'SANCTION_OUTCOME', entityId: 'so-1' },
      ],
      ACTOR,
    );

    expect(prisma.domainAuditLog.createMany).toHaveBeenCalledWith({
      data: [
        {
          entityType: 'VIOLATION_NOTICE',
          entityId: ID,
          action: 'READ',
          actorUserId: '42',
          actorRoles: [M6Role.M6_ADMIN],
        },
        {
          entityType: 'SANCTION_OUTCOME',
          entityId: 'so-1',
          action: 'READ',
          actorUserId: '42',
          actorRoles: [M6Role.M6_ADMIN],
        },
      ],
    });
  });

  it('recordRead propaga la falla: sin auditoría no hay lectura', async () => {
    prisma.domainAuditLog.createMany.mockRejectedValueOnce(new Error('db caída'));
    await expect(
      service.recordRead([{ entityType: 'VIOLATION_NOTICE', entityId: ID }], ACTOR),
    ).rejects.toThrow('db caída');
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
  describe('findHistory', () => {
    const fila = (over: Record<string, unknown> = {}) => ({
      id: 'a',
      entityType: 'ENVIRONMENTAL_REPORT',
      entityId: ID,
      action: 'CLOSE',
      fromStatus: 'FORWARDED',
      toStatus: 'CLOSED',
      actorUserId: '42',
      actorRoles: [M6Role.M6_OFICINA_AMBIENTAL],
      note: 'Regularizado',
      occurredAt: new Date('2026-11-02T10:00:00.000Z'),
      ...over,
    });

    it('filtra por la entidad, excluye READ, ordena con desempate y pagina', async () => {
      prisma.domainAuditLog.findMany.mockResolvedValue([fila()]);
      prisma.domainAuditLog.count.mockResolvedValue(41);
      const query = Object.assign(new PaginationQueryDto(), { page: 2, pageSize: 10 });

      const res = await service.findHistory('ENVIRONMENTAL_REPORT', ID, query);

      const where = { entityType: 'ENVIRONMENTAL_REPORT', entityId: ID, action: { not: 'READ' } };
      expect(prisma.domainAuditLog.findMany).toHaveBeenCalledWith({
        where,
        skip: 10,
        take: 10,
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      });
      expect(prisma.domainAuditLog.count).toHaveBeenCalledWith({ where });
      expect(res.meta.total).toBe(41);
    });

    it('expone solo occurredAt, action, estados y note: ni actor ni ids', async () => {
      prisma.domainAuditLog.findMany.mockResolvedValue([fila()]);
      prisma.domainAuditLog.count.mockResolvedValue(1);

      const res = await service.findHistory('ENVIRONMENTAL_REPORT', ID, new PaginationQueryDto());

      expect(Object.keys(res.data[0]).sort()).toEqual(
        ['action', 'fromStatus', 'note', 'occurredAt', 'toStatus'].sort(),
      );
      expect(res.data[0].note).toBe('Regularizado');
    });

    it('no entrega el note de lo que escribe M4 (decisión de la sanción, Tier 2)', async () => {
      prisma.domainAuditLog.findMany.mockResolvedValue([
        fila({ actorUserId: M4_ACTOR_ID, action: 'STATUS_CHANGE', note: 'FINE_ISSUED' }),
      ]);
      prisma.domainAuditLog.count.mockResolvedValue(1);

      const res = await service.findHistory('ENVIRONMENTAL_REPORT', ID, new PaginationQueryDto());

      expect(res.data[0]).toMatchObject({ action: 'STATUS_CHANGE', note: null });
    });
  });
});
