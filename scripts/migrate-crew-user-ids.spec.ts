import { PrismaClient } from '@prisma/client';
import { migrateCrewUserIds, parseMapping } from './migrate-crew-user-ids';

describe('parseMapping', () => {
  it('acepta un objeto { "usr-…": "<id de M1>" }', () => {
    expect(parseMapping('{"usr-00010":"10","usr-00011":"11"}')).toEqual({
      'usr-00010': '10',
      'usr-00011': '11',
    });
  });

  it('normaliza los ceros a la izquierda del destino', () => {
    expect(parseMapping('{"usr-1":"007"}')).toEqual({ 'usr-1': '7' });
  });

  it.each([['[]'], ['null'], ['"texto"'], ['5']])('rechaza %s: no es un objeto', (json) => {
    expect(() => parseMapping(json)).toThrow('El mapeo debe ser un objeto JSON');
  });

  it.each([['"usr-2"'], ['"1.5"'], ['""'], ['7'], ['null'], ['"12345678901234567890"']])(
    'rechaza el destino %s: no es un id numérico de M1',
    (destino) => {
      expect(() => parseMapping(`{"usr-1":${destino}}`)).toThrow(/Mapeo inválido para 'usr-1'/);
    },
  );

  it('propaga el error de JSON mal formado', () => {
    expect(() => parseMapping('{no es json')).toThrow(SyntaxError);
  });
});

