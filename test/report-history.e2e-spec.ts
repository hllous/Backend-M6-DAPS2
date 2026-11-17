import { NestExpressApplication } from '@nestjs/platform-express';
import { M4_ACTOR_ID } from '../src/common/audit/audit-actors';
import { PrismaService } from '../src/prisma/prisma.service';
import { Api, createTestApp, seedActores, tokenDe, truncateAll } from './helpers';

/**
 * Historial del expediente (#728) contra la base real: Oficina Ambiental lee el motivo
 * de cada decisión, sin actor ni ids y sin las filas READ.
 */
describe('Historial del expediente (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let api: Api;
  const como = (actor: Parameters<typeof tokenDe>[0]) => new Api(app, tokenDe(actor));

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    api = Api.porRol(app);
    await truncateAll(prisma);
    await seedActores(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('Oficina Ambiental lee los motivos, del más nuevo al más viejo, sin actor ni READ', async () => {
    const r = await api.post('/environmental-reports', { reportType: 'NOISE' }).expect(201);
    const id = r.body.id;
    await api.post(`/environmental-reports/${id}/start-review`).expect(200);
    await api
      .post(`/environmental-reports/${id}/forward`, { reason: 'Corresponde a Obras Públicas' })
      .expect(200);
    await api
      .post(`/environmental-reports/${id}/close`, { reason: 'Obras resolvió el reclamo' })
      .expect(200);
    // Una lectura Tier 2 del expediente no es un paso del expediente.
    await prisma.domainAuditLog.create({
      data: {
        entityType: 'ENVIRONMENTAL_REPORT',
        entityId: id,
        action: 'READ',
        actorUserId: '1',
        actorRoles: [],
      },
    });
    // Y las filas de otro expediente no se mezclan.
    await api.post('/environmental-reports', { reportType: 'NOISE' }).expect(201);

    const res = await como('ambiental').get(`/environmental-reports/${id}/history`).expect(200);

    expect(res.body.data.map((i: { action: string }) => i.action)).toEqual([
      'CLOSE',
      'FORWARD',
      'START_REVIEW',
      'CREATE',
    ]);
    expect(res.body.data[0]).toMatchObject({
      fromStatus: 'FORWARDED',
      toStatus: 'CLOSED',
      note: 'Obras resolvió el reclamo',
    });
    expect(res.body.data[1].note).toBe('Corresponde a Obras Públicas');
    for (const item of res.body.data) {
      expect(Object.keys(item).sort()).toEqual(
        ['action', 'fromStatus', 'note', 'occurredAt', 'toStatus'].sort(),
      );
    }
    expect(res.body.meta.total).toBe(4);

    const pagina = await como('ambiental')
      .get(`/environmental-reports/${id}/history?page=2&pageSize=3`)
      .expect(200);
    expect(pagina.body.data).toHaveLength(1);
    expect(pagina.body.meta.total).toBe(4);
  });

  it('admin y auditor leen; operaciones, cuadrilla e inspector reciben 403 ROLE_REQUIRED', async () => {
    const r = await api.post('/environmental-reports', { reportType: 'NOISE' }).expect(201);
    const ruta = `/environmental-reports/${r.body.id}/history`;
    await como('admin').get(ruta).expect(200);
    await como('auditor').get(ruta).expect(200);
    for (const actor of ['operaciones', 'cuadrilla', 'inspector'] as const) {
      const res = await como(actor).get(ruta).expect(403);
      expect(res.body.code).toBe('ROLE_REQUIRED');
    }
  });

  it('404 si el expediente no existe y 400 si el id no es UUID', async () => {
    await como('ambiental')
      .get('/environmental-reports/3f2b8c1e-5d4a-4e6f-9a1b-2c3d4e5f6a7b/history')
      .expect(404);
    await como('ambiental').get('/environmental-reports/no-es-uuid/history').expect(400);
  });

  it('leer el historial no deja fila READ', async () => {
    const r = await api.post('/environmental-reports', { reportType: 'NOISE' }).expect(201);
    await como('ambiental').get(`/environmental-reports/${r.body.id}/history`).expect(200);
    const lecturas = await prisma.domainAuditLog.count({
      where: { entityId: r.body.id, action: 'READ' },
    });
    expect(lecturas).toBe(0);
  });

  it('el note de la fila que escribe M4 (decisión de la sanción) no sale', async () => {
    const r = await api.post('/environmental-reports', { reportType: 'NOISE' }).expect(201);
    // Como la escribe sanctions.consumer.ts: actor system:m4 y la decisión como note.
    await prisma.domainAuditLog.create({
      data: {
        entityType: 'ENVIRONMENTAL_REPORT',
        entityId: r.body.id,
        action: 'STATUS_CHANGE',
        fromStatus: 'NOTICE_ISSUED',
        toStatus: 'SANCTIONED',
        actorUserId: M4_ACTOR_ID,
        actorRoles: [],
        note: 'FINE_ISSUED',
      },
    });

    const res = await como('ambiental')
      .get(`/environmental-reports/${r.body.id}/history`)
      .expect(200);

    expect(res.body.data[0]).toMatchObject({
      action: 'STATUS_CHANGE',
      toStatus: 'SANCTIONED',
      note: null,
    });
    expect(JSON.stringify(res.body)).not.toContain('FINE_ISSUED');
  });
});
