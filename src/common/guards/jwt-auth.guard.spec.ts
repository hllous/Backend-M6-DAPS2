import { ExecutionContext } from '@nestjs/common';
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
});
