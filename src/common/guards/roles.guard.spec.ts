import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { M6Role } from '../../auth/m6-role';
import { ANY_EMPLOYEE_KEY, ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let meta: Record<string, unknown>;
  let guard: RolesGuard;

  const handler = () => undefined;
  class DummyController {}

  const reflector = {
    getAllAndOverride: (key: string) => meta[key],
  } as unknown as Reflector;

  const ctx = (user: unknown, method = 'GET') =>
    ({
      getHandler: () => handler,
      getClass: () => DummyController,
      switchToHttp: () => ({
        getRequest: () => ({
          user,
          method,
          path: '/x',
          headers: { authorization: 'Bearer secreto' },
        }),
      }),
    }) as unknown as ExecutionContext;

  const user = (...roles: M6Role[]) => ({ userId: '7', roles });

  const denegado = (c: ExecutionContext) => {
    try {
      guard.canActivate(c);
    } catch (e) {
      expect(e).toBeInstanceOf(ForbiddenException);
      return (e as ForbiddenException).getResponse() as Record<string, unknown>;
    }
    throw new Error('debía denegar');
  };

  beforeEach(() => {
    meta = {};
    guard = new RolesGuard(reflector);
  });

  it('se registra como segundo APP_GUARD, después de JwtAuthGuard (el orden importa)', () => {
    const providers = Reflect.getMetadata('providers', AppModule) as {
      provide?: unknown;
      useClass?: unknown;
    }[];
    const guards = providers.filter((p) => p.provide === APP_GUARD).map((p) => p.useClass);
    expect(guards).toEqual([JwtAuthGuard, RolesGuard]);
  });

  it('@Public() lo saltea, aunque no haya usuario', () => {
    meta[IS_PUBLIC_KEY] = true;
    expect(guard.canActivate(ctx(undefined, 'POST'))).toBe(true);
  });

  it('@AnyEmployee() deja pasar a un empleado sin ningún rol de M6', () => {
    meta[ANY_EMPLOYEE_KEY] = true;
    expect(guard.canActivate(ctx(user()))).toBe(true);
  });

  describe('con @Roles', () => {
    it('permite si el usuario tiene alguno de los roles', () => {
      meta[ROLES_KEY] = [M6Role.M6_ADMIN, M6Role.M6_OFICINA_OPERACIONES];
      expect(guard.canActivate(ctx(user(M6Role.M6_OFICINA_OPERACIONES), 'POST'))).toBe(true);
    });

    it('rechaza con ROLE_REQUIRED si no tiene ninguno', () => {
      meta[ROLES_KEY] = [M6Role.M6_ADMIN];
      const body = denegado(ctx(user(M6Role.M6_AUDITOR), 'POST'));
      expect(body).toMatchObject({ statusCode: 403, code: 'ROLE_REQUIRED' });
      // No revela qué rol haría falta.
      expect(JSON.stringify(body)).not.toContain('M6_ADMIN');
    });

    it('rechaza si no hay usuario o no trae roles', () => {
      meta[ROLES_KEY] = [M6Role.M6_ADMIN];
      denegado(ctx(undefined, 'POST'));
      denegado(ctx({}, 'POST'));
    });

    it('loguea la denegación con usuario, ruta y roles requeridos, sin token', () => {
      const warn = jest.spyOn(guard['logger'], 'warn').mockImplementation();
      meta[ROLES_KEY] = [M6Role.M6_ADMIN];
      denegado(ctx(user(), 'PUT'));
      const msg = warn.mock.calls[0][0] as string;
      expect(msg).toContain('7');
      expect(msg).toContain('PUT /x');
      expect(msg).toContain('M6_ADMIN');
      expect(msg).not.toContain('secreto');
    });
  });

  describe('sin @Roles', () => {
    it.each(['GET', 'HEAD'])('%s exige algún rol de M6 (incluido el auditor)', (method) => {
      expect(guard.canActivate(ctx(user(M6Role.M6_AUDITOR), method))).toBe(true);
      expect(guard.canActivate(ctx(user(M6Role.M6_CAMPO_CUADRILLA), method))).toBe(true);
      expect(denegado(ctx(user(), method))).toMatchObject({ code: 'ROLE_REQUIRED' });
    });

    it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
      '%s falla cerrado para todos y loguea error de configuración',
      (method) => {
        const error = jest.spyOn(guard['logger'], 'error').mockImplementation();
        jest.spyOn(guard['logger'], 'warn').mockImplementation();
        expect(denegado(ctx(user(M6Role.M6_ADMIN), method))).toMatchObject({
          code: 'ROLE_REQUIRED',
        });
        expect(error).toHaveBeenCalledWith(expect.stringContaining(`${method} /x`));
      },
    );

    it('un @Roles vacío se trata como ausente', () => {
      meta[ROLES_KEY] = [];
      denegado(ctx(user(M6Role.M6_ADMIN), 'POST'));
    });
  });
});
