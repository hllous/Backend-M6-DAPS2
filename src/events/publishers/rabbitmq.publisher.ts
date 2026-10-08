import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ChannelModel, ConfirmChannel, Message, connect } from 'amqplib';
import { EventPublisher } from './event-publisher.port';
import { EventEnvelope } from '../envelope';
import { brokerHost, CONNECT_TIMEOUT_MS, RabbitMqConfig } from '../rabbitmq';

/**
 * Adaptador RabbitMQ. El EventsModule lo instancia solo cuando hay
 * `RABBITMQ_URL`; si no, provee el de log.
 *
 * Publica a `muni.inbox`, el exchange fanout del Core: la routing key no
 * enruta nada —el Core decide el destino leyendo las suscripciones—. Se manda
 * el `eventType` igual, porque no cuesta nada y se lee en el panel del broker.
 */
@Injectable()
export class RabbitMqEventPublisher extends EventPublisher implements OnModuleDestroy {
  readonly transport = 'rabbitmq';
  private readonly logger = new Logger(RabbitMqEventPublisher.name);
  private connection?: ChannelModel;
  private channel?: ConfirmChannel;
  private connecting?: Promise<ConfirmChannel>;
  /** `messageId` de lo que el broker devolvió: el exchange no tenía ninguna cola bindeada. */
  private readonly returned = new Set<string>();

  constructor(private readonly config: RabbitMqConfig) {
    super();
  }

  async onModuleDestroy(): Promise<void> {
    const connection = this.connection;
    this.reset();
    await connection?.close();
  }

  async publish(envelope: EventEnvelope): Promise<void> {
    const channel = await this.connect();

    // Qué se garantiza: la promesa resuelve solo si el broker confirmó el
    // mensaje Y lo enrutó a al menos una cola. Rechaza con el nack del broker,
    // con el cierre del canal, o si el exchange no tenía ninguna cola bindeada
    // (`mandatory` + `basic.return`; con fanout la routing key no cuenta). En
    // cualquier rechazo el dispatcher cuenta un intento y deja la fila PENDING,
    // hasta FAILED al quinto. No garantiza que el consumidor lo haya procesado.
    await new Promise<void>((resolve, reject) => {
      channel.publish(
        this.config.exchange,
        envelope.eventType,
        Buffer.from(JSON.stringify(envelope)),
        {
          persistent: true,
          mandatory: true,
          contentType: 'application/json',
          messageId: envelope.eventId,
          type: envelope.eventType,
          appId: envelope.sourceModule,
          headers: {
            eventId: envelope.eventId,
            eventType: envelope.eventType,
            sourceModule: envelope.sourceModule,
          },
        },
        (err: unknown) => {
          // El broker manda el basic.return antes que el ack o nack del mismo
          // mensaje, así que al llegar acá ya se sabe si volvió. Se saca del
          // Set siempre, también ante un nack, para que no ensucie el reintento.
          const devuelto = this.returned.delete(envelope.eventId);
          if (err) return reject(err instanceof Error ? err : new Error(String(err)));
          if (devuelto) {
            return reject(
              new Error(
                `${envelope.eventType} devuelto por el broker: ${this.config.exchange} no tiene ninguna cola bindeada`,
              ),
            );
          }
          resolve();
        },
      );
    });
  }

  /**
   * Conexión perezosa, no en el arranque.
   *
   * Así un broker caído no impide que la app levante: los eventos se siguen
   * encolando en el outbox y el dispatcher reintenta. Si conectara en
   * `onModuleInit`, una caída de RabbitMQ tiraría abajo toda la API.
   */
  private async connect(): Promise<ConfirmChannel> {
    if (this.channel) return this.channel;

    // Varias publicaciones concurrentes comparten el mismo intento de conexión.
    this.connecting ??= (async () => {
      let connection: ChannelModel | undefined;
      try {
        connection = await connect(this.config.url, { timeout: CONNECT_TIMEOUT_MS });
        // Sin listener de 'error', un corte del broker es una excepción no
        // capturada que tira el proceso. El 'close' que le sigue resetea.
        connection.on('error', (err: Error) =>
          this.logger.warn(`Conexión RabbitMQ con error: ${err.message}`),
        );
        // Solo si sigue siendo la vigente: el 'close' tardío de una conexión
        // vieja no debe tirar abajo la nueva.
        connection.on('close', () => {
          if (this.connection === connection) this.reset();
        });

        const channel = await connection.createConfirmChannel();
        channel.on('error', (err: Error) =>
          this.logger.warn(`Canal RabbitMQ con error: ${err.message}`),
        );
        channel.on('return', (msg: Message) => {
          const id: unknown = msg.properties.messageId;
          if (typeof id === 'string') this.returned.add(id);
        });
        // Un canal cerrado por el broker (p. ej. exchange con otro tipo) no se
        // reabre solo: se descarta y la próxima publicación reconecta.
        channel.on('close', () => {
          if (this.channel === channel) this.reset();
          void connection?.close().catch(() => undefined);
        });

        // Pasivo: el exchange es del Core. Si no existe, el broker cierra el
        // canal con 404 y la publicación vuelve como fallo al outbox.
        await channel.checkExchange(this.config.exchange);

        this.logger.log(
          `Productor RabbitMQ conectado a ${brokerHost(this.config.url)}, exchange ${this.config.exchange}`,
        );
        this.connection = connection;
        this.channel = channel;
        return channel;
      } catch (error) {
        // Que el próximo intento vuelva a probar en vez de quedarse pegado
        // a una promesa ya rechazada.
        this.connecting = undefined;
        await connection?.close().catch(() => undefined);
        throw error;
      }
    })();

    return this.connecting;
  }

  private reset(): void {
    this.connection = undefined;
    this.channel = undefined;
    this.connecting = undefined;
    this.returned.clear();
  }
}
