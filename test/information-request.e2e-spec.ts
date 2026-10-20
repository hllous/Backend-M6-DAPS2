import { NestExpressApplication } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../src/prisma/prisma.service';
import { Api, createTestApp, tokenFor, truncateAll } from './helpers';

/**
 * Pedir información al vecino (#169) contra la base real: la columna pendiente,
 * el outbox y el estado deducido del ticket tienen que quedar escritos juntos, y
 * la respuesta que llega por el inbox tiene que cerrar la solicitud.
 */
describe('Solicitud de información al vecino (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let api: Api;

  const ticketId = randomUUID();
  let reportId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    api = new Api(app, tokenFor(['INSPECTOR']));
    await truncateAll(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('pide información, queda pendiente y avisa a M2', async () => {
    const creado = await api
      .post('/environmental-reports', {
        reportType: 'NOISE',
        address: 'Av. Siempre Viva 742',
        ticketId,
      })
      .expect(201);
    reportId = creado.body.id;
    await api.post(`/environmental-reports/${reportId}/start-review`).expect(200);

    const res = await api
      .post(`/environmental-reports/${reportId}/request-information`, {
        message: '  Necesitamos una foto más del frente.  ',
        requiredBy: '2999-01-10',
        internalNote: 'La anterior salió movida.',
      })
      .expect(200);

    expect(res.body).toMatchObject({
      status: 'UNDER_REVIEW',
      informationRequestPending: true,
      informationRequestMessage: 'Necesitamos una foto más del frente.',
      informationRequestRequiredBy: '2999-01-11T02:59:59.000Z',
    });

    const eventos = await prisma.outboxEvent.findMany({
      where: { aggregateId: reportId, eventType: 'updateTicketStatus' },
      orderBy: { occurredAt: 'asc' },
    });
    const ultimo = eventos[eventos.length - 1].payload as Record<string, any>;
    expect(ultimo).toMatchObject({
      updateType: 'INFORMATION_REQUIRED',
      publicMessage: 'Necesitamos una foto más del frente.',
      internalMessage: 'La anterior salió movida.',
      details: {
        informationRequest: { messageForCitizen: 'Necesitamos una foto más del frente.' },
      },
    });
    const estado = await prisma.ticketM2State.findUniqueOrThrow({ where: { ticketId } });
    expect(estado.status).toBe('PENDING_INFORMATION');
  });

  it('un segundo pedido es 409 y no encola otro evento', async () => {
    const antes = await prisma.outboxEvent.count({ where: { aggregateId: reportId } });

    await api
      .post(`/environmental-reports/${reportId}/request-information`, { message: 'Otra cosa' })
      .expect(409);

    expect(await prisma.outboxEvent.count({ where: { aggregateId: reportId } })).toBe(antes);
  });

  it('la respuesta de M2 cierra la solicitud y guarda lo que contestó el vecino', async () => {
    const res = await api
      .post('/events/inbox', {
        eventId: randomUUID(),
        eventType: 'ticketUpdated',
        occurredAt: '2026-10-20T15:00:00.000Z',
        data: {
          ticketId,
          responsibleAreaId: 'M6',
          updateType: 'INFORMATION_PROVIDED',
          currentStatus: 'IN_PROGRESS',
          details: { informationResponse: { message: 'Acá va la foto de noche.' } },
          updatedAt: '2026-10-20T15:00:00.000Z',
        },
      })
      .expect(200);
    expect(res.body.status).toBe('processed');

    const detalle = await api.get(`/environmental-reports/${reportId}`).expect(200);
    expect(detalle.body).toMatchObject({
      informationRequestPending: false,
      informationRequestedAt: null,
      informationRequestMessage: null,
      informationRequestRequiredBy: null,
      citizenResponse: 'Acá va la foto de noche.',
    });
  });

  it('con la solicitud cerrada se puede pedir otra', async () => {
    await api
      .post(`/environmental-reports/${reportId}/request-information`, { message: 'Una más' })
      .expect(200);
  });
});
