/**
 * Genera `prisma/data/contenedores-ciudad.json`, `puntos-verdes-ciudad.json` y
 * `arbolado-ciudad.json` (#439): una MUESTRA determinista de los datos reales de IDECABA
 * (WFS del GeoServer de la Ciudad, workspace `catalogo_og_130`) que reemplaza al inventario
 * pseudoaleatorio del seed.
 *
 * `npm run datos-ciudad:build`
 *
 * Necesita red (solo lectura, pedidos secuenciales con pausa). El seed NO la usa: lee los JSON.
 * Los crudos no se guardan. El barrio se decide por punto-en-polígono contra
 * `docs/geojson/caba_barrios.geojson`; el campo `bar` del WFS se ignora. Parámetros y
 * licencias: `prisma/data/README.md`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { WasteType } from '@prisma/client';
import {
  GeometriaPoligonal,
  Position,
  cajaDe,
  prng,
  puntoEnGeometria,
  semillaDe,
} from '../src/common/utils/geo';
import { slugBarrio } from './build-espacios-verdes';

// ── Parámetros de la muestra (decisión del PO, #439) ─────────────────────────
/**
 * Contenedores de la base = 500 (360 negros + 140 verdes en la propuesta del PO) CONTANDO los 52
 * escritos a mano del seed: 31 `HOUSEHOLD`, 16 `RECYCLABLE`, 3 `GREEN` y 2 `BULKY`. Los 5 de
 * tipo GREEN/BULKY no entran en la cuenta negros/verdes, así que la muestra real es 500 - 52 = 448:
 * 325 negros + 123 verdes. La base queda en 356 HOUSEHOLD + 139 RECYCLABLE + 5 de otros tipos = 500.
 * (Para 360/140 exactos serían 329 + 124, y la base sumaría 505.)
 */
export const CONTENEDORES_NEGROS = 325;
export const CONTENEDORES_VERDES = 123;
/** Los escritos a mano de `prisma/seed.ts` por barrio: el reparto los cuenta para quedar parejo. */
export const CONTENEDORES_A_MANO: Readonly<
  Record<string, { HOUSEHOLD: number; RECYCLABLE: number }>
> = {
  belgrano: { HOUSEHOLD: 4, RECYCLABLE: 3 },
  palermo: { HOUSEHOLD: 6, RECYCLABLE: 3 },
  colegiales: { HOUSEHOLD: 3, RECYCLABLE: 1 },
  recoleta: { HOUSEHOLD: 5, RECYCLABLE: 2 },
  'san-nicolas': { HOUSEHOLD: 4, RECYCLABLE: 2 },
  montserrat: { HOUSEHOLD: 3, RECYCLABLE: 2 },
  retiro: { HOUSEHOLD: 4, RECYCLABLE: 2 },
  'puerto-madero': { HOUSEHOLD: 2, RECYCLABLE: 1 },
};
export const ARBOLES = 408;
export const MIN_CONTENEDORES_BARRIO = 4;
export const MIN_ARBOLES_BARRIO = 3;
/** Semilla de todos los sorteos: cambiarla cambia la muestra entera. */
export const SEMILLA = 'datos-ciudad-439';

// ── Parámetros de consulta (educados: secuenciales, con pausa y topes) ───────
export const WFS_URL = 'https://geoserver.buenosaires.gob.ar/geoserver/catalogo_og_130/wfs';
const PAGINA = 1000;
const MAX_PAGINAS = 40;
const VENTANAS_ARBOLES = 4;
const TAM_VENTANA = 75;
const PAUSA_MS = 300;

/** Caja de CABA: todo lo que caiga afuera es un dato corrupto. */
const CABA = { lngMin: -58.54, lngMax: -58.33, latMin: -34.71, latMax: -34.52 };

export type TipoContenedor = 'HOUSEHOLD' | 'RECYCLABLE';
export type EstadoArbol = 'HEALTHY' | 'WEAKENED' | 'DISEASED' | 'DEAD';

export interface ContenedorCiudad {
  /** `id` de IDECABA (único por capa, se repite entre negros y verdes: va con el tipo). */
  id: number;
  containerType: TipoContenedor;
  address: string;
  lat: number;
  lng: number;
  /** `codigo` del barrio en el catálogo de M9, por geometría. */
  barrio: string;
}

