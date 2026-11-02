import { DelayType } from '@prisma/client';
import { puntoEnGeometria } from '../src/common/utils/geo';
import { CONTENEDORES_A_MANO } from '../scripts/build-datos-ciudad';
import { SERVICE_TYPE_SPECIALTY } from '../src/modules/crews/crew-specialty';
import { CONTAINER_TRANSITIONS } from '../src/modules/containers/containers.service';
import {
  CONTAINERS,
  CLAVES_GENERADAS,
  CREWS,
  GREEN_POINTS,
  TREES,
  TIPO_ESPACIO,
  TOPE_SERVICIOS,
  especialidadDe,
  historialDeContenedores,
  nombreDePersona,
  organizacionDe,
  assertBaseSegura,
  planificar,
  rolesDeLaDemo,
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
    // El total baja con los días: se agenda desde hoy hasta el fin de la cursada.
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

describe('seed: especialidad y zona base de las cuadrillas (#455)', () => {
  it('todos los tipos que atiende una cuadrilla tienen especialidad en el mapa', () => {
    const sinMapa = CREWS.flatMap((c) => c.tipos).filter((t) => !SERVICE_TYPE_SPECIALTY[t]);
    expect(sinMapa).toEqual([]);
  });

  it('la especialidad derivada es null o cubre TODOS los tipos que atiende la cuadrilla', () => {
    for (const c of CREWS) {
      const esp = especialidadDe(c.tipos);
      if (esp === null) continue;
      for (const t of c.tipos)
        expect({ cuadrilla: c.clave, tipo: t, esp }).toEqual({
          cuadrilla: c.clave,
          tipo: t,
          esp: SERVICE_TYPE_SPECIALTY[t],
        });
    }
  });

  it('las cuadrillas mixtas quedan sin especialidad y las de un solo rubro la tienen', () => {
    const porClave = (k: string) => especialidadDe(CREWS.find((c) => c.clave === k)!.tipos);
    // PAL-REC mezcla recolección y barrido; COOP-PAL, reciclables y recolección de contenedores.
    expect(porClave('PAL-REC')).toBeNull();
    expect(porClave('COOP-PAL')).toBeNull();
    expect(porClave('ARBOLADO')).toBe('TREES');
    expect(porClave('INSP')).toBe('INSPECTION');
    expect(CREWS.some((c) => especialidadDe(c.tipos) === null)).toBe(true);
    expect(CREWS.some((c) => especialidadDe(c.tipos) !== null)).toBe(true);
  });

  it('la zona base solo existe para cuadrillas de una zona, y las hay de las dos clases', () => {
    expect(new Set(CREWS.map((c) => c.zonas.length === 1)).size).toBe(2);
  });
});

describe('seed: 480 cuadrillas por zona y especialidad (#455)', () => {
  const generadas = CREWS.filter((c) => CLAVES_GENERADAS.has(c.clave));

  it('hay 16 operativas y 480 generadas: 10 por barrio, con todas las especialidades', () => {
    expect(CREWS).toHaveLength(496);
    expect(generadas).toHaveLength(480);
    for (const b of BARRIOS) {
      const deZona = generadas.filter((c) => c.zonas[0] === b.codigo);
      expect(deZona).toHaveLength(10);
      expect(new Set(deZona.map((c) => especialidadDe(c.tipos)))).toEqual(
        new Set([
          'COLLECTION',
          'SWEEPING',
          'CLEANING',
          'RECYCLING',
          'TREES',
          'GREEN_SPACES',
          'INSPECTION',
        ]),
      );
    }
  });

  it('nombres de cuadrilla únicos y ids de persona desde 10000, sin repetir entre cuadrillas', () => {
    expect(new Set(CREWS.map((c) => c.name)).size).toBe(CREWS.length);
    const ids = CREWS.flatMap((c) => c.members);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(Number(id)).toBeGreaterThanOrEqual(10000);
    for (const c of generadas) {
      expect(c.members.length).toBeGreaterThanOrEqual(2);
      expect(c.members.length).toBeLessThanOrEqual(4);
    }
  });

  it('las personas de demostración existen en el seed', () => {
    const cuadrilla = (id: string) => CREWS.find((c) => c.members.includes(id))!;
    expect(cuadrilla('10000').clave).toBe('BEL-REC');
    expect(cuadrilla('10001').leaderUserId).toBe('10000');
    expect(especialidadDe(cuadrilla('10070').tipos)).toBe('INSPECTION');
  });
});

describe('seed: guard de base remota', () => {
  const remota = 'postgresql://u:p@db.supabase.co:5432/postgres?schema=public';
  it('acepta localhost, 127.0.0.1 y ::1', () => {
    for (const h of ['localhost:5433', '127.0.0.1:5432', '[::1]:5432'])
      expect(() => assertBaseSegura(`postgresql://m6:x@${h}/m6?schema=public`)).not.toThrow();
  });

  it('rechaza hosts remotos, trucos de subcadena y URL ausente o inválida', () => {
    for (const u of [
      remota,
      'postgresql://u:p@localhost.evil.com:5432/db',
      'postgresql://localhost:x@db.supabase.co:5432/db',
      'postgresql://u:p@db.supabase.co/localhost',
      'no es una url',
      undefined,
    ])
      expect(() => assertBaseSegura(u)).toThrow(/SEED_CONFIRM_REMOTE/);
  });

  it('SEED_CONFIRM_REMOTE=1 permite una remota; cualquier otro valor no', () => {
    expect(() => assertBaseSegura(remota, '1')).not.toThrow();
    expect(() => assertBaseSegura(remota, 'true')).toThrow();
  });
});

describe('seed: roles y personas de demostración', () => {
  const roles = rolesDeLaDemo();
  const de = (id: string) => roles.filter((r) => r.userId === id).map((r) => r.role);
  const conInspeccion = (c: (typeof CREWS)[number]) => c.tipos.includes('AMB-INSP');

  it('toda persona de una cuadrilla es de Campo; solo las de inspección son además inspectores', () => {
    for (const c of CREWS)
      for (const id of c.members) {
        expect(de(id)).toContain('M6_CAMPO_CUADRILLA');
        expect(de(id).includes('M6_CAMPO_INSPECTOR')).toBe(conInspeccion(c));
      }
  });

  it('10000 y 10001 son de Campo y 10070 también es inspector', () => {
    expect(de('10000')).toEqual(['M6_CAMPO_CUADRILLA']);
    expect(de('10001')).toEqual(['M6_CAMPO_CUADRILLA']);
    expect(de('10070').sort()).toEqual(['M6_CAMPO_CUADRILLA', 'M6_CAMPO_INSPECTOR']);
  });

  it('líder, integrante e inspector pertenecen a las cuadrillas que dice docs/seed.md', () => {
    const bel = CREWS.find((c) => c.clave === 'BEL-REC')!;
    expect(bel.name).toBe('Cuadrilla Municipal Belgrano y Colegiales — Recolección');
    expect(bel.leaderUserId).toBe('10000');
    expect(bel.members).toContain('10001');
    expect(bel.leaderUserId).not.toBe('10001');
    const insp = CREWS.find((c) => c.clave === 'INSP')!;
    expect(insp.leaderUserId).toBe('10070');
    expect(insp.members).toContain('10070');
    expect(especialidadDe(insp.tipos)).toBe('INSPECTION');
  });

  it('los members de las operativas siguen 10000 + 10 × posición', () => {
    CREWS.filter((c) => !CLAVES_GENERADAS.has(c.clave)).forEach((c, i) => {
      expect(c.leaderUserId).toBe(String(10000 + 10 * i));
      c.members.forEach((m, n) => expect(m).toBe(String(10000 + 10 * i + n)));
    });
  });
});

describe('seed: nombres de ejemplo de las cuadrillas (#454)', () => {
  it('el mismo id da siempre el mismo nombre, con nombre y apellido', () => {
    expect(nombreDePersona('10000')).toBe(nombreDePersona('10000'));
    expect(nombreDePersona('10000')).toMatch(/^\S+ \S+$/);
  });

  it('los integrantes de una misma cuadrilla no repiten nombre', () => {
    for (const c of CREWS) {
      const nombres = c.members.map(nombreDePersona);
      expect(new Set(nombres).size).toBe(nombres.length);
    }
  });

  it('el responsable figura entre los integrantes con el mismo nombre', () => {
    for (const c of CREWS) expect(c.members).toContain(c.leaderUserId);
  });

  it('solo las cuadrillas que no son municipales tienen nombre de organización', () => {
    for (const c of CREWS) {
      const org = organizacionDe(c);
      if (c.crewType === 'MUNICIPAL') expect(org).toBeNull();
      else expect(org).toMatch(/^Cooperativa de Recuperadores \S+/);
    }
    expect(organizacionDe({ crewType: 'COOPERATIVE', name: 'Coop X — Reciclables' } as never)).toBe(
      'Coop X',
    );
  });
});

describe('seed: historial de estados de los contenedores (#475)', () => {
  const filas = historialDeContenedores(CONTAINERS);
  const porCodigo = (codigo: string) => filas.filter((f) => f.code === codigo);
  const hoy = new Date();

  it('cada contenedor nace con una fila de alta (origen nulo, destino ACTIVE) antes que las demás', () => {
    for (const c of CONTAINERS) {
      const suyas = porCodigo(c.code);
      expect(suyas[0]).toMatchObject({ from: null, to: 'ACTIVE' });
      expect(suyas.filter((f) => f.from === null)).toHaveLength(1);
    }
  });

  it('las filas de cada contenedor son cronológicas y encadenan: el origen es el destino anterior', () => {
    for (const c of CONTAINERS) {
      const suyas = porCodigo(c.code);
      suyas.forEach((f, i) => {
        if (i === 0) return;
        expect(f.from).toBe(suyas[i - 1].to);
        expect(f.at.getTime()).toBeGreaterThan(suyas[i - 1].at.getTime());
      });
    }
  });

  it('solo hace transiciones que la máquina de estados permite', () => {
    for (const f of filas) {
      if (f.from === null) continue;
      expect(CONTAINER_TRANSITIONS[f.from]).toContain(f.to);
    }
  });

  it('termina en el estado que el contenedor tiene hoy, sin contradecirlo', () => {
    for (const c of CONTAINERS) {
      expect(porCodigo(c.code).at(-1)!.to).toBe(c.status ?? 'ACTIVE');
    }
  });

  it('cubre los once contenedores de demostración en sus estados finales', () => {
    const finales = CONTAINERS.filter((c) => c.status && c.status !== 'ACTIVE');
    expect(finales.length).toBeGreaterThanOrEqual(11);
    for (const c of finales) expect(porCodigo(c.code).length).toBeGreaterThan(1);
  });

  it('no inventa el futuro', () => {
    for (const f of filas) expect(f.at.getTime()).toBeLessThanOrEqual(hoy.getTime());
  });

  it('abarca varios meses de actividad, con desbordes, daños y reparaciones', () => {
    const mes = (f: { at: Date }) => f.at.toISOString().slice(0, 7);
    const desbordes = filas.filter((f) => f.from !== null && f.to === 'OVERFLOWED');
    const danios = filas.filter((f) => f.from !== null && f.to === 'DAMAGED');
    expect(new Set(desbordes.map(mes)).size).toBeGreaterThanOrEqual(4);
    expect(new Set(danios.map(mes)).size).toBeGreaterThanOrEqual(4);
    expect(filas.some((f) => f.to === 'UNDER_REPAIR')).toBe(true);
    const primera = Math.min(...filas.map((f) => f.at.getTime()));
    expect(hoy.getTime() - primera).toBeGreaterThan(120 * 86_400_000);
  });

  it('es determinístico: dos corridas dan las mismas filas', () => {
    expect(historialDeContenedores(CONTAINERS)).toEqual(filas);
  });
});
