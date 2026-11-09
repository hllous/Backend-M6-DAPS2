import { NestExpressApplication } from '@nestjs/platform-express';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  Api,
  crearContenedor,
  crearCuadrilla,
  crearTipoServicio,
  crearZona,
  createTestApp,
  hoy,
  seedActores,
  truncateAll,
} from './helpers';

/**
 * Concurrencia optimista (ADR-012, #591): ETag en el GET, If-Match opcional en
 * las transiciones. Lo que importa acá es que el 412 no escriba nada (ni
 * outbox) y que de dos pedidos con el mismo ETag gane uno solo.
 */
describe('ETag / If-Match (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let api: Api;
  let zoneId: string;

  const etagDe = async (id: string): Promise<string> => {
    const res = await api.get(`/containers/${id}`).expect(200);
    return res.headers['etag'] as string;
  };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    api = Api.porRol(app);
    await truncateAll(prisma);
    await seedActores(prisma);
    zoneId = (await crearZona(api)).id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('el GET individual devuelve un ETag débil derivado de updatedAt', async () => {
    const c = await crearContenedor(api, zoneId);
    const res = await api.get(`/containers/${c.id}`).expect(200);
    expect(res.headers['etag']).toMatch(/^W\/"\d+"$/);
  });

  it('con el ETag correcto aplica la transición y devuelve el ETag nuevo', async () => {
    const c = await crearContenedor(api, zoneId);
    const etag = await etagDe(c.id);

    const res = await api
      .post(`/containers/${c.id}/report-overflow`, {}, { 'If-Match': etag })
      .expect(200);

    expect(res.body.status).toBe('OVERFLOWED');
    expect(res.headers['etag']).toMatch(/^W\/"\d+"$/);
    expect(res.headers['etag']).not.toBe(etag);
    expect(res.headers['etag']).toBe(await etagDe(c.id));
  });

  it('con un ETag viejo responde 412 y no escribe nada, ni en el outbox', async () => {
    const c = await crearContenedor(api, zoneId);
    const viejo = await etagDe(c.id);
    await api.post(`/containers/${c.id}/report-overflow`).expect(200);
    await api.post(`/containers/${c.id}/empty`).expect(200);

    const eventosAntes = await prisma.outboxEvent.count();
    const historialAntes = await prisma.containerStatusHistory.count({
      where: { containerId: c.id },
    });
    const antes = await prisma.container.findUniqueOrThrow({ where: { id: c.id } });

    const res = await api
      .post(
        `/containers/${c.id}/report-damage`,
        { damageType: 'LID_BROKEN', severity: 'HIGH', requiresPublicWorks: true },
        { 'If-Match': viejo },
      )
      .expect(412);

    expect(res.body.statusCode).toBe(412);
    const despues = await prisma.container.findUniqueOrThrow({ where: { id: c.id } });
    expect(despues.status).toBe('ACTIVE');
    expect(despues.updatedAt).toEqual(antes.updatedAt);
    expect(await prisma.outboxEvent.count()).toBe(eventosAntes);
    expect(await prisma.containerStatusHistory.count({ where: { containerId: c.id } })).toBe(
      historialAntes,
    );
  });

  it('sin If-Match, o con "*", se comporta como siempre', async () => {
    const c = await crearContenedor(api, zoneId);
    await api.post(`/containers/${c.id}/report-overflow`).expect(200);
    await api.post(`/containers/${c.id}/empty`, {}, { 'If-Match': '*' }).expect(200);
  });

  it('un If-Match vigente sobre una transición inválida sigue dando 409', async () => {
    const c = await crearContenedor(api, zoneId);
    const etag = await etagDe(c.id);
    await api.post(`/containers/${c.id}/empty`, {}, { 'If-Match': etag }).expect(409);
  });

  it('dos pedidos con el mismo ETag: uno gana y el otro recibe 412', async () => {
    const c = await crearContenedor(api, zoneId);
    const etag = await etagDe(c.id);

    // Dos transiciones distintas desde ACTIVE: sin If-Match la segunda daría 409
    // por el guard de estado o, peor, ganaría pisando la otra.
    const [a, b] = await Promise.all([
      api.post(`/containers/${c.id}/report-overflow`, {}, { 'If-Match': etag }),
      api.post(`/containers/${c.id}/relocate`, {}, { 'If-Match': etag }),
    ]);

    expect([a.status, b.status].sort()).toEqual([200, 412]);
    const fila = await prisma.container.findUniqueOrThrow({ where: { id: c.id } });
    expect(['OVERFLOWED', 'RELOCATING']).toContain(fila.status);
  });

  it('servicios: ETag en el GET y 412 con uno viejo', async () => {
    const tipo = await crearTipoServicio(api, { mode: 'POINT' });
    const crewId = (await crearCuadrilla(api)).id;
    const c = await crearContenedor(api, zoneId);
    const creado = await api
      .post('/services', {
        serviceTypeId: tipo.id,
        targetType: 'CONTAINER',
        targetId: c.id,
        scheduledDate: hoy(),
        origin: 'PLANNED',
        crewId,
      })
      .expect(201);
    const id: string = creado.body.id;
    const viejo = (await api.get(`/services/${id}`).expect(200)).headers['etag'] as string;
    expect(viejo).toMatch(/^W\/"\d+"$/);

    await api.post(`/services/${id}/start`).expect(200);
    await api
      .post(`/services/${id}/suspend`, { reason: 'WEATHER' }, { 'If-Match': viejo })
      .expect(412);
    expect((await prisma.service.findUniqueOrThrow({ where: { id } })).status).toBe('IN_PROGRESS');
  });

  it('expedientes ambientales: 412 con un ETag viejo', async () => {
    const r = await api.post('/environmental-reports', { reportType: 'NOISE' }).expect(201);
    const id: string = r.body.id;
    const viejo = (await api.get(`/environmental-reports/${id}`).expect(200)).headers[
      'etag'
    ] as string;
    await api.post(`/environmental-reports/${id}/start-review`).expect(200);

    await api.post(`/environmental-reports/${id}/close`, {}, { 'If-Match': viejo }).expect(412);
    expect((await prisma.environmentalReport.findUniqueOrThrow({ where: { id } })).status).toBe(
      'UNDER_REVIEW',
    );
  });
});
