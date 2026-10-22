import { PrismaClient } from '@prisma/client';
import { CrewType, Shift } from '@prisma/client';
import { migrateCrewUserIds, parseMapping } from '../scripts/migrate-crew-user-ids';
import { assertBaseLocal } from './guard-database-url';
import { truncateAll } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';

assertBaseLocal(process.env.DATABASE_URL);

/**
 * Migración de ids `usr-…` a user_id de M1 (#394). Se prueba contra Postgres real:
 * lo que importa es la salida del simulacro y el estado de la base, no cómo se arma el plan.
 */
describe('Migración de ids de usuario en cuadrillas (e2e)', () => {
  let prisma: PrismaService;
  let crewA: string;
  let crewB: string;
  let crewC: string;

  const miembros = async (crewId: string): Promise<string[]> =>
    (await prisma.crewMember.findMany({ where: { crewId }, orderBy: { userId: 'asc' } })).map(
      (m) => m.userId,
    );

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await truncateAll(prisma);
    const base = { crewType: CrewType.MUNICIPAL, defaultShift: Shift.MORNING };
    // A: con mapeo, un integrante sin mapeo y el líder con mapeo.
    crewA = (await prisma.crew.create({ data: { ...base, name: 'A', leaderUserId: 'usr-00001' } }))
      .id;
    await prisma.crewMember.createMany({
      data: [
        { crewId: crewA, userId: 'usr-00010' },
        { crewId: crewA, userId: 'usr-00011' },
        { crewId: crewA, userId: 'usr-99999' }, // sin mapeo
      ],
    });
    // B: ya migrada (numéricos) más un legacy cuyo destino ya existe (choque de PK).
    crewB = (await prisma.crew.create({ data: { ...base, name: 'B', leaderUserId: '7' } })).id;
    await prisma.crewMember.createMany({
      data: [
        { crewId: crewB, userId: '10' },
        { crewId: crewB, userId: 'usr-00010' }, // → '10', que ya está
      ],
    });
    // C: líder sin mapeo.
    crewC = (await prisma.crew.create({ data: { ...base, name: 'C', leaderUserId: 'usr-88888' } }))
      .id;
  });

  const mapping = parseMapping(
    JSON.stringify({ 'usr-00001': '1', 'usr-00010': '10', 'usr-00011': '011' }),
  );

  it('rechaza un mapeo con destinos que no son ids numéricos de M1', () => {
    expect(() => parseMapping(JSON.stringify({ 'usr-1': 'abc' }))).toThrow(/usr-1/);
    expect(() => parseMapping('[]')).toThrow();
  });

  it('el simulacro imprime el plan, reporta lo que no tiene mapeo y no toca nada', async () => {
    const antes = await prisma.crewMember.findMany({
      orderBy: [{ crewId: 'asc' }, { userId: 'asc' }],
    });
    const salida: string[] = [];
    const res = await migrateCrewUserIds(prisma as unknown as PrismaClient, mapping, {
      dryRun: true,
      log: (l) => salida.push(l),
    });

    expect(res.applied).toBe(false);
    expect(res.unmapped.map((u) => u.userId).sort()).toEqual(['usr-88888', 'usr-99999']);
    const texto = salida.join('\n');
    expect(texto).toContain('usr-00010 -> 10');
    expect(texto).toContain('SIN MAPEO');
    expect(texto).toContain('usr-99999');
    expect(texto).toContain('usr-88888');
    expect(
      await prisma.crewMember.findMany({ orderBy: [{ crewId: 'asc' }, { userId: 'asc' }] }),
    ).toEqual(antes);
    expect((await prisma.crew.findUniqueOrThrow({ where: { id: crewA } })).leaderUserId).toBe(
      'usr-00001',
    );
  });

  it('aplica el mapeo, normaliza, resuelve el choque de PK y deja sin tocar lo que no mapea', async () => {
    const res = await migrateCrewUserIds(prisma as unknown as PrismaClient, mapping, {
      dryRun: false,
      log: () => undefined,
    });

    expect(res.applied).toBe(true);
    // 011 se guarda como 11; usr-99999 queda donde estaba (no se borra en silencio).
    expect(await miembros(crewA)).toEqual(['10', '11', 'usr-99999']);
    expect((await prisma.crew.findUniqueOrThrow({ where: { id: crewA } })).leaderUserId).toBe('1');
    // B: el legacy se fusionó con el '10' que ya existía.
    expect(await miembros(crewB)).toEqual(['10']);
    expect((await prisma.crew.findUniqueOrThrow({ where: { id: crewB } })).leaderUserId).toBe('7');
    expect((await prisma.crew.findUniqueOrThrow({ where: { id: crewC } })).leaderUserId).toBe(
      'usr-88888',
    );
  });

  it('es idempotente: la segunda corrida no cambia nada', async () => {
    await migrateCrewUserIds(prisma as unknown as PrismaClient, mapping, {
      dryRun: false,
      log: () => undefined,
    });
    const salida: string[] = [];
    const segunda = await migrateCrewUserIds(prisma as unknown as PrismaClient, mapping, {
      dryRun: false,
      log: (l) => salida.push(l),
    });

    expect(segunda.changes).toBe(0);
    expect(segunda.unmapped.map((u) => u.userId).sort()).toEqual(['usr-88888', 'usr-99999']);
    expect(salida.join('\n')).toContain('Sin cambios');
  });
});
