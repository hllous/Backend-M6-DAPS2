import { DelayType } from '@prisma/client';
import { puntoEnGeometria } from '../src/common/utils/geo';
import { CONTENEDORES_A_MANO } from '../scripts/build-datos-ciudad';
import {
  CONTAINERS,
  GREEN_POINTS,
  TREES,
  TIPO_ESPACIO,
  TOPE_SERVICIOS,
  planificar,
  verificar,
  verificarCobertura,
} from './seed';
import {
  BARRIOS,
  ESPACIOS,
  MIN_ARBOLES,
  MIN_CONTENEDORES,
  cargarPoligonos,
  cargarInventario,
} from './seed-lugares';

describe('seed: distribución sobre los 48 barrios y 15 comunas', () => {
  const planes = planificar();

  it('usa los 48 barrios y las 15 comunas del snapshot de M9', () => {
    expect(BARRIOS).toHaveLength(48);
    expect(new Set(BARRIOS.map((b) => b.comuna)).size).toBe(15);
  });

  it('la planificación es coherente y entra en el tope de servicios', () => {
    expect(() => verificar(planes)).not.toThrow();
    expect(planes.length).toBeLessThanOrEqual(TOPE_SERVICIOS);
    expect(planes.length).toBeGreaterThan(600);
    // 788 + 12 vaciados sobre contenedores reales en distintos estados.
    expect(planes).toHaveLength(800);
  });

  it('toda comuna tiene recorridos y servicios, y todo barrio inventario', () => {
    expect(verificarCobertura(planes)).toEqual([]);
  });

  it('verificar rechaza un aviso de demora en el futuro y un vaciado sin explicar de un contenedor desbordado', () => {
    const futuro = planes.find((p) => p.dia > 0 && p.estado === 'SCHEDULED')!;
    const conAviso = {
      ...futuro,
      demoras: [
        {
          tipo: DelayType.START,
          minutos: 10,
          motivo: 'x',
          estado: futuro.estado,
          detectado: [0, 8, 0] as [number, number, number],
          reportadoPor: '1',
        },
      ],
    };
    expect(() => verificar(planes.map((p) => (p === futuro ? conAviso : p)))).toThrow(/futuro/);
    const desbordado = planes.find(
      (p) => p.estado === 'COMPLETED' && p.objetivo?.codigo === 'CT-monte-castro-0001',
    )!;
    const sinNota = { ...desbordado, notas: undefined };
    expect(() => verificar(planes.map((p) => (p === desbordado ? sinNota : p)))).toThrow(
      /sin nota/,
    );
  });

  it('verificarCobertura detecta una agenda que deja comunas sin servicio', () => {
    const errores = verificarCobertura([]);
    expect(errores.filter((e) => e.endsWith('sin servicios'))).toHaveLength(15);
  });

  it('toda clasificación del dataset de espacios verdes tiene tipo en el modelo', () => {
    for (const e of ESPACIOS) expect(TIPO_ESPACIO[e.clasificacion]).toBeDefined();
  });

  it('es determinística: dos corridas dan lo mismo', () => {
    expect(JSON.stringify(planificar())).toBe(JSON.stringify(planes));
  });
});

