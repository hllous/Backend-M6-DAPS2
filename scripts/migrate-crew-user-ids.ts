/**
 * Migra los ids de usuario de las cuadrillas (`crew_member.user_id` y
 * `crew.leader_user_id`) de `usr-…` al `user_id` numérico de M1 (#394, #365).
 * Hay que correrlo sobre la base desplegada ANTES de activar la pertenencia de
 * Campo: el token de M1 trae el `sub` numérico y un `usr-…` nunca va a coincidir.
 *
 * Uso: `npm run crews:migrate-user-ids -- --map mapeo.json [--dry-run]`
 *
 * - `--map`: JSON `{ "usr-00010": "10", ... }` con el mapeo que entrega M1.
 * - `--dry-run`: solo lee; imprime el plan y no escribe.
 * - Los ids que no son numéricos ni están en el mapeo se reportan como SIN MAPEO y
 *   quedan como están (nunca se borran); el script sale con código 2 si queda alguno.
 * - Los numéricos con ceros a la izquierda se normalizan (`007` → `7`).
 * - Si el id destino ya es integrante de la cuadrilla, la fila vieja se fusiona
 *   (se borra) en vez de chocar con la PK (crew_id, user_id).
 * - Idempotente: la segunda corrida no encuentra nada para cambiar.
 *
 * Lee `.env` si existe; apuntar `DATABASE_URL` a la base correcta antes de correrlo.
 */
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { M1_USER_ID_REGEX, normalizeM1UserId } from '../src/common/decorators/m1-user-id.decorator';

export type Mapping = Record<string, string>;

export interface MigrationOptions {
  dryRun: boolean;
  log?: (line: string) => void;
}

export interface UnmappedRow {
  table: 'crew_member' | 'crew.leader_user_id';
  crewId: string;
  userId: string;
}

export interface MigrationResult {
  applied: boolean;
  /** Filas que cambian (o cambiarían en el simulacro). */
  changes: number;
  unmapped: UnmappedRow[];
}

type MemberAction = 'update' | 'merge';

/** Un cambio de id dentro de una cuadrilla. */
interface IdChange {
  crewId: string;
  from: string;
  to: string;
}

interface MemberChange extends IdChange {
  action: MemberAction;
}

/** Valida y normaliza el mapeo: las claves son libres, los destinos tienen que ser ids de M1. */
export function parseMapping(json: string): Mapping {
  const raw: unknown = JSON.parse(json);
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('El mapeo debe ser un objeto JSON { "usr-…": "<user_id de M1>" }');
  }
  const mapping: Mapping = {};
  for (const [from, to] of Object.entries(raw)) {
    if (typeof to !== 'string' || !M1_USER_ID_REGEX.test(to)) {
      throw new Error(`Mapeo inválido para '${from}': '${String(to)}' no es un id numérico de M1`);
    }
    mapping[from] = normalizeM1UserId(to);
  }
  return mapping;
}

/** El id destino de un id actual, o `null` si no hay forma de saberlo. */
function resolve(userId: string, mapping: Mapping): string | null {
  if (M1_USER_ID_REGEX.test(userId)) return normalizeM1UserId(userId);
  return mapping[userId] ?? null;
}

