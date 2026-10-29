import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { CoreClient } from './core.client';
import { Barrio, esBarrio } from './neighborhoods-catalog.service';

/** Una zona administrativa de M9 (`GET /api/v1/catalogos/zonas`): acá, una comuna. */
export interface ZonaM9 {
  id: string;
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  activo: boolean;
  barrios?: number;
}

export interface CatalogoM9 {
  barrios: Barrio[];
  zonas: ZonaM9[];
}

export interface SyncOptions {
  dryRun?: boolean;
  /** Borra las filas `zone_neighborhood` fuera del catálogo (destructivo). */
  cleanLegacy?: boolean;
}

export interface LegacyRow {
  zoneCode: string;
  neighborhoodId: string;
  /** La zona tiene servicios, recorridos u otros datos: la fila no se toca. */
  retenida: boolean;
}

export interface SyncReport {
  dryRun: boolean;
  communes: { creadas: number; actualizadas: number; sinCambios: number };
  zones: {
    creadas: number;
    actualizadas: number;
    desactivadas: number;
    desactivadasConDatos: number;
    sinCambios: number;
  };
  /** Zonas existentes con el `code` de un barrio pero de otro origen: no se tocaron. */
  conflictos: string[];
  /** Barrios activos cuya comuna no está entre las comunas activas: sin zona. */
  sinComuna: string[];
  /** Zonas cuyo `code` no es de un barrio de M9 (p. ej. las del seed viejo). */
  zonasLegacy: string[];
  legacyRows: LegacyRow[];
  legacyEliminadas: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATA_DIR = join(__dirname, '../../prisma/data');

function esZona(z: unknown): z is ZonaM9 {
  const x = z as Partial<ZonaM9> | null;
  return (
    typeof x?.id === 'string' &&
    typeof x.codigo === 'string' &&
    typeof x.nombre === 'string' &&
    typeof x.activo === 'boolean'
  );
}

/** Valida la forma y los UUID: un catálogo roto aborta antes de escribir nada. */
export function validarCatalogo(raw: { barrios: unknown; zonas: unknown }): CatalogoM9 {
  const { barrios, zonas } = raw;
  if (!Array.isArray(barrios) || !barrios.length || !barrios.every(esBarrio)) {
    throw new Error('Catálogo de barrios inválido: vacío o con ítems de forma incorrecta');
  }
  if (!Array.isArray(zonas) || !zonas.length || !zonas.every(esZona)) {
    throw new Error('Catálogo de zonas inválido: vacío o con ítems de forma incorrecta');
  }
  const ids = barrios.map((b) => b.id);
  if (!ids.every((id) => UUID.test(id)) || new Set(ids).size !== ids.length) {
    throw new Error('Catálogo de barrios inválido: ids que no son UUID o repetidos');
  }
  const codigos = barrios.map((b) => b.codigo);
  if (new Set(codigos).size !== codigos.length) {
    throw new Error('Catálogo de barrios inválido: códigos repetidos');
  }
  return { barrios, zonas };
}

export function cargarSnapshot(): CatalogoM9 {
  const leer = (f: string): unknown => JSON.parse(readFileSync(join(DATA_DIR, f), 'utf8'));
  return validarCatalogo({ barrios: leer('m9-barrios.json'), zonas: leer('m9-zonas.json') });
}

export async function cargarDesdeCore(core: CoreClient): Promise<CatalogoM9> {
  const pedir = async (path: string): Promise<unknown> => {
    const res = await core.request(path);
    if (!res.ok) throw new Error(`El Core respondió HTTP ${res.status} en ${path}`);
    const body = (await res.json().catch(() => undefined)) as unknown;
    if (Array.isArray(body)) return body;
    const b = body as {
      data?: unknown;
      next?: unknown;
      page?: unknown;
      limit?: unknown;
      totalPages?: unknown;
      hasNext?: unknown;
      hasMore?: unknown;
      total?: unknown;
      meta?: { total?: unknown };
    };
    const total = b?.total ?? b?.meta?.total;
    const n = Array.isArray(b?.data) ? b.data.length : 0;
    // M9 no confirmó si pagina. Una página parcial haría desactivar zonas de barrios
    // que sí siguen activos, así que ante cualquier marca de paginación se aborta.
    const pagina = [b?.next, b?.page, b?.limit, b?.totalPages, b?.hasNext, b?.hasMore];
    if (
      pagina.some((x) => x !== undefined && x !== null && x !== false) ||
      (typeof total === 'number' && total > n)
    ) {
      throw new Error(`La respuesta de ${path} parece paginada: no se sincroniza truncada`);
    }
    return b?.data;
  };
  return validarCatalogo({
    barrios: await pedir('/api/v1/catalogos/barrios'),
    zonas: await pedir('/api/v1/catalogos/zonas'),
  });
}

/** N de un código `comuna-N` de M9. Sin número no hay orden posible: se aborta antes de escribir algo a medias. */
function numeroDeComuna(codigo: string): number {
  const m = /^comuna-(\d+)$/.exec(codigo);
  if (!m) throw new Error(`La zona activa '${codigo}' de M9 no tiene el formato comuna-N`);
  return Number(m[1]);
}

function tieneDatos(z: { _count: Record<string, number> }): boolean {
  return Object.values(z._count).some((n) => n > 0);
}

/** `--clean-legacy` con el snapshot borraría según una foto vieja: no se permite. */
export function validarOpcionesCli(opts: SyncOptions, desdeSnapshot: boolean): void {
  if (opts.cleanLegacy && desdeSnapshot) {
    throw new Error('--clean-legacy no se puede combinar con --from-snapshot: usá el Core');
  }
}

type Db = Pick<PrismaClient, 'commune' | 'zone' | 'zoneNeighborhood'>;

/**
 * Deja las comunas y las zonas de M6 como el catálogo de M9: una `Zone` por barrio
 * activo, agrupada por su comuna. Idempotente. Nada se borra: el barrio dado de
 * baja desactiva su zona. Con `dryRun` solo lee y devuelve el plan.
 */
export async function syncZones(
  prisma: PrismaClient,
  catalogo: CatalogoM9,
  opts: SyncOptions = {},
): Promise<SyncReport> {
  if (opts.dryRun) return ejecutar(prisma, catalogo, opts, true);
  return prisma.$transaction((tx) => ejecutar(tx as Db, catalogo, opts, false), {
    timeout: 60_000,
  });
}

async function ejecutar(
  db: Db,
  { barrios, zonas }: CatalogoM9,
  opts: SyncOptions,
  dryRun: boolean,
): Promise<SyncReport> {
  const rep: SyncReport = {
    dryRun,
    communes: { creadas: 0, actualizadas: 0, sinCambios: 0 },
    zones: { creadas: 0, actualizadas: 0, desactivadas: 0, desactivadasConDatos: 0, sinCambios: 0 },
    conflictos: [],
    sinComuna: [],
    zonasLegacy: [],
    legacyRows: [],
    legacyEliminadas: 0,
  };

  // Comunas: solo las activas. Las inactivas de M9 (ficticias) no se crean.
  const comunaId = new Map<string, string>();
  const existentes = await db.commune.findMany();
  for (const z of zonas.filter((x) => x.activo)) {
    const ya = existentes.find((c) => c.code === z.codigo);
    const number = numeroDeComuna(z.codigo);
    if (!ya) {
      rep.communes.creadas++;
      // En dry-run no hay id real; alcanza con saber que la comuna existiría.
      const creada = dryRun
        ? undefined
        : await db.commune.create({
            data: { code: z.codigo, number, name: z.nombre, active: true },
          });
      comunaId.set(z.codigo, creada?.id ?? `dry-${z.codigo}`);
      continue;
    }
    comunaId.set(z.codigo, ya.id);
    if (ya.name === z.nombre && ya.active && ya.number === number) {
      rep.communes.sinCambios++;
    } else {
      rep.communes.actualizadas++;
      if (!dryRun) {
        await db.commune.update({
          where: { id: ya.id },
          data: { name: z.nombre, number, active: true },
        });
      }
    }
  }

  const zonasDb = await db.zone.findMany({
    include: {
      neighborhoods: true,
      _count: {
        select: {
          routeStops: true,
          serviceZones: true,
          zoneResults: true,
          containers: true,
          greenPoints: true,
          trees: true,
          greenSpaces: true,
        },
      },
    },
  });
  const porCodigo = new Map(zonasDb.map((z) => [z.code, z]));

  for (const b of barrios) {
    const z = porCodigo.get(b.codigo);
    // La zona es de M9 si ya apunta a este barrio o todavía no apunta a ninguno.
    const esDeM9 =
      !z || !z.neighborhoods.length || z.neighborhoods.some((n) => n.neighborhoodId === b.id);
    if (!esDeM9) {
      rep.conflictos.push(`${b.codigo}: la zona existe con otros barrios; no se tocó`);
      continue;
    }
    if (!b.activo) {
      // Sin zona no hay nada que dar de baja; los ficticios no se crean.
      if (z?.active) {
        // Con servicios, recorridos o inventario: se informa aparte para revisarla.
        if (tieneDatos(z)) rep.zones.desactivadasConDatos++;
        else rep.zones.desactivadas++;
        if (!dryRun) await db.zone.update({ where: { id: z.id }, data: { active: false } });
      } else if (z) {
        rep.zones.sinCambios++;
      }
      continue;
    }
    const cId = comunaId.get(b.zona);
    if (!cId) {
      rep.sinComuna.push(`${b.codigo} (${b.zona})`);
      continue;
    }
    if (!z) {
      rep.zones.creadas++;
      if (!dryRun) {
        await db.zone.create({
          data: {
            code: b.codigo,
            name: b.nombre,
            active: true,
            communeId: cId,
            neighborhoods: { create: { neighborhoodId: b.id } },
          },
        });
      }
      continue;
    }
    const falta = !z.neighborhoods.some((n) => n.neighborhoodId === b.id);
    if (z.name === b.nombre && z.active && z.communeId === cId && !falta) {
      rep.zones.sinCambios++;
      continue;
    }
    rep.zones.actualizadas++;
    if (!dryRun) {
      await db.zone.update({
        where: { id: z.id },
        data: {
          name: b.nombre,
          active: true,
          communeId: cId,
          ...(falta && { neighborhoods: { create: { neighborhoodId: b.id } } }),
        },
      });
    }
  }

  // Legacy: lo que quedó de antes del catálogo. Solo se reporta salvo --clean-legacy.
  const validos = new Set(barrios.map((b) => b.id));
  const codigosM9 = new Set(barrios.map((b) => b.codigo));
  rep.zonasLegacy = zonasDb.filter((z) => !codigosM9.has(z.code)).map((z) => z.code);
  for (const z of zonasDb) {
    const retenida = tieneDatos(z);
    for (const n of z.neighborhoods.filter((x) => !validos.has(x.neighborhoodId))) {
      rep.legacyRows.push({ zoneCode: z.code, neighborhoodId: n.neighborhoodId, retenida });
      // Solo ids que no son UUID (`caba-…`, `barrio-…`): un UUID ausente del catálogo
      // puede ser un barrio real que un catálogo truncado o viejo no trae.
      if (opts.cleanLegacy && !retenida && !dryRun && !UUID.test(n.neighborhoodId)) {
        await db.zoneNeighborhood.delete({
          where: { zoneId_neighborhoodId: { zoneId: z.id, neighborhoodId: n.neighborhoodId } },
        });
        rep.legacyEliminadas++;
      }
    }
  }
  return rep;
}
