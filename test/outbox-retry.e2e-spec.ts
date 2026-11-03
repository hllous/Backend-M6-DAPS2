import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../src/prisma/prisma.service';
import { OutboxDispatcher } from '../src/events/outbox/outbox-dispatcher.service';
import { EventPublisher } from '../src/events/publishers/event-publisher.port';
import { EventEnvelope } from '../src/events/envelope';
import { Api, ACTORES, createTestApp, truncateAll, seedActores } from './helpers';

/**
 * Consulta y reintento manual del outbox contra la base real.
 *
 * El dispatcher de createTestApp está stubbeado (no barre solo); acá se arma uno
 * real con un publicador simulado para recorrer FAILED → retry → SENT.
 */
describe('Outbox: consulta y reintento (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let api: Api;
  let dispatcher: OutboxDispatcher;
  const publicados: EventEnvelope[] = [];

  const publicador: EventPublisher = {
    transport: 'simulado',
    publish: async (envelope) => {
      publicados.push(envelope);
    },
  };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    api = Api.porRol(app);
    dispatcher = new OutboxDispatcher(prisma, publicador, app.get(ConfigService));
    await truncateAll(prisma);
    await seedActores(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  const crear = (status: 'PENDING' | 'SENT' | 'FAILED', over: Record<string, unknown> = {}) =>
    prisma.outboxEvent.create({
      data: {
        eventType: 'containerDamaged',
        aggregateType: 'CONTAINER',
        aggregateId: randomUUID(),
        payload: { containerId: randomUUID() },
        status,
        attempts: status === 'FAILED' ? 5 : 0,
        lastError: status === 'FAILED' ? 'connect ECONNREFUSED' : null,
        ...over,
      },
    });

  it('FAILED → retry → PENDING → el dispatcher lo publica → SENT, y queda auditado', async () => {
    const fallido = await crear('FAILED');

    const res = await api.post(`/events/outbox/${fallido.id}/retry`).expect(200);
    expect(res.body).toMatchObject({ id: fallido.id, status: 'PENDING', attempts: 0 });
    expect(res.body.lastError).toBeNull();

    await dispatcher.dispatchPending();

    const enviado = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: fallido.id } });
    expect(enviado.status).toBe('SENT');
    expect(enviado.publishedAt).not.toBeNull();
    // Mismo eventId que la primera vez: el receptor deduplica por él.
    expect(publicados.map((e) => e.eventId)).toContain(fallido.id);

    const auditoria = await prisma.outboxRetryAudit.findMany({
      where: { outboxEventId: fallido.id },
    });
    expect(auditoria).toHaveLength(1);
    expect(auditoria[0]).toMatchObject({
      actorUserId: ACTORES.admin.userId,
      previousAttempts: 5,
      previousError: 'connect ECONNREFUSED',
    });

    const detalle = await api.get(`/events/outbox/${fallido.id}`).expect(200);
    expect(detalle.body.payload).toEqual(fallido.payload);
    expect(detalle.body.retries).toHaveLength(1);
  });

  it('reintentar un SENT o un PENDING da 409 y no audita', async () => {
    const enviado = await crear('SENT');
    const pendiente = await crear('PENDING');

    await api.post(`/events/outbox/${enviado.id}/retry`).expect(409);
    await api.post(`/events/outbox/${pendiente.id}/retry`).expect(409);

    expect(
      await prisma.outboxRetryAudit.count({
        where: { outboxEventId: { in: [enviado.id, pendiente.id] } },
      }),
    ).toBe(0);
  });

  it('el listado filtra por estado y no expone el payload', async () => {
    await crear('FAILED');

    const res = await api.get('/events/outbox?status=FAILED').expect(200);

    expect(res.body.data.length).toBeGreaterThan(0);
    for (const fila of res.body.data) {
      expect(fila.status).toBe('FAILED');
      expect(fila).not.toHaveProperty('payload');
    }
  });

  it('retry-failed exige confirm: true y reencola con tope', async () => {
    await api.post('/events/outbox/retry-failed', { confirm: 'false' }).expect(400);
    await api.post('/events/outbox/retry-failed', {}).expect(400);

    await crear('FAILED');
    await crear('FAILED');
    const res = await api
      .post('/events/outbox/retry-failed', { confirm: true, limit: 1 })
      .expect(200);

    expect(res.body.requeued).toBe(1);
    expect(res.body.remainingFailed).toBeGreaterThanOrEqual(1);
  });
});
