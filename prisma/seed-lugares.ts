import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ContainerStatus, ContainerType, DamageType, Severity, WasteType } from '@prisma/client';
import {
  GeometriaPoligonal,
  Position,
  prng,
  puntoEnGeometria,
  puntosEnGeometria,
  semillaDe,
} from '../src/common/utils/geo';
import { EspacioVerde, slugBarrio } from '../scripts/build-espacios-verdes';

/**
 * Lugares del seed: los 48 barrios de M9 con sus polígonos oficiales, los espacios
 * verdes del dataset de BA Data y el inventario (contenedores, puntos verdes, arbolado)
 * que se genera dentro de cada barrio. Todo determinístico: el azar sale de un PRNG
 * sembrado con el código del barrio.
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
}

export interface Inventario {
  contenedores: ContenedorSeed[];
  puntosVerdes: PuntoVerdeSeed[];
  arboles: ArbolSeed[];
}

/** Mínimos por barrio: lo que haya escrito a mano cuenta, el resto se completa. */
export const MIN_CONTENEDORES = 4;
export const MIN_ARBOLES = 3;

const ESPECIES = [
  'Tipuana tipu',
  'Platanus x acerifolia',
  'Fraxinus pennsylvanica',
  'Jacaranda mimosifolia',
  'Ligustrum lucidum',
  'Melia azedarach',
  'Acer negundo',
  'Handroanthus impetiginosus',
];

const r5 = (n: number): number => Math.round(n * 1e5) / 1e5;
const r1 = (n: number): number => Math.round(n * 10) / 10;

/** Un punto a `metros` de otro, en una dirección dada (aproximación plana: alcanza a esta escala). */
function desplazar([lng, lat]: Position, metros: number, ang: number): Position {
  return [
    lng + (metros * Math.cos(ang)) / (111_320 * Math.cos((lat * Math.PI) / 180)),
    lat + (metros * Math.sin(ang)) / 110_540,
  ];
}

/**
 * Inventario de los barrios que no lo tienen escrito a mano. `existentes` cuenta lo ya
 * cargado por zona. Todo punto cae dentro del polígono de su barrio y, cuando se puede,
 * a unas decenas de metros de una plaza o parque real del barrio.
 */
export function generarInventario(
  poligonos: ReadonlyMap<string, GeometriaPoligonal>,
  existentes: {
    contenedores: ReadonlyMap<string, number>;
    puntosVerdes: ReadonlyMap<string, number>;
    arboles: ReadonlyMap<string, number>;
  },
): Inventario {
  const inv: Inventario = { contenedores: [], puntosVerdes: [], arboles: [] };
  const tipos = [
    ContainerType.HOUSEHOLD,
    ContainerType.HOUSEHOLD,
    ContainerType.RECYCLABLE,
    ContainerType.HOUSEHOLD,
    ContainerType.RECYCLABLE,
    ContainerType.GREEN,
  ];

  BARRIOS.forEach((b, i) => {
    const poligono = poligonos.get(b.codigo) as GeometriaPoligonal;
    const azar = prng(semillaDe(`inventario-${b.codigo}`));
    // Anclas reales: plazas y parques con nombre propio, los más grandes primero.
    const anclas = ESPACIOS.filter(
      (e) => e.barrio === b.codigo && !e.nombreDerivado && e.clasificacion !== 'PLAZOLETA',
    )
      .sort((x, y) => y.areaM2 - x.areaM2)
      .slice(0, 8);
    const pool = anclas.length ? anclas : ESPACIOS.filter((e) => e.barrio === b.codigo).slice(0, 8);

    /** Un punto cerca de un ancla; si el desplazamiento sale del barrio, se reintenta. */
    const cerca = (
      k: number,
      minM: number,
      maxM: number,
    ): { p: Position; ancla?: EspacioVerde } => {
      const ancla = pool[k % Math.max(pool.length, 1)];
      if (ancla) {
        for (let t = 0; t < 30; t++) {
          const p = desplazar(
            [ancla.lng, ancla.lat],
            minM + azar() * (maxM - minM),
            azar() * 2 * Math.PI,
          );
          if (puntoEnGeometria(p, poligono)) return { p, ancla };
        }
      }
      return { p: puntosEnGeometria(poligono, 1, azar)[0] };
    };

    const nCont = Math.max(
      0,
      MIN_CONTENEDORES + (i % 3) - (existentes.contenedores.get(b.codigo) ?? 0),
    );
    for (let n = 0; n < nCont; n++) {
      const { p, ancla } = cerca(n, 25, 90);
      const tipo = tipos[(n + i) % tipos.length];
      const dañado = n === 0 && i % 7 === 3;
      inv.contenedores.push({
        code: `CT-${b.codigo}-${String(n + 1).padStart(4, '0')}`,
        zone: b.codigo,
        containerType: tipo,
        address: ancla ? `Frente a ${ancla.nombre}` : `${b.nombre}, vereda`,
        lat: r5(p[1]),
        lng: r5(p[0]),
        capacityLiters: tipo === ContainerType.GREEN ? 1100 : n % 2 ? 2400 : 3200,
        ...(dañado && {
          status: ContainerStatus.DAMAGED,
          damageType: DamageType.LID_BROKEN,
          severity: Severity.MEDIUM,
          requiresPublicWorks: false,
        }),
        ...(n === 1 && i % 9 === 4 && { status: ContainerStatus.OVERFLOWED }),
      });
    }

    // Punto verde: en la plaza más grande del barrio, si no hay uno cargado a mano.
    if (!existentes.puntosVerdes.get(b.codigo)) {
      const sede = anclas.find((e) => puntoEnGeometria([e.lng, e.lat], poligono));
      const p: Position = sede ? [sede.lng, sede.lat] : cerca(0, 0, 0).p;
      inv.puntosVerdes.push({
        code: `GP-${b.codigo}-01`,
        name: sede ? `Punto Verde ${sede.nombre}` : `Punto Verde ${b.nombre}`,
        zone: b.codigo,
        address: sede ? sede.nombre : b.nombre,
        lat: r5(p[1]),
        lng: r5(p[0]),
        wasteTypes: i % 3 === 0 ? [WasteType.RECYCLABLE, WasteType.GREEN] : [WasteType.RECYCLABLE],
      });
    }

    const nArb = Math.max(0, MIN_ARBOLES + (i % 2) - (existentes.arboles.get(b.codigo) ?? 0));
    for (let n = 0; n < nArb; n++) {
      const { p, ancla } = cerca(n + 3, 15, 60);
      inv.arboles.push({
        surveyCode: `ARB-${b.codigo}-9${String(n + 1).padStart(4, '0')}`,
        zone: b.codigo,
        species: ESPECIES[Math.floor(azar() * ESPECIES.length)],
        address: ancla ? `Vereda de ${ancla.nombre}` : `${b.nombre}, vereda`,
        lat: r5(p[1]),
        lng: r5(p[0]),
        heightM: r1(5 + azar() * 15),
        diameterCm: r1(20 + azar() * 70),
      });
    }
  });
  return inv;
}
