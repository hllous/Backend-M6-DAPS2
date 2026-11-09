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
  unique,
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

  describe('PATCH de edición de datos', () => {
    it('contenedor: ETag vigente -> 200 y ETag nuevo; viejo -> 412 sin cambios; sin header como hoy', async () => {
      const c = await crearContenedor(api, zoneId);
      const viejo = await etagDe(c.id);

      const ok = await api
        .patch(`/containers/${c.id}`, { capacityLiters: 900 }, { 'If-Match': viejo })
        .expect(200);
      expect(ok.body.capacityLiters).toBe(900);
      expect(ok.headers['etag']).not.toBe(viejo);
      expect(ok.headers['etag']).toBe(await etagDe(c.id));

      const antes = await prisma.container.findUniqueOrThrow({ where: { id: c.id } });
      await api
        .patch(`/containers/${c.id}`, { capacityLiters: 500 }, { 'If-Match': viejo })
        .expect(412);
      const despues = await prisma.container.findUniqueOrThrow({ where: { id: c.id } });
      expect(despues.capacityLiters).toBe(900);
      expect(despues.updatedAt).toEqual(antes.updatedAt);

      await api.patch(`/containers/${c.id}`, { capacityLiters: 700 }).expect(200);
      await api
        .patch(`/containers/${c.id}`, { capacityLiters: 800 }, { 'If-Match': '*' })
        .expect(200);
    });

    it('contenedor: dos PATCH con el mismo ETag, uno gana y el otro recibe 412', async () => {
      const c = await crearContenedor(api, zoneId);
      const etag = await etagDe(c.id);
      const [a, b] = await Promise.all([
        api.patch(`/containers/${c.id}`, { capacityLiters: 600 }, { 'If-Match': etag }),
        api.patch(`/containers/${c.id}`, { capacityLiters: 700 }, { 'If-Match': etag }),
      ]);
      expect([a.status, b.status].sort()).toEqual([200, 412]);
    });

    it('servicio: ETag viejo -> 412 sin cambios; vigente -> 200; concurrencia -> [200, 412]', async () => {
      const tipo = await crearTipoServicio(api, { mode: 'POINT' });
      const c = await crearContenedor(api, zoneId);
      const crear = async () =>
        (
          await api
            .post('/services', {
              serviceTypeId: tipo.id,
              targetType: 'CONTAINER',
              targetId: c.id,
              scheduledDate: hoy(),
              origin: 'PLANNED',
            })
            .expect(201)
        ).body.id as string;
      const etagServicio = async (id: string) =>
        (await api.get(`/services/${id}`).expect(200)).headers['etag'] as string;

      const id = await crear();
      const viejo = await etagServicio(id);
      const ok = await api
        .patch(`/services/${id}`, { notes: 'primera' }, { 'If-Match': viejo })
        .expect(200);
      expect(ok.headers['etag']).not.toBe(viejo);

      await api.patch(`/services/${id}`, { notes: 'segunda' }, { 'If-Match': viejo }).expect(412);
      expect((await prisma.service.findUniqueOrThrow({ where: { id } })).notes).toBe('primera');
      await api.patch(`/services/${id}`, { notes: 'sin header' }).expect(200);

      const etag = await etagServicio(id);
      const [a, b] = await Promise.all([
        api.patch(`/services/${id}`, { notes: 'A' }, { 'If-Match': etag }),
        api.patch(`/services/${id}`, { notes: 'B' }, { 'If-Match': etag }),
      ]);
      expect([a.status, b.status].sort()).toEqual([200, 412]);
    });
  });

  it('intervenciones de arbolado: 412 con un ETag viejo y no cambia el estado', async () => {
    const arbol = await prisma.tree.create({
      data: { surveyCode: unique('ARB'), zoneId },
    });
    const creada = await api
      .post('/tree-interventions', { interventionType: 'REMOVAL', treeIds: [arbol.id] })
      .expect(201);
    const id: string = creada.body.id;
    const etagIntervencion = async () =>
      (await api.get(`/tree-interventions/${id}`).expect(200)).headers['etag'] as string;

    const viejo = await etagIntervencion();
    const ok = await api
      .post(`/tree-interventions/${id}/submit-for-authorization`, {}, { 'If-Match': viejo })
      .expect(200);
    expect(ok.headers['etag']).not.toBe(viejo);
    expect(ok.headers['etag']).toBe(await etagIntervencion());

    await api.post(`/tree-interventions/${id}/reject`, {}, { 'If-Match': viejo }).expect(412);
    const fila = await prisma.treeIntervention.findUniqueOrThrow({ where: { id } });
    expect(fila.status).toBe('PENDING_AUTHORIZATION');
  });
});
