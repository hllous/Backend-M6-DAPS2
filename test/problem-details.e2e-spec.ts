import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { Api, bearer, createTestApp, seedActores, tokenDe, truncateAll, unique } from './helpers';

/**
 * ADR-011: los errores reales salen como `application/problem+json` con los
 * campos RFC 9457 y, además, los históricos que el frontend ya lee.
 */
describe('Errores en Problem Details RFC 9457 (e2e)', () => {
  let app: NestExpressApplication;
  let api: Api;

  beforeAll(async () => {
    app = await createTestApp();
    const prisma = app.get(PrismaService);
    await truncateAll(prisma);
    await seedActores(prisma);
    api = Api.porRol(app);
  });
  afterAll(async () => {
    await app.close();
  });

  const esProblema = (res: request.Response, status: number, instance: string) => {
    expect(res.status).toBe(status);
    expect(res.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(res.body).toMatchObject({
      type: 'about:blank',
      status,
      statusCode: status,
      instance,
      path: instance,
    });
    expect(res.body.title).toBe(res.body.error);
    expect(res.body.detail).toBe(res.body.message);
    expect(typeof res.body.timestamp).toBe('string');
  };

  it('400: body inválido', async () => {
    const res = await api.post('/zones', { code: unique('ZN'), name: 'Zona', sobra: true });
    esProblema(res, 400, '/zones');
    expect(res.body.title).toBe('Bad Request');
  });

  it('401: sin token', async () => {
    const res = await request(app.getHttpServer()).get('/zones');
    esProblema(res, 401, '/zones');
  });

  it('404: recurso inexistente', async () => {
    const ruta = '/zones/00000000-0000-4000-8000-000000000000';
    const res = await api.get(ruta);
    esProblema(res, 404, ruta);
    expect(res.body.title).toBe('Not Found');
  });

  it('409: código duplicado', async () => {
    const code = unique('ZN');
    await api.post('/zones', { code, name: 'Zona' }).expect(201);
    const res = await api.post('/zones', { code, name: 'Otra' });
    esProblema(res, 409, '/zones');
    expect(res.body.title).toBe('Conflict');
  });

  it('403: rol insuficiente (AUDITOR escribe) con code ROLE_REQUIRED', async () => {
    const res = await request(app.getHttpServer())
      .post('/zones')
      .set(bearer(tokenDe('auditor')))
      .send({ code: unique('ZN'), name: 'Zona' });
    esProblema(res, 403, '/zones');
    expect(res.body).toMatchObject({ title: 'Forbidden', code: 'ROLE_REQUIRED' });
  });

  it('el token de la query sale redactado en instance y path', async () => {
    const ruta = '/zones/00000000-0000-4000-8000-000000000000';
    const res = await api.get(`${ruta}?access_token=abc`);
    esProblema(res, 404, `${ruta}?access_token=[REDACTED]`);
    expect(JSON.stringify(res.body)).not.toContain('abc');
  });

  // Errores que ocurren antes del router de Nest (body-parser).
  it('400: JSON mal formado', async () => {
    const res = await request(app.getHttpServer())
      .post('/zones')
      .set(bearer(tokenDe('admin')))
      .set('Content-Type', 'application/json')
      .send('{"code": ');
    esProblema(res, 400, '/zones');
  });

  it('413: cuerpo más grande que el límite del body-parser', async () => {
    const res = await request(app.getHttpServer())
      .post('/zones')
      .set(bearer(tokenDe('admin')))
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ code: 'x', name: 'a'.repeat(200 * 1024) }));
    esProblema(res, 413, '/zones');
  });
});

describe('429 en Problem Details (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    process.env.THROTTLE_LIMIT = '2';
    app = await createTestApp();
  });
  afterAll(async () => {
    await app.close();
    delete process.env.THROTTLE_LIMIT;
  });

  it('responde problem+json con el cuerpo RFC y los campos históricos', async () => {
    const auth = bearer(tokenDe('admin'));
    let res = await request(app.getHttpServer()).get('/zones').set(auth);
    for (let i = 0; i < 2; i++) res = await request(app.getHttpServer()).get('/zones').set(auth);
    expect(res.status).toBe(429);
    expect(res.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(res.body).toMatchObject({
      type: 'about:blank',
      title: 'Too Many Requests',
      status: 429,
      statusCode: 429,
      instance: '/zones',
      path: '/zones',
    });
    expect(res.body.detail).toBe(res.body.message);
  });
});
