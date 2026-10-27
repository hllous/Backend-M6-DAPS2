import { puntoEnGeometria } from '../src/common/utils/geo';
import { TIPO_ESPACIO, TOPE_SERVICIOS, planificar, verificar, verificarCobertura } from './seed';
import {
  BARRIOS,
  ESPACIOS,
  MIN_ARBOLES,
  MIN_CONTENEDORES,
  cargarPoligonos,
  generarInventario,
} from './seed-lugares';

const SIN_INVENTARIO = {
  contenedores: new Map<string, number>(),
  puntosVerdes: new Map<string, number>(),
  arboles: new Map<string, number>(),
};

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
  });

  it('toda comuna tiene recorridos y servicios, y todo barrio inventario', () => {
    expect(verificarCobertura(planes)).toEqual([]);
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

describe('seed: inventario generado', () => {
  const poligonos = cargarPoligonos();
  const inv = generarInventario(poligonos, SIN_INVENTARIO);

  it('cubre todos los barrios con los mínimos', () => {
    for (const b of BARRIOS) {
      expect(inv.contenedores.filter((c) => c.zone === b.codigo).length).toBeGreaterThanOrEqual(
        MIN_CONTENEDORES,
      );
      expect(inv.arboles.filter((t) => t.zone === b.codigo).length).toBeGreaterThanOrEqual(
        MIN_ARBOLES,
      );
      expect(inv.puntosVerdes.some((g) => g.zone === b.codigo)).toBe(true);
      expect(ESPACIOS.some((e) => e.barrio === b.codigo)).toBe(true);
    }
  });

  it('cada punto cae dentro del polígono de su barrio', () => {
    const todos = [...inv.contenedores, ...inv.puntosVerdes, ...inv.arboles];
    for (const x of todos) {
      expect(puntoEnGeometria([x.lng, x.lat], poligonos.get(x.zone)!)).toBe(true);
    }
  });

  it('es determinístico y no repite códigos', () => {
    expect(generarInventario(poligonos, SIN_INVENTARIO)).toEqual(inv);
    const codigos = [
      ...inv.contenedores.map((c) => c.code),
      ...inv.arboles.map((t) => t.surveyCode),
    ];
    expect(new Set(codigos).size).toBe(codigos.length);
  });

  it('completa solo lo que falta cuando ya hay inventario cargado', () => {
    const completo = new Map(BARRIOS.map((b) => [b.codigo, 99]));
    const vacio = generarInventario(poligonos, {
      contenedores: completo,
      puntosVerdes: completo,
      arboles: completo,
    });
    expect(vacio).toEqual({ contenedores: [], puntosVerdes: [], arboles: [] });
  });
});