export interface PuntoVerdeCiudad {
  name: string;
  address: string;
  lat: number;
  lng: number;
  barrio: string;
  wasteTypes: WasteType[];
  /** `tip` de IDECABA (p. ej. «Con Atención»). */
  atencion: string;
  horario: string;
}

export interface ArbolCiudad {
  id: number;
  /** Nombre científico (`nam` de IDECABA), «Fraxinus pennsylvanica». */
  species: string;
  /** Nombre común (`nco` de IDECABA). */
  commonName: string;
  healthStatus: EstadoArbol;
  heightM: number;
  diameterCm: number;
  address: string;
  lat: number;
  lng: number;
  barrio: string;
}

export interface FeatureWfs<P> {
  geometry: { type: string; coordinates: Position };
  properties: P;
}
interface PropsContenedor {
  id: number;
  dir: string | null;
}
interface PropsPuntoVerde {
  fna: string;
  dir: string | null;
  wsc: string | null;
  tip: string | null;
  hor: string | null;
}
interface PropsArbol {
  id: number;
  nam: string | null;
  nco: string | null;
  vta: string | null;
  alt: number | null;
  dmt: number | null;
  dir: string | null;
}

// ── Funciones puras ──────────────────────────────────────────────────────────

const r5 = (n: number): number => Math.round(n * 1e5) / 1e5;

/** Dentro de la caja de CABA. Los ejes son [lng, lat] (verificado con puntos conocidos). */
export function enCaba([lng, lat]: Position): boolean {
  return (
    Number.isFinite(lng) &&
    Number.isFinite(lat) &&
    lng >= CABA.lngMin &&
    lng <= CABA.lngMax &&
    lat >= CABA.latMin &&
    lat <= CABA.latMax
  );
}

/** El `codigo` del barrio que contiene el punto, o `undefined` si cae afuera de todos. */
export function barrioDe(
  p: Position,
  poligonos: ReadonlyMap<string, GeometriaPoligonal>,
): string | undefined {
  if (!enCaba(p)) return undefined;
  for (const [codigo, g] of poligonos) {
    const [x0, y0, x1, y1] = cajaDe(g);
    if (p[0] < x0 || p[0] > x1 || p[1] < y0 || p[1] > y1) continue;
    if (puntoEnGeometria(p, g)) return codigo;
  }
  return undefined;
}

/** Polígonos de `caba_barrios.geojson` por `codigo` de M9; falla si falta alguno de los 48. */
export function poligonosPorBarrio(
  geo: { features: { properties: { BARRIO: string }; geometry: GeometriaPoligonal }[] },
  codigos: readonly string[],
): Map<string, GeometriaPoligonal> {
  const mapa = new Map<string, GeometriaPoligonal>();
  for (const f of geo.features) mapa.set(slugBarrio(f.properties.BARRIO), f.geometry);
  const faltan = codigos.filter((c) => !mapa.has(c));
  if (faltan.length) throw new Error(`Barrios sin polígono: ${faltan.join(', ')}`);
  return new Map(codigos.map((c) => [c, mapa.get(c) as GeometriaPoligonal]));
}

/**
 * Reparte `total` entre los barrios lo más parejo posible sin pasarse de su capacidad:
 * rondas de +1 por barrio con lugar; en la ronda final, primero los de más capacidad
 * restante (empate: orden alfabético). Lo que a un barrio le falta lo absorben los demás.
 */
export function repartir(
  total: number,
  capacidad: ReadonlyMap<string, number>,
  previo: ReadonlyMap<string, number> = new Map(),
): Map<string, number> {
  const cupo = new Map([...capacidad.keys()].sort().map((c) => [c, 0]));
  const nivel = (c: string): number => (previo.get(c) ?? 0) + (cupo.get(c) as number);
  for (let resto = total; resto > 0; resto--) {
    const libres = [...cupo.keys()].filter(
      (c) => (cupo.get(c) as number) < (capacidad.get(c) as number),
    );
    if (!libres.length)
      throw new Error(`No hay capacidad para repartir ${total} (faltan ${resto})`);
    // Siempre al barrio más bajo (contando lo previo); empate: más capacidad restante, luego orden alfabético.
    libres.sort(
      (a, b) =>
        nivel(a) - nivel(b) ||
        (capacidad.get(b) as number) -
          (cupo.get(b) as number) -
          ((capacidad.get(a) as number) - (cupo.get(a) as number)) ||
        a.localeCompare(b),
    );
    cupo.set(libres[0], (cupo.get(libres[0]) as number) + 1);
  }
  return cupo;
}

