import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { bearer, createTestApp, seedActores, tokenDe, truncateAll } from './helpers';

/** `sort` y `order` (#703): ordenan todo el resultado antes de paginar, no la página visible. */
describe('GET /vehicles con sort y order (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createTestApp();
    const prisma = app.get(PrismaService);
    await truncateAll(prisma);
    await seedActores(prisma);
    await prisma.vehicle.createMany({
      data: ['B-2', 'A-1', 'D-4', 'C-3'].map((plate) => ({
        plate,
        vehicleType: 'COMPACTOR_TRUCK',
      })),
    });
  });

  afterAll(async () => {
    await app.close();
  });

  const get = (qs: string) =>
    request(app.getHttpServer())
      .get(`/vehicles?${qs}`)
      .set(bearer(tokenDe('admin')));
  const patentes = (body: { data: { plate: string }[] }) => body.data.map((v) => v.plate);

  it('sin parámetros ordena por patente ascendente (comportamiento previo)', async () => {
    const res = await get('pageSize=10').expect(200);
    expect(patentes(res.body)).toEqual(['A-1', 'B-2', 'C-3', 'D-4']);
  });

  it('order=desc invierte todo el resultado y pagina sobre ese orden', async () => {
    const p1 = await get('sort=plate&order=desc&pageSize=2&page=1').expect(200);
    const p2 = await get('sort=plate&order=desc&pageSize=2&page=2').expect(200);
    expect(patentes(p1.body)).toEqual(['D-4', 'C-3']);
    expect(patentes(p2.body)).toEqual(['B-2', 'A-1']);
  });

  it('un sort fuera de la lista da 400', async () => {
    await get('sort=updatedAt').expect(400);
    await get('sort=plate&order=up').expect(400);
  });
});
