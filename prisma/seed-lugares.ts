import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ContainerStatus,
  ContainerType,
  DamageType,
  Severity,
  TreeHealthStatus,
  WasteType,
} from '@prisma/client';
import { GeometriaPoligonal } from '../src/common/utils/geo';
import { EspacioVerde, slugBarrio } from '../scripts/build-espacios-verdes';
import type {
  ArbolCiudad,
  ContenedorCiudad,
  PuntoVerdeCiudad,
} from '../scripts/build-datos-ciudad';

/**
 * Lugares del seed: los 48 barrios de M9 con sus polígonos oficiales, los espacios
 * verdes del dataset de BA Data y el inventario (contenedores, puntos verdes, arbolado),
 * que sale de la muestra de IDECABA versionada en `prisma/data/*-ciudad.json` (#439; la
 * genera `npm run datos-ciudad:build`). El seed no usa la red.
 */

const RAIZ = join(__dirname, '..');
const leer = <T>(ruta: string): T => JSON.parse(readFileSync(join(RAIZ, ruta), 'utf8')) as T;

export interface Barrio {
  id: string;
  codigo: string;
  nombre: string;
  /** Número de comuna (`comuna-13` → 13). */
  comuna: number;
}

/** Los 48 barrios activos de M9 (snapshot), ordenados por código. */
export const BARRIOS: Barrio[] = leer<
  { id: string; codigo: string; nombre: string; zona: string; activo: boolean }[]
>('prisma/data/m9-barrios.json')
  .filter((b) => b.activo)
  .map((b) => ({
    id: b.id,
    codigo: b.codigo,
    nombre: b.nombre,
    comuna: Number(b.zona.replace('comuna-', '')),
  }))
  .sort((a, b) => a.codigo.localeCompare(b.codigo));

export const ESPACIOS: EspacioVerde[] = leer<EspacioVerde[]>('prisma/data/espacios-verdes.json');

/** Polígono oficial de cada barrio (docs/geojson/caba_barrios.geojson), por `codigo` de M9. */
export function cargarPoligonos(): Map<string, GeometriaPoligonal> {
  const geo = leer<{
    features: { properties: { BARRIO: string }; geometry: GeometriaPoligonal }[];
  }>('docs/geojson/caba_barrios.geojson');
  const mapa = new Map<string, GeometriaPoligonal>();
  for (const f of geo.features) mapa.set(slugBarrio(f.properties.BARRIO), f.geometry);
  const faltan = BARRIOS.filter((b) => !mapa.has(b.codigo)).map((b) => b.codigo);
  if (faltan.length) throw new Error(`seed: barrios sin polígono: ${faltan.join(', ')}`);
  return mapa;
}

export interface ContenedorSeed {
  code: string;
  zone: string;
  containerType: ContainerType;
  address: string;
  lat: number;
  lng: number;
  capacityLiters: number;
  status?: ContainerStatus;
  damageType?: DamageType;
  severity?: Severity;
  requiresPublicWorks?: boolean;
}

export interface PuntoVerdeSeed {
  code: string;
  name: string;
  zone: string;
  address: string;
  lat: number;
  lng: number;
  wasteTypes: WasteType[];
}

export interface ArbolSeed {
  surveyCode: string;
  zone: string;
  species: string;
  address: string;
  lat: number;
  lng: number;
  heightM: number;
  diameterCm: number;
  /** Vitalidad del censo (IDECABA) ya mapeada; el árbol escrito a mano no la trae. */
  healthStatus?: TreeHealthStatus;
}

export interface Inventario {
  contenedores: ContenedorSeed[];
  puntosVerdes: PuntoVerdeSeed[];
  arboles: ArbolSeed[];
}

/** Mínimos por barrio: el script de la muestra falla si no los cumple. */
export const MIN_CONTENEDORES = 4;
export const MIN_ARBOLES = 3;

/**
 * Estados de demostración de contenedores reales (IDECABA no trae estado): uno por barrio, en
 * comunas que no son las ocho originales, para que el mapa y la operación tengan desbordes,
 * daños, reparaciones y reubicaciones fuera de Belgrano/Palermo/Centro. El `0001` de cada
 * barrio es el negro de menor `id` de IDECABA. Los daños llevan tipo y severidad; los
 * eventos `containerDamaged` de los DAMAGED los siembra el seed.
 */
export const CONTENEDORES_DEMO: Readonly<
  Record<string, Pick<ContenedorSeed, 'status' | 'damageType' | 'severity' | 'requiresPublicWorks'>>
