import { buildCorsOptions } from './cors-options';

describe('buildCorsOptions', () => {
  it('con CORS_ORIGINS restringe a esos orígenes y nunca habilita credenciales', () => {
    const o = buildCorsOptions(['https://front.example']);
    expect(o.origin).toEqual(['https://front.example']);
    expect(o.credentials).toBe(false);
  });

  it.each([undefined, []])('sin orígenes (%j) queda abierto pero sin credenciales', (origins) => {
    const o = buildCorsOptions(origins);
    expect(o.origin).toBeUndefined();
    expect(o.credentials).toBe(false);
  });

  it('expone ETag, Idempotency-Replayed y X-Request-Id', () => {
    expect(buildCorsOptions().exposedHeaders).toEqual([
      'ETag',
      'Idempotency-Replayed',
      'X-Request-Id',
    ]);
  });
});
