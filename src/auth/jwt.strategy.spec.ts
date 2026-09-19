import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const config = { get: jest.fn().mockReturnValue('test-secret') } as unknown as ConfigService;

  it('mapea sub a userId y roles a un array', () => {
    const strategy = new JwtStrategy(config);
    expect(strategy.validate({ sub: 'user-1', roles: ['ADMIN'] })).toEqual({
      userId: 'user-1',
      roles: ['ADMIN'],
    });
  });

  it('usa un array vacío cuando el payload no trae roles', () => {
    const strategy = new JwtStrategy(config);
    expect(strategy.validate({ sub: 'user-2' })).toEqual({
      userId: 'user-2',
      roles: [],
    });
  });
});
