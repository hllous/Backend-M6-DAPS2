import { EventEmitter } from 'events';
import { BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChannelModel, ConsumeMessage, connect } from 'amqplib';
import { MAX_MESSAGE_BYTES, RabbitMqConsumer } from './rabbitmq.consumer';
import { createRabbitMqConsumer } from '../events.module';
import { InboxService } from '../inbox/inbox.service';
import { RabbitMqConfig } from '../rabbitmq';

jest.mock('amqplib', () => ({ connect: jest.fn() }));

type Setup = (model: ChannelModel) => Promise<void>;
type OnMessage = (msg: ConsumeMessage | null) => void;

const config: RabbitMqConfig = {
  url: 'amqp://usuario:secreto@broker:5672',
  exchange: 'muni.inbox',
  queue: 'q.ambiente',
  prefetch: 10,
};

const sobre = {
  eventId: 'ev-1',
  eventType: 'streetClosureApproved',
  producer: { moduleId: 'M7', service: 'transito' },
  data: { closureRequestId: 'abc' },
};

const json = (body: unknown): Buffer => Buffer.from(JSON.stringify(body));

function fakeChannel() {
  return Object.assign(new EventEmitter(), {
    checkQueue: jest.fn().mockResolvedValue(undefined),
    prefetch: jest.fn().mockResolvedValue(undefined),
    consume: jest.fn().mockResolvedValue(undefined),
    ack: jest.fn(),
    nack: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
  });
}

