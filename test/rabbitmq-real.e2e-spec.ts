import { NestExpressApplication } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import { connect, ChannelModel, Channel } from 'amqplib';
import { PrismaService } from '../src/prisma/prisma.service';
import { InboxService } from '../src/events/inbox/inbox.service';
import { RabbitMqConsumer } from '../src/events/consumers/rabbitmq.consumer';
import { createTestApp, truncateAll } from './helpers';

/**
 * El consumer del bus contra un RabbitMQ REAL (#575): lo que los unitarios, con
 * amqplib mockeado, no pueden ver (ack/nack de verdad, reentrega, reconexión).
 *
 * Se saltea sin RABBITMQ_URL, y también si no apunta a localhost: igual que el
 * guard de la base, para no publicar jamás en el broker desplegado.
 *
 * El mismo RABBITMQ_URL activaría el consumer de la app en TODAS las suites
 * (contra una `q.ambiente` que no existe), así que se lee y se borra del
 * entorno antes de levantar la app; el consumer del test se arma a mano con una
 * cola propia. En el CI corre en un paso aparte con la variable puesta.
 */
const url = process.env.RABBITMQ_URL;
delete process.env.RABBITMQ_URL;
const local = !!url && ['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname);
const describeReal = local ? describe : describe.skip;
if (!local) {
  console.warn(
    `[rabbitmq-real] saltado: ${url ? 'RABBITMQ_URL no apunta a localhost' : 'falta RABBITMQ_URL (RabbitMQ local, ver docs/testing.md)'}`,
  );
}

const esperar = async (cond: () => Promise<boolean>, ms = 15_000): Promise<void> => {
  const limite = Date.now() + ms;
  while (Date.now() < limite) {
    if (await cond()) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('timeout esperando la condición');
};

function sobre(eventId: string) {
  return {
    specVersion: '1.70',
    eventId,
    eventType: 'weatherAlertIssued',
    eventVersion: '1.0',
    occurredAt: new Date().toISOString(),
    producer: { moduleId: 'M9', service: 'weather-service' },
    subject: 'zones/n/a',
    data: {
      alertType: 'STORM',
      severity: 'CRITICAL',
      zoneIds: [randomUUID()],
      from: new Date().toISOString(),
      to: new Date(Date.now() + 3_600_000).toISOString(),
    },
  };
}

describeReal('Consumer RabbitMQ con broker real (e2e)', () => {
  const queue = `q.test-${randomUUID()}`;
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let consumer: RabbitMqConsumer;
  let conn: ChannelModel;
  let ch: Channel;

  const publicar = (body: unknown, eventId: string) =>
    ch.sendToQueue(queue, Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)), {
      messageId: eventId,
      contentType: 'application/json',
    });
  const filas = (eventId: string) => prisma.inboxEvent.findMany({ where: { messageId: eventId } });
  const procesado = (eventId: string) => async () =>
    (await filas(eventId)).some((f) => f.processedAt !== null);

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await truncateAll(prisma);

    conn = await connect(url!, { clientProperties: { connection_name: 'm6-e2e-publisher' } });
    ch = await conn.createChannel();
    // El consumer verifica la cola en modo pasivo: la crea quien la dueña (el Core).
    await ch.assertQueue(queue, { durable: false });

    consumer = new RabbitMqConsumer(
      { url: url!, exchange: 'muni.inbox', queue, prefetch: 1 },
      app.get(InboxService),
    );
    await consumer.onApplicationBootstrap();
  });

  afterAll(async () => {
    await consumer?.onModuleDestroy();
    await ch?.deleteQueue(queue).catch(() => undefined);
    await conn?.close().catch(() => undefined);
    await app?.close();
  });

  it('procesa un mensaje válido', async () => {
    const id = randomUUID();
    publicar(sobre(id), id);
    await esperar(procesado(id));
    expect(await filas(id)).toHaveLength(1);
  });

  it('un eventId repetido se procesa una sola vez', async () => {
    const id = randomUUID();
    publicar(sobre(id), id);
    publicar(sobre(id), id);
    // Un testigo posterior: la cola es FIFO con prefetch 1, así que cuando está
    // procesado el duplicado ya pasó por el consumer.
    const testigo = randomUUID();
    publicar(sobre(testigo), testigo);
    await esperar(procesado(testigo));
    expect(await filas(id)).toHaveLength(1);
  });

  it('un mensaje inválido no deja fila ni traba al consumer', async () => {
    const antes = await prisma.inboxEvent.count();
    publicar('{no es json', randomUUID());
    publicar({ eventId: randomUUID() }, randomUUID());
    const siguiente = randomUUID();
    publicar(sobre(siguiente), siguiente);
    await esperar(procesado(siguiente));
    await esperar(async () => (await ch.checkQueue(queue)).messageCount === 0);
    // Solo el válido dejó fila.
    expect(await prisma.inboxEvent.count()).toBe(antes + 1);
  });

  // El broker no se puede apagar desde un service container del CI, pero la
  // API de management (rabbitmq:3-management) sí cierra conexiones: al consumer
  // le llega lo mismo que ante una caída y `recovery` tiene que reconectar.
  it('se recupera cuando el broker le cierra la conexión', async () => {
    const u = new URL(url!);
    const mgmt = process.env.RABBITMQ_MGMT_URL ?? `http://${u.hostname}:15672`;
    const auth = `Basic ${Buffer.from(`${decodeURIComponent(u.username)}:${decodeURIComponent(u.password)}`).toString('base64')}`;

    const lista = await fetch(`${mgmt}/api/connections`, { headers: { Authorization: auth } });
    expect(lista.ok).toBe(true);
    const conexiones = (await lista.json()) as {
      name: string;
      client_properties?: { connection_name?: string };
    }[];
    // Todas menos la del publisher del test: lo que queda es la del consumer.
    const victimas = conexiones.filter(
      (c) => c.client_properties?.connection_name !== 'm6-e2e-publisher',
    );
    expect(victimas.length).toBeGreaterThan(0);
    for (const c of victimas) {
      await fetch(`${mgmt}/api/connections/${encodeURIComponent(c.name)}`, {
        method: 'DELETE',
        headers: { Authorization: auth },
      });
    }

    const id = randomUUID();
    publicar(sobre(id), id);
    await esperar(procesado(id), 30_000);
  });
});
