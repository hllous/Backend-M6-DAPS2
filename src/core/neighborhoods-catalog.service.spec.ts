import { CoreClient } from './core.client';
import { NeighborhoodsCatalogService } from './neighborhoods-catalog.service';

// Fixtures con el formato de M9 (GET /api/v1/catalogos/barrios); ids inventados.
const PALERMO = {
  id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  codigo: 'palermo',
  nombre: 'Palermo',
  zona: 'comuna-14',
  zonaNombre: 'Comuna 14',
  metadatos: {},
  activo: true,
};
const BALVANERA = {
  id: '0b8f1a52-3c4d-4e6f-9a1b-2c3d4e5f6a7b',
  codigo: 'balvanera',
  nombre: 'Balvanera',
  zona: 'comuna-3',
  zonaNombre: 'Comuna 3',
  metadatos: null,
  activo: false,
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function crear(request: jest.Mock, enabled = true) {
  return new NeighborhoodsCatalogService({ enabled, request } as unknown as CoreClient);
}

describe('NeighborhoodsCatalogService', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('lee el catálogo al arrancar y filtra por activo, comuna y texto', async () => {
    const request = jest.fn().mockResolvedValue(json([PALERMO, BALVANERA, { basura: 1 }]));
    const s = crear(request);
    s.onApplicationBootstrap();
    await jest.advanceTimersByTimeAsync(0);

    expect(request).toHaveBeenCalledWith('/api/v1/catalogos/barrios');
    expect(s.disponible).toBe(true);
    expect(s.list()).toHaveLength(2);
    expect(s.list({ soloActivos: true })).toEqual([PALERMO]);
    expect(s.list({ zona: 'comuna-3' })).toEqual([BALVANERA]);
    expect(s.list({ q: ' PALER ' })).toEqual([PALERMO]);
    expect(s.existe(PALERMO.id)).toBe(true);
    expect(s.existe('otro')).toBe(false);
    s.onModuleDestroy();
  });

  it('acepta la respuesta envuelta en { data }', async () => {
    const s = crear(jest.fn().mockResolvedValue(json({ data: [PALERMO] })));
    await s.refrescar();
    expect(s.list()).toEqual([PALERMO]);
    s.onModuleDestroy();
  });

  it('sin CORE_API_URL no pide nada y queda no disponible', () => {
    const request = jest.fn();
    const s = crear(request, false);
    s.onApplicationBootstrap();

    expect(request).not.toHaveBeenCalled();
    expect(s.disponible).toBe(false);
    expect(s.existe('x')).toBeUndefined();
    expect(s.list()).toEqual([]);
  });

  it('si el Core falla no tira la app y reintenta al minuto', async () => {
    const request = jest
      .fn()
      .mockResolvedValueOnce(json({}, 503))
      .mockRejectedValueOnce(new Error('red'))
      .mockResolvedValueOnce(json({ ok: 1 }))
      .mockResolvedValue(json([PALERMO]));
    const s = crear(request);
    s.onApplicationBootstrap();
    await jest.advanceTimersByTimeAsync(0);
    expect(s.disponible).toBe(false);

    await jest.advanceTimersByTimeAsync(60_000);
    await jest.advanceTimersByTimeAsync(60_000);
    await jest.advanceTimersByTimeAsync(60_000);
    expect(request).toHaveBeenCalledTimes(4);
    expect(s.disponible).toBe(true);
    s.onModuleDestroy();
  });

  it('una renovación fallida conserva el catálogo anterior', async () => {
    const request = jest
      .fn()
      .mockResolvedValueOnce(json([PALERMO]))
      .mockResolvedValue(json({}, 500));
    const s = crear(request);
    await s.refrescar();
    await s.refrescar();

    expect(s.list()).toEqual([PALERMO]);
    s.onModuleDestroy();
  });

  it('cerrada la app no vuelve a agendar', async () => {
    const request = jest.fn().mockResolvedValue(json([PALERMO]));
    const s = crear(request);
    s.onModuleDestroy();
    await s.refrescar();
    await jest.advanceTimersByTimeAsync(7 * 3600_000);

    expect(request).toHaveBeenCalledTimes(1);
  });
});
