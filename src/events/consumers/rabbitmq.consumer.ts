import {
  BadRequestException,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
  PipeTransform,
} from '@nestjs/common';
import { Channel, ChannelModel, ConsumeMessage, RecoveringChannelModel, connect } from 'amqplib';
import { globalPipes } from '../../configure-app';
import { ConsumedEvent } from '../inbox/consumed-events';
import { InboxService } from '../inbox/inbox.service';
import { IngestEventDto, toInboundEnvelope } from '../inbox/ingest-event.dto';
import { brokerHost, CONNECT_TIMEOUT_MS, RabbitMqConfig } from '../rabbitmq';

/**
 * El mismo tope que el body HTTP (el default de 100 kB del body-parser de
 * Express). Un mensaje más grande se rechaza antes de parsearlo.
 */
export const MAX_MESSAGE_BYTES = 100 * 1024;

/** Cuánto del error se loguea: los nombres de propiedad los elige el emisor. */
const MAX_DETALLE = 500;

/** Qué hacer con el mensaje una vez que el inbox habló. */
export type Disposition = 'ack' | 'reject' | 'requeue';

/**
 * Lado entrante del bus: la cola de M6 bindeada al exchange con una routing key
 * por evento consumido.
 *
 * Entra por **el mismo camino que `POST /events/inbox`**: los mismos pipes
 * globales sobre `IngestEventDto` y el mismo `InboxService.ingest()`, así la
 * validación y la idempotencia por `eventId` no tienen dos versiones.
 *
 * Arranca en `onApplicationBootstrap`, cuando todos los consumers ya
 * registraron sus handlers, y sin bloquear: un broker caído no impide que la
 * API levante. La reconexión con backoff exponencial (hasta 30 s) la hace el
 * modo `recovery` de amqplib.
 */
export class RabbitMqConsumer implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqConsumer.name);
  private readonly pipes: PipeTransform[] = globalPipes({ forbidNonWhitelisted: false });
  private connection?: RecoveringChannelModel;

  constructor(
    private readonly config: RabbitMqConfig,
    private readonly inbox: InboxService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const connection = await connect(this.config.url, {
      timeout: CONNECT_TIMEOUT_MS,
      recovery: {
        waitForConnect: false,
        maxDelay: 30_000,
        setup: (m: ChannelModel) => this.setup(m),
      },
    });
    connection.on('connect', () =>
      this.logger.log(
        `Consumiendo ${this.config.queue} desde ${brokerHost(this.config.url)}, exchange ${this.config.exchange}`,
      ),
    );
    connection.on('reconnect-scheduled', ({ attempt, delay, error }) =>
      this.logger.warn(
        `RabbitMQ no disponible (${error.message}): reintento ${attempt} en ${delay} ms`,
      ),
    );
    // Sin listener, un 'error' de la conexión es una excepción no capturada.
    connection.on('error', (err: Error) => this.logger.warn(`RabbitMQ: ${err.message}`));
    this.connection = connection;
  }

  async onModuleDestroy(): Promise<void> {
    await this.connection?.close();
  }

  /** Corre en cada (re)conexión: la topología se declara idempotente cada vez. */
  private async setup(model: ChannelModel): Promise<void> {
    const channel = await model.createChannel();
    channel.on('error', (err: Error) => this.logger.warn(`Canal RabbitMQ: ${err.message}`));
    // `recovery` solo mira la conexión: si el broker cierra el canal (cola
    // borrada, ack inválido) se cierra la conexión para que reconecte todo.
    channel.on('close', () => void model.close().catch(() => undefined));

    const { exchange, exchangeType, queue, deadLetterExchange, prefetch } = this.config;
    await channel.assertExchange(exchange, exchangeType, { durable: true });
    await channel.assertQueue(queue, { durable: true, deadLetterExchange });
    for (const eventType of Object.values(ConsumedEvent)) {
      await channel.bindQueue(queue, exchange, eventType);
    }
    await channel.prefetch(prefetch);
    await channel.consume(queue, (msg) => void this.onMessage(channel, msg));
  }

  private async onMessage(channel: Channel, msg: ConsumeMessage | null): Promise<void> {
    if (!msg) {
      // El broker canceló el consumo (cola borrada): reconectar la redeclara.
      this.logger.warn(`El broker canceló el consumo de ${this.config.queue}`);
      await channel.close().catch(() => undefined);
      return;
    }

    let disposition = await this.handle(msg.content);
    if (disposition === 'requeue' && msg.fields.redelivered) {
      // Segunda entrega y vuelve a fallar: se asume determinista (un texto que
      // jsonb rechaza, un error de Prisma) y se corta el loop. El costo es que
      // una caída de la base que dure dos entregas manda el mensaje a la DLX
      // (o lo descarta si no hay) en vez de esperar.
      this.logger.error('Falló también en la reentrega: se descarta sin reencolar');
      disposition = 'reject';
    }

    try {
      if (disposition === 'ack') channel.ack(msg);
      else channel.nack(msg, false, disposition === 'requeue');
    } catch (error) {
      // Canal cerrado mientras se procesaba: amqplib tira síncrono y, dentro de
      // este async llamado con `void`, sería un unhandled rejection que en Node
      // 22 mata el proceso. El broker lo reentrega y el inbox deduplica.
      this.logger.warn(`No se pudo confirmar el mensaje: ${describe(error)}`);
    }
  }

  /**
   * - procesado, duplicado, ignorado o failed → `ack`. `failed` también: la
   *   fila del inbox ya quedó con el error, y un reenvío sería `duplicate`.
   * - inválido (lo que por HTTP es 400) → `reject`, a la DLX si hay.
   * - error inesperado (base caída) → `requeue`, solo en la primera entrega.
   *
   * Límite: si `ingest` ya insertó la fila y falló después, la reentrega sale
   * `duplicate` y no vuelve a correr el handler.
   */
  async handle(content: Buffer): Promise<Disposition> {
    if (content.length > MAX_MESSAGE_BYTES) {
      this.logger.warn(
        `Mensaje de ${content.length} bytes descartado: supera ${MAX_MESSAGE_BYTES}`,
      );
      return 'reject';
    }
    try {
      let value: unknown = JSON.parse(content.toString('utf8'));
      for (const pipe of this.pipes) {
        value = await pipe.transform(value, { type: 'body', metatype: IngestEventDto });
      }
      await this.inbox.ingest(toInboundEnvelope(value as IngestEventDto));
      return 'ack';
    } catch (error) {
      if (error instanceof SyntaxError || error instanceof BadRequestException) {
        this.logger.warn(`Mensaje inválido descartado: ${describe(error)}`);
        return 'reject';
      }
      // ponytail: requeue inmediato y una sola vez (onMessage corta en la
      // reentrega). Sin demora entre intentos: la mejora es DLX + TTL (retry
      // con backoff) cuando M9 defina la topología.
      this.logger.error(`Error procesando mensaje, se reencola: ${describe(error)}`);
      return 'requeue';
    }
  }
}

function describe(error: unknown): string {
  return detalle(error).slice(0, MAX_DETALLE);
}

function detalle(error: unknown): string {
  // El mensaje de JSON.parse cita un fragmento del contenido, que es de terceros.
  if (error instanceof SyntaxError) return 'el cuerpo no es JSON';
  if (error instanceof BadRequestException) {
    const { message } = error.getResponse() as { message?: string | string[] };
    return Array.isArray(message) ? message.join('; ') : String(message ?? error.message);
  }
  return error instanceof Error ? error.message : String(error);
}
