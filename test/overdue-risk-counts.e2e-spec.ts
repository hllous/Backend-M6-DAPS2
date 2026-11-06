import { NestExpressApplication } from '@nestjs/platform-express';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  Api,
  bearer,
  crearZona,
  createTestApp,
  seedActores,
  tokenDe,
  truncateAll,
  unique,
} from './helpers';

/**
 * Tableros (#511): el conteo de vencidas y de riesgo alto y el filtro del
 * listado salen de la misma definición, así que "Ver lista" suma lo que dice
 * el número. Contra Postgres real porque el filtro de riesgo es SQL.
 */
describe('Conteos de vencidas y riesgo alto (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  const get = (path: string) =>
    request(app.getHttpServer())
      .get(path)
      .set(bearer(tokenDe('operaciones')));
  const hace = (dias: number) => new Date(Date.now() - dias * 86_400_000);

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await truncateAll(prisma);
    await seedActores(prisma);
    const zona = await crearZona(Api.porRol(app));
    const otra = await crearZona(Api.porRol(app));

    const arbol = (zoneId: string) =>
      prisma.tree.create({ data: { surveyCode: unique('ARB'), zoneId } });
    const relevar = (treeId: string, riskLevel: 'LOW' | 'HIGH', surveyedAt: Date) =>
      prisma.treeSurvey.create({
        data: { treeId, surveyedAt, healthStatus: 'HEALTHY', riskLevel },
      });
    const alto = await arbol(zona.id);
    await relevar(alto.id, 'LOW', hace(10));
    await relevar(alto.id, 'HIGH', hace(1)); // el último manda
    const bajado = await arbol(otra.id);
    await relevar(bajado.id, 'HIGH', hace(10));
    await relevar(bajado.id, 'LOW', hace(1)); // ya no cuenta

    // Creada hace 40 días: vencida en cualquier calendario con plazo de 5 hábiles.
    await prisma.environmentalReport.create({
      data: { reportType: 'NOISE', status: 'RECEIVED', createdAt: hace(40) },
    });
    await prisma.environmentalReport.create({
      data: { reportType: 'NOISE', status: 'CLOSED', createdAt: hace(40) },
    });
    await prisma.environmentalReport.create({ data: { reportType: 'NOISE', status: 'RECEIVED' } });
  });

  afterAll(async () => {
    await app.close();
  });

  it('árboles: el listado filtrado coincide con el indicador, por zona incluida', async () => {
    const lista = await get('/trees?riskLevel=HIGH').expect(200);
    const ind = await get('/indicators/incidents').expect(200);

    expect(lista.body.meta.total).toBe(1);
    expect(ind.body.trees.byRiskLevel).toEqual(
      expect.arrayContaining([
        { riskLevel: 'HIGH', count: 1 },
        { riskLevel: 'LOW', count: 1 },
      ]),
    );
    const zonaAlta = ind.body.trees.byZone.find(
      (z: { zoneId: string }) => z.zoneId === lista.body.data[0].zoneId,
    );
    expect(zonaAlta.byRiskLevel).toEqual([{ riskLevel: 'HIGH', count: 1 }]);
    await get('/trees?riskLevel=ALTO').expect(400);
  });

  it('denuncias: overdue=true lista exactamente las vencidas del indicador', async () => {
    const desde = hace(60).toISOString().slice(0, 10);
    const ind = await get(`/indicators/incidents?from=${desde}`).expect(200);
    const lista = await get(`/environmental-reports?overdue=true&createdFrom=${desde}`).expect(200);

    expect(ind.body.reports.overdue).toMatchObject({ open: 2, overdue: 1 });
    expect(ind.body.reports.overdue.byZone).toEqual([
      { zoneId: null, code: null, name: null, open: 2, overdue: 1, pct: 50 },
    ]);
    expect(lista.body.meta.total).toBe(1);
  });
});
