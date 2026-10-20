import { NestExpressApplication } from '@nestjs/platform-express';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  Api,
  crearCuadrilla,
  crearTipoServicio,
  crearZona,
  createTestApp,
  hoy,
  tokenFor,
  truncateAll,
  unique,
} from './helpers';

/**
 * #324: treePruningScheduled se difiere si al asociar el servicio faltan
 * cuadrilla o franja, y sale una sola vez cuando el servicio los completa.
 */
describe('treePruningScheduled diferido (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let api: Api;
  let zonaId: string;
  let tipoId: string;
  let crewId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    api = new Api(app, tokenFor(['SUPERVISOR']));
    await truncateAll(prisma);
    zonaId = (await crearZona(api)).id;
    tipoId = (await crearTipoServicio(api, { mode: 'POINT', category: 'TREES' })).id;
    crewId = (await crearCuadrilla(api)).id;
  });

  afterAll(async () => {
    await app.close();
  });

  /** Una poda autorizada sobre un árbol, y un servicio POINT sin cuadrilla ni franja. */
  async function podaYServicio(servicio: Record<string, unknown> = {}) {
    const arbol = await prisma.tree.create({ data: { surveyCode: unique('AR'), zoneId: zonaId } });
    const intervencion = await prisma.treeIntervention.create({
      data: {
        interventionType: 'SAFETY_PRUNING',
        status: 'AUTHORIZED',
        trees: { create: { treeId: arbol.id } },
      },
    });
    const svc = await api
      .post('/services', {
        serviceTypeId: tipoId,
        scheduledDate: hoy(),
        origin: 'PLANNED',
        targetType: 'TREE',
        targetId: arbol.id,
        ...servicio,
      })
      .expect(201);
    return { intervencionId: intervencion.id, servicioId: svc.body.id as string };
  }

  const asociar = (intervencionId: string, serviceId: string) =>
    api.post(`/tree-interventions/${intervencionId}/assign-service`, { serviceId }).expect(200);

  const emitidos = (intervencionId: string) =>
    prisma.outboxEvent.count({
      where: { eventType: 'treePruningScheduled', aggregateId: intervencionId },
    });

  it('se difiere hasta que el servicio tiene cuadrilla y franja, y sale una sola vez', async () => {
    const { intervencionId, servicioId } = await podaYServicio();

    await asociar(intervencionId, servicioId);
    expect(await emitidos(intervencionId)).toBe(0);

    await api.post(`/services/${servicioId}/assign-crew`, { crewId }).expect(200);
    expect(await emitidos(intervencionId)).toBe(0);

    await api
      .patch(`/services/${servicioId}`, { windowFrom: '07:00', windowTo: '11:00' })
      .expect(200);
    expect(await emitidos(intervencionId)).toBe(1);
    const evento = await prisma.outboxEvent.findFirstOrThrow({
      where: { eventType: 'treePruningScheduled', aggregateId: intervencionId },
    });
    expect(evento.payload).toMatchObject({
      interventionId: intervencionId,
      serviceId: servicioId,
      crewId,
      timeWindow: { from: '07:00', to: '11:00' },
    });

    // Un cambio posterior no lo reenvía.
    await api
      .patch(`/services/${servicioId}`, { windowFrom: '08:00', windowTo: '12:00' })
      .expect(200);
    await api.post(`/services/${servicioId}/assign-crew`, { crewId }).expect(200);
    expect(await emitidos(intervencionId)).toBe(1);
  });

  it('asociar con cuadrilla y franja completas emite al asociar y no de nuevo después', async () => {
    // Otro día: la cuadrilla ya tiene el primer servicio y se solaparía.
    const mañana = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const { intervencionId, servicioId } = await podaYServicio({
      scheduledDate: mañana,
      crewId,
      windowFrom: '07:00',
      windowTo: '11:00',
    });

    await asociar(intervencionId, servicioId);
    expect(await emitidos(intervencionId)).toBe(1);

    await api
      .patch(`/services/${servicioId}`, { windowFrom: '08:00', windowTo: '12:00' })
      .expect(200);
    expect(await emitidos(intervencionId)).toBe(1);
  });

  it('un servicio RESCHEDULED no emite hasta confirmar la nueva fecha', async () => {
    const { intervencionId, servicioId } = await podaYServicio({ scheduledDate: '2098-01-01' });
    await asociar(intervencionId, servicioId);
    await api.post(`/services/${servicioId}/reschedule`, { reason: 'lluvia' }).expect(200);

    await api.post(`/services/${servicioId}/assign-crew`, { crewId }).expect(200);
    await api
      .patch(`/services/${servicioId}`, { windowFrom: '07:00', windowTo: '11:00' })
      .expect(200);
    expect(await emitidos(intervencionId)).toBe(0);

    await api
      .post(`/services/${servicioId}/confirm-reschedule`, { scheduledDate: '2098-02-02' })
      .expect(200);
    expect(await emitidos(intervencionId)).toBe(1);
    const evento = await prisma.outboxEvent.findFirstOrThrow({
      where: { eventType: 'treePruningScheduled', aggregateId: intervencionId },
    });
    expect(evento.payload).toMatchObject({ scheduledDate: '2098-02-02' });
  });
});
