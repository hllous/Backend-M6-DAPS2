import { EventEmitter } from 'events';
import { ConfigService } from '@nestjs/config';
import { connect } from 'amqplib';
import { RabbitMqEventPublisher } from './rabbitmq.publisher';
import { EventEnvelope } from '../envelope';
import { RabbitMqConfig } from '../rabbitmq';
import { createEventPublisher } from '../events.module';
import { LoggingEventPublisher } from './logging.publisher';

jest.mock('amqplib', () => ({ connect: jest.fn() }));

type ConfirmCallback = (err: unknown) => void;

function fakeChannel() {
  const channel = Object.assign(new EventEmitter(), {
    checkExchange: jest.fn().mockResolvedValue(undefined),
    publish: jest.fn(
      (_ex: string, _rk: string, _body: Buffer, _opts: unknown, cb: ConfirmCallback) => {
        cb(null);
        return true;
      },
    ),
  });
  return channel;
}

function fakeConnection(channel: ReturnType<typeof fakeChannel>) {
  return Object.assign(new EventEmitter(), {
    createConfirmChannel: jest.fn().mockResolvedValue(channel),
    close: jest.fn().mockResolvedValue(undefined),
  });
}

describe('RabbitMqEventPublisher', () => {
  const config: RabbitMqConfig = {
    url: 'amqp://usuario:secreto@broker:5672/m6',
    exchange: 'muni.inbox',
    queue: 'q.ambiente',
    prefetch: 10,
  };

  const envelope: EventEnvelope = {
    eventId: 'ev-1',
    eventType: 'urbanServiceScheduled',
    eventVersion: '1.0',
    occurredAt: '2026-01-01T00:00:00.000Z',
    sourceModule: 'ambiente',
    data: { serviceId: 'svc-1' },
  };

  let channel: ReturnType<typeof fakeChannel>;
  let connection: ReturnType<typeof fakeConnection>;
  const connectMock = connect as jest.Mock;

  beforeEach(() => {
    channel = fakeChannel();
    connection = fakeConnection(channel);
    connectMock.mockReset().mockResolvedValue(connection);
  });

  it('no conecta hasta la primera publicación', () => {
    const publisher = new RabbitMqEventPublisher(config);
    expect(publisher.transport).toBe('rabbitmq');
    expect(connectMock).not.toHaveBeenCalled();
  });

  it('conecta una sola vez, verifica el exchange del Core y publica con routing key = eventType', async () => {
    const publisher = new RabbitMqEventPublisher(config);

    await publisher.publish(envelope);
    await publisher.publish(envelope);

    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(connectMock).toHaveBeenCalledWith(config.url, { timeout: 10_000 });
    expect(channel.checkExchange).toHaveBeenCalledWith('muni.inbox');
    expect(channel.publish).toHaveBeenCalledTimes(2);

    const [exchange, routingKey, body, options] = channel.publish.mock.calls[0];
    expect(exchange).toBe('muni.inbox');
    expect(routingKey).toBe('urbanServiceScheduled');
    expect(JSON.parse(body.toString())).toEqual(envelope);
    expect(options).toEqual({
      persistent: true,
      mandatory: true,
      contentType: 'application/json',
      messageId: 'ev-1',
      type: 'urbanServiceScheduled',
      appId: 'ambiente',
      headers: { eventId: 'ev-1', eventType: 'urbanServiceScheduled', sourceModule: 'ambiente' },
    });
  });

  it('dos publicaciones concurrentes comparten el mismo intento de conexión', async () => {
    const publisher = new RabbitMqEventPublisher(config);

    await Promise.all([publisher.publish(envelope), publisher.publish(envelope)]);

    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(channel.publish).toHaveBeenCalledTimes(2);
  });

  it('si la conexión falla, un intento posterior vuelve a probar', async () => {
    connectMock.mockRejectedValueOnce(new Error('broker caído'));
    const publisher = new RabbitMqEventPublisher(config);

    await expect(publisher.publish(envelope)).rejects.toThrow('broker caído');
    await publisher.publish(envelope);

    expect(connectMock).toHaveBeenCalledTimes(2);
    expect(channel.publish).toHaveBeenCalledTimes(1);
  });

  it('si falla después de conectar (exchange inexistente), cierra la conexión y reintenta', async () => {
    channel.checkExchange.mockRejectedValueOnce(new Error('NOT_FOUND'));
    const publisher = new RabbitMqEventPublisher(config);

    await expect(publisher.publish(envelope)).rejects.toThrow('NOT_FOUND');
    expect(connection.close).toHaveBeenCalledTimes(1);

    await publisher.publish(envelope);
    expect(connectMock).toHaveBeenCalledTimes(2);
  });

  it('el nack del broker se propaga, para que el dispatcher deje la fila PENDING', async () => {
    channel.publish.mockImplementationOnce((_e, _r, _b, _o, cb: ConfirmCallback) => {
      cb(new Error('nack'));
      return true;
    });
    const publisher = new RabbitMqEventPublisher(config);

    await expect(publisher.publish(envelope)).rejects.toThrow('nack');
  });

  it('sin cola bindeada (basic.return) la publicación rechaza, aunque el broker confirme', async () => {
    const publisher = new RabbitMqEventPublisher(config);
    await publisher.publish(envelope);

    channel.publish.mockImplementationOnce((_e, _r, _b, opts: { messageId: string }, cb) => {
      channel.emit('return', { properties: { messageId: opts.messageId } });
      cb(null);
      return true;
    });
    await expect(publisher.publish(envelope)).rejects.toThrow('no tiene ninguna cola bindeada');

    // El return se consume: el siguiente con el mismo id ya no queda marcado.
    await expect(publisher.publish(envelope)).resolves.toBeUndefined();
  });

  it('un return de otro mensaje no afecta a este', async () => {
    const publisher = new RabbitMqEventPublisher(config);
    await publisher.publish(envelope);

    channel.emit('return', { properties: { messageId: 'otro' } });
    channel.emit('return', { properties: {} });
    await expect(publisher.publish(envelope)).resolves.toBeUndefined();
  });

  it('un rechazo que no es Error igual llega como Error', async () => {
    channel.publish.mockImplementationOnce((_e, _r, _b, _o, cb: ConfirmCallback) => {
      cb('rechazado');
      return true;
    });
    const publisher = new RabbitMqEventPublisher(config);

    await expect(publisher.publish(envelope)).rejects.toThrow('rechazado');
  });

  it('si la conexión se cierra, la próxima publicación reconecta', async () => {
    const publisher = new RabbitMqEventPublisher(config);
    await publisher.publish(envelope);

    connection.emit('error', new Error('connection reset'));
    connection.emit('close');
    await publisher.publish(envelope);

    expect(connectMock).toHaveBeenCalledTimes(2);
  });

  it('si el broker cierra el canal, se descarta y la próxima publicación reconecta', async () => {
    const publisher = new RabbitMqEventPublisher(config);
    await publisher.publish(envelope);

    channel.emit('error', new Error('404 NOT_FOUND'));
    channel.emit('close');
    await publisher.publish(envelope);

    expect(connection.close).toHaveBeenCalled();
    expect(connectMock).toHaveBeenCalledTimes(2);
  });

  it("el 'close' tardío de una conexión vieja no descarta la nueva", async () => {
    const vieja = connection;
    const publisher = new RabbitMqEventPublisher(config);
    await publisher.publish(envelope);
    vieja.emit('close');

    channel = fakeChannel();
    connection = fakeConnection(channel);
    connectMock.mockResolvedValue(connection);
    await publisher.publish(envelope);
    expect(connectMock).toHaveBeenCalledTimes(2);

    vieja.emit('close');
    await publisher.publish(envelope);
    expect(connectMock).toHaveBeenCalledTimes(2);
  });

  it('onModuleDestroy cierra la conexión si llegó a abrirse', async () => {
    const publisher = new RabbitMqEventPublisher(config);
    await publisher.publish(envelope);
    await publisher.onModuleDestroy();
    expect(connection.close).toHaveBeenCalled();
  });

  it('onModuleDestroy no falla si nunca se conectó', async () => {
    const publisher = new RabbitMqEventPublisher(config);
    await expect(publisher.onModuleDestroy()).resolves.toBeUndefined();
    expect(connection.close).not.toHaveBeenCalled();
  });
});

describe('createEventPublisher', () => {
  const conConfig = (rabbitmq: Partial<RabbitMqConfig>) =>
    ({ get: jest.fn(() => rabbitmq) }) as unknown as ConfigService;

  it('sin RABBITMQ_URL usa el de log', () => {
    expect(createEventPublisher(conConfig({ exchange: 'x' }))).toBeInstanceOf(
      LoggingEventPublisher,
    );
  });

  it('con RABBITMQ_URL usa RabbitMQ, sin conectar todavía', () => {
    (connect as jest.Mock).mockClear();
    const publisher = createEventPublisher(
      conConfig({ url: 'amqp://u:p@broker:5672', exchange: 'x' }),
    );
    expect(publisher).toBeInstanceOf(RabbitMqEventPublisher);
    expect(connect).not.toHaveBeenCalled();
  });
});