/** `n` elementos elegidos con un PRNG sembrado, devueltos en el orden estable de `clave`. */
export function muestrear<T>(
  items: readonly T[],
  n: number,
  semilla: string,
  clave: (t: T) => number,
): T[] {
  const azar = prng(semillaDe(semilla));
  const mezcla = [...items].sort((a, b) => clave(a) - clave(b));
  // Fisher-Yates sobre una base ordenada: la salida depende solo de la semilla y de los ids.
  for (let i = mezcla.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1));
    [mezcla[i], mezcla[j]] = [mezcla[j], mezcla[i]];
  }
  return mezcla.slice(0, n).sort((a, b) => clave(a) - clave(b));
}

/**
 * Vitalidad del censo (`vta`) → `TreeHealthStatus`.
 * - «Vital» → HEALTHY.
 * - «En Observación» → DISEASED (el censo lo tiene bajo seguimiento sanitario).
 * - «Escasa Foliación» → WEAKENED (sigue en pie, con la copa rala).
 * - «Tocón» y «Cepa» → DEAD (queda el tronco o la base, sin copa).
 * Sin `vta` el ejemplar no se usa.
 */
export function estadoArbol(vta: string | null): EstadoArbol | undefined {
  switch (vta?.trim()) {
    case 'Vital':
      return 'HEALTHY';
    case 'En Observación':
      return 'DISEASED';
    case 'Escasa Foliación':
      return 'WEAKENED';
    case 'Tocón':
    case 'Cepa':
      return 'DEAD';
    default:
      return undefined;
  }
}