export async function migrateCrewUserIds(
  prisma: PrismaClient,
  mapping: Mapping,
  { dryRun, log = console.log }: MigrationOptions,
): Promise<MigrationResult> {
  const members = await prisma.crewMember.findMany({
    orderBy: [{ crewId: 'asc' }, { userId: 'asc' }],
  });
  const leaders = await prisma.crew.findMany({
    where: { leaderUserId: { not: null } },
    select: { id: true, leaderUserId: true },
    orderBy: { id: 'asc' },
  });

  const memberChanges: MemberChange[] = [];
  const leaderChanges: IdChange[] = [];
  const unmapped: UnmappedRow[] = [];

  // Ids que ya ocupa cada cuadrilla y no se mueven: contra ellos chocaría la PK.
  const occupied = new Map<string, Set<string>>();
  const pending: IdChange[] = [];
  for (const m of members) {
    const to = resolve(m.userId, mapping);
    if (to === null) {
      unmapped.push({ table: 'crew_member', crewId: m.crewId, userId: m.userId });
    } else if (to === m.userId) {
      const set = occupied.get(m.crewId) ?? new Set<string>();
      set.add(m.userId);
      occupied.set(m.crewId, set);
    } else {
      pending.push({ crewId: m.crewId, from: m.userId, to });
    }
  }
  // Los sin mapeo también ocupan su lugar (no se mueven), pero su id no es numérico:
  // no pueden chocar con un destino, así que no hace falta registrarlos.
  for (const p of pending) {
    const set = occupied.get(p.crewId) ?? new Set<string>();
    memberChanges.push({ ...p, action: set.has(p.to) ? 'merge' : 'update' });
    set.add(p.to);
    occupied.set(p.crewId, set);
  }

  for (const c of leaders) {
    const from = c.leaderUserId as string;
    const to = resolve(from, mapping);
    if (to === null) unmapped.push({ table: 'crew.leader_user_id', crewId: c.id, userId: from });
    else if (to !== from) leaderChanges.push({ crewId: c.id, from, to });
  }

  const changes = memberChanges.length + leaderChanges.length;
  log(dryRun ? '== SIMULACRO (no se escribe nada) ==' : '== MIGRACIÓN ==');
  for (const c of memberChanges) {
    const note =
      c.action === 'merge'
        ? ' (el destino ya es integrante: se fusiona y se borra la fila vieja)'
        : '';
    log(`crew_member   crew ${c.crewId}: ${c.from} -> ${c.to}${note}`);
  }
  for (const c of leaderChanges) {
    log(`crew.leader   crew ${c.crewId}: ${c.from} -> ${c.to}`);
  }
  for (const u of unmapped) {
    log(`SIN MAPEO     ${u.table} crew ${u.crewId}: ${u.userId} (queda como está)`);
  }
  if (changes === 0) log('Sin cambios.');
  log(
    `Resumen: ${memberChanges.length} integrantes, ${leaderChanges.length} líderes, ${unmapped.length} sin mapeo.`,
  );

  if (!dryRun && changes > 0) {
    await prisma.$transaction([
      ...memberChanges.map((c) =>
        c.action === 'merge'
          ? prisma.crewMember.delete({
              where: { crewId_userId: { crewId: c.crewId, userId: c.from } },
            })
          : prisma.crewMember.update({
              where: { crewId_userId: { crewId: c.crewId, userId: c.from } },
              data: { userId: c.to },
            }),
      ),
      ...leaderChanges.map((c) =>
        prisma.crew.update({ where: { id: c.crewId }, data: { leaderUserId: c.to } }),
      ),
    ]);
  }

  return { applied: !dryRun, changes, unmapped };
}

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function main(): Promise<void> {
  try {
    process.loadEnvFile('.env');
  } catch {
    // Sin .env, vale lo que ya esté en el entorno.
  }
  const mapPath = argValue('--map');
  if (!mapPath) {
    console.error('Falta --map <archivo.json> con el mapeo { "usr-…": "<user_id de M1>" }.');
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error('Falta DATABASE_URL.');
    process.exit(1);
  }
  const dryRun = process.argv.includes('--dry-run');
  const mapping = parseMapping(readFileSync(mapPath, 'utf8'));

  const target = new URL(process.env.DATABASE_URL);
  console.log(`Base: ${target.hostname}:${target.port || '5432'}${target.pathname}`);

  const prisma = new PrismaClient();
  try {
    const res = await migrateCrewUserIds(prisma, mapping, { dryRun });
    if (res.unmapped.length > 0) process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((err: Error) => {
    console.error(err.message);
    process.exit(1);
  });
}
