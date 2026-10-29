import { PrismaClient } from '@prisma/client';
import { CoreClient } from './core.client';
import {
  CatalogoM9,
  cargarDesdeCore,
  cargarSnapshot,
  syncZones,
  validarCatalogo,
  validarOpcionesCli,
} from './zones-sync';

const U1 = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';
const U3 = '33333333-3333-4333-8333-333333333333';

const catalogo = (): CatalogoM9 => ({
  zonas: [
    { id: 'a', codigo: 'comuna-1', nombre: 'Comuna 1', activo: true },
    { id: 'b', codigo: 'comuna-2', nombre: 'Comuna 2', activo: true },
    { id: 'c', codigo: 'norte', nombre: 'Zona Norte', activo: false },
  ],
  barrios: [
    {
      id: U1,
      codigo: 'retiro',
      nombre: 'Retiro',
      zona: 'comuna-1',
      zonaNombre: 'C1',
      activo: true,
    },
    {
      id: U2,
      codigo: 'ficticio',
      nombre: 'Ficticio',
      zona: 'norte',
      zonaNombre: 'N',
      activo: false,
    },
    {
      id: U3,
      codigo: 'recoleta',
      nombre: 'Recoleta',
      zona: 'comuna-9',
      zonaNombre: 'C9',
      activo: true,
    },
  ],
});

const count = {
  routeStops: 0,
  serviceZones: 0,
  zoneResults: 0,
  containers: 0,
  greenPoints: 0,
  trees: 0,
  greenSpaces: 0,
};

