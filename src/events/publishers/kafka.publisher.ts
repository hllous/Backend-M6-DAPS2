import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer } from 'kafkajs';
import { EventPublisher } from './event-publisher.port';
import { EventEnvelope } from '../envelope';

/**
 * Adaptador Kafka. El EventsModule lo instancia solo cuando hay
 * `KAFKA_BROKERS` configurado; si no, provee el de log.
 *
 * Un topic por tipo de evento, con el nombre del evento tal cual: el Core
 * matchea por string literal, así que el topic es `urbanServiceScheduled`, no
 * `M6.urbanServiceScheduled` ni una variante. Cuando M9 publique su catálogo de
 * topics —sigue pendiente— puede que haya que prefijarlos.
 */
@Injectable()
export class KafkaEventPublisher extends EventPublisher implements OnModuleDestroy {
  readonly transport = 'kafka';
  private readonly logger = new Logger(KafkaEventPublisher.name);
  private producer?: Producer;
  private connecting?: Promise<Producer>;

  constructor(private readonly config: ConfigService) {
    super();
  }

  async onModuleDestroy(): Promise<void> {
    await this.producer?.disconnect();
  }

  async publish(envelope: EventEnvelope): Promise<void> {
    const producer = await this.connect();

    await producer.send({
      topic: envelope.eventType,
      messages: [
        {
          // Particionar por agregado mantiene el orden de los eventos de un
          // mismo servicio o contenedor, que es el orden que importa.
          key: envelope.subject,
          value: JSON.stringify(envelope),
          headers: {
            eventId: envelope.eventId,
            eventType: envelope.eventType,
            producer: envelope.producer,
          },
        },
      ],
    });
  }

  /**
   * Conexión perezosa, no en el arranque.
   *
   * Así un broker caído no impide que la app levante: los eventos se siguen
   * encolando en el outbox y el dispatcher reintenta. Si conectara en
   * `onModuleInit`, una caída de Kafka tiraría abajo toda la API.
   */
  private async connect(): Promise<Producer> {
    if (this.producer) return this.producer;

    // Varias publicaciones concurrentes comparten el mismo intento de conexión.
    this.connecting ??= (async () => {
      const brokers = (this.config.get<string>('kafka.brokers') ?? '')
        .split(',')
        .map((b) => b.trim())
        .filter(Boolean);

      const kafka = new Kafka({
        clientId: this.config.get<string>('kafka.clientId') ?? 'm6-ambiente',
        brokers,
      });

      const producer = kafka.producer();
      try {
        await producer.connect();
      } catch (error) {
        // Que el próximo intento vuelva a probar en vez de quedarse pegado
        // a una promesa ya rechazada.
        this.connecting = undefined;
        throw error;
      }

      this.logger.log(`Productor Kafka conectado a ${brokers.join(', ')}`);
      this.producer = producer;
      return producer;
    })();

    return this.connecting;
  }
}
