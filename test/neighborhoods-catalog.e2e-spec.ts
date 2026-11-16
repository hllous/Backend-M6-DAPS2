import { join } from 'node:path';
import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { bearer, createTestApp, seedActores, tokenDe, truncateAll } from './helpers';

/**
 * Catálogo de barrios local (#594): con NEIGHBORHOODS_CATALOG_FILE el endpoint
 * responde con el JSON versionado; sin él (producción, o local sin M9) sigue
 * siendo 503 y no una lista vacía.
 */
describe('GET /neighborhoods (e2e)', () => {
  const previo = process.env.NEIGHBORHOODS_CATALOG_FILE;
  let app: NestExpressApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
    if (previo === undefined) delete process.env.NEIGHBORHOODS_CATALOG_FILE;
    else process.env.NEIGHBORHOODS_CATALOG_FILE = previo;
  });

  it('con el catálogo local responde 200 con los barrios', async () => {
    process.env.NEIGHBORHOODS_CATALOG_FILE = join(
      __dirname,
      '..',
      'prisma',
      'data',
      'm9-barrios.json',
    );
    app = await createTestApp();
    const prisma = app.get(PrismaService);
    await truncateAll(prisma);
    await seedActores(prisma);

    const res = await request(app.getHttpServer())
      .get('/neighborhoods')
      .set(bearer(tokenDe('admin')))
      .expect(200);

    expect(res.body.length).toBeGreaterThan(40);
    expect(res.body[0]).toEqual(
      expect.objectContaining({ id: expect.any(String), codigo: expect.any(String) }),
    );
  });

  it('sin catálogo responde 503', async () => {
    delete process.env.NEIGHBORHOODS_CATALOG_FILE;
    app = await createTestApp();
    const prisma = app.get(PrismaService);
    await truncateAll(prisma);
    await seedActores(prisma);

    await request(app.getHttpServer())
      .get('/neighborhoods')
      .set(bearer(tokenDe('admin')))
      .expect(503);
  });
});