describe('migrateCrewUserIds', () => {
  let prisma: any;
  let log: jest.Mock;
  let lines: () => string;

  const withData = (
    members: { crewId: string; userId: string }[],
    leaders: { id: string; leaderUserId: string }[] = [],
  ) => {
    prisma.crewMember.findMany.mockResolvedValue(members);
    prisma.crew.findMany.mockResolvedValue(leaders);
  };
  const run = (mapping: Record<string, string>, dryRun = false) =>
    migrateCrewUserIds(prisma as unknown as PrismaClient, mapping, { dryRun, log });

  beforeEach(() => {
    prisma = {
      crewMember: {
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn((args) => ({ op: 'memberUpdate', args })),
        delete: jest.fn((args) => ({ op: 'memberDelete', args })),
      },
      crew: {
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn((args) => ({ op: 'crewUpdate', args })),
      },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    log = jest.fn();
    lines = () => log.mock.calls.map(([l]) => l).join('\n');
  });

  it('mapea integrantes y líder en una sola transacción', async () => {
    withData(
      [
        { crewId: 'c1', userId: 'usr-1' },
        { crewId: 'c1', userId: 'usr-2' },
      ],
      [{ id: 'c1', leaderUserId: 'usr-1' }],
    );

    const res = await run({ 'usr-1': '10', 'usr-2': '20' });

    expect(res).toEqual({ applied: true, changes: 3, unmapped: [] });
    expect(prisma.crewMember.update).toHaveBeenCalledWith({
      where: { crewId_userId: { crewId: 'c1', userId: 'usr-1' } },
      data: { userId: '10' },
    });
    expect(prisma.crewMember.update).toHaveBeenCalledWith({
      where: { crewId_userId: { crewId: 'c1', userId: 'usr-2' } },
      data: { userId: '20' },
    });
    expect(prisma.crew.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { leaderUserId: '10' },
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction.mock.calls[0][0]).toHaveLength(3);
    expect(lines()).toContain('== MIGRACIÓN ==');
    expect(lines()).toContain('Resumen: 2 integrantes, 1 líderes, 0 sin mapeo.');
  });

  it('normaliza los numéricos con ceros a la izquierda sin necesitar mapeo', async () => {
    withData([{ crewId: 'c1', userId: '007' }], [{ id: 'c1', leaderUserId: '0042' }]);

    const res = await run({});

    expect(res.changes).toBe(2);
    expect(prisma.crewMember.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { userId: '7' } }),
    );
    expect(prisma.crew.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { leaderUserId: '42' },
    });
  });

  it('--dry-run imprime el plan y no escribe', async () => {
    withData([{ crewId: 'c1', userId: 'usr-1' }], [{ id: 'c1', leaderUserId: 'usr-1' }]);

    const res = await run({ 'usr-1': '10' }, true);

    expect(res).toEqual({ applied: false, changes: 2, unmapped: [] });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.crewMember.update).not.toHaveBeenCalled();
    expect(prisma.crew.update).not.toHaveBeenCalled();
    expect(lines()).toContain('== SIMULACRO (no se escribe nada) ==');
    expect(lines()).toContain('crew_member   crew c1: usr-1 -> 10');
    expect(lines()).toContain('crew.leader   crew c1: usr-1 -> 10');
  });

  it('reporta las filas sin mapeo, las deja como están y no las borra', async () => {
    withData(
      [
        { crewId: 'c1', userId: 'usr-9' },
        { crewId: 'c1', userId: 'usr-1' },
      ],
      [{ id: 'c1', leaderUserId: 'usr-8' }],
    );

    const res = await run({ 'usr-1': '10' });

    expect(res.unmapped).toEqual([
      { table: 'crew_member', crewId: 'c1', userId: 'usr-9' },
      { table: 'crew.leader_user_id', crewId: 'c1', userId: 'usr-8' },
    ]);
    expect(res.changes).toBe(1);
    expect(prisma.crewMember.delete).not.toHaveBeenCalled();
    expect(prisma.crewMember.update).toHaveBeenCalledTimes(1);
    expect(prisma.crew.update).not.toHaveBeenCalled();
    expect(lines()).toContain('SIN MAPEO     crew_member crew c1: usr-9 (queda como está)');
    expect(lines()).toContain('SIN MAPEO     crew.leader_user_id crew c1: usr-8 (queda como está)');
  });

  it('fusiona (borra la fila vieja) si el destino ya es integrante de esa cuadrilla', async () => {
    withData([
      { crewId: 'c1', userId: '10' },
      { crewId: 'c1', userId: 'usr-1' },
    ]);

    const res = await run({ 'usr-1': '10' });

    expect(res.changes).toBe(1);
    expect(prisma.crewMember.delete).toHaveBeenCalledWith({
      where: { crewId_userId: { crewId: 'c1', userId: 'usr-1' } },
    });
    expect(prisma.crewMember.update).not.toHaveBeenCalled();
    expect(lines()).toContain('se fusiona y se borra la fila vieja');
  });

  it('con dos ids viejos hacia el mismo destino, el primero mueve y el segundo se fusiona', async () => {
    withData([
      { crewId: 'c1', userId: 'usr-1' },
      { crewId: 'c1', userId: 'usr-2' },
    ]);

    await run({ 'usr-1': '10', 'usr-2': '10' });

    expect(prisma.crewMember.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { userId: '10' } }),
    );
    expect(prisma.crewMember.delete).toHaveBeenCalledWith({
      where: { crewId_userId: { crewId: 'c1', userId: 'usr-2' } },
    });
  });

  it('el mismo destino en otra cuadrilla no es un choque', async () => {
    withData([
      { crewId: 'c1', userId: '10' },
      { crewId: 'c2', userId: 'usr-1' },
    ]);

    await run({ 'usr-1': '10' });

    expect(prisma.crewMember.delete).not.toHaveBeenCalled();
    expect(prisma.crewMember.update).toHaveBeenCalledWith({
      where: { crewId_userId: { crewId: 'c2', userId: 'usr-1' } },
      data: { userId: '10' },
    });
  });

  it('es idempotente: con todo ya migrado no cambia ni escribe nada', async () => {
    withData([{ crewId: 'c1', userId: '10' }], [{ id: 'c1', leaderUserId: '10' }]);

    const res = await run({ 'usr-1': '10' });

    expect(res).toEqual({ applied: true, changes: 0, unmapped: [] });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(lines()).toContain('Sin cambios.');
  });
});
