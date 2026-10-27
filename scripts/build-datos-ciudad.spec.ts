import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { GeometriaPoligonal, puntoEnGeometria } from '../src/common/utils/geo';
import {
  ArbolCiudad,
  ContenedorCiudad,
  PuntoVerdeCiudad,
  CONTENEDORES_A_MANO,
  CONTENEDORES_NEGROS,
  CONTENEDORES_VERDES,
  barrioDe,
  candidatosArbol,
  candidatosContenedor,
  elegirPorBarrio,
  enCaba,
  especie,
  estadoArbol,
  muestrear,
  poligonosPorBarrio,
  puntosVerdes,
  repartir,
  residuosDe,
} from './build-datos-ciudad';

const raiz = join(__dirname, '..');
const leer = <T>(f: string): T => JSON.parse(readFileSync(join(raiz, f), 'utf8')) as T;
const datos = <T>(f: string): T[] => leer<{ datos: T[] }>(`prisma/data/${f}`).datos;

const cuadrado = (x: number, y: number): GeometriaPoligonal => ({
  type: 'Polygon',
  coordinates: [
    [
      [x, y],
      [x + 0.01, y],
      [x + 0.01, y + 0.01],
      [x, y + 0.01],
      [x, y],
    ],
  ],
});
const POLIGONOS = new Map([
  ['norte', cuadrado(-58.45, -34.55)],
  ['sur', cuadrado(-58.45, -34.65)],
]);
const pt = (lng: number, lat: number) => ({
  type: 'Point',
  coordinates: [lng, lat] as [number, number],
});

describe('build-datos-ciudad: geometría', () => {
  it('rechaza coordenadas fuera de CABA o con los ejes invertidos', () => {
    expect(enCaba([-58.4, -34.6])).toBe(true);
    expect(enCaba([-34.6, -58.4])).toBe(false);
    expect(enCaba([-58.4, -33.0])).toBe(false);
    expect(enCaba([NaN, -34.6])).toBe(false);
  });

  it('asigna el barrio por punto-en-polígono, no por texto', () => {
    expect(barrioDe([-58.445, -34.545], POLIGONOS)).toBe('norte');
    expect(barrioDe([-58.445, -34.645], POLIGONOS)).toBe('sur');
    expect(barrioDe([-58.445, -34.6], POLIGONOS)).toBeUndefined();
    expect(barrioDe([-58.0, -34.545], POLIGONOS)).toBeUndefined();
  });

  it('con el GeoJSON real: puntos conocidos caen en su barrio', () => {
    const codigos = leer<{ codigo: string; activo: boolean }[]>('prisma/data/m9-barrios.json')
      .filter((b) => b.activo)
      .map((b) => b.codigo);
    const reales = poligonosPorBarrio(leer('docs/geojson/caba_barrios.geojson'), codigos);
    expect(reales.size).toBe(48);
    expect(barrioDe([-58.40677, -34.58449], reales)).toBe('recoleta'); // Parque Las Heras
    expect(barrioDe([-58.4761, -34.6767], reales)).toBe('villa-lugano'); // Estación Lugano
    expect(barrioDe([-58.3816, -34.6037], reales)).toBe('san-nicolas'); // Obelisco
    expect(() => poligonosPorBarrio({ features: [] }, ['palermo'])).toThrow(/palermo/);
  });
});

