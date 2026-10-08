import {
  BadRequestException,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
  PipeTransform,
} from '@nestjs/common';
import { Channel, ChannelModel, ConsumeMessage, RecoveringChannelModel, connect } from 'amqplib';
import { globalPipes } from '../../configure-app';
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

/**
 * Qué hacer con el mensaje una vez que el inbox habló. `nack` es siempre sin
 * reencolar: los reintentos los hace el Core, con backoff.
 */
export type Disposition = 'ack' | 'nack';

/**
 * Lado entrante del bus: la cola de M6 (`q.ambiente`), que crea el Core y en la
 * que llega solo lo que suscribimos, con varios `eventType` mezclados.
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
      this.logger.log(`Consumiendo ${this.config.queue} desde ${brokerHost(this.config.url)}`),
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

    const { queue, prefetch } = this.config;
    // Pasivo: la cola y su binding los crea el Core al registrar nuestras
    // suscripciones. Declararla con otros argumentos daría PRECONDITION_FAILED;
    // si todavía no existe, el broker cierra el canal con 404 y `recovery`
    // reintenta hasta que aparezca.
    await channel.checkQueue(queue).catch((error: Error) => {
      this.logger.error(
        `La cola ${queue} no está disponible (${error.message}): ¿están registradas las suscripciones de M6 en el Core?`,
      );
      throw error;
    });
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

    const disposition = await this.handle(msg.content);

    try {
      // Nunca se reencola (pedido de M9): reencolado, el mensaje gira en nuestra cola
      // sin demora ni auditoría. Con `nack` sin reencolar el Core reintenta con
      // backoff (15 s → 1 m → 5 m → 15 m) y después lo manda a su DLQ.
      if (disposition === 'ack') channel.ack(msg);
      else channel.nack(msg, false, false);
    } catch (error) {
      // Canal cerrado mientras se procesaba: amqplib tira síncrono y, dentro de
      // este async llamado con `void`, sería un unhandled rejection que en Node
      // 22 mata el proceso. El broker lo reentrega y el inbox deduplica.
      this.logger.warn(`No se pudo confirmar el mensaje: ${describe(error)}`);
    }
  }

  /**
   * - procesado, duplicado o ignorado → `ack`.
   * - failed (el handler tiró) → `nack`: el Core lo reentrega con backoff y el
   *   inbox vuelve a correr el handler, porque la fila quedó sin `processedAt`.
   *   Así se recupera una falla transitoria (la base caída un minuto).
   * - inválido (lo que por HTTP es 400) → `nack` también. Va a agotar los
   *   reintentos, pero termina en la DLQ del Core con el payload crudo, que es
   *   donde alguien lo puede ver; un `ack` + log lo perdería.
   * - error inesperado (base caída antes del handler) → `nack`.
   */
  async handle(content: Buffer): Promise<Disposition> {
    if (content.length > MAX_MESSAGE_BYTES) {
      this.logger.warn(`Mensaje de ${content.length} bytes rechazado: supera ${MAX_MESSAGE_BYTES}`);
      return 'nack';
    }
    try {
      let value: unknown = JSON.parse(content.toString('utf8'));
      for (const pipe of this.pipes) {
        value = await pipe.transform(value, { type: 'body', metatype: IngestEventDto });
      }
      const { status } = await this.inbox.ingest(toInboundEnvelope(value as IngestEventDto));
      return status === 'failed' ? 'nack' : 'ack';
    } catch (error) {
      if (error instanceof SyntaxError || error instanceof BadRequestException) {
        this.logger.warn(`Mensaje inválido rechazado: ${describe(error)}`);
        return 'nack';
      }
      this.logger.error(
        `Error procesando mensaje, queda para el reintento del Core: ${describe(error)}`,
      );
      return 'nack';
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
