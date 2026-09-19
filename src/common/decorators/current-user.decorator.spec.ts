import 'reflect-metadata';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { CurrentUser } from './current-user.decorator';

/**
 * `createParamDecorator` envuelve la factory: no se puede invocar directo.
 * Este helper es el patrón estándar de Nest para extraerla vía metadata.
 */
function getParamDecoratorFactory(decorator: (...args: never[]) => ParameterDecorator) {
  class TestDecorator {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public test(@decorator() value: unknown) {}
  }
  const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, TestDecorator, 'test');
  return Object.values(args)[0] as { factory: (field: unknown, ctx: unknown) => unknown };
}

describe('CurrentUser', () => {
  const { factory } = getParamDecoratorFactory(CurrentUser);
  const ctx = (user: unknown) => ({ switchToHttp: () => ({ getRequest: () => ({ user }) }) });

  it('sin field, devuelve el usuario completo', () => {
    expect(factory(undefined, ctx({ userId: 'u1', roles: ['ADMIN'] }))).toEqual({
      userId: 'u1',
      roles: ['ADMIN'],
    });
  });

  it('con field, devuelve solo ese campo', () => {
    expect(factory('userId', ctx({ userId: 'u1' }))).toBe('u1');
  });

  it('sin usuario en el request, devuelve undefined', () => {
    expect(factory('userId', ctx(undefined))).toBeUndefined();
  });
});