describe('build-datos-ciudad: muestreo determinista', () => {
  it('muestrear depende solo de la semilla y los ids, no del orden de entrada', () => {
    const items = Array.from({ length: 50 }, (_, i) => ({ id: i * 3 }));
    const a = muestrear(items, 10, 's', (x) => x.id);
    const b = muestrear([...items].reverse(), 10, 's', (x) => x.id);
    expect(a).toEqual(b);
    expect(a).toHaveLength(10);
    expect(a.map((x) => x.id)).toEqual([...a.map((x) => x.id)].sort((x, y) => x - y));
    expect(muestrear(items, 10, 'otra', (x) => x.id)).not.toEqual(a);
    expect(muestrear(items, 99, 's', (x) => x.id)).toHaveLength(50);
  });

  it('repartir es parejo, respeta la capacidad y redistribuye lo que falta', () => {
    const cap = new Map([
      ['a', 10],
      ['b', 10],
      ['c', 1],
      ['d', 10],
    ]);
    const r = repartir(12, cap);
    expect(r.get('c')).toBe(1);
    expect([...r.values()].reduce((x, y) => x + y, 0)).toBe(12);
    expect(Math.max(r.get('a')!, r.get('b')!, r.get('d')!)).toBe(4);
    expect(repartir(12, cap)).toEqual(r);
    expect(() => repartir(40, cap)).toThrow(/capacidad/);
  });

  it('repartir cuenta lo previo: los barrios con más escritos a mano reciben menos', () => {
    const cap = new Map([
      ['a', 20],
      ['b', 20],
      ['c', 20],
    ]);
    const r = repartir(9, cap, new Map([['a', 6]]));
    expect(r.get('a')).toBe(0);
    expect(Math.abs(r.get('b')! - r.get('c')!)).toBeLessThanOrEqual(1);
    expect(r.get('b')! + r.get('c')!).toBe(9);
    // Con más cupo, 'a' vuelve a entrar al reparto cuando los demás lo alcanzan.
    expect(repartir(30, cap, new Map([['a', 6]])).get('a')).toBeGreaterThan(0);
  });

  it('elegirPorBarrio da el total exacto, sin repetir ids y estable', () => {
    const cand = Array.from({ length: 60 }, (_, i) => ({
      id: i,
      barrio: i % 3 === 0 ? 'a' : i % 3 === 1 ? 'b' : 'c',
    }));
    const r = elegirPorBarrio([...cand, cand[0]], 30, 'x', ['a', 'b', 'c']);
    expect(r.elegidos).toHaveLength(30);
    expect(new Set(r.elegidos.map((e) => e.id)).size).toBe(30);
    expect(r.cupo.get('a')).toBe(10);
    expect(elegirPorBarrio(cand, 30, 'x', ['a', 'b', 'c']).elegidos).toEqual(r.elegidos);
  });
});

describe('build-datos-ciudad: mapeos', () => {
  it('vitalidad del censo → TreeHealthStatus', () => {
    expect(estadoArbol('Vital')).toBe('HEALTHY');
    expect(estadoArbol('En Observación')).toBe('DISEASED');
    expect(estadoArbol('Escasa Foliación')).toBe('WEAKENED');
    expect(estadoArbol('Tocón')).toBe('DEAD');
    expect(estadoArbol('Cepa')).toBe('DEAD');
    expect(estadoArbol(null)).toBeUndefined();
    expect(estadoArbol('Otra cosa')).toBeUndefined();
  });

  it('especie en forma de binomial y residuos de los puntos verdes', () => {
    expect(especie(' Fraxinus  Pennsylvanica ')).toBe('Fraxinus pennsylvanica');
    expect(especie('Tabebuia Sp.')).toBe('Tabebuia sp.');
    expect(residuosDe('Aceite vegetal usado - Pilas - RAEES')).toEqual(['RECYCLABLE']);
    expect(residuosDe('Cartón - Metal - Orgánicos - Vidrio')).toEqual(['RECYCLABLE', 'GREEN']);
    expect(residuosDe('Voluminosos')).toEqual(['RECYCLABLE', 'BULKY']);
    expect(residuosDe(null)).toEqual(['RECYCLABLE']);
  });

  it('contenedores: descarta fuera de CABA y sin dirección, y redondea', () => {
    const f = (lng: number, lat: number, dir: string | null, id: number) => ({
      geometry: pt(lng, lat),
      properties: { id, dir },
    });
    const out = candidatosContenedor(
      [
        f(-58.4451234567, -34.5451234567, ' Calle  1 ', 1),
        f(-58.4451, -34.5451, null, 2),
        f(-34.5451, -58.4451, 'Invertido 3', 3),
        f(-58.0, -34.545, 'Afuera 4', 4),
      ],
      'RECYCLABLE',
      POLIGONOS,
    );
    expect(out).toEqual([
      {
        id: 1,
        containerType: 'RECYCLABLE',
        address: 'Calle 1',
        lat: -34.54512,
        lng: -58.44512,
        barrio: 'norte',
      },
    ]);
  });

  it('árboles: exige especie, vitalidad y medidas, y mapea los campos', () => {
    type Props = {
      id: number;
      nam: string | null;
      nco: string | null;
      vta: string | null;
      alt: number | null;
      dmt: number | null;
      dir: string | null;
    };
    const base: Props = {
      id: 7,
      nam: 'Jacaranda Mimosifolia',
      nco: 'Jacaranda',
      vta: 'En Observación',
      alt: 9,
      dmt: 32,
      dir: 'Calle 5',
    };
    const f = (p: Partial<Props>) => ({
      geometry: pt(-58.445, -34.545),
      properties: { ...base, ...p },
    });
    const out = candidatosArbol(
      [f({}), f({ vta: null }), f({ alt: null }), f({ dmt: 0 }), f({ nco: null }), f({ dir: '' })],
      POLIGONOS,
    );
    expect(out).toEqual([
      {
        id: 7,
        species: 'Jacaranda mimosifolia',
        commonName: 'Jacaranda',
        healthStatus: 'DISEASED',
        heightM: 9,
        diameterCm: 32,
        address: 'Calle 5',
        lat: -34.545,
        lng: -58.445,
        barrio: 'norte',
      },
    ]);
  });

  it('puntos verdes: falla si uno cae fuera de todo barrio', () => {
    const f = (lng: number, lat: number) => ({
      geometry: pt(lng, lat),
      properties: { fna: 'Punto verde X', dir: 'Y', wsc: null, tip: 'Con Atención', hor: 'h' },
    });
    expect(puntosVerdes([f(-58.445, -34.545)], POLIGONOS)[0]).toMatchObject({ barrio: 'norte' });
    expect(() => puntosVerdes([f(-58.0, -34.545)], POLIGONOS)).toThrow(/fuera/);
  });
});

