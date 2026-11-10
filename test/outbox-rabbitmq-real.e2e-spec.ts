import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { OutboxEventStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { connect, ChannelModel, Channel, ConsumeMessage } from 'amqplib';
import { MAX_ATTEMPTS, OutboxDispatcher } from '../src/events/outbox/outbox-dispatcher.service';
import { RabbitMqEventPublisher } from '../src/events/publishers/rabbitmq.publisher';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, truncateAll } from './helpers';

/**
 * El lado de publicación del outbox contra un RabbitMQ REAL (#618): el
 * OutboxDispatcher real con el RabbitMqEventPublisher real, y una cola propia
 * enlazada a `muni.inbox` para ver lo que llega.
 *
 * Se saltea sin RABBITMQ_URL o si no apunta a localhost (igual que
 * rabbitmq-real). La variable se borra del entorno antes de levantar la app para
 * no activar el consumer; el publisher y el dispatcher se arman a mano (el
 * helper reemplaza el dispatcher de la app por un stub sin @Interval).
 *
 * La caída del broker se simula apuntando el publisher a un puerto cerrado y
 * luego a RabbitMQ real: corre igual en el CI, donde no se puede apagar el
 * servicio. No hay variante con `docker stop`: apagaría un broker que puede ser
 * compartido y la cola de prueba moriría con él.
 */
