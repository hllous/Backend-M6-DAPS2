import { ConfigService } from '@nestjs/config';
import { CoreClient } from './core.client';

const SECRET = 'secreto-de-maquina-m6';
const TOKEN_URL = 'https://core.test/api/v1/auth/module-token';

function cliente(core: Record<string, unknown> = {}) {
  const config = {
    getOrThrow: () => ({
      apiUrl: 'https://core.test/',
      moduleId: 'ambiente',
      moduleSecret: SECRET,
      ...core,
    }),
  } as unknown as ConfigService;
  return new CoreClient(config);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function token(accessToken: string, expiresIn = 900): Response {
  return json({ accessToken, tokenType: 'Bearer', expiresIn, kind: 'module' });
}

/** Los pedidos de token que llegaron al Core. */
function pedidosDeToken(fetchMock: jest.Mock): unknown[] {
  return fetchMock.mock.calls.filter(([url]) => url === TOKEN_URL);
}

describe('CoreClient', () => {
  const fetchOriginal = global.fetch;
  let fetchMock: jest.Mock;

  afterAll(() => {
    global.fetch = fetchOriginal;
  });

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('pide el token con el módulo y el secret, y lo cachea', async () => {
    fetchMock.mockResolvedValueOnce(token('t1'));
    const core = cliente();

    expect(await core.getToken()).toBe('t1');
    expect(await core.getToken()).toBe('t1');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(TOKEN_URL);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ module: 'ambiente', secret: SECRET });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('llamadas concurrentes comparten un solo pedido', async () => {
    fetchMock.mockResolvedValueOnce(token('t1'));
    const core = cliente();

    expect(await Promise.all([core.getToken(), core.getToken(), core.getToken()])).toEqual([
      't1',
      't1',
      't1',
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  /** Sin refresh: se pide otro un minuto antes de que venza. */
  it('renueva el token un minuto antes del vencimiento', async () => {
    jest.useFakeTimers({ now: 0 });
    fetchMock.mockResolvedValueOnce(token('t1')).mockResolvedValueOnce(token('t2'));
    const core = cliente();

    expect(await core.getToken()).toBe('t1');
    jest.setSystemTime(13 * 60_000);
    expect(await core.getToken()).toBe('t1');
    jest.setSystemTime(14 * 60_000);
    expect(await core.getToken()).toBe('t2');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('agrega el Bearer y, ante un 401, renueva el token y reintenta una vez', async () => {
    fetchMock
      .mockResolvedValueOnce(token('viejo'))
      .mockResolvedValueOnce(json({}, 401))
      .mockResolvedValueOnce(token('nuevo'))
      .mockResolvedValueOnce(json({ ok: true }));
    const core = cliente();

    const res = await core.request('/api/v1/catalog', { headers: { Accept: 'application/json' } });

    expect(res.status).toBe(200);
    expect(pedidosDeToken(fetchMock)).toHaveLength(2);
    const llamadas = fetchMock.mock.calls.filter(([url]) => url !== TOKEN_URL) as [
      string,
      RequestInit,
    ][];
    expect(llamadas.map(([url]) => url)).toEqual([
      'https://core.test/api/v1/catalog',
      'https://core.test/api/v1/catalog',
    ]);
    const auth = llamadas.map(([, init]) => new Headers(init.headers).get('Authorization'));
    expect(auth).toEqual(['Bearer viejo', 'Bearer nuevo']);
    expect(new Headers(llamadas[0][1].headers).get('Accept')).toBe('application/json');
    expect(await core.getToken()).toBe('nuevo');
  });

  it('no reintenta más de una vez si el 401 sigue', async () => {
    fetchMock
      .mockResolvedValueOnce(token('t1'))
      .mockResolvedValueOnce(json({}, 401))
      .mockResolvedValueOnce(token('t2'))
      .mockResolvedValueOnce(json({}, 401));

    expect((await cliente().request('/x')).status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('otras respuestas se devuelven tal cual, sin pedir otro token', async () => {
    fetchMock.mockResolvedValueOnce(token('t1')).mockResolvedValueOnce(json({}, 403));

    expect((await cliente().request('/x')).status).toBe(403);
    expect(pedidosDeToken(fetchMock)).toHaveLength(1);
  });

  /** Un pedido fallido no puede quedar cacheado. */
  it('si el Core rechaza el pedido, falla sin el secret y el siguiente reintenta', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ secret: SECRET }, 401))
      .mockResolvedValueOnce(token('t1'));
    const core = cliente();

    const error = await core.getToken().catch((e: Error) => e);
    expect((error as Error).message).toMatch(/HTTP 401/);
    expect((error as Error).message).not.toContain(SECRET);
    expect(await core.getToken()).toBe('t1');
  });

  it('un error de red o timeout no arrastra el secret al mensaje', async () => {
    fetchMock.mockRejectedValueOnce(
      Object.assign(new Error(`falló el POST con ${SECRET}`), { name: 'TimeoutError' }),
    );

    const error = (await cliente()
      .getToken()
      .catch((e: Error) => e)) as Error;
    expect(error.message).toMatch(/TimeoutError/);
    expect(error.message).not.toContain(SECRET);
  });

  it('rechaza una respuesta sin accessToken', async () => {
    fetchMock.mockResolvedValueOnce(json({ expiresIn: 900 }));

    await expect(cliente().getToken()).rejects.toThrow(/sin accessToken/);
  });

  it('un body que no es JSON no cita el texto recibido en el error', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"accessToken":"eyJ.secreto'));

    const error = (await cliente()
      .getToken()
      .catch((e: Error) => e)) as Error;
    expect(error.message).toMatch(/sin accessToken/);
    expect(error.message).not.toContain('eyJ');
  });

  /** Sin URL la app arranca: el error aparece recién si alguien lo usa. */
  it('sin CORE_API_URL queda deshabilitado y no llama a nada', async () => {
    const core = cliente({ apiUrl: undefined, moduleSecret: undefined });

    expect(core.enabled).toBe(false);
    await expect(core.request('/x')).rejects.toThrow(/deshabilitado/);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(cliente().enabled).toBe(true);
  });
});