describe('prisma/data/*-ciudad.json (la muestra versionada)', () => {
  const barrios = leer<{ codigo: string; activo: boolean }[]>('prisma/data/m9-barrios.json')
    .filter((b) => b.activo)
    .map((b) => b.codigo);
  const poligonos = poligonosPorBarrio(leer('docs/geojson/caba_barrios.geojson'), barrios);
  const contenedores = datos<ContenedorCiudad>('contenedores-ciudad.json');
  const puntos = datos<PuntoVerdeCiudad>('puntos-verdes-ciudad.json');
  const arboles = datos<ArbolCiudad>('arbolado-ciudad.json');

  it('fija los totales: 448 reales (325 negros + 123 verdes), que con los 52 a mano son 500; 19 puntos; ≥400 árboles', () => {
    expect(contenedores).toHaveLength(448);
    expect(contenedores.filter((c) => c.containerType === 'HOUSEHOLD')).toHaveLength(
      CONTENEDORES_NEGROS,
    );
    expect(contenedores.filter((c) => c.containerType === 'RECYCLABLE')).toHaveLength(
      CONTENEDORES_VERDES,
    );
    expect(CONTENEDORES_NEGROS + CONTENEDORES_VERDES + 52).toBe(500);
    expect(puntos).toHaveLength(19);
    expect(arboles.length).toBeGreaterThanOrEqual(400);
    expect(arboles.length).toBeLessThanOrEqual(420);
  });

  it('cubre los 48 barrios con ≥4 contenedores y ≥3 árboles, y cada punto cae en su barrio', () => {
    for (const b of barrios) {
      const c = contenedores.filter((x) => x.barrio === b);
      const mano = CONTENEDORES_A_MANO[b] ?? { HOUSEHOLD: 0, RECYCLABLE: 0 };
      expect(c.length + mano.HOUSEHOLD + mano.RECYCLABLE).toBeGreaterThanOrEqual(4);
      expect(
        c.filter((x) => x.containerType === 'RECYCLABLE').length + mano.RECYCLABLE,
      ).toBeGreaterThanOrEqual(1);
      expect(arboles.filter((x) => x.barrio === b).length).toBeGreaterThanOrEqual(3);
    }
    for (const x of [...contenedores, ...puntos, ...arboles]) {
      expect(puntoEnGeometria([x.lng, x.lat], poligonos.get(x.barrio)!)).toBe(true);
    }
  });

  it('no repite ids dentro de cada tipo y los árboles traen estado y especie reales', () => {
    const clave = (c: ContenedorCiudad) => `${c.containerType}-${c.id}`;
    expect(new Set(contenedores.map(clave)).size).toBe(448);
    expect(new Set(arboles.map((a) => a.id)).size).toBe(arboles.length);
    expect(new Set(arboles.map((a) => a.species)).size).toBeGreaterThan(5);
    expect(
      arboles.every((a) => ['HEALTHY', 'WEAKENED', 'DISEASED', 'DEAD'].includes(a.healthStatus)),
    ).toBe(true);
  });

  it('cada archivo lleva la cabecera de fuente, licencia y atribución y son compactos', () => {
    for (const f of ['contenedores', 'puntos-verdes', 'arbolado']) {
      const ruta = `prisma/data/${f}-ciudad.json`;
      const { meta } = leer<{ meta: Record<string, string> }>(ruta);
      expect(meta.fuente).toMatch(/IDECABA/);
      expect(meta.licencia.length).toBeGreaterThan(10);
      expect(meta.atribucion).toMatch(/Gobierno de la Ciudad/);
      expect(meta.consulta).toBeTruthy();
      expect(statSync(join(raiz, ruta)).size).toBeLessThan(150 * 1024);
    }
  });
});
