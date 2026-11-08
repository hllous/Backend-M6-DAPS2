import { redactUrl } from './redact-url';

describe('redactUrl', () => {
  it.each([
    'token',
    'access_token',
    'api-key',
    'apiKey',
    'x-api-key',
    'client_secret',
    'jwt',
    'bearer',
    'auth',
    'Authorization',
    'sig',
    'signature',
    'session',
    'sessionId',
    'pwd',
    'passwd',
    'password',
    'token[]',
    'TOKEN',
    'access%5Ftoken',
    'api%2Dkey',
  ])('redacta %s', (name) => {
    expect(redactUrl(`/x?${name}=SECRETO&page=2`)).toBe(`/x?${name}=[REDACTED]&page=2`);
  });

  it.each(['page', 'pageSize', 'status', 'search', 'zoneId', 'assignedCrewId', 'sort', 'from'])(
    'no toca el parámetro legítimo %s',
    (name) => {
      expect(redactUrl(`/x?${name}=v`)).toBe(`/x?${name}=v`);
    },
  );

  it('deja pasar urls sin query y nombres con % mal formado', () => {
    expect(redactUrl('/services')).toBe('/services');
    expect(redactUrl('/x?k=%E0%A4')).toBe('/x?k=%E0%A4');
  });
});
