import {
  GeometriaPoligonal,
  cajaDe,
  poligonosDe,
  prng,
  puntoEnGeometria,
  puntosEnGeometria,
  semillaDe,
} from './geo';

const MULTI: GeometriaPoligonal = {
  type: 'MultiPolygon',
  coordinates: [
    [
      [
        [0, 0],
        [4, 0],
        [4, 4],
        [0, 4],
        [0, 0],
      ],
      // hueco
      [
        [1, 1],
        [3, 1],
        [3, 3],
        [1, 3],
        [1, 1],
      ],
    ],
  ],
};

describe('geo', () => {
  it('respeta los huecos del polígono', () => {
    expect(puntoEnGeometria([0.5, 0.5], MULTI)).toBe(true);
    expect(puntoEnGeometria([2, 2], MULTI)).toBe(false);
    expect(poligonosDe(MULTI)).toHaveLength(1);
    expect(cajaDe(MULTI)).toEqual([0, 0, 4, 4]);
  });

  it('prng y semillaDe son determinísticos', () => {
    const a = prng(semillaDe('palermo'));
    const b = prng(semillaDe('palermo'));
    const sa = [a(), a(), a()];
    expect(sa).toEqual([b(), b(), b()]);
    expect(sa.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(semillaDe('palermo')).not.toBe(semillaDe('belgrano'));
  });

  it('puntosEnGeometria devuelve n puntos adentro, siempre los mismos', () => {
    const una = puntosEnGeometria(MULTI, 20, prng(7));
    expect(una).toEqual(puntosEnGeometria(MULTI, 20, prng(7)));
    expect(una).toHaveLength(20);
    expect(una.every((p) => puntoEnGeometria(p, MULTI))).toBe(true);
  });

  it('aborta si no puede muestrear', () => {
    const casiVacio: GeometriaPoligonal = {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 0],
          [0, 0],
        ],
      ],
    };
    expect(() => puntosEnGeometria(casiVacio, 1, prng(1))).toThrow(/rechazos/);
  });
});
