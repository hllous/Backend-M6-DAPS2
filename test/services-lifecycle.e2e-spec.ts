import { NestExpressApplication } from '@nestjs/platform-express';
import * as request from 'supertest';
import { OutboxEventStatus } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  Api,
  crearCuadrilla,
  crearRuta,
  crearTipoServicio,
  crearZona,
  createTestApp,
  hoy,
  tokenFor,
  truncateAll,
} from './helpers';

/**
 * El ciclo completo de un servicio urbano contra la base real: programar,
 * asignar, iniciar, informar el resultado por zona y cerrar.
 *
 * Es el recorrido que los tests unitarios no cubren, porque ahí Prisma está
 * mockeado y la máquina de estados nunca ve una fila de verdad ni se comprueba
 * que las filas del outbox queden escritas. Que se escriban en la misma
 * transacción (el rollback) lo prueba `containers-close.e2e-spec.ts`.
 */
describe('Ciclo de vida de un servicio urbano (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let api: Api;

  let zoneId: string;
  let serviceId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    api = new Api(app, tokenFor(['SUPERVISOR']));
    await truncateAll(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  /**
   * Fija el contrato de hoy: sin token no se entra. Los roles que pasan estas
   * suites (SUPERVISOR, INSPECTOR) todavia no los chequea nadie —`@Roles()` entra
   * cuando M1 publique su catalogo, ver ADR-005—, asi que sin este caso la suite
   * se leeria como evidencia de una segregacion por rol que no existe.
   * Cuando entre `@Roles()`, sumar aca el 403 con un rol sin permiso.
   */
  it('rechaza con 401 un pedido sin token', async () => {
    await request(app.getHttpServer()).get('/services').expect(401);
  });

  /**
   * Lo que agrega `configureApp()` sobre la app pelada. Si los e2e no lo
   * levantaran igual que `main.ts`, estos dos casos pasarían en rojo.
   */
  it('rechaza con 400 un body con propiedades que el DTO no declara', async () => {
    const res = await api.post('/zones', { code: 'ZN-EXTRA', name: 'Zona', sobra: true });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body.message)).toContain('sobra');
  });

  it('manda las cabeceras de seguridad y no anuncia el framework', async () => {
    const res = await request(app.getHttpServer()).get('/services');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  /** #216: el catálogo mostraba "Sin paradas" porque el listado no las traía. */
  it('el listado de recorridos trae las paradas en orden, igual que el detalle', async () => {
    const primera = await crearZona(api);
    const segunda = await crearZona(api);
    // Se cargan al revés del orden de creación para que el orden no salga del id.
    const ruta = await crearRuta(api, [segunda.id, primera.id]);
    const detalle = await api.get(`/routes/${ruta.id}`).expect(200);

    const listado = await api.get('/routes?pageSize=100').expect(200);
    const enListado = listado.body.data.find((r: { id: string }) => r.id === ruta.id);

    expect(enListado.stops.map((s: { zoneId: string }) => s.zoneId)).toEqual([
      segunda.id,
      primera.id,
    ]);
    expect(enListado.stops).toEqual(detalle.body.stops);
  });

  it('programa el servicio y encola urbanServiceScheduled en el outbox', async () => {
    const zona = await crearZona(api);
    zoneId = zona.id;
    const ruta = await crearRuta(api, [zoneId]);
    const tipo = await crearTipoServicio(api, { mode: 'ROUTE' });

    const res = await api
      .post('/services', {
        serviceTypeId: tipo.id,
        routeId: ruta.id,
        scheduledDate: hoy(),
        origin: 'TICKET',
        ticketId: 'TCK-E2E-0001',
      })
      .expect(201);

    serviceId = res.body.id;
    expect(res.body.status).toBe('SCHEDULED');
    expect(res.body.zones).toHaveLength(1);

    const encolados = await prisma.outboxEvent.findMany({ where: { aggregateId: serviceId } });
    expect(encolados).toHaveLength(1);
    expect(encolados[0]).toMatchObject({
      eventType: 'urbanServiceScheduled',
      aggregateType: 'SERVICE',
      status: OutboxEventStatus.PENDING,
    });
  });

  it('rechaza con 409 una transición que la tabla no admite', async () => {
    // SCHEDULED no admite SUSPENDED: hay que iniciar primero.
    const res = await api.post(`/services/${serviceId}/suspend`, { reason: 'Prueba e2e' });
    expect(res.status).toBe(409);
    expect(res.body.message).toContain('SCHEDULED');
  });

  it('no deja iniciar sin cuadrilla y sí después de asignarla', async () => {
    await api.post(`/services/${serviceId}/start`).expect(409);

    const cuadrilla = await crearCuadrilla(api);
    const asignado = await api
      .post(`/services/${serviceId}/assign-crew`, { crewId: cuadrilla.id })
      .expect(200);
    expect(asignado.body.crewId).toBe(cuadrilla.id);

    const iniciado = await api.post(`/services/${serviceId}/start`).expect(200);
    expect(iniciado.body.status).toBe('IN_PROGRESS');
  });

  it('informa el resultado de la zona y cierra el servicio como COMPLETED', async () => {
    await api
      .post(`/services/${serviceId}/zone-results`, { zoneId, status: 'SERVICED' })
      .expect(201);

    const cerrado = await api.post(`/services/${serviceId}/complete`).expect(200);
    expect(cerrado.body.status).toBe('COMPLETED');

    const persistido = await prisma.service.findUniqueOrThrow({ where: { id: serviceId } });
    expect(persistido.status).toBe('COMPLETED');
  });

  it('deja el servicio cerrado como estado final', async () => {
    const res = await api.post(`/services/${serviceId}/start`);
    expect(res.status).toBe(409);
    expect(res.body.message).toContain('COMPLETED');
  });

  it('proyecta hacia M2 los cambios del servicio nacido de un reclamo', async () => {
    const tipos = await prisma.outboxEvent.findMany({
      where: { aggregateId: serviceId },
      // occurredAt lo pone el cliente con precisión de ms: dos eventos del mismo
      // request pueden empatar, y ahí el orden de Postgres no está garantizado.
      orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
      select: { eventType: true, payload: true, status: true },
    });

    expect(tipos.map((e) => e.eventType)).toEqual([
      'urbanServiceScheduled',
      'updateTicketStatus',
      'updateTicketStatus',
    ]);
    // Nada se publicó: el dispatcher está stubbeado, así que la cola es la
    // prueba de que el evento se escribió junto al cambio de dominio.
    expect(tipos.every((e) => e.status === OutboxEventStatus.PENDING)).toBe(true);

    const ticketIds = tipos
      .filter((e) => e.eventType === 'updateTicketStatus')
      .map((e) => (e.payload as { ticketId: string }).ticketId);
    expect(ticketIds).toEqual(['TCK-E2E-0001', 'TCK-E2E-0001']);
  });
});