describe('seed: inventario real de IDECABA', () => {
  const poligonos = cargarPoligonos();
  const inv = cargarInventario();
  const deBarrio = <T extends { zone: string }>(xs: T[], b: string) =>
    xs.filter((x) => x.zone === b);

  it('fija los totales: 448 reales + 52 a mano = 500 contenedores (356 HOUSEHOLD + 139 RECYCLABLE + 5 GREEN/BULKY); 19 puntos; ≥400 árboles', () => {
    expect(inv.contenedores).toHaveLength(448);
    expect(inv.contenedores.filter((c) => c.containerType === 'HOUSEHOLD')).toHaveLength(325);
    expect(inv.contenedores.filter((c) => c.containerType === 'RECYCLABLE')).toHaveLength(123);
    expect(CONTAINERS).toHaveLength(500);
    const n = (t: string) => CONTAINERS.filter((c) => c.containerType === t).length;
    expect(n('HOUSEHOLD')).toBe(356);
    expect(n('RECYCLABLE')).toBe(139);
    expect(n('GREEN') + n('BULKY')).toBe(5);
    expect(inv.puntosVerdes).toHaveLength(19);
    expect(inv.arboles.length).toBeGreaterThanOrEqual(400);
    expect(inv.arboles.length).toBeLessThanOrEqual(420);
  });

  it('CONTENEDORES_A_MANO del script coincide con los escritos a mano del seed', () => {
    const real = new Set(inv.contenedores.map((c) => c.code));
    const cuenta: Record<string, { HOUSEHOLD: number; RECYCLABLE: number }> = {};
    for (const c of CONTAINERS.filter((x) => !real.has(x.code))) {
      cuenta[c.zone] ??= { HOUSEHOLD: 0, RECYCLABLE: 0 };
      if (c.containerType === 'HOUSEHOLD' || c.containerType === 'RECYCLABLE')
        cuenta[c.zone][c.containerType]++;
    }
    expect(cuenta).toEqual(CONTENEDORES_A_MANO);
  });

  it('el seed reparte parejo contando todos: 9 a 13 contenedores por barrio y al menos un verde', () => {
    const porBarrio = BARRIOS.map((b) => CONTAINERS.filter((c) => c.zone === b.codigo));
    for (const c of porBarrio) {
      expect(c.length).toBeGreaterThanOrEqual(MIN_CONTENEDORES);
      expect(c.some((x) => x.containerType === 'RECYCLABLE')).toBe(true);
    }
    const n = porBarrio.map((c) => c.length);
    expect(Math.min(...n)).toBeGreaterThanOrEqual(9);
    expect(Math.max(...n)).toBeLessThanOrEqual(13);
  });

  it('escenarios de demo: contenedores reales desbordados, dañados, en taller y en reubicación', () => {
    const estado = (e: string) => inv.contenedores.filter((c) => c.status === e);
    expect(estado('OVERFLOWED')).toHaveLength(5);
    expect(estado('DAMAGED')).toHaveLength(3);
    expect(estado('UNDER_REPAIR')).toHaveLength(2);
    expect(estado('RELOCATING')).toHaveLength(1);
    for (const c of estado('DAMAGED')) {
      expect(c.damageType).toBeDefined();
      expect(c.severity).toBeDefined();
    }
    const comunas = new Set(
      inv.contenedores
        .filter((c) => c.status)
        .map((c) => BARRIOS.find((b) => b.codigo === c.zone)!.comuna),
    );
    expect(comunas.size).toBe(11);
    expect([...comunas].some((c) => [1, 2, 13, 14].includes(c))).toBe(false);
  });

  it('cubre todos los barrios con los mínimos de árboles y espacios verdes', () => {
    for (const b of BARRIOS) {
      expect(deBarrio(inv.arboles, b.codigo).length).toBeGreaterThanOrEqual(MIN_ARBOLES);
      expect(ESPACIOS.some((e) => e.barrio === b.codigo)).toBe(true);
    }
    const n = BARRIOS.map((b) => deBarrio(inv.arboles, b.codigo).length);
    expect(Math.max(...n) - Math.min(...n)).toBeLessThanOrEqual(1);
  });

  it('cada punto cae dentro del polígono de su barrio', () => {
    const todos = [...inv.contenedores, ...inv.puntosVerdes, ...inv.arboles];
    for (const x of todos) {
      expect(puntoEnGeometria([x.lng, x.lat], poligonos.get(x.zone)!)).toBe(true);
    }
  });

  it('los códigos siguen el formato, no se repiten y no chocan con los escritos a mano', () => {
    expect(inv.contenedores.every((c) => /^CT-[a-z-]+-\d{4}$/.test(c.code))).toBe(true);
    expect(inv.puntosVerdes.every((g) => /^GP-[a-z-]+-\d{2}$/.test(g.code))).toBe(true);
    expect(inv.arboles.every((t) => /^ARB-[a-z-]+-9\d{4}$/.test(t.surveyCode))).toBe(true);
    for (const codigos of [
      [...inv.contenedores.map((c) => c.code), ...CONTAINERS.map((c) => c.code)],
      [...inv.arboles.map((t) => t.surveyCode), ...TREES.map((t) => t.surveyCode)],
      [...inv.puntosVerdes.map((g) => g.code), ...GREEN_POINTS.map((g) => g.code)],
    ]) {
      // El inventario está incluido en CONTAINERS/TREES/GREEN_POINTS: cada código aparece dos veces.
      const veces = new Map<string, number>();
      for (const c of codigos) veces.set(c, (veces.get(c) ?? 0) + 1);
      expect(Math.max(...veces.values())).toBeLessThanOrEqual(2);
    }
    expect(inv.contenedores.map((c) => c.code)).toContain('CT-belgrano-0001');
    expect(inv.arboles.map((t) => t.surveyCode)).toContain('ARB-villa-luro-90001');
  });

  it('es determinístico y el seed suma lo real a lo escrito a mano', () => {
    expect(cargarInventario()).toEqual(inv);
    expect(CONTAINERS.length).toBeGreaterThan(inv.contenedores.length);
    expect(TREES.length).toBeGreaterThanOrEqual(400);
  });

  it('los árboles traen especie científica y estado válido', () => {
    for (const t of inv.arboles) {
      expect(t.species).toMatch(/^[A-Z][a-z]+ /);
      expect(['HEALTHY', 'WEAKENED', 'DISEASED', 'DEAD']).toContain(t.healthStatus);
      expect(t.heightM).toBeGreaterThan(0);
      expect(t.diameterCm).toBeGreaterThan(0);
    }
  });
});