function mkPrisma(communes: unknown[] = [], zones: unknown[] = []) {
  const prisma = {
    commune: {
      findMany: jest.fn().mockResolvedValue(communes),
      create: jest
        .fn()
        .mockImplementation(({ data }: { data: { code: string } }) =>
          Promise.resolve({ id: `c-${data.code}` }),
        ),
      update: jest.fn().mockResolvedValue({}),
    },
    zone: {
      findMany: jest.fn().mockResolvedValue(zones),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    },
    zoneNeighborhood: { delete: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((cb: (tx: unknown) => unknown) => cb(prisma));
  return prisma;
}
const run = (p: ReturnType<typeof mkPrisma>, c = catalogo(), o = {}) =>
  syncZones(p as unknown as PrismaClient, c, o);

const zonaDb = (over: Record<string, unknown> = {}) => ({
  id: 'z1',
  code: 'retiro',
  name: 'Retiro',
  active: true,
  communeId: 'c1',
  neighborhoods: [{ neighborhoodId: U1 }],
  _count: count,
  ...over,
});

describe('syncZones', () => {
  it('crea comunas activas y una zona por barrio activo; ignora ficticios y comuna ausente', async () => {
    const p = mkPrisma();
    const r = await run(p);
    expect(r.communes).toEqual({ creadas: 2, actualizadas: 0, sinCambios: 0 });
    expect(p.commune.create).toHaveBeenCalledTimes(2);
    expect(p.zone.create).toHaveBeenCalledTimes(1);
    expect(p.zone.create.mock.calls[0][0].data).toMatchObject({
      code: 'retiro',
      communeId: 'c-comuna-1',
      neighborhoods: { create: { neighborhoodId: U1 } },
    });
    expect(r.zones.creadas).toBe(1);
    expect(r.sinComuna).toEqual(['recoleta (comuna-9)']);
  });

  it('es idempotente: la segunda corrida no cambia nada', async () => {
    const p = mkPrisma(
      [
        { id: 'c1', code: 'comuna-1', number: 1, name: 'Comuna 1', active: true },
        { id: 'c2', code: 'comuna-2', number: 2, name: 'Comuna 2', active: true },
      ],
      [zonaDb()],
    );
    const r = await run(p);
    expect(r.communes.sinCambios).toBe(2);
    expect(r.zones).toEqual({
      creadas: 0,
      actualizadas: 0,
      desactivadas: 0,
      desactivadasConDatos: 0,
      sinCambios: 1,
    });
    expect(p.zone.create).not.toHaveBeenCalled();
    expect(p.zone.update).not.toHaveBeenCalled();
    expect(p.commune.update).not.toHaveBeenCalled();
  });

  it('actualiza nombre, comuna, reactivación y el vínculo faltante', async () => {
    const p = mkPrisma(
      [{ id: 'c1', code: 'comuna-1', number: 1, name: 'vieja', active: false }],
      [zonaDb({ name: 'Otro', active: false, neighborhoods: [] })],
    );
    const r = await run(p);
    expect(r.communes.actualizadas).toBe(1);
    expect(r.zones.actualizadas).toBe(1);
    expect(p.zone.update.mock.calls[0][0].data).toMatchObject({
      name: 'Retiro',
      active: true,
      neighborhoods: { create: { neighborhoodId: U1 } },
    });
  });

  it('desactiva (nunca borra) la zona de un barrio dado de baja', async () => {
    const c = catalogo();
    c.barrios[0].activo = false;
    const p = mkPrisma(
      [{ id: 'c1', code: 'comuna-1', number: 1, name: 'Comuna 1', active: true }],
      [zonaDb()],
    );
    const r = await run(p, c);
    expect(r.zones.desactivadas).toBe(1);
    expect(p.zone.update).toHaveBeenCalledWith({ where: { id: 'z1' }, data: { active: false } });
  });

  it('una zona ya inactiva de un barrio inactivo queda sin cambios', async () => {
    const c = catalogo();
    c.barrios[0].activo = false;
    const p = mkPrisma([], [zonaDb({ active: false })]);
    const r = await run(p, c);
    expect(r.zones.sinCambios).toBe(1);
    expect(p.zone.update).not.toHaveBeenCalled();
  });

  it('no pisa una zona con el mismo code pero otros barrios: la reporta', async () => {
    const p = mkPrisma([], [zonaDb({ neighborhoods: [{ neighborhoodId: 'caba-retiro' }] })]);
    const r = await run(p);
    expect(r.conflictos).toHaveLength(1);
    expect(p.zone.update).not.toHaveBeenCalled();
    expect(p.zone.create).not.toHaveBeenCalled();
  });

  it('completa el número de la comuna al crearla y al corregirla', async () => {
    const p = mkPrisma([{ id: 'c1', code: 'comuna-1', number: 0, name: 'Comuna 1', active: true }]);
    const r = await run(p);
    expect(p.commune.create.mock.calls[0][0].data).toMatchObject({ code: 'comuna-2', number: 2 });
    expect(r.communes.actualizadas).toBe(1);
    expect(p.commune.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { name: 'Comuna 1', number: 1, active: true },
    });
  });

  it('aborta si una zona activa de M9 no tiene el formato comuna-N', async () => {
    const c = catalogo();
    c.zonas.push({ id: 'd', codigo: 'centro', nombre: 'Centro', activo: true });
    await expect(run(mkPrisma(), c)).rejects.toThrow('comuna-N');
  });

  it('comuna sin barrios: se crea igual', async () => {
    const p = mkPrisma();
    await run(p);
    expect(p.commune.create.mock.calls.map((c) => c[0].data.code)).toContain('comuna-2');
  });

  it('dry-run no escribe ni abre transacción, pero planifica', async () => {
    const p = mkPrisma();
    const r = await run(p, catalogo(), { dryRun: true });
    expect(r.dryRun).toBe(true);
    expect(r.communes.creadas).toBe(2);
    expect(r.zones.creadas).toBe(1);
    expect(p.$transaction).not.toHaveBeenCalled();
    expect(p.commune.create).not.toHaveBeenCalled();
    expect(p.zone.create).not.toHaveBeenCalled();
  });

  it('dry-run de actualizaciones y bajas tampoco escribe', async () => {
    const c = catalogo();
    c.barrios[0].activo = false;
    const p = mkPrisma(
      [{ id: 'c1', code: 'comuna-1', number: 1, name: 'x', active: true }],
      [zonaDb()],
    );
    const r = await run(p, c, { dryRun: true, cleanLegacy: true });
    expect(r.communes.actualizadas).toBe(1);
    expect(r.zones.desactivadas).toBe(1);
    expect(p.commune.update).not.toHaveBeenCalled();
    expect(p.zone.update).not.toHaveBeenCalled();
  });

  describe('legacy', () => {
    const legacy = () => [
      zonaDb(),
      {
        id: 'z2',
        code: 'Z-PAL',
        name: 'Palermo',
        active: true,
        communeId: null,
        neighborhoods: [{ neighborhoodId: 'caba-palermo' }],
        _count: count,
      },
      {
        id: 'z3',
        code: 'Z-USO',
        name: 'Con uso',
        active: true,
        communeId: null,
        neighborhoods: [{ neighborhoodId: 'caba-uso' }],
        _count: { ...count, serviceZones: 2 },
      },
    ];

    it('por defecto solo reporta', async () => {
      const p = mkPrisma([], legacy());
      const r = await run(p);
      expect(r.zonasLegacy).toEqual(['Z-PAL', 'Z-USO']);
      expect(r.legacyRows.map((l) => [l.zoneCode, l.retenida])).toEqual([
        ['Z-PAL', false],
        ['Z-USO', true],
      ]);
      expect(r.legacyEliminadas).toBe(0);
      expect(p.zoneNeighborhood.delete).not.toHaveBeenCalled();
    });

    it('con cleanLegacy borra solo filas sin uso, nunca zonas', async () => {
      const p = mkPrisma([], legacy());
      const r = await run(p, catalogo(), { cleanLegacy: true });
      expect(r.legacyEliminadas).toBe(1);
      expect(p.zoneNeighborhood.delete).toHaveBeenCalledTimes(1);
      expect(p.zoneNeighborhood.delete).toHaveBeenCalledWith({
        where: { zoneId_neighborhoodId: { zoneId: 'z2', neighborhoodId: 'caba-palermo' } },
      });
    });
  });
});

describe('validarCatalogo', () => {
  it.each([
    ['barrios vacíos', { barrios: [], zonas: catalogo().zonas }],
    ['barrio mal formado', { barrios: [{ id: U1 }], zonas: catalogo().zonas }],
    ['zonas mal formadas', { barrios: catalogo().barrios, zonas: [{}] }],
    ['no es lista', { barrios: {}, zonas: null }],
  ])('rechaza %s', (_n, raw) => {
    expect(() => validarCatalogo(raw)).toThrow(/inválido/);
  });

  it('rechaza ids que no son UUID, repetidos o códigos repetidos', () => {
    const c = catalogo();
    expect(() =>
      validarCatalogo({ ...c, barrios: [{ ...c.barrios[0], id: 'caba-retiro' }] }),
    ).toThrow(/UUID/);
    expect(() => validarCatalogo({ ...c, barrios: [c.barrios[0], c.barrios[0]] })).toThrow(/UUID/);
    expect(() =>
      validarCatalogo({ ...c, barrios: [c.barrios[0], { ...c.barrios[1], codigo: 'retiro' }] }),
    ).toThrow(/códigos repetidos/);
  });
});

describe('snapshot versionado', () => {
  const { barrios, zonas } = cargarSnapshot();
  const activos = barrios.filter((b) => b.activo);

  it('tiene 48 barrios activos y 15 comunas activas', () => {
    expect(activos).toHaveLength(48);
    expect(zonas.filter((z) => z.activo)).toHaveLength(15);
  });

  it('cada barrio activo apunta a una comuna activa del snapshot', () => {
    const comunas = new Set(zonas.filter((z) => z.activo).map((z) => z.codigo));
    expect(activos.filter((b) => !comunas.has(b.zona))).toEqual([]);
  });

  it('ids UUID únicos (barrios y zonas)', () => {
    const ids = [...barrios, ...zonas].map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('cargarDesdeCore', () => {
  const resp = (body: unknown, ok = true) =>
    Promise.resolve({ ok, status: ok ? 200 : 500, json: () => Promise.resolve(body) });
  const core = (fn: (p: string) => Promise<unknown>) =>
    ({ request: jest.fn(fn) }) as unknown as CoreClient;
  const c = catalogo();

  it('lee barrios y zonas, en lista o en { data }', async () => {
    const r = await cargarDesdeCore(
      core((p) => resp(p.endsWith('barrios') ? c.barrios : { data: c.zonas })),
    );
    expect(r.barrios).toHaveLength(3);
    expect(r.zonas).toHaveLength(3);
  });

  it('falla ante HTTP de error', async () => {
    await expect(cargarDesdeCore(core(() => resp([], false)))).rejects.toThrow(/HTTP 500/);
  });

  it('falla ante una respuesta paginada o con cuerpo inválido', async () => {
    await expect(cargarDesdeCore(core(() => resp({ data: c.barrios, total: 99 })))).rejects.toThrow(
      /paginada/,
    );
    await expect(cargarDesdeCore(core(() => resp({ data: c.barrios, next: 'x' })))).rejects.toThrow(
      /paginada/,
    );
    await expect(
      cargarDesdeCore(
        core(() => Promise.resolve({ ok: true, json: () => Promise.reject(new Error('x')) })),
      ),
    ).rejects.toThrow(/inválido/);
  });
});

describe('syncZones: casos de la ronda 1', () => {
  const sinUso = (id: string, ns: string[]) => ({
    id,
    code: `L-${id}`,
    name: 'x',
    active: true,
    communeId: null,
    neighborhoods: ns.map((neighborhoodId) => ({ neighborhoodId })),
    _count: {
      routeStops: 0,
      serviceZones: 0,
      zoneResults: 0,
      containers: 0,
      greenPoints: 0,
      trees: 0,
      greenSpaces: 0,
    },
  });

  it('cleanLegacy + dryRun reporta retenida y no borra nada', async () => {
    const p = mkPrisma(
      [],
      [
        sinUso('z2', ['caba-x']),
        {
          ...sinUso('z3', ['caba-y']),
          _count: {
            routeStops: 1,
            serviceZones: 0,
            zoneResults: 0,
            containers: 0,
            greenPoints: 0,
            trees: 0,
            greenSpaces: 0,
          },
        },
      ],
    );
    const r = await run(p, catalogo(), { dryRun: true, cleanLegacy: true });
    expect(r.legacyRows.map((l) => l.retenida)).toEqual([false, true]);
    expect(r.legacyEliminadas).toBe(0);
    expect(p.zoneNeighborhood.delete).not.toHaveBeenCalled();
  });

  it('un UUID ausente del catálogo se reporta pero cleanLegacy no lo borra', async () => {
    const real = '99999999-9999-4999-8999-999999999999';
    const p = mkPrisma([], [sinUso('z2', [real, 'barrio-viejo'])]);
    const r = await run(p, catalogo(), { cleanLegacy: true });
    expect(r.legacyRows).toHaveLength(2);
    expect(r.legacyEliminadas).toBe(1);
    expect(p.zoneNeighborhood.delete).toHaveBeenCalledTimes(1);
    expect(
      p.zoneNeighborhood.delete.mock.calls[0][0].where.zoneId_neighborhoodId.neighborhoodId,
    ).toBe('barrio-viejo');
  });

  it('cuenta aparte la zona desactivada que tiene datos asociados', async () => {
    const c = catalogo();
    c.barrios[0].activo = false;
    const conDatos = zonaDb({ _count: { ...count, serviceZones: 3 } });
    const p = mkPrisma([], [conDatos]);
    const r = await run(p, c);
    expect(r.zones.desactivadasConDatos).toBe(1);
    expect(r.zones.desactivadas).toBe(0);
    expect(p.zone.update).toHaveBeenCalledWith({ where: { id: 'z1' }, data: { active: false } });
  });
});

describe('validarOpcionesCli', () => {
  it('rechaza --clean-legacy con --from-snapshot', () => {
    expect(() => validarOpcionesCli({ cleanLegacy: true }, true)).toThrow(/--clean-legacy/);
  });
  it('acepta el resto de las combinaciones', () => {
    expect(() => validarOpcionesCli({ cleanLegacy: true }, false)).not.toThrow();
    expect(() => validarOpcionesCli({ cleanLegacy: false }, true)).not.toThrow();
  });
});

describe('cargarDesdeCore: marcas de paginación', () => {
  it.each([
    [{ page: 1 }],
    [{ limit: 50 }],
    [{ totalPages: 2 }],
    [{ hasNext: true }],
    [{ hasMore: true }],
  ])('aborta con %j', async (marca) => {
    const core = {
      request: jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: catalogo().barrios, ...marca }),
      }),
    } as unknown as CoreClient;
    await expect(cargarDesdeCore(core)).rejects.toThrow(/paginada/);
  });
});
