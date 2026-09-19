import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';

describe('RolesGuard', () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let guard: RolesGuard;

  const handler = () => undefined;
  class DummyController {}

  const contextWithUser = (user: unknown) =>
    ({
      getHandler: () => handler,
      getClass: () => DummyController,
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  it('permite el acceso si el endpoint no declara @Roles()', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(contextWithUser(undefined))).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [handler, DummyController]);
  });

  it('permite el acceso si @Roles() declara un array vacío', () => {
    reflector.getAllAndOverride.mockReturnValue([]);
    expect(guard.canActivate(contextWithUser({ roles: [] }))).toBe(true);
  });

  it('rechaza si hay roles requeridos pero no hay usuario en el request', () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);
    expect(guard.canActivate(contextWithUser(undefined))).toBe(false);
  });

  it('rechaza si el usuario no tiene el array de roles', () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);
    expect(guard.canActivate(contextWithUser({}))).toBe(false);
  });

  it('rechaza si ninguno de los roles del usuario matchea', () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);
    expect(guard.canActivate(contextWithUser({ roles: ['OPERATOR'] }))).toBe(false);
  });

  it('permite el acceso si el usuario tiene alguno de los roles requeridos', () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN', 'SUPERVISOR']);
    expect(guard.canActivate(contextWithUser({ roles: ['SUPERVISOR'] }))).toBe(true);
  });
});
