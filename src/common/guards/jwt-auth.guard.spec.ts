import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

describe('JwtAuthGuard', () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let guard: JwtAuthGuard;
  let context: ExecutionContext;

  const handler = () => undefined;
  class DummyController {}

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new JwtAuthGuard(reflector as unknown as Reflector);
    context = {
      getHandler: () => handler,
      getClass: () => DummyController,
    } as unknown as ExecutionContext;
  });

  it('deja pasar sin token cuando el endpoint es @Public()', () => {
    reflector.getAllAndOverride.mockReturnValue(true);

    expect(guard.canActivate(context)).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
      handler,
      DummyController,
    ]);
  });

  it('delega en passport cuando el endpoint no es publico', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    // El prototipo de arriba es el AuthGuard('jwt') del que hereda JwtAuthGuard.
    const passportCanActivate = jest
      .spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
      .mockReturnValue(true);

    expect(guard.canActivate(context)).toBe(true);
    expect(passportCanActivate).toHaveBeenCalledWith(context);

    passportCanActivate.mockRestore();
  });

  describe('handleRequest', () => {
    const user = (subType: 'EMPLEADO' | 'CIUDADANO') => ({
      userId: '1',
      roles: ['ADMINISTRATIVO'],
      subType,
    });

    it('deja pasar a un empleado', () => {
      const u = user('EMPLEADO');
      expect(guard.handleRequest(null, u)).toBe(u);
    });

    it('rechaza a un ciudadano con 403 y mensaje claro', () => {
      expect(() => guard.handleRequest(null, user('CIUDADANO'))).toThrow(
        new ForbiddenException('Este sistema es solo para personal municipal'),
      );
    });

    it('sin usuario o con error de passport sigue siendo 401', () => {
      expect(() => guard.handleRequest(null, false)).toThrow(UnauthorizedException);
      expect(() => guard.handleRequest(new Error('x'), user('EMPLEADO'))).toThrow();
    });
  });
});
