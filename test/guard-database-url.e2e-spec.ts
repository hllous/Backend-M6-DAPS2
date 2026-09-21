import { assertBaseLocal } from './guard-database-url';

/**
 * El guard que impide truncar una base que no sea local. Función pura: no
 * levanta la app ni toca la base, pero vive acá porque protege a los e2e.
 */
describe('assertBaseLocal (guard de DATABASE_URL de los e2e)', () => {
  it('tira si no hay DATABASE_URL', () => {
    expect(() => assertBaseLocal(undefined)).toThrow('DATABASE_URL');
  });

  it.each([
    'postgresql://m6:m6@localhost:5433/m6_e2e?schema=public',
    'postgresql://m6:m6@127.0.0.1:5432/m6_e2e',
    'postgresql://m6:m6@[::1]:5432/m6_e2e',
  ])('deja pasar %s', (url) => {
    expect(assertBaseLocal(url)).toBe(url);
  });

  it('tira con un host remoto', () => {
    expect(() => assertBaseLocal('postgresql://u:p@db.example.com:5432/db')).toThrow(
      "'db.example.com'",
    );
  });

  it('tira cuando localhost aparece antes del último @ pero el host real es remoto', () => {
    expect(() => assertBaseLocal('postgresql://u:p@localhost:5432@db.example.com/db')).toThrow(
      "'db.example.com'",
    );
  });
});