/** «Fraxinus Pennsylvanica» → «Fraxinus pennsylvanica» (binomial en su forma habitual). */
export function especie(nam: string): string {
  const t = nam.trim().replace(/\s+/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

/**
 * Qué recibe un punto verde (`wsc`) → `WasteType`. Cartón, metal, papel, plástico, vidrio,
 * tetra-brik y telgopor son RECYCLABLE; «Orgánicos» es GREEN; «Voluminosos», BULKY. Aceite,
 * pilas, RAEE, cápsulas y demás materiales de entrega voluntaria no tienen valor propio en el
 * enum: son reciclables especiales, así que RECYCLABLE (siempre está).
 */
export function residuosDe(wsc: string | null): WasteType[] {
  const t = (wsc ?? '').toLowerCase();
  const tipos: WasteType[] = ['RECYCLABLE'];
  if (t.includes('orgánicos')) tipos.push('GREEN');
  if (t.includes('voluminosos')) tipos.push('BULKY');
  return tipos;
}

const texto = (s: string | null | undefined): string => (s ?? '').trim().replace(/\s+/g, ' ');

/** Contenedores crudos → candidatos con barrio por geometría. Descarta sin dirección o fuera de CABA. */
export function candidatosContenedor(
  features: readonly FeatureWfs<PropsContenedor>[],
  containerType: TipoContenedor,
  poligonos: ReadonlyMap<string, GeometriaPoligonal>,
): ContenedorCiudad[] {
  const salida: ContenedorCiudad[] = [];
  for (const f of features) {
    const p: Position = [r5(f.geometry.coordinates[0]), r5(f.geometry.coordinates[1])];
    const barrio = barrioDe(p, poligonos);
    const address = texto(f.properties.dir);
    if (!barrio || !address) continue;
    salida.push({ id: f.properties.id, containerType, address, lat: p[1], lng: p[0], barrio });
  }
  return salida;
}

/** Elige `total` de un tipo repartido entre barrios (≥1 por barrio con candidatos si alcanza el cupo). */
export function elegirPorBarrio<T extends { barrio: string; id: number }>(
  candidatos: readonly T[],
  total: number,
  semilla: string,
  barrios: readonly string[],
  previo: ReadonlyMap<string, number> = new Map(),
): { elegidos: T[]; cupo: Map<string, number> } {
  const porBarrio = new Map<string, T[]>(barrios.map((b) => [b, []]));
  const vistos = new Set<number>();
  for (const c of candidatos) {
    if (vistos.has(c.id)) continue;
    vistos.add(c.id);
    porBarrio.get(c.barrio)?.push(c);
  }
  const cupo = repartir(total, new Map([...porBarrio].map(([b, l]) => [b, l.length])), previo);
  const elegidos = [...porBarrio].flatMap(([b, l]) =>
    muestrear(l, cupo.get(b) as number, `${semilla}-${b}`, (t) => t.id),
  );
  return { elegidos: elegidos.sort((a, b) => a.id - b.id), cupo };
}

/** Árboles crudos → candidatos con especie, estado y medidas válidos y barrio por geometría. */
export function candidatosArbol(
  features: readonly FeatureWfs<PropsArbol>[],
  poligonos: ReadonlyMap<string, GeometriaPoligonal>,
): ArbolCiudad[] {
  const salida: ArbolCiudad[] = [];
  for (const f of features) {
    const p = f.properties;
    const estado = estadoArbol(p.vta);
    const address = texto(p.dir);
    if (!estado || !p.nam || !p.nco || !address) continue;
    if (!(p.alt && p.alt > 0) || !(p.dmt && p.dmt > 0)) continue;
    const pos: Position = [r5(f.geometry.coordinates[0]), r5(f.geometry.coordinates[1])];
    const barrio = barrioDe(pos, poligonos);
    if (!barrio) continue;
    salida.push({
      id: p.id,
      species: especie(p.nam),
      commonName: texto(p.nco),
      healthStatus: estado,
      heightM: p.alt,
      diameterCm: p.dmt,
      address,
      lat: pos[1],
      lng: pos[0],
      barrio,
    });
  }
  return salida;
}

/** Puntos verdes crudos → los que caen en CABA, ordenados por nombre. */
export function puntosVerdes(
  features: readonly FeatureWfs<PropsPuntoVerde>[],
  poligonos: ReadonlyMap<string, GeometriaPoligonal>,
): PuntoVerdeCiudad[] {
  const salida: PuntoVerdeCiudad[] = [];
  for (const f of features) {
    const pos: Position = [r5(f.geometry.coordinates[0]), r5(f.geometry.coordinates[1])];
    const barrio = barrioDe(pos, poligonos);
    if (!barrio) throw new Error(`Punto verde fuera de CABA o de todo barrio: ${f.properties.fna}`);
    salida.push({
      name: texto(f.properties.fna),
      address: texto(f.properties.dir),
      lat: pos[1],
      lng: pos[0],
      barrio,
      wasteTypes: residuosDe(f.properties.wsc),
      atencion: texto(f.properties.tip),
      horario: texto(f.properties.hor),
    });
  }
  return salida.sort((a, b) => a.name.localeCompare(b.name));
}

// ── Red (solo en `main`) ─────────────────────────────────────────────────────

const pausa = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
let pedidos = 0;

async function wfs(capa: string, params: Record<string, string | number>): Promise<string> {
  const url = new URL(WFS_URL);
  const todos = {
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typeNames: `catalogo_og_130:${capa}`,
    ...params,
  };
  for (const [k, v] of Object.entries(todos)) url.searchParams.set(k, String(v));
  for (let intento = 1; ; intento++) {
    await pausa(PAUSA_MS);
    pedidos++;
    try {
      // GeoServer responde 403 sin un User-Agent de navegador.
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 Chrome/120' } });
      if (!r.ok) throw new Error(`WFS ${capa} ${url.search}: HTTP ${r.status}`);
      return await r.text();
    } catch (e) {
      if (intento >= 3) throw e;
      await pausa(2000 * intento);
    }
  }
}

const JSON_SRS = { outputFormat: 'application/json', srsName: 'EPSG:4326', sortBy: 'id' } as const;

async function features<P>(
  capa: string,
  extra: Record<string, string | number> = {},
): Promise<FeatureWfs<P>[]> {
  const j = JSON.parse(await wfs(capa, { ...JSON_SRS, ...extra })) as { features: FeatureWfs<P>[] };
  return j.features;
}

/** Capa entera, paginada por `id` con tope de páginas (las de contenedores: 5 y 28 páginas). */
async function capaCompleta<P>(capa: string): Promise<FeatureWfs<P>[]> {
  const todo: FeatureWfs<P>[] = [];
  for (let i = 0; i < MAX_PAGINAS; i++) {
    const pagina = await features<P>(capa, { count: PAGINA, startIndex: i * PAGINA });
    todo.push(...pagina);
    if (pagina.length < PAGINA) return todo;
  }
  throw new Error(`${capa}: más de ${MAX_PAGINAS * PAGINA} filas, ¿cambió la capa?`);
}

/** Árboles de un barrio: la caja del polígono, hasta 4 ventanas de 75 en posiciones sorteadas. */
async function arbolesDeCaja(
  codigo: string,
  g: GeometriaPoligonal,
): Promise<FeatureWfs<PropsArbol>[]> {
  const [x0, y0, x1, y1] = cajaDe(g);
  const bbox = `${x0},${y0},${x1},${y1},EPSG:4326`;
  const hits = await wfs('arbolado_publico', { resultType: 'hits', bbox });
  const n = Number(/numberMatched="(\d+)"/.exec(hits)?.[1]);
  if (!(n > 0)) throw new Error(`arbolado_publico: sin árboles en la caja de ${codigo}`);
  const azar = prng(semillaDe(`${SEMILLA}-ventanas-${codigo}`));
  const todo = VENTANAS_ARBOLES * TAM_VENTANA;
  const ventanas =
    n <= todo
      ? [{ startIndex: 0, count: n }]
      : Array.from({ length: VENTANAS_ARBOLES }, () => ({
          startIndex: Math.floor(azar() * (n - TAM_VENTANA + 1)),
          count: TAM_VENTANA,
        }));
  const porId = new Map<number, FeatureWfs<PropsArbol>>();
  for (const v of ventanas) {
    for (const f of await features<PropsArbol>('arbolado_publico', { ...v, bbox })) {
      porId.set(f.properties.id, f);
    }
  }
  return [...porId.values()];
}

function meta(
  capa: string,
  consulta: string,
  licencia: string,
  adaptado: string,
  descargado: string,
): object {
  return {
    fuente: 'IDECABA, Gobierno de la Ciudad de Buenos Aires (WFS del GeoServer de la Ciudad)',
    capa: `catalogo_og_130:${capa}`,
    url: WFS_URL,
    descargado,
    consulta,
    licencia,
    atribucion:
      'Fuente: Gobierno de la Ciudad Autónoma de Buenos Aires (IDECABA / BA Data). Datos utilizados con fines académicos y adaptados para su integración en el proyecto.',
    adaptado,
    semilla: SEMILLA,
  };
}

function escribir(ruta: string, cabecera: object, datos: object[]): void {
  const texto = `{\n"meta": ${JSON.stringify(cabecera)},\n"datos": [\n${datos.map((d) => JSON.stringify(d)).join(',\n')}\n]\n}\n`;
  writeFileSync(ruta, texto);
  console.log(`${ruta}: ${datos.length} filas, ${(texto.length / 1024).toFixed(1)} KB`);
}

const LICENCIA_CAPA =
  'Metadato de IDECABA (GeoNetwork, consultado el 27/10/2026): uso con fines informativos e ilustrativos en un proyecto educacional o de divulgación científica, aclarando la fuente; sin fines comerciales; uso personal e intransferible. NO es CC BY 2.5 AR (esa licencia está confirmada solo para espacios verdes).';

/** Fecha de la cabecera: `--descargado=AAAA-MM-DD` o, si no se fija, la del día. El seed no la lee. */
const descargadoDe = (argv: readonly string[]): string =>
  argv.find((a) => a.startsWith('--descargado='))?.slice('--descargado='.length) ??
  new Date().toISOString().slice(0, 10);

/** El metadato de la capa de arbolado tiene dos registros con el mismo título y textos distintos. */
const LICENCIA_ARBOLADO = `${LICENCIA_CAPA} Registro del metadato de esta capa NO verificado: hay dos registros con el mismo título («Arbolado público: censo 2017-2018») y textos distintos (uno sin restricciones cargadas).`;

async function main(): Promise<void> {
  const t0 = Date.now();
  const descargado = descargadoDe(process.argv);
  const raiz = join(__dirname, '..');
  const leer = <T>(f: string): T => JSON.parse(readFileSync(join(raiz, f), 'utf8')) as T;
  const codigos = leer<{ codigo: string; activo: boolean }[]>('prisma/data/m9-barrios.json')
    .filter((b) => b.activo)
    .map((b) => b.codigo)
    .sort();
  const poligonos = poligonosPorBarrio(leer('docs/geojson/caba_barrios.geojson'), codigos);

  // Contenedores: las dos capas completas (≈32 pedidos de 1000), tipo según la capa.
  const negros = candidatosContenedor(
    await capaCompleta<PropsContenedor>('contenedores_negros'),
    'HOUSEHOLD',
    poligonos,
  );
  const verdes = candidatosContenedor(
    await capaCompleta<PropsContenedor>('contenedores_verdes'),
    'RECYCLABLE',
    poligonos,
  );
  const aMano = (tipo: 'HOUSEHOLD' | 'RECYCLABLE'): Map<string, number> =>
    new Map(Object.entries(CONTENEDORES_A_MANO).map(([b, c]) => [b, c[tipo]]));
  const n = elegirPorBarrio(
    negros,
    CONTENEDORES_NEGROS,
    `${SEMILLA}-negros`,
    codigos,
    aMano('HOUSEHOLD'),
  );
  const v = elegirPorBarrio(
    verdes,
    CONTENEDORES_VERDES,
    `${SEMILLA}-verdes`,
    codigos,
    aMano('RECYCLABLE'),
  );
  const contenedores = [...n.elegidos, ...v.elegidos];
  for (const b of codigos) {
    const mano = CONTENEDORES_A_MANO[b];
    const k =
      (n.cupo.get(b) as number) +
      (v.cupo.get(b) as number) +
      (mano ? mano.HOUSEHOLD + mano.RECYCLABLE : 0);
    if (k < MIN_CONTENEDORES_BARRIO) throw new Error(`${b}: solo ${k} contenedores`);
  }

  const verdesPv = puntosVerdes(
    await features<PropsPuntoVerde>('puntos_verdes', { sortBy: 'fna' }),
    poligonos,
  );

  // Árboles: por barrio, ventanas sorteadas dentro de la caja del polígono.
  const candidatosArboles: ArbolCiudad[] = [];
  for (const b of codigos) {
    candidatosArboles.push(
      ...candidatosArbol(await arbolesDeCaja(b, poligonos.get(b) as GeometriaPoligonal), poligonos),
    );
  }
  const a = elegirPorBarrio(candidatosArboles, ARBOLES, `${SEMILLA}-arboles`, codigos);
  for (const b of codigos) {
    if ((a.cupo.get(b) as number) < MIN_ARBOLES_BARRIO) throw new Error(`${b}: pocos árboles`);
  }

  const datos = join(raiz, 'prisma/data');
  const pasos = `GetFeature 2.0.0, outputFormat=application/json, srsName=EPSG:4326, sortBy=id, paginas de ${PAGINA}`;
  escribir(
    join(datos, 'contenedores-ciudad.json'),
    meta(
      'contenedores_negros + contenedores_verdes',
      `${pasos}, capas completas; muestra ${CONTENEDORES_NEGROS} negros (HOUSEHOLD) + ${CONTENEDORES_VERDES} verdes (RECYCLABLE) repartidos entre los 48 barrios`,
      LICENCIA_CAPA,
      'Barrio por punto-en-polígono; coordenadas a 5 decimales; sin la columna de carga, comuna ni barrio del WFS.',
      descargado,
    ),
    contenedores,
  );
  escribir(
    join(datos, 'puntos-verdes-ciudad.json'),
    meta(
      'puntos_verdes',
      `GetFeature 2.0.0, outputFormat=application/json, srsName=EPSG:4326, sortBy=fna; las 19 filas`,
      LICENCIA_CAPA,
      'Barrio por punto-en-polígono; wsc → WasteType (ver README).',
      descargado,
    ),
    verdesPv,
  );
  escribir(
    join(datos, 'arbolado-ciudad.json'),
    meta(
      'arbolado_publico',
      `${pasos}, por barrio: resultType=hits y ${VENTANAS_ARBOLES} ventanas de ${TAM_VENTANA} (count/startIndex sorteados) con bbox=<caja del barrio>,EPSG:4326; muestra ${ARBOLES}`,
      LICENCIA_ARBOLADO,
      'Barrio por punto-en-polígono; nam → species (científico), nco → commonName, vta → healthStatus, alt → heightM, dmt → diameterCm.',
      descargado,
    ),
    a.elegidos,
  );
  console.log(`${pedidos} pedidos en ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}

if (require.main === module) {
  main().catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  });
}
