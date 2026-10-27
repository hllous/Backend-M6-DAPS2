import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { puntoEnGeometria, puntoInterior, GeometriaPoligonal } from '../src/common/utils/geo';
import {
  capitalizar,
  construir,
  EspacioVerde,
  nombreDe,
  slugBarrio,
} from './build-espacios-verdes';

const leer = <T>(f: string): T => JSON.parse(readFileSync(join(__dirname, '..', f), 'utf8')) as T;

const CUADRADO: GeometriaPoligonal = {
  type: 'Polygon',
  coordinates: [
    [
      [-58.5, -34.6],
      [-58.4, -34.6],
      [-58.4, -34.5],
      [-58.5, -34.5],
      [-58.5, -34.6],
    ],
  ],
};

/** Una "C": el centroide cae en el hueco, así que hay que buscar un punto interior. */
const EN_C: GeometriaPoligonal = {
  type: 'Polygon',
  coordinates: [
    [
      [0, 0],
      [10, 0],
      [10, 2],
      [2, 2],
      [2, 8],
      [10, 8],
      [10, 10],
      [0, 10],
      [0, 0],
    ],
  ],
};

const props = (
  o: Partial<{ nombre: string | null; ubicacion: string | null; barrio: string }>,
) => ({
  id: 1,
  nombre: null,
  nom_mapa: null,
  barrio: 'Palermo',
  comuna: 14,
  ubicacion: null,
  clasificac: 'PLAZOLETA',
  area: 100.6,
  ...o,
});

describe('build-espacios-verdes', () => {
  it('empareja los barrios con alias y sin acentos', () => {
    expect(slugBarrio('Monserrat')).toBe('montserrat');
    expect(slugBarrio('La Boca')).toBe('la-boca');
    expect(slugBarrio('Nuñez')).toBe('nunez');
    expect(slugBarrio('Villa Gral. Mitre')).toBe('villa-general-mitre');
    expect(slugBarrio('Paternal')).toBe('la-paternal');
  });

  it('el punto interior cae adentro, incluso en una forma en C', () => {
    expect(puntoEnGeometria(puntoInterior(CUADRADO), CUADRADO)).toBe(true);
    expect(puntoEnGeometria([5, 5], EN_C)).toBe(false);
    expect(puntoEnGeometria(puntoInterior(EN_C), EN_C)).toBe(true);
  });

  it('usa la ubicación como nombre si falta y lo marca', () => {
    expect(nombreDe(props({ nombre: 'Plaza Italia' }))).toEqual({
      nombre: 'Plaza Italia',
      derivado: false,
    });
    expect(nombreDe(props({ ubicacion: 'CONDE - MATIENZO, BENJAMIN' }))).toEqual({
      nombre: 'Plazoleta Conde - Matienzo, Benjamin',
      derivado: true,
    });
    expect(nombreDe(props({})).nombre).toBe('Plazoleta s/n 1');
    expect(capitalizar('AV ALICIA MOREAU DE JUSTO')).toBe('Av Alicia Moreau de Justo');
  });

  it('construir filtra clasificaciones, redondea y falla ante un barrio desconocido', () => {
    const codigos = new Set(['palermo']);
    const comunas = new Map([['palermo', 14]]);
    const f = (p: object) => ({ properties: p as ReturnType<typeof props>, geometry: CUADRADO });
    const out = construir(
      [f(props({ nombre: 'X' })), f({ ...props({}), id: 2, clasificac: 'CANTERO CENTRAL' })],
      codigos,
      comunas,
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ barrio: 'palermo', comuna: 14, areaM2: 101 });
    expect(() => construir([f(props({ barrio: 'Atlantis' }))], codigos, comunas)).toThrow(
      /Atlantis/,
    );
  });
});

describe('prisma/data/espacios-verdes.json', () => {
  const datos = leer<EspacioVerde[]>('prisma/data/espacios-verdes.json');
  const barrios = leer<{ codigo: string; zona: string; activo: boolean }[]>(
    'prisma/data/m9-barrios.json',
  ).filter((b) => b.activo);

  it('cubre los 48 barrios del snapshot y solo ellos', () => {
    const usados = new Set(datos.map((d) => d.barrio));
    expect([...usados].sort()).toEqual(barrios.map((b) => b.codigo).sort());
  });

  it('trae todas las plazas, parques y plazoletas del dataset (1358) y los extras soportados', () => {
    const n = (c: string) => datos.filter((d) => d.clasificacion === c).length;
    expect(n('PLAZA') + n('PARQUE') + n('PLAZOLETA')).toBe(1358);
    expect(datos).toHaveLength(1366);
    expect(new Set(datos.map((d) => d.id)).size).toBe(datos.length);
  });

  it('las coordenadas caen dentro de CABA y la comuna coincide con la del barrio', () => {
    const comunaDe = new Map(barrios.map((b) => [b.codigo, Number(b.zona.replace('comuna-', ''))]));
    for (const d of datos) {
      expect(d.lng).toBeGreaterThan(-58.54);
      expect(d.lng).toBeLessThan(-58.33);
      expect(d.lat).toBeGreaterThan(-34.71);
      expect(d.lat).toBeLessThan(-34.52);
      expect(d.comuna).toBe(comunaDe.get(d.barrio));
      expect(d.nombre.length).toBeGreaterThan(0);
    }
  });

  it('el archivo es compacto', () => {
    const bytes = readFileSync(join(__dirname, '../prisma/data/espacios-verdes.json')).length;
    expect(bytes).toBeLessThan(300 * 1024);
  });
});
