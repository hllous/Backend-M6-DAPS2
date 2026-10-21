import { ConfigService } from '@nestjs/config';
import { CoreClient } from './core.client';
import { CoreRegistryService } from './core-registry.service';
import { ConsumedEvent } from '../events/inbox/consumed-events';
import { EventType } from '../events/event-types';

const CONSUMIDOS = Object.values(ConsumedEvent).filter((e) => e !== 'weatherAlertIssued');
const PUBLICADOS = Object.values(EventType);
const TOTAL = CONSUMIDOS.length + PUBLICADOS.length;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

interface CoreSimulado {
  core: CoreClient;
  request: jest.Mock;
  posts: { path: string; body: Record<string, unknown> }[];
}

/** Un Core simulado con estado: lo que se hace POST aparece en el siguiente GET. */
function coreSimulado(
  inicial: { subs?: string[]; pubs?: string[] } = {},
  falla?: (path: string, method: string) => boolean,
): CoreSimulado {
  const subs = (inicial.subs ?? []).map((eventType) => ({ eventType, maxAttempts: 4 }));
  const pubs = (inicial.pubs ?? []).map((eventType) => ({ eventType }));
  const posts: CoreSimulado['posts'] = [];
  const request = jest.fn((path: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET';
    if (falla?.(path, method)) return Promise.resolve(json({}, 503));
    if (method === 'GET') {
      return Promise.resolve(json(path.endsWith('subscriptions') ? subs : { data: pubs }));
    }
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    posts.push({ path, body });
    (path.endsWith('subscriptions') ? subs : pubs).push(body as never);
    return Promise.resolve(json(body, 201));
  });
  return { core: { enabled: true, request } as unknown as CoreClient, request, posts };
}

function servicio(core: CoreClient, cfg: Record<string, unknown> = {}) {
  const config = {
    get: (k: string, def?: unknown) => (k in cfg ? cfg[k] : def),
  } as unknown as ConfigService;
  return new CoreRegistryService(core, config);
}

describe('CoreRegistryService', () => {
  afterEach(() => jest.useRealTimers());

  it('registra lo que sale del código: 8 suscripciones (sin weatherAlertIssued) y 6 publicaciones', async () => {
    const { core, posts } = coreSimulado();
    const res = await servicio(core).sync();

    expect(CONSUMIDOS).toHaveLength(8);
    expect(PUBLICADOS).toHaveLength(6);
    expect([...res.suscripcionesCreadas].sort()).toEqual([...CONSUMIDOS].sort());
    expect([...res.publicacionesCreadas].sort()).toEqual([...PUBLICADOS].sort());
    const subs = posts.filter((p) => p.path === '/api/v1/subscriptions');
    expect(subs.every((p) => p.body.maxAttempts === 4)).toBe(true);
    expect(posts.map((p) => p.body.eventType)).not.toContain('weatherAlertIssued');
  });

  it('maxAttempts es configurable', async () => {
    const { core, posts } = coreSimulado();
    await servicio(core, { 'core.subscriptionMaxAttempts': 6 }).sync();
    expect(posts.find((p) => p.path.endsWith('subscriptions'))?.body.maxAttempts).toBe(6);
  });

  it('correrlo dos veces no duplica nada', async () => {
    const { core, posts } = coreSimulado();
    const s = servicio(core);
    await s.sync();
    const antes = posts.length;
    const res = await s.sync();

    expect(posts).toHaveLength(antes);
    expect(res.suscripcionesCreadas).toEqual([]);
    expect(res.publicacionesCreadas).toEqual([]);
  });

  it('crea solo lo que falta y loguea lo que sobra sin borrarlo', async () => {
    const { core, request } = coreSimulado({
      subs: ['ticketUpdated'],
      pubs: ['zoneNotServiced', 'containerDamaged'],
    });
    const res = await servicio(core).sync();

    expect(res.suscripcionesCreadas).not.toContain('ticketUpdated');
    expect(res.publicacionesCreadas).not.toContain('containerDamaged');
    expect(res.sobrantes).toEqual(['publicación zoneNotServiced']);
    expect(
      request.mock.calls.some(([, i]) => (i as RequestInit | undefined)?.method === 'DELETE'),
    ).toBe(false);
  });

  it('un error HTTP o una respuesta que no es lista falla sin crear nada a ciegas', async () => {
    await expect(servicio(coreSimulado({}, () => true).core).sync()).rejects.toThrow(/HTTP 503/);

    const raro = { enabled: true, request: jest.fn().mockResolvedValue(json({ ok: 1 })) };
    await expect(servicio(raro as unknown as CoreClient).sync()).rejects.toThrow(/no es una lista/);
    expect(raro.request).toHaveBeenCalledTimes(1);

    const { core } = coreSimulado({}, (_p, m) => m === 'POST');
    await expect(servicio(core).sync()).rejects.toThrow(/POST .* HTTP 503/);
  });

  describe('al arrancar', () => {
    it('sin CORE_API_URL no hace nada', () => {
      const request = jest.fn();
      servicio({ enabled: false, request } as unknown as CoreClient).onApplicationBootstrap();
      expect(request).not.toHaveBeenCalled();
    });

    it('CORE_REGISTER_ON_BOOT=false lo apaga', () => {
      const { core, request } = coreSimulado();
      servicio(core, { 'core.registerOnBoot': false }).onApplicationBootstrap();
      expect(request).not.toHaveBeenCalled();
    });

    it('no bloquea el arranque y termina de registrar', async () => {
      const { core, posts } = coreSimulado();
      servicio(core).onApplicationBootstrap();
      await new Promise((r) => setTimeout(r, 20));
      expect(posts).toHaveLength(TOTAL);
    });

    it('una falla del Core no tira la app: se reintenta con backoff y se completa', async () => {
      jest.useFakeTimers();
      let caido = true;
      const { core, posts } = coreSimulado({}, () => caido);
      const s = servicio(core);
      expect(() => s.onApplicationBootstrap()).not.toThrow();
      await jest.advanceTimersByTimeAsync(0);
      expect(posts).toHaveLength(0);

      caido = false;
      await jest.advanceTimersByTimeAsync(5_000);
      expect(posts).toHaveLength(TOTAL);
      s.onModuleDestroy();
    });

    it('abandona tras los intentos máximos', async () => {
      jest.useFakeTimers();
      const { core, request } = coreSimulado({}, () => true);
      servicio(core).onApplicationBootstrap();
      await jest.advanceTimersByTimeAsync(2_000_000);
      // Un GET por intento: falla antes de pedir el segundo.
      expect(request).toHaveBeenCalledTimes(6);
    });

    it('no reintenta después de cerrar la app', async () => {
      jest.useFakeTimers();
      const { core, request } = coreSimulado({}, () => true);
      const s = servicio(core);
      s.onApplicationBootstrap();
      await jest.advanceTimersByTimeAsync(0);
      s.onModuleDestroy();
      await jest.advanceTimersByTimeAsync(2_000_000);
      expect(request).toHaveBeenCalledTimes(1);
    });
  });
});