> = {
  // Desbordados: comunas 3, 5, 6, 7 y 15.
  'CT-balvanera-0001': { status: ContainerStatus.OVERFLOWED },
  'CT-almagro-0001': { status: ContainerStatus.OVERFLOWED },
  'CT-caballito-0001': { status: ContainerStatus.OVERFLOWED },
  'CT-flores-0001': { status: ContainerStatus.OVERFLOWED },
  'CT-villa-crespo-0001': { status: ContainerStatus.OVERFLOWED },
  // Dañados: comunas 4, 8 y 9.
  'CT-barracas-0001': {
    status: ContainerStatus.DAMAGED,
    damageType: DamageType.LID_BROKEN,
    severity: Severity.MEDIUM,
    requiresPublicWorks: false,
  },
  'CT-villa-lugano-0001': {
    status: ContainerStatus.DAMAGED,
    damageType: DamageType.STRUCTURAL,
    severity: Severity.HIGH,
    requiresPublicWorks: true,
  },
  'CT-liniers-0001': {
    status: ContainerStatus.DAMAGED,
    damageType: DamageType.VANDALIZED,
    severity: Severity.MEDIUM,
    requiresPublicWorks: false,
  },
  // En el taller: comunas 10 y 12. En reubicación: comuna 11.
  'CT-monte-castro-0001': { status: ContainerStatus.UNDER_REPAIR },
  'CT-villa-urquiza-0001': { status: ContainerStatus.UNDER_REPAIR },
  'CT-villa-devoto-0001': { status: ContainerStatus.RELOCATING },
};

const delArchivo = <T>(ruta: string): T[] => leer<{ datos: T[] }>(ruta).datos;

const nnnn = (n: number, ancho: number): string => String(n).padStart(ancho, '0');

/** Orden estable: por barrio y, adentro, por tipo (negros antes que verdes) e `id` de IDECABA. */
const porBarrio = <T extends { barrio: string }>(items: T[], orden: (a: T, b: T) => number): T[] =>
  [...items].sort((a, b) => a.barrio.localeCompare(b.barrio) || orden(a, b));

/** Numera dentro de cada barrio: 1, 2, 3… en el orden recibido. */
function numerar<T extends { barrio: string }, R>(
  items: T[],
  armar: (item: T, n: number) => R,
): R[] {
  const cuenta = new Map<string, number>();
  return items.map((i) => {
    const n = (cuenta.get(i.barrio) ?? 0) + 1;
    cuenta.set(i.barrio, n);
    return armar(i, n);
  });
}

/**
 * Inventario real de IDECABA: contenedores negros (`HOUSEHOLD`) y verdes (`RECYCLABLE`),
 * los puntos verdes de la Ciudad y una muestra del censo de arbolado. Los códigos
 * (`CT-<barrio>-NNNN`, `GP-<barrio>-NN`, `ARB-<barrio>-9NNNN`) los arma el seed por barrio y en
 * orden estable. La capacidad no existe en IDECABA: se alterna 2400/3200 L como antes.
 */
export function cargarInventario(): Inventario {
  const tipoOrden = (t: string): number => (t === ContainerType.HOUSEHOLD ? 0 : 1);
  const contenedores = numerar(
    porBarrio(
      delArchivo<ContenedorCiudad>('prisma/data/contenedores-ciudad.json'),
      (a, b) => tipoOrden(a.containerType) - tipoOrden(b.containerType) || a.id - b.id,
    ),
    (c, n): ContenedorSeed => ({
      code: `CT-${c.barrio}-${nnnn(n, 4)}`,
      zone: c.barrio,
      containerType: c.containerType as ContainerType,
      address: c.address,
      lat: c.lat,
      lng: c.lng,
      capacityLiters: n % 2 ? 3200 : 2400,
    }),
  );

  const puntosVerdes = numerar(
    porBarrio(delArchivo<PuntoVerdeCiudad>('prisma/data/puntos-verdes-ciudad.json'), (a, b) =>
      a.name.localeCompare(b.name),
    ),
    (g, n): PuntoVerdeSeed => ({
      code: `GP-${g.barrio}-${nnnn(n, 2)}`,
      name: g.name,
      zone: g.barrio,
      address: g.address,
      lat: g.lat,
      lng: g.lng,
      wasteTypes: g.wasteTypes,
    }),
  );

  const arboles = numerar(
    porBarrio(delArchivo<ArbolCiudad>('prisma/data/arbolado-ciudad.json'), (a, b) => a.id - b.id),
    (t, n): ArbolSeed => ({
      surveyCode: `ARB-${t.barrio}-9${nnnn(n, 4)}`,
      zone: t.barrio,
      species: t.species,
      address: t.address,
      lat: t.lat,
      lng: t.lng,
      heightM: t.heightM,
      diameterCm: t.diameterCm,
      healthStatus: t.healthStatus as TreeHealthStatus,
    }),
  );
  const sinCodigo = Object.keys(CONTENEDORES_DEMO).filter(
    (c) => !contenedores.some((x) => x.code === c),
  );
  if (sinCodigo.length) throw new Error(`seed: contenedores de demo inexistentes: ${sinCodigo}`);
  for (const c of contenedores) Object.assign(c, CONTENEDORES_DEMO[c.code]);
  return { contenedores, puntosVerdes, arboles };
}
