import { ConfigService } from '@nestjs/config';
import { Kafka } from 'kafkajs';
import { KafkaEventPublisher } from './kafka.publisher';
import { EventEnvelope } from '../envelope';

const connectMock = jest.fn();
const sendMock = jest.fn();
const disconnectMock = jest.fn();
const producerMock = jest.fn(() => ({
  connect: connectMock,
  send: sendMock,
  disconnect: disconnectMock,
}));

jest.mock('kafkajs', () => ({
  Kafka: jest.fn().mockImplementation(() => ({ producer: producerMock })),
}));

describe('KafkaEventPublisher', () => {
  const config = {
    get: jest.fn((key: string) => {
      const values: Record<string, string> = {
        'kafka.brokers': 'broker1:9092, broker2:9092',
        'kafka.clientId': 'm6-ambiente',
      };
      return values[key];
    }),
  } as unknown as ConfigService;

  const envelope: EventEnvelope = {
    specVersion: '1.0',
    eventId: 'ev-1',
    eventType: 'urbanServiceScheduled',
    occurredAt: '2026-01-01T00:00:00.000Z',
    producer: { moduleId: 'M6', service: 'urban-services-api' },
    subject: 'svc-1',
    data: {},
  };

  beforeEach(() => {
    connectMock.mockReset().mockResolvedValue(undefined);
    sendMock.mockReset().mockResolvedValue(undefined);
    disconnectMock.mockReset().mockResolvedValue(undefined);
    (Kafka as jest.Mock).mockClear();
  });

  it('conecta el producer una sola vez y publica el mensaje particionado por subject', async () => {
    const publisher = new KafkaEventPublisher(config);
    expect(publisher.transport).toBe('kafka');

    await publisher.publish(envelope);
    await publisher.publish(envelope);

    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledTimes(2);
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: 'urbanServiceScheduled',
        messages: [
          expect.objectContaining({
            key: 'svc-1',
            headers: {
              eventId: 'ev-1',
              eventType: 'urbanServiceScheduled',
              producer: 'M6',
            },
          }),
        ],
      }),
    );
  });

  it('arma el cliente Kafka con los brokers separados por coma sin espacios', async () => {
    const publisher = new KafkaEventPublisher(config);
    await publisher.publish(envelope);

    expect(Kafka).toHaveBeenCalledWith({
      clientId: 'm6-ambiente',
      brokers: ['broker1:9092', 'broker2:9092'],
    });
  });

  it('dos publicaciones concurrentes comparten el mismo intento de conexión', async () => {
    const publisher = new KafkaEventPublisher(config);

    await Promise.all([publisher.publish(envelope), publisher.publish(envelope)]);

    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledTimes(2);
  });

  it('si la conexión falla, un intento posterior vuelve a probar', async () => {
    connectMock.mockRejectedValueOnce(new Error('broker caído'));
    const publisher = new KafkaEventPublisher(config);

    await expect(publisher.publish(envelope)).rejects.toThrow('broker caído');

    connectMock.mockResolvedValueOnce(undefined);
    await publisher.publish(envelope);

    expect(connectMock).toHaveBeenCalledTimes(2);
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it('onModuleDestroy desconecta el producer si llegó a conectarse', async () => {
    const publisher = new KafkaEventPublisher(config);
    await publisher.publish(envelope);
    await publisher.onModuleDestroy();
    expect(disconnectMock).toHaveBeenCalledTimes(1);
  });

  it('onModuleDestroy no falla si nunca se conectó', async () => {
    const publisher = new KafkaEventPublisher(config);
    await expect(publisher.onModuleDestroy()).resolves.toBeUndefined();
    expect(disconnectMock).not.toHaveBeenCalled();
  });
});
