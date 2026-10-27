/**
 * Geometría mínima para ubicar puntos dentro de polígonos GeoJSON (CRS84: [lng, lat]).
 * La usan el script de espacios verdes y el seed; no hay dependencia externa a propósito.
 */

export type Position = [number, number];
/** Un polígono: el primer anillo es el exterior y los demás son huecos. */
export type Poligono = Position[][];

export interface GeometriaPoligonal {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: number[][][] | number[][][][];
}

/** Los polígonos de una geometría, sea `Polygon` o `MultiPolygon`. */
export function poligonosDe(g: GeometriaPoligonal): Poligono[] {
  return (g.type === 'Polygon' ? [g.coordinates] : g.coordinates) as Poligono[];
}

function enAnillo([x, y]: Position, anillo: Position[]): boolean {
  let dentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i];
    const [xj, yj] = anillo[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

function enPoligono(p: Position, poligono: Poligono): boolean {
  return enAnillo(p, poligono[0]) && !poligono.slice(1).some((hueco) => enAnillo(p, hueco));
}

/** ¿Cae el punto dentro de la geometría (respetando huecos)? */
export function puntoEnGeometria(p: Position, g: GeometriaPoligonal): boolean {
  return poligonosDe(g).some((poligono) => enPoligono(p, poligono));
}

function areaYCentroide(anillo: Position[]): { area: number; c: Position } {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const f = anillo[j][0] * anillo[i][1] - anillo[i][0] * anillo[j][1];
    a += f;
    cx += (anillo[j][0] + anillo[i][0]) * f;
    cy += (anillo[j][1] + anillo[i][1]) * f;
  }
  if (a === 0) return { area: 0, c: anillo[0] };
  return { area: a / 2, c: [cx / (3 * a), cy / (3 * a)] };
}

/** Caja envolvente [minLng, minLat, maxLng, maxLat]. */
export function cajaDe(g: GeometriaPoligonal): [number, number, number, number] {
  const caja: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const poligono of poligonosDe(g)) {
    for (const [x, y] of poligono[0]) {
      caja[0] = Math.min(caja[0], x);
      caja[1] = Math.min(caja[1], y);
      caja[2] = Math.max(caja[2], x);
      caja[3] = Math.max(caja[3], y);
    }
  }
  return caja;
}

/**
 * Un punto representativo que cae DENTRO de la geometría: el centroide del polígono más
 * grande si está adentro; si no (formas en L, huecos), el punto de una grilla fina más
 * cercano a ese centroide.
 */
export function puntoInterior(g: GeometriaPoligonal): Position {
  const mayor = poligonosDe(g)
    .map((p) => ({ p, ...areaYCentroide(p[0]) }))
    .sort((a, b) => Math.abs(b.area) - Math.abs(a.area))[0];
  if (puntoEnGeometria(mayor.c, g)) return mayor.c;

  const [x0, y0, x1, y1] = cajaDe(g);
  const N = 40;
  let mejor: Position | undefined;
  let dMejor = Infinity;
  for (let i = 0; i <= N; i++) {
    for (let j = 0; j <= N; j++) {
      const p: Position = [x0 + ((x1 - x0) * i) / N, y0 + ((y1 - y0) * j) / N];
      if (!puntoEnGeometria(p, g)) continue;
      const d = (p[0] - mayor.c[0]) ** 2 + (p[1] - mayor.c[1]) ** 2;
      if (d < dMejor) {
        dMejor = d;
        mejor = p;
      }
    }
  }
  if (!mejor) throw new Error('geo: no se encontró un punto interior (geometría degenerada)');
  return mejor;
}

/** PRNG determinístico (mulberry32): mismo `semilla`, misma secuencia. */
export function prng(semilla: number): () => number {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash de texto a entero de 32 bits, para sembrar `prng` por barrio. */
export function semillaDe(texto: string): number {
  let h = 0x811c9dc5;
  for (const c of texto) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193);
  return h >>> 0;
}

/** `n` puntos distintos dentro de la geometría, por muestreo con rechazo (determinístico). */
export function puntosEnGeometria(
  g: GeometriaPoligonal,
  n: number,
  azar: () => number,
): Position[] {
  const [x0, y0, x1, y1] = cajaDe(g);
  const puntos: Position[] = [];
  for (let intentos = 0; puntos.length < n; intentos++) {
    if (intentos > n * 2000) throw new Error('geo: demasiados rechazos al muestrear');
    const p: Position = [x0 + (x1 - x0) * azar(), y0 + (y1 - y0) * azar()];
    if (puntoEnGeometria(p, g)) puntos.push(p);
  }
  return puntos;
}
