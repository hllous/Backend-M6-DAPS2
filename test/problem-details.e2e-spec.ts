import { NestExpressApplication } from '@nestjs/platform-express';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { Api, createTestApp, seedActores, truncateAll, unique } from './helpers';

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
});
