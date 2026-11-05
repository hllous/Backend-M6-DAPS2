import { ConfigService } from '@nestjs/config';
import { CoreClient } from '../core/core.client';
import { IdentityUnavailableError } from './identity.port';
import { M1IdentityClient } from './m1-identity.client';

const TOKEN = 'module-token-secreto';
const BASE = 'https://m1.test';
const UUID = '3f2b8a52-6d0e-4b8e-9d57-0f0a9d2c1e11';
const ACTOR = {
  sub: '1042',
  actorType: 'EMPLEADO',
  actorId: '3f2b8a52-6d0e-4b8e-9d57-0f0a9d2c1e11',
  nombre: 'Ana',
  apellido: 'Pérez',
  estado: 'ACTIVO',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('M1IdentityClient', () => {
  const fetchOriginal = global.fetch;
  let fetchMock: jest.Mock;
  let core: { getToken: jest.Mock };

  const cliente = (baseUrl?: string) =>
    new M1IdentityClient(
      { getOrThrow: () => ({ baseUrl }) } as unknown as ConfigService,
      core as unknown as CoreClient,
    );

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock;
    core = { getToken: jest.fn().mockResolvedValue(TOKEN) };
  });
  afterAll(() => {
    global.fetch = fetchOriginal;
  });

  it('actores: 200 devuelve el registro, con el module-token como Bearer', async () => {
    fetchMock.mockResolvedValue(json(ACTOR));
    const m1 = cliente(`${BASE}/`);

    expect(m1.enabled).toBe(true);
    expect(await m1.findEmployeeBySub('1042')).toEqual(ACTOR);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}/integraciones/v1/actores?actorType=EMPLEADO&sub=1042`);
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`);
    expect(init.redirect).toBe('error');
  });

  it('404 con cuerpo Spring es null, no un error', async () => {
    fetchMock.mockResolvedValue(
      json({ timestamp: 't', status: 404, error: 'Not Found', message: 'x', path: '/p' }, 404),
    );
    expect(await cliente(BASE).findEmployeeBySub('9')).toBeNull();
  });

  it('inactivo: 200 con el estado real', async () => {
    fetchMock.mockResolvedValue(json({ ...ACTOR, estado: 'INACTIVO' }));
    expect((await cliente(BASE).findEmployeeBySub('1042'))?.estado).toBe('INACTIVO');
  });

  it('arma las rutas de ciudadanos y organizaciones', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(json({})));
    const m1 = cliente(BASE);
    await m1.findCitizenById(UUID);
    await m1.findOrganizationById(UUID);
    await m1.findOrganizationByCuit('30-1&x=1');
    expect(fetchMock.mock.calls.map(([u]) => u)).toEqual([
      `${BASE}/integraciones/v1/ciudadanos/${UUID}`,
      `${BASE}/integraciones/v1/organizaciones/${UUID}`,
      `${BASE}/integraciones/v1/organizaciones?cuit=30-1%26x%3D1`,
    ]);
  });

  it.each(['.', '..', 'a/b', '', 'o-1'])('id no UUID %p: error de argumento', (id) => {
    const m1 = cliente(BASE);
    expect(() => m1.findCitizenById(id)).toThrow(TypeError);
    expect(() => m1.findOrganizationById(id)).toThrow(TypeError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['actorId no UUID', { ...ACTOR, actorId: 'x' }],
    ['falta nombre', { ...ACTOR, nombre: undefined }],
    ['no es objeto', []],
  ])('cuerpo inválido (%s) es error tipado', async (_n, body) => {
    fetchMock.mockResolvedValue(json(body));
    await expect(cliente(BASE).findEmployeeBySub('1042')).rejects.toBeInstanceOf(
      IdentityUnavailableError,
    );
  });

  it('registro de otro sub es error tipado', async () => {
    fetchMock.mockResolvedValue(json(ACTOR));
    await expect(cliente(BASE).findEmployeeBySub('999')).rejects.toBeInstanceOf(
      IdentityUnavailableError,
    );
  });

  it('organización con cuerpo no objeto es error tipado', async () => {
    fetchMock.mockResolvedValue(json('x'));
    await expect(cliente(BASE).findOrganizationByCuit('30')).rejects.toBeInstanceOf(
      IdentityUnavailableError,
    );
  });

  it.each([401, 500, 503])('HTTP %i es error tipado sin token ni body', async (status) => {
    fetchMock.mockResolvedValue(new Response(`boom ${TOKEN}`, { status }));
    const err = await cliente(BASE)
      .findEmployeeBySub('1')
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(IdentityUnavailableError);
    expect((err as IdentityUnavailableError).status).toBe(status);
    expect((err as Error).message).not.toContain(TOKEN);
    expect((err as Error).message).not.toContain('boom');
  });

  it('timeout o red: error tipado que no filtra el token', async () => {
    const timeout = Object.assign(new Error(`aborted ${TOKEN}`), { name: 'TimeoutError' });
    fetchMock.mockRejectedValue(timeout);
    const err = await cliente(BASE)
      .findEmployeeBySub('1')
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(IdentityUnavailableError);
    expect((err as Error).message).toBe('No se pudo consultar a M1 (TimeoutError)');
    expect((err as Error).message).not.toContain(TOKEN);
  });

  it('200 sin JSON es error tipado sin citar el cuerpo', async () => {
    fetchMock.mockResolvedValue(new Response(`<html>${TOKEN}`, { status: 200 }));
    const err = await cliente(BASE)
      .findEmployeeBySub('1')
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(IdentityUnavailableError);
    expect((err as Error).message).not.toContain(TOKEN);
  });

  it('si el Core no da token, error tipado y no se llama a M1', async () => {
    core.getToken.mockRejectedValue(new Error(`falló ${TOKEN}`));
    const err = await cliente(BASE)
      .findEmployeeBySub('1')
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(IdentityUnavailableError);
    expect((err as Error).message).not.toContain(TOKEN);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sin M1_BASE_URL está deshabilitado y no toca ni el Core ni M1', async () => {
    const m1 = cliente(undefined);
    expect(m1.enabled).toBe(false);
    await expect(m1.findEmployeeBySub('1')).rejects.toThrow(/M1_BASE_URL/);
    expect(core.getToken).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
