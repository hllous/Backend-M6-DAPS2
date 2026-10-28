import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { createHmac } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { JwtStrategy } from './jwt.strategy';
import { M1RoleAdapter } from './m1-role.adapter';
import { M6Role } from './m6-role';

// Clave de juguete: 32 bytes en base64, como la que entrega M1.
const SECRET_B64 = Buffer.alloc(32, 7).toString('base64');
const ISSUER = 'modulo1-ciudadanos';

const config = {
  getOrThrow: (key: string) => ({ 'jwt.secret': SECRET_B64, 'jwt.issuer': ISSUER })[key],
  get: (key: string) => ({ bootstrapAdminUserIds: ['99'] })[key],
} as unknown as ConfigService;

// Filas de la tabla de asignaciones que devuelve el mock; cada test las pisa.
let assigned: M6Role[] = [];
const findMany = jest.fn(async () => assigned.map((role) => ({ role })));
const prisma = { userRoleAssignment: { findMany } } as unknown as PrismaService;
const adapter = new M1RoleAdapter();

beforeEach(() => {
  assigned = [];
  findMany.mockClear();
});

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
  const strategy = new JwtStrategy(config, prisma, adapter);
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
  it('acepta un access token de M1 y lo mapea a roles de M6', async () => {
    assigned = [M6Role.M6_CAMPO_CUADRILLA];
    expect((await authenticate(sign())).user).toEqual({
      userId: '42',
      subType: 'EMPLEADO',
      m1Role: 'ADMINISTRATIVO',
      roles: [M6Role.M6_CAMPO_CUADRILLA],
    });
  });

  it('sin filas en la tabla no hay roles efectivos (el rol de M1 solo no autoriza)', async () => {
    expect((await authenticate(sign())).user).toMatchObject({ roles: [] });
  });

  it('un rol de la tabla que el rol de M1 ya no permite no es efectivo', async () => {
    assigned = [M6Role.M6_ADMIN, M6Role.M6_CAMPO_INSPECTOR];
    const r = await authenticate(sign({ rol: 'ADMINISTRATIVO' })); // ya no RESPONSABLE_AREA
    expect(r.user).toMatchObject({ roles: [M6Role.M6_CAMPO_INSPECTOR] });
  });

  it('RESPONSABLE_AREA conserva M6_ADMIN', async () => {
    assigned = [M6Role.M6_ADMIN];
    expect((await authenticate(sign({ rol: 'RESPONSABLE_AREA' }))).user).toMatchObject({
      roles: [M6Role.M6_ADMIN],
    });
  });

  it('admin de bootstrap: M6_ADMIN sin fila, pero solo si M1 lo permite', async () => {
    const ok = await authenticate(sign({ sub: 99, rol: 'RESPONSABLE_AREA' }));
    expect(ok.user).toMatchObject({ roles: [M6Role.M6_ADMIN] });
    const sinRol = await authenticate(sign({ sub: 99, rol: 'ADMINISTRATIVO' }));
    expect(sinRol.user).toMatchObject({ roles: [] });
  });

  it('bootstrap + fila de Campo: ganan los de Oficina (ADR-005)', async () => {
    assigned = [M6Role.M6_CAMPO_INSPECTOR, M6Role.M6_AUDITOR];
    const r = await authenticate(sign({ sub: 99, rol: 'RESPONSABLE_AREA' }));
    expect(r.user).toMatchObject({ roles: [M6Role.M6_ADMIN] });
  });

  it('sin bootstrapAdminUserIds en la config no hay admins de bootstrap', async () => {
    const sinBootstrap = { ...config, get: () => undefined } as unknown as ConfigService;
    const s = new JwtStrategy(sinBootstrap, prisma, adapter);
    const user = await s.validate({
      sub: 99,
      sub_type: 'EMPLEADO',
      rol: 'RESPONSABLE_AREA',
      typ: 'access',
      exp: 1,
    });
    expect(user.roles).toEqual([]);
  });

  it('un rol de M1 sin roles asignables ni consulta la tabla', async () => {
    assigned = [M6Role.M6_ADMIN];
    const r = await authenticate(sign({ rol: 'MESA_ENTRADAS' }));
    expect(r.user).toMatchObject({ m1Role: 'MESA_ENTRADAS', roles: [] });
    expect(findMany).not.toHaveBeenCalled();
  });

  it('lee la tabla en cada request, sin caché', async () => {
    await authenticate(sign());
    await authenticate(sign());
    expect(findMany).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['HS384', 'sha384'],
    ['HS512', 'sha512'],
  ])('acepta firmado con %s (JJWT elige según el largo de la clave de M1)', async (alg, hmac) => {
    const r = await authenticate(sign({}, { alg, hmac }));
    expect(r.user).toMatchObject({ userId: '42' });
  });

  it('acepta un ciudadano con rol PERSONA, el claim que emite M1 v3.1', async () => {
    const r = await authenticate(sign({ sub_type: 'CIUDADANO', rol: 'PERSONA' }));
    expect(r.user).toMatchObject({ roles: [], m1Role: 'PERSONA', subType: 'CIUDADANO' });
  });

  it('acepta un ciudadano, sin roles de M6', async () => {
    const r = await authenticate(sign({ sub_type: 'CIUDADANO', rol: 'CIUDADANO' }));
    expect(r.user).toMatchObject({ roles: [], m1Role: 'CIUDADANO', subType: 'CIUDADANO' });
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
    ['alg RS256', sign({}, { alg: 'RS256' })],
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
