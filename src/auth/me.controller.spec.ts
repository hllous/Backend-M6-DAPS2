import { MeController } from './me.controller';
import { AuthenticatedUser } from './jwt.strategy';
import { M6Role } from './m6-role';

describe('MeController', () => {
  it('devuelve identidad y roles efectivos', () => {
    const user: AuthenticatedUser = {
      userId: '42',
      subType: 'EMPLEADO',
      m1Role: 'ADMINISTRATIVO',
      roles: [M6Role.M6_CAMPO_CUADRILLA],
    };
    expect(new MeController().me(user)).toEqual(user);
  });
});
