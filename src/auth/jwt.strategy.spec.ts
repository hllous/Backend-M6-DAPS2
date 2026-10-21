import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { createHmac } from 'node:crypto';
import { JwtStrategy } from './jwt.strategy';

// Clave de juguete: 32 bytes en base64, como la que entrega M1.
const SECRET_B64 = Buffer.alloc(32, 7).toString('base64');
const ISSUER = 'modulo1-ciudadanos';

const config = {
  getOrThrow: (key: string) => ({ 'jwt.secret': SECRET_B64, 'jwt.issuer': ISSUER })[key],
} as unknown as ConfigService;

const b64u = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');

/** Firma a mano para poder armar algoritmos que jsonwebtoken se negaría a emitir. */
function sign(
  claims: Record<string, unknown> = {},
  { alg = 'HS256', key = Buffer.from(SECRET_B64, 'base64'), hmac = 'sha256' } = {},
): string {
  const payload: Record<string, unknown> = {
    iss: ISSUER,
    typ: 'access',
    sub: 42,
    sub_type: 'EMPLEADO',
    rol: 'ADMINISTRATIVO',
    exp: Math.floor(Date.now() / 1000) + 900,
    ...claims,
  };
  for (const k of Object.keys(payload)) if (payload[k] === undefined) delete payload[k];
  const unsigned = `${b64u({ alg, typ: 'JWT' })}.${b64u(payload)}`;
  const sig = alg === 'none' ? '' : createHmac(hmac, key).update(unsigned).digest('base64url');
  return `${unsigned}.${sig}`;
}

/** Pasa el token por el flujo real de passport-jwt (firma, alg, iss, exp) y devuelve el resultado. */
function authenticate(token: string): Promise<{ user?: unknown; failed?: boolean }> {
  const strategy = new JwtStrategy(config);
  return new Promise((resolve) => {
    Object.assign(strategy, {
      success: (user: unknown) => resolve({ user }),
      fail: () => resolve({ failed: true }),
      // Nest corta `validate` con una excepción que el AuthGuard convierte en 401.
      error: () => resolve({ failed: true }),
    });
    strategy.authenticate({ headers: { authorization: `Bearer ${token}` } } as Request);
  });
}

describe('JwtStrategy', () => {
  it('acepta un access token de M1 y lo mapea', async () => {
    expect((await authenticate(sign())).user).toEqual({
      userId: '42',
      roles: ['ADMINISTRATIVO'],
      subType: 'EMPLEADO',
    });
  });

  it('acepta un ciudadano', async () => {
    const r = await authenticate(sign({ sub_type: 'CIUDADANO', rol: 'CIUDADANO' }));
    expect(r.user).toMatchObject({ roles: ['CIUDADANO'], subType: 'CIUDADANO' });
  });

  it.each([
    ['firma incorrecta', sign({}, { key: Buffer.alloc(32, 1) })],
    ['iss incorrecto', sign({ iss: 'otro' })],
    ['sin iss', sign({ iss: undefined })],
    ['typ=refresh', sign({ typ: 'refresh' })],
    ['sin typ', sign({ typ: undefined })],
    ['sin exp', sign({ exp: undefined })],
    ['vencido', sign({ exp: Math.floor(Date.now() / 1000) - 10 })],
    ['alg none', sign({}, { alg: 'none' })],
    ['alg HS512', sign({}, { alg: 'HS512', hmac: 'sha512' })],
    ['sin rol', sign({ rol: undefined })],
    ['rol vacío', sign({ rol: '' })],
    ['rol como array', sign({ rol: ['ADMINISTRATIVO'] })],
    ['sub_type inesperado', sign({ sub_type: 'ROBOT' })],
    ['sin sub', sign({ sub: undefined })],
    ['sub no numérico', sign({ sub: 'abc' })],
    // Firmado con los bytes del texto base64 en vez de los decodificados.
    ['secreto sin decodificar', sign({}, { key: Buffer.from(SECRET_B64) })],
  ])('rechaza: %s', async (_caso, token) => {
    const r = await authenticate(token);
    expect(r.user).toBeUndefined();
    expect(r.failed).toBe(true);
  });
});
