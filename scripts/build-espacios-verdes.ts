/**
 * Genera `prisma/data/espacios-verdes.json`, el dataset compacto que siembra los
 * espacios verdes (#422), a partir del GeoJSON de BA Data «Espacios verdes».
 *
 * `npm run espacios-verdes:build [-- ruta/al/espacio_verde_publico.geojson]`
 *
 * Sin argumento lee `docs/geojson/espacio_verde_publico.geojson` (versionado). El seed
 * no carga ese archivo de 18 MB: usa el JSON compacto de salida.
 *
 * Entra todo PLAZA, PARQUE y PLAZOLETA, más PARQUE SEMIPÚBLICO, JARDÍN BOTÁNICO y PASEO
 * (el modelo los cubre con PARK y PROMENADE). Quedan afuera canteros centrales, patios,
 * jardines y complejos: no son espacios que la cuadrilla de parques atienda como tales.
 * Falla si algún barrio del dataset no empareja con el catálogo de M9.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { GeometriaPoligonal, puntoInterior } from '../src/common/utils/geo';

export const CLASIFICACIONES = [
  'PLAZA',
  'PLAZOLETA',
  'PARQUE',
  'PARQUE SEMIPÚBLICO',
  'JARDÍN BOTÁNICO',
  'PASEO',
] as const;
export type Clasificacion = (typeof CLASIFICACIONES)[number];

/** El dataset escribe distinto a M9 en estos barrios (ver docs/geojson/README.md). */
const ALIAS_BARRIO: Record<string, string> = {
  monserrat: 'montserrat',
  paternal: 'la-paternal',
  boca: 'la-boca',
};

export interface EspacioVerde {
  id: number;
  nombre: string;
  /** `nombre` salió de la ubicación porque el dataset no lo trae. */
  nombreDerivado?: true;
  clasificacion: Clasificacion;
  /** `codigo` del barrio en el catálogo de M9. */
  barrio: string;
  comuna: number;
  lat: number;
  lng: number;
  areaM2: number;
}

interface FeatureEV {
  properties: {
    id: number;
    nombre: string | null;
    nom_mapa: string | null;
    barrio: string;
    comuna: number;
    ubicacion: string | null;
    clasificac: string;
    area: number;
  };
  geometry: GeometriaPoligonal;
}

/** «Villa Gral. Mitre» → `villa-general-mitre`: el slug que usa M9. */
export function slugBarrio(nombre: string): string {
  const slug = nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\bgral\b\.?/g, 'general')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return ALIAS_BARRIO[slug] ?? slug;
}

const MINUSCULAS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'entre', 'al']);

/** «CONDE - MATIENZO, BENJAMIN» → «Conde - Matienzo, Benjamin»; legible, sin pretender ortografía. */
export function capitalizar(texto: string): string {
  return texto
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((p, i) =>
      i > 0 && MINUSCULAS.has(p)
        ? p
        : p.replace(/(^|[-(])([a-zñáéíóú])/g, (_, a: string, b: string) => a + b.toUpperCase()),
    )
    .join(' ');
}

/** El nombre del dataset, o la ubicación si falta (con el tipo adelante); nunca queda vacío. */
export function nombreDe(p: FeatureEV['properties']): { nombre: string; derivado: boolean } {
  const propio = p.nombre?.trim();
  if (propio) return { nombre: propio, derivado: false };
  const tipo = capitalizar(p.clasificac);
  const ubic = (p.ubicacion ?? p.nom_mapa)?.trim();
  return { nombre: ubic ? `${tipo} ${capitalizar(ubic)}` : `${tipo} s/n ${p.id}`, derivado: true };
}

const redondear = (n: number, d: number): number => Math.round(n * 10 ** d) / 10 ** d;

/** Compacta el GeoJSON. `codigos`: los `codigo` de barrio del catálogo de M9. */
export function construir(
  features: FeatureEV[],
  codigos: ReadonlySet<string>,
  comunaDe: ReadonlyMap<string, number>,
): EspacioVerde[] {
  const salida: EspacioVerde[] = [];
  const desconocidos = new Set<string>();
  for (const f of features) {
    const p = f.properties;
    if (!(CLASIFICACIONES as readonly string[]).includes(p.clasificac)) continue;
    const barrio = slugBarrio(p.barrio);
    if (!codigos.has(barrio)) {
      desconocidos.add(p.barrio);
      continue;
    }
    const [lng, lat] = puntoInterior(f.geometry);
    const { nombre, derivado } = nombreDe(p);
    salida.push({
      id: p.id,
      nombre,
      ...(derivado && { nombreDerivado: true as const }),
      clasificacion: p.clasificac as Clasificacion,
      barrio,
      comuna: comunaDe.get(barrio) ?? p.comuna,
      lat: redondear(lat, 5),
      lng: redondear(lng, 5),
      areaM2: Math.round(p.area),
    });
  }
  if (desconocidos.size) {
    throw new Error(`Barrios sin emparejar con M9: ${[...desconocidos].join(', ')}`);
  }
  return salida.sort((a, b) => a.id - b.id);
}

function main(): void {
  const raiz = join(__dirname, '..');
  const entrada = process.argv[2] ?? join(raiz, 'docs/geojson/espacio_verde_publico.geojson');
  const barrios = JSON.parse(readFileSync(join(raiz, 'prisma/data/m9-barrios.json'), 'utf8')) as {
    codigo: string;
    zona: string;
    activo: boolean;
  }[];
  const activos = barrios.filter((b) => b.activo);
  const comunaDe = new Map(activos.map((b) => [b.codigo, Number(b.zona.replace('comuna-', ''))]));
  const geo = JSON.parse(readFileSync(entrada, 'utf8')) as { features: FeatureEV[] };
  const datos = construir(geo.features, new Set(comunaDe.keys()), comunaDe);
  // Un espacio por línea: diffs legibles y archivo chico.
  const texto = `[\n${datos.map((d) => JSON.stringify(d)).join(',\n')}\n]\n`;
  writeFileSync(join(raiz, 'prisma/data/espacios-verdes.json'), texto);
  console.log(`${datos.length} espacios verdes, ${Math.round(texto.length / 1024)} KB`);
}

if (require.main === module) main();
