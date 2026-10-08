import { NestExpressApplication } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  Api,
  crearRuta,
  crearTipoServicio,
  crearZona,
  createTestApp,
  hoy,
  tokenFor,
  truncateAll,
} from './helpers';

/** El sobre de la cohorte v1.70: `producer` viaja como objeto, no como string. */
function sobre(eventId: string, eventType: string, data: Record<string, unknown>) {
  return {
    specVersion: '1.70',
    eventId,
    eventType,
    eventVersion: '1.0',
    occurredAt: new Date().toISOString(),
    producer: { moduleId: 'M9', service: 'weather-service' },
    subject: `zones/${data.zoneIds ?? 'n/a'}`,
    data,
  };
}

/**
 * El lado entrante del inbox contra la base real.
 *
 * Lo que se verifica acá y no en los unitarios: que la idempotencia la dé el
 * `@unique` de `message_id` —no una consulta previa— y que un payload inválido
 * no deje fila, para que el emisor pueda reenviar el corregido con el mismo
 * eventId.
 */
describe('Inbox de eventos entrantes (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let api: Api;

  let zoneId: string;
  let serviceId: string;
  let rutaId: string;
  let tipoId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    api = new Api(app, tokenFor(['SUPERVISOR']));
    await truncateAll(prisma);

    const zona = await crearZona(api);
    zoneId = zona.id;
    const ruta = await crearRuta(api, [zoneId]);
    const tipo = await crearTipoServicio(api, { mode: 'ROUTE' });
    rutaId = ruta.id;
    tipoId = tipo.id;
    serviceId = await programarServicio();
  });

  async function programarServicio(): Promise<string> {
    const res = await api
      .post('/services', {
        serviceTypeId: tipoId,
        routeId: rutaId,
        scheduledDate: hoy(),
        origin: 'PLANNED',
      })
      .expect(201);
    return res.body.id;
  }

  afterAll(async () => {
    await app.close();
  });

  it('procesa el evento y aplica su efecto', async () => {
    const res = await api
      .post(
        '/events/inbox',
        sobre(randomUUID(), 'weatherAlertIssued', {
          alertType: 'STORM',
          severity: 'CRITICAL',
          zoneIds: [zoneId],
          from: `${hoy()}T00:00:00.000Z`,
          to: `${hoy()}T23:59:00.000Z`,
        }),
      )
      .expect(200);

    expect(res.body.status).toBe('processed');

    const servicio = await prisma.service.findUniqueOrThrow({ where: { id: serviceId } });
    expect(servicio.status).toBe('RESCHEDULED');
  });

  it('descarta el mismo eventId sin volver a aplicarlo', async () => {
    const eventId = randomUUID();
    const evento = sobre(eventId, 'weatherAlertIssued', {
      alertType: 'STORM',
      severity: 'CRITICAL',
      zoneIds: [zoneId],
      from: `${hoy()}T00:00:00.000Z`,
      to: `${hoy()}T23:59:00.000Z`,
    });

    const primera = await api.post('/events/inbox', evento).expect(200);
    expect(primera.body.status).toBe('processed');

    // Un servicio que nace después del primer envío, en la misma zona y fecha:
    // si el duplicado se volviera a aplicar, lo reprogramaría.
    const testigoId = await programarServicio();

    const segunda = await api.post('/events/inbox', evento).expect(200);
    expect(segunda.body.status).toBe('duplicate');

    const filas = await prisma.inboxEvent.findMany({ where: { messageId: eventId } });
    expect(filas).toHaveLength(1);
    expect(filas[0].processedAt).not.toBeNull();

    const testigo = await prisma.service.findUniqueOrThrow({ where: { id: testigoId } });
    expect(testigo.status).toBe('SCHEDULED');
  });

  it('rechaza con 400 el payload inválido y no guarda la fila', async () => {
    const eventId = randomUUID();

    // Falta `zoneIds`, que es lo que el handler usa para saber a qué aplicarlo.
    const res = await api
      .post('/events/inbox', sobre(eventId, 'weatherAlertIssued', { severity: 'CRITICAL' }))
      .expect(400);
    expect(res.body.message).toContain('zoneIds');

    expect(await prisma.inboxEvent.findUnique({ where: { messageId: eventId } })).toBeNull();

    // Sin fila, el emisor reenvía el corregido con el mismo eventId.
    const corregido = await api
      .post(
        '/events/inbox',
        sobre(eventId, 'weatherAlertIssued', {
          severity: 'LOW',
          zoneIds: [zoneId],
        }),
      )
      .expect(200);
    expect(corregido.body.status).toBe('processed');
  });

  it('un eventId cuyo handler falló se reintenta, y si anda queda procesado y sin error', async () => {
    const eventId = randomUUID();
    const data = { severity: 'LOW', zoneIds: [zoneId] };
    // La fila que deja un handler que tiró: sin processedAt y con el error.
    await prisma.inboxEvent.create({
      data: { messageId: eventId, eventType: 'weatherAlertIssued', payload: data, error: 'boom' },
    });

    // Otro eventType con el mismo eventId no toma la fila ni la marca procesada.
    const ajeno = await api
      .post('/events/inbox', sobre(eventId, 'eventoQueNadieEscucha', { algo: 1 }))
      .expect(200);
    expect(ajeno.body.status).toBe('duplicate');
    const intacta = await prisma.inboxEvent.findUniqueOrThrow({ where: { messageId: eventId } });
    expect(intacta.processedAt).toBeNull();
    expect(intacta.error).toBe('boom');

    const res = await api
      .post('/events/inbox', sobre(eventId, 'weatherAlertIssued', data))
      .expect(200);
    expect(res.body.status).toBe('processed');

    const fila = await prisma.inboxEvent.findUniqueOrThrow({ where: { messageId: eventId } });
    expect(fila.processedAt).not.toBeNull();
    expect(fila.error).toBeNull();
  });

  it('acepta el sobre del Core, con causationId null', async () => {
    const res = await api
      .post('/events/inbox', {
        eventId: randomUUID(),
        eventType: 'weatherAlertIssued',
        eventVersion: '1.0',
        occurredAt: '2026-09-29T18:00:00Z',
        sourceModule: 'clima',
        correlationId: randomUUID(),
        causationId: null,
        data: { severity: 'LOW', zoneIds: [zoneId] },
      })
      .expect(200);

    expect(res.body.status).toBe('processed');
  });

  it('registra y descarta un evento sin handler', async () => {
    const eventId = randomUUID();
    const res = await api
      .post('/events/inbox', sobre(eventId, 'eventoQueNadieEscucha', { algo: 1 }))
      .expect(200);

    expect(res.body.status).toBe('ignored');

    const fila = await prisma.inboxEvent.findUniqueOrThrow({ where: { messageId: eventId } });
    // Queda el marcador de idempotencia, no el contenido de negocio ajeno.
    expect(fila.payload).toEqual({ redacted: 'contenido no persistido' });
  });
});
