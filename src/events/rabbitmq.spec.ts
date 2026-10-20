import { brokerHost, brokerUser } from './rabbitmq';

describe('brokerHost', () => {
  it('saca usuario y clave de la URL', () => {
    expect(brokerHost('amqps://m6:secreto@bus.example.com:5671/muni')).toBe(
      'amqps://bus.example.com:5671/muni',
    );
  });

  it('sin vhost queda solo el host', () => {
    expect(brokerHost('amqp://guest:guest@localhost:5672')).toBe('amqp://localhost:5672');
  });

  it('una URL ilegible no se loguea tal cual', () => {
    expect(brokerHost('no es una url:secreto')).toBe('(URL de RabbitMQ ilegible)');
  });
});

describe('brokerUser', () => {
  it('devuelve el usuario decodificado, sin la clave', () => {
    expect(brokerUser('amqps://m%40m6:secreto@bus:5671/muni')).toBe('m@m6');
  });

  it('sin usuario o con una URL ilegible no hay userId', () => {
    expect(brokerUser('amqp://bus:5672')).toBeUndefined();
    expect(brokerUser('no es una url')).toBeUndefined();
  });
});