const url = process.env.RABBITMQ_URL;
delete process.env.RABBITMQ_URL;
const local = !!url && ['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname);
const describeReal = local ? describe : describe.skip;
if (!local) {
  console.warn(
    `[outbox-rabbitmq-real] saltado: ${url ? 'RABBITMQ_URL no apunta a localhost' : 'falta RABBITMQ_URL (ver docs/testing.md)'}`,
  );
}

const EXCHANGE = 'muni.inbox';
const NOMBRE_TEST = 'm6-e2e-outbox-consumer';
// Puerto reservado, sin nada escuchando: la conexión se rechaza al instante.
const URL_SIN_BROKER = 'amqp://guest:guest@127.0.0.1:1';

const esperar = async (cond: () => boolean, ms = 15_000): Promise<void> => {
  const limite = Date.now() + ms;
  while (Date.now() < limite) {
    if (cond()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('timeout esperando la condición');
};

/** Quieta cuando `n()` no cambia durante `ventanaMs`: ventana corta y acotada, no hay señal del broker para "no llega más". */
const estabilizar = async (n: () => number, ventanaMs = 600, ms = 15_000): Promise<void> => {
  const limite = Date.now() + ms;
  let ultimo = n();
  let desde = Date.now();
  while (Date.now() < limite) {
    await new Promise((r) => setTimeout(r, 100));
    if (n() !== ultimo) {
      ultimo = n();
      desde = Date.now();
    } else if (Date.now() - desde >= ventanaMs) return;
  }
  throw new Error('la cola no se estabilizó');
};

describeReal('Outbox -> RabbitMQ con broker real (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let config: ConfigService;
  let conn: ChannelModel;
  let ch: Channel;
  let queue: string;
  let recibidos: ConsumeMessage[] = [];
  const publishers: RabbitMqEventPublisher[] = [];

  const dispatcherCon = (brokerUrl: string) => {
    const p = new RabbitMqEventPublisher({
      url: brokerUrl,
      exchange: EXCHANGE,
      queue: 'no-usada',
      prefetch: 1,
    });
    publishers.push(p);
    return new OutboxDispatcher(prisma, p, config);
  };

  const encolar = async (n: number): Promise<string[]> => {
    const ids: string[] = [];
    for (let i = 0; i < n; i++) {
      const row = await prisma.outboxEvent.create({
        data: {
          eventType: 'serviceCompleted',
          aggregateType: 'Service',
          aggregateId: randomUUID(),
          payload: { n: i },
          // Fechas fijas y crecientes: el barrido ordena por occurredAt.
          occurredAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)),
        },
      });
      ids.push(row.id);
    }
    return ids;
  };
  const estado = (ids: string[]) =>
    prisma.outboxEvent.findMany({ where: { id: { in: ids } }, orderBy: { occurredAt: 'asc' } });
  const idsRecibidos = () => recibidos.map((m) => m.properties.messageId as string);

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    config = app.get(ConfigService);

    conn = await connect(url!, { clientProperties: { connection_name: NOMBRE_TEST } });
    ch = await conn.createChannel();
    // El exchange es del Core; en un broker vacío se declara igual que él (fanout).
    await ch.assertExchange(EXCHANGE, 'fanout', { durable: true });
    queue = (await ch.assertQueue('', { exclusive: true })).queue;
    await ch.bindQueue(queue, EXCHANGE, '');
    await ch.consume(queue, (m) => m && recibidos.push(m), { noAck: true });
  });

  beforeEach(async () => {
    await truncateAll(prisma);
    await ch.purgeQueue(queue);
    recibidos = [];
  });

  afterAll(async () => {
    await Promise.all(publishers.map((p) => p.onModuleDestroy().catch(() => undefined)));
    await conn?.close().catch(() => undefined);
    await app?.close();
  });

  it('publica las filas PENDING al exchange y las marca SENT', async () => {
    const ids = await encolar(3);

    await dispatcherCon(url!).dispatchPending();

    await esperar(() => recibidos.length === 3);
    expect(idsRecibidos()).toEqual(ids);
    expect(JSON.parse(recibidos[0].content.toString())).toMatchObject({
      eventId: ids[0],
      eventType: 'serviceCompleted',
      data: { n: 0 },
    });
    for (const fila of await estado(ids)) {
      expect(fila.status).toBe(OutboxEventStatus.SENT);
      expect(fila.attempts).toBe(1);
      expect(fila.publishedAt).not.toBeNull();
      expect(fila.lastError).toBeNull();
    }
  });

  it('con el broker caído las filas quedan PENDING con el intento contado, y al volver se reenvían una sola vez', async () => {
    const ids = await encolar(3);

    // Dos barridas con el broker inalcanzable: bien por debajo de MAX_ATTEMPTS.
    const caido = dispatcherCon(URL_SIN_BROKER);
    await caido.dispatchPending();
    await caido.dispatchPending();

    for (const fila of await estado(ids)) {
      expect(fila.status).toBe(OutboxEventStatus.PENDING);
      expect(fila.attempts).toBe(2);
      expect(fila.lastError).toBeTruthy();
      expect(fila.publishedAt).toBeNull();
    }
    expect(recibidos).toHaveLength(0);

    // El broker vuelve; una barrida más después comprueba que no se duplica.
    const vivo = dispatcherCon(url!);
    await vivo.dispatchPending();
    await esperar(() => recibidos.length >= 3);
    await vivo.dispatchPending();

    // Solo se afirma cuando dejó de llegar: un duplicado tardío no se escapa.
    await estabilizar(() => recibidos.length);
    expect(recibidos).toHaveLength(3);
    expect(new Set(idsRecibidos()).size).toBe(3);
    expect([...idsRecibidos()].sort()).toEqual([...ids].sort());
    for (const fila of await estado(ids)) {
      expect(fila.status).toBe(OutboxEventStatus.SENT);
      expect(fila.attempts).toBe(3);
      expect(fila.lastError).toBeNull();
    }
  });

  // Diseño: al agotar MAX_ATTEMPTS la fila queda FAILED y no se reintenta sola (reintento manual);
  // el reenvío al volver el broker vale dentro del margen de MAX_ATTEMPTS.
  it('agotados los reintentos con el broker caído, la fila pasa a FAILED y deja de tomarse', async () => {
    const [id] = await encolar(1);
    const caido = dispatcherCon(URL_SIN_BROKER);

    for (let i = 1; i < MAX_ATTEMPTS; i++) {
      await caido.dispatchPending();
      expect((await estado([id]))[0].status).toBe(OutboxEventStatus.PENDING);
    }
    await caido.dispatchPending();
    const fila = (await estado([id]))[0];
    expect(fila.status).toBe(OutboxEventStatus.FAILED);
    expect(fila.attempts).toBe(MAX_ATTEMPTS);

    await dispatcherCon(url!).dispatchPending();
    await estabilizar(() => recibidos.length);
    expect(recibidos).toHaveLength(0);
    expect((await estado([id]))[0].attempts).toBe(MAX_ATTEMPTS);
  });

  // El broker no se apaga en el CI, pero la API de management cierra la
  // conexión del publisher: al dispatcher le llega lo mismo que ante una caída.
  // Solo se cierra la conexión que el publisher abrió (la que aparece de más
  // tras su primer envío), no las ajenas.
  it('un publisher con conexión viva que pierde el broker se recupera y reenvía sin pérdida ni duplicados', async () => {
    const u = new URL(url!);
    const mgmt = process.env.RABBITMQ_MGMT_URL ?? `http://${u.hostname}:15672`;
    if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(mgmt).hostname)) {
      console.warn(
        '[outbox-rabbitmq-real] recuperación saltada: RABBITMQ_MGMT_URL no apunta a localhost',
      );
      return;
    }
    const auth = `Basic ${Buffer.from(`${decodeURIComponent(u.username)}:${decodeURIComponent(u.password)}`).toString('base64')}`;
    const conexiones = async () => {
      const r = await fetch(`${mgmt}/api/connections`, { headers: { Authorization: auth } });
      return (await r.json()) as {
        name: string;
        client_properties?: { connection_name?: string };
      }[];
    };
    const ajenas = async () =>
      (await conexiones()).filter((c) => c.client_properties?.connection_name !== NOMBRE_TEST);

    const previas = new Set((await ajenas()).map((c) => c.name));
    const vivo = dispatcherCon(url!);
    const [a] = await encolar(1);
    await vivo.dispatchPending();
    expect((await estado([a]))[0].status).toBe(OutboxEventStatus.SENT);

    // Management refresca cada ~5 s: la conexión nueva tarda en aparecer.
    let propia: { name: string }[] = [];
    const limite = Date.now() + 20_000;
    while (!propia.length && Date.now() < limite) {
      propia = (await ajenas()).filter((c) => !previas.has(c.name));
      if (!propia.length) await new Promise((r) => setTimeout(r, 250));
    }
    expect(propia).toHaveLength(1);
    await fetch(`${mgmt}/api/connections/${encodeURIComponent(propia[0].name)}`, {
      method: 'DELETE',
      headers: { Authorization: auth },
    });

    const nuevos = await encolar(2);
    const todos = [a, ...nuevos];
    // Barridas hasta que todo esté SENT: las que caen en la ventana del corte
    // dejan la fila PENDING (nunca FAILED) y la siguiente barrida reconecta.
    const limite2 = Date.now() + 30_000;
    let enviadas = false;
    while (!enviadas && Date.now() < limite2) {
      await vivo.dispatchPending();
      const filas = await estado(nuevos);
      for (const f of filas) {
        expect(f.status).not.toBe(OutboxEventStatus.FAILED);
        expect(f.attempts).toBeLessThan(MAX_ATTEMPTS);
      }
      enviadas = filas.every((f) => f.status === OutboxEventStatus.SENT);
      if (!enviadas) await new Promise((r) => setTimeout(r, 200));
    }
    expect(enviadas).toBe(true);

    await estabilizar(() => recibidos.length);
    expect([...idsRecibidos()].sort()).toEqual([...todos].sort());
    expect(new Set(idsRecibidos()).size).toBe(3);
  }, 90_000);
});