describe('RabbitMqConsumer', () => {
  const connectMock = connect as jest.Mock;
  let inbox: { ingest: jest.Mock };
  let recovering: EventEmitter & { close: jest.Mock };
  let consumer: RabbitMqConsumer;

  beforeEach(() => {
    inbox = { ingest: jest.fn().mockResolvedValue({ status: 'processed' }) };
    recovering = Object.assign(new EventEmitter(), {
      close: jest.fn().mockResolvedValue(undefined),
    });
    connectMock.mockReset().mockResolvedValue(recovering);
    consumer = new RabbitMqConsumer(config, inbox as unknown as InboxService);
  });

  describe('handle (misma validación que POST /events/inbox)', () => {
    it.each(['processed', 'duplicate', 'ignored', 'failed'])('%s → ack', async (status) => {
      inbox.ingest.mockResolvedValueOnce({ status });
      await expect(consumer.handle(json(sobre))).resolves.toBe('ack');
    });

    it('pasa al inbox el sobre validado, sin rellenar lo que no vino', async () => {
      await consumer.handle(json(sobre));
      expect(inbox.ingest).toHaveBeenCalledWith(expect.objectContaining(sobre));
      expect(inbox.ingest.mock.calls[0][0].occurredAt).toBeUndefined();
    });

    it('un cuerpo que no es JSON → reject', async () => {
      await expect(consumer.handle(Buffer.from('{no json'))).resolves.toBe('reject');
      expect(inbox.ingest).not.toHaveBeenCalled();
    });

    it.each([
      ['sin eventId', { eventType: 'x', data: {} }],
      ['carácter nulo (NoNullCharsPipe)', { ...sobre, data: { a: 'x\u0000' } }],
      ['null', null],
      ['un string suelto', 'hola'],
    ])('sobre inválido (%s) → reject, sin llegar al inbox', async (_caso, body) => {
      await expect(consumer.handle(json(body))).resolves.toBe('reject');
      expect(inbox.ingest).not.toHaveBeenCalled();
    });

    it('un campo de sobre desconocido (traceId de M9) se descarta, no tira el mensaje', async () => {
      await expect(consumer.handle(json({ ...sobre, traceId: 't-1' }))).resolves.toBe('ack');
      expect(inbox.ingest.mock.calls[0][0]).not.toHaveProperty('traceId');
    });

    it('un mensaje más grande que el body HTTP → reject sin parsear', async () => {
      const grande = Buffer.alloc(MAX_MESSAGE_BYTES + 1, 'a');
      await expect(consumer.handle(grande)).resolves.toBe('reject');
      expect(inbox.ingest).not.toHaveBeenCalled();
    });

    it('el detalle del error que se loguea se trunca a 500 caracteres', async () => {
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      inbox.ingest.mockRejectedValueOnce(new BadRequestException('x'.repeat(2000)));
      await consumer.handle(json(sobre));
      const logueado = warn.mock.calls.at(-1)?.[0] as string;
      expect(logueado.length).toBeLessThan(600);
      warn.mockRestore();
    });

    it('payload inválido para el handler (400 del inbox) → reject', async () => {
      inbox.ingest.mockRejectedValueOnce(new BadRequestException('Payload inválido'));
      await expect(consumer.handle(json(sobre))).resolves.toBe('reject');
    });

    it('error inesperado (base caída) → requeue', async () => {
      inbox.ingest.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      await expect(consumer.handle(json(sobre))).resolves.toBe('requeue');
    });

    it('un rechazo que no es Error también → requeue', async () => {
      inbox.ingest.mockRejectedValueOnce('raro');
      await expect(consumer.handle(json(sobre))).resolves.toBe('requeue');
    });
  });

  describe('conexión y topología', () => {
    async function arrancar() {
      await consumer.onApplicationBootstrap();
      const options = connectMock.mock.calls[0][1];
      const channel = fakeChannel();
      const model = Object.assign(new EventEmitter(), {
        createChannel: jest.fn().mockResolvedValue(channel),
        close: jest.fn().mockResolvedValue(undefined),
      });
      await (options.recovery.setup as Setup)(model as unknown as ChannelModel);
      const onMessage = channel.consume.mock.calls[0][1] as OnMessage;
      return { options, channel, model, onMessage };
    }

    const tick = () => new Promise((resolve) => setImmediate(resolve));

    it('conecta con recovery sin esperar al broker', async () => {
      const { options } = await arrancar();
      expect(connectMock).toHaveBeenCalledWith(config.url, expect.any(Object));
      expect(options.timeout).toBe(10_000);
      expect(options.recovery).toEqual(
        expect.objectContaining({ waitForConnect: false, maxDelay: 30_000 }),
      );
    });

    it('verifica la cola del Core en modo pasivo, sin declarar ni bindear nada', async () => {
      const { channel } = await arrancar();

      // El fake no tiene assertQueue ni bindQueue: si se llamaran, el setup tiraría.
      expect(channel.checkQueue).toHaveBeenCalledWith('q.ambiente');
      expect(channel.prefetch).toHaveBeenCalledWith(10);
    });

    it('sin la cola (falta suscribirse en el Core) loguea y falla el setup para que recovery reintente', async () => {
      const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      await consumer.onApplicationBootstrap();
      const options = connectMock.mock.calls[0][1];
      const channel = fakeChannel();
      channel.checkQueue.mockRejectedValueOnce(new Error('NOT_FOUND - no queue'));
      const model = Object.assign(new EventEmitter(), {
        createChannel: jest.fn().mockResolvedValue(channel),
        close: jest.fn().mockResolvedValue(undefined),
      });

      await expect(
        (options.recovery.setup as Setup)(model as unknown as ChannelModel),
      ).rejects.toThrow('NOT_FOUND');
      expect(error.mock.calls[0][0]).toMatch(/suscripciones/);
      expect(channel.consume).not.toHaveBeenCalled();
      error.mockRestore();
    });

    it('ack si se procesó, nack sin requeue si es inválido, nack con requeue si falló', async () => {
      const { channel, onMessage } = await arrancar();
      const msg = (body: unknown) =>
        ({ content: json(body), fields: { redelivered: false } }) as ConsumeMessage;

      const ok = msg(sobre);
      onMessage(ok);
      await tick();
      expect(channel.ack).toHaveBeenCalledWith(ok);

      const invalido = msg({ eventType: 'x' });
      onMessage(invalido);
      await tick();
      expect(channel.nack).toHaveBeenCalledWith(invalido, false, false);

      inbox.ingest.mockRejectedValueOnce(new Error('db caída'));
      const roto = msg(sobre);
      onMessage(roto);
      await tick();
      expect(channel.nack).toHaveBeenCalledWith(roto, false, true);
    });

    it('si vuelve a fallar en la reentrega, nack sin requeue: corta el loop caliente', async () => {
      const { channel, onMessage } = await arrancar();
      inbox.ingest.mockRejectedValueOnce(new Error('unsupported Unicode escape sequence'));
      const reentregado = {
        content: json(sobre),
        fields: { redelivered: true },
      } as ConsumeMessage;

      onMessage(reentregado);
      await tick();

      expect(channel.nack).toHaveBeenCalledWith(reentregado, false, false);
    });

    it('un ack sobre un canal cerrado no se escapa como unhandled rejection', async () => {
      const { channel, onMessage } = await arrancar();
      channel.ack.mockImplementationOnce(() => {
        throw new Error('Channel closed');
      });
      const unhandled = jest.fn();
      process.on('unhandledRejection', unhandled);

      onMessage({ content: json(sobre), fields: { redelivered: false } } as ConsumeMessage);
      await tick();
      await tick();

      process.off('unhandledRejection', unhandled);
      expect(channel.ack).toHaveBeenCalled();
      expect(unhandled).not.toHaveBeenCalled();
    });

    it('si el broker cancela el consumo, cierra el canal para reconectar', async () => {
      const { channel, onMessage } = await arrancar();
      onMessage(null);
      await tick();
      expect(channel.close).toHaveBeenCalled();
    });

    it('un canal cerrado por el broker cierra la conexión, y recovery reconecta', async () => {
      const { channel, model } = await arrancar();
      channel.emit('error', new Error('406 PRECONDITION_FAILED'));
      channel.emit('close');
      expect(model.close).toHaveBeenCalled();
    });

    it('los eventos de la conexión se loguean sin tirar el proceso', async () => {
      await arrancar();
      expect(() => {
        recovering.emit('connect');
        recovering.emit('reconnect-scheduled', {
          attempt: 1,
          delay: 100,
          error: new Error('ECONNREFUSED'),
        });
        recovering.emit('error', new Error('connection reset'));
      }).not.toThrow();
    });

    it('onModuleDestroy cierra la conexión', async () => {
      await arrancar();
      await consumer.onModuleDestroy();
      expect(recovering.close).toHaveBeenCalled();
    });

    it('onModuleDestroy no falla si nunca arrancó', async () => {
      await expect(consumer.onModuleDestroy()).resolves.toBeUndefined();
    });
  });

  describe('createRabbitMqConsumer', () => {
    const conConfig = (rabbitmq: Partial<RabbitMqConfig>) =>
      ({ get: jest.fn(() => rabbitmq) }) as unknown as ConfigService;

    it('sin RABBITMQ_URL no se instancia nada', () => {
      const sinUrl: Partial<RabbitMqConfig> = { ...config, url: undefined };
      expect(
        createRabbitMqConsumer(conConfig(sinUrl), inbox as unknown as InboxService),
      ).toBeNull();
      expect(connectMock).not.toHaveBeenCalled();
    });

    it('con RABBITMQ_URL devuelve el consumidor', () => {
      expect(
        createRabbitMqConsumer(conConfig(config), inbox as unknown as InboxService),
      ).toBeInstanceOf(RabbitMqConsumer);
    });
  });
});
