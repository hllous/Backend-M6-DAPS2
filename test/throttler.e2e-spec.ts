import { NestExpressApplication } from '@nestjs/platform-express';
import * as request from 'supertest';
import { bearer, createTestApp, tokenFor } from './helpers';

describe('Rate limiting global (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    // Límite bajo solo para esta suite; se lee al compilar el módulo.
    process.env.THROTTLE_LIMIT = '3';
    app = await createTestApp();
  });
  afterAll(async () => {
    await app.close();
    delete process.env.THROTTLE_LIMIT;
  });

  it('devuelve 429 al pasar el límite de un endpoint y los demás siguen respondiendo', async () => {
    const auth = bearer(tokenFor('M6_ADMIN'));
    const codes: number[] = [];
    for (let i = 0; i < 4; i++) {
      codes.push((await request(app.getHttpServer()).get('/zones').set(auth)).status);
    }
    expect(codes.slice(0, 3)).not.toContain(429);
    expect(codes[3]).toBe(429);

    const otro = await request(app.getHttpServer()).get('/neighborhoods').set(auth);
    expect(otro.status).not.toBe(429);
    // health no cuenta: el keepalive no puede recibir 429.
    for (let i = 0; i < 5; i++) await request(app.getHttpServer()).get('/health').expect(200);
  });
});
