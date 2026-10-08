import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { InboundEnvelope } from '../envelope';
import { eventContext, EventTrace, trazaDelConsumido } from '../event-context';

/**
 * Un handler de evento entrante. Recibe el `data` del sobre y su `occurredAt`
 * (null si no vino o no es una fecha), para que un reintento atrasado no pise
 * un dato más nuevo: el orden de llegada no está garantizado (#270).
 *
 * Si tira, la fila del inbox queda sin `processedAt` y con el error registrado,
 * y un reenvío con el mismo `eventId` (el reintento del Core) lo vuelve a
 * correr con el payload guardado. **Tiene que tolerar correr de nuevo** (guard
 * por estado o un unique): el reintento llega tras cualquier `failed`, también
 * cuando su efecto ya quedó escrito y lo que falló fue marcar la fila. El inbox
 * descarta un evento ya procesado, no el reintento de uno fallido.
 */
export type InboxHandler = (
  data: Record<string, unknown>,
  occurredAt: Date | null,
) => Promise<void>;

export interface InboxHandlerOptions {
  /**
   * Decide si el `data` se guarda en `inbox_event.payload`. Sin esta opción se
   * guarda siempre. Si devuelve false queda solo un marcador: la fila sigue
   * dando la idempotencia (`messageId`, `eventType`, `processedAt`) pero sin
   * contenido de negocio. La regla la aporta el módulo dueño del evento para
   * que el inbox no conozca contratos ajenos.
   */
  persistPayload?: (data: Record<string, unknown>) => boolean;
  /**
   * Devuelve los campos obligatorios que faltan o tienen el tipo equivocado
   * (vacío = válido). Se evalúa antes de guardar: un payload sin lo que el
   * handler necesita no tiene efecto, y marcarlo `processed` ocultaría el error
   * del emisor. Los campos extra se toleran.
   */
  validate?: (data: Record<string, unknown>) => string[];
}

/** Lo que queda en la columna (NO nula) cuando no corresponde guardar el payload. */
export const REDACTED_PAYLOAD = Object.freeze({ redacted: 'contenido no persistido' });

function esRedactado(payload: Prisma.JsonValue): boolean {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    !Array.isArray(payload) &&
    payload.redacted === REDACTED_PAYLOAD.redacted
  );
}

/**
 * ponytail: tolerancia fija al reloj del emisor. Pasarla a config si un emisor
 * real deriva más que esto.
 */
const TOLERANCIA_FUTURO_MS = 5 * 60_000;

/**
 * El `occurredAt` del sobre como fecha, o null si no vino, no se puede leer o
 * está en el futuro. Una fecha futura (un reloj roto, o cualquiera con JWT por
 * `POST /events/inbox`) dejaría la marca de orden ahí y todo evento legítimo
 * posterior se ignoraría como atrasado, sin arreglo salvo por SQL (#270).
 */
function aFecha(valor: string | undefined): Date | null {
  const fecha = valor ? new Date(valor) : null;
  if (!fecha || isNaN(fecha.getTime())) return null;
  return fecha.getTime() > Date.now() + TOLERANCIA_FUTURO_MS ? null : fecha;
}

export interface IngestResult {
  status: 'processed' | 'duplicate' | 'ignored' | 'failed';
  detail?: string;
}

/**
 * El lado entrante del patrón inbox/outbox.
 *
 * **La idempotencia vive acá, no en cada handler.** El enunciado exige que un
 * evento ya procesado no genere efectos duplicados, y resolverlo una vez en el
 * punto de entrada es mucho más confiable que pedirle a cada handler que sea
 * idempotente por su cuenta. `InboxEvent.messageId` es `@unique`, así que el
 * duplicado lo detecta la base, no una consulta previa que podría correr en
 * paralelo con otra igual. El reintento de un evento fallido también lo decide
 * la base: lo toma un update condicional, así que de dos entregas solapadas
 * corre una sola.
 *
 * El handler corre dentro de `eventContext`: lo que encole hereda el
 * `correlationId` del sobre y lleva su `eventId` como `causationId` (#267).
 * Por `POST /events/inbox` este contexto pisa al que abre el request.
 */
@Injectable()
export class InboxService {
  private readonly logger = new Logger(InboxService.name);
  private readonly handlers = new Map<string, InboxHandler>();
  private readonly options = new Map<string, InboxHandlerOptions>();

  constructor(private readonly prisma: PrismaService) {}

  /** Cada módulo registra los suyos en su `onModuleInit`. */
  register(eventType: string, handler: InboxHandler, options?: InboxHandlerOptions): void {
    if (this.handlers.has(eventType)) {
      throw new Error(`Ya hay un handler registrado para '${eventType}'`);
    }
    this.handlers.set(eventType, handler);
    if (options) this.options.set(eventType, options);
  }

  registeredTypes(): string[] {
    return [...this.handlers.keys()].sort();
  }

  /**
   * Lanza `BadRequestException` si el `data` de un evento con handler no trae
   * sus campos obligatorios; no queda fila guardada. El controller HTTP la
   * devuelve como 400; `RabbitMqConsumer` la captura y hace `nack`, y después
   * de los reintentos del Core termina en su DLQ.
   */
  async ingest(envelope: InboundEnvelope): Promise<IngestResult> {
    const messageId = envelope.eventId;
    let data = (envelope.data ?? {}) as Record<string, unknown>;

    // Se rechaza antes del insert: sin fila, el emisor puede reenviar el corregido
    // con el mismo eventId (el 400 ya le dice qué corregir). Sin handler no hay
    // contrato que validar y sigue `ignored`.
    const invalidos = this.validar(envelope.eventType, data);
    if (invalidos.length) {
      this.logger.warn(`${envelope.eventType} (${messageId}) rechazado: payload inválido`);
      throw new BadRequestException(
        `Payload inválido para ${envelope.eventType}. Campos faltantes o con tipo incorrecto: ${invalidos.join(', ')}`,
      );
    }

    // Sin handler o con una regla que dice que no es nuestro, el contenido de
    // negocio (ticketUpdated de otros módulos: ubicación, citizenId, etc.) no se
    // persiste. Un ticketUpdated nuestro con updateType descartado a propósito sí
    // se guarda: la regla mira el dueño, no la acción.
    const persist = this.debePersistir(envelope.eventType, data);

    let trace: EventTrace = trazaDelConsumido(messageId, envelope.correlationId);
    let occurredAt = aFecha(envelope.occurredAt);
    if (envelope.occurredAt && !occurredAt) {
      // No se interpola el valor: viene de un tercero.
      this.logger.warn(
        `${envelope.eventType} (${messageId}): occurredAt ilegible o en el futuro, se procesa sin ordenar`,
      );
    }

    // El unique de messageId es lo que decide si es duplicado: dejamos que
    // falle el insert en vez de consultar antes, porque entre la consulta y el
    // insert podría entrar el mismo mensaje otra vez.
    try {
      await this.prisma.inboxEvent.create({
        data: {
          messageId,
          eventType: envelope.eventType,
          payload: (persist ? envelope.data : REDACTED_PAYLOAD) as Prisma.InputJsonObject,
          correlationId: trace.correlationId,
          sourceModule: envelope.sourceModule,
          occurredAt,
        },
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) {
        throw error;
      }
      // Es un reintento solo si el handler falló antes (sin `processedAt`, con
      // `error`) y es el mismo eventType. El update condicional toma la fila de
      // forma atómica: una entrega solapada la ve en curso (error null) y sale
      // duplicate. ponytail: si el proceso se cae a mitad del handler, la fila
      // queda sin processedAt ni error y ningún reenvío la retoma; destrabarlo
      // pide una columna de lease (migración).
      const { count } = await this.prisma.inboxEvent.updateMany({
        where: {
          messageId,
          eventType: envelope.eventType,
          processedAt: null,
          error: { not: null },
        },
        data: { error: null },
      });
      if (count === 0) {
        this.logger.log(
          `${envelope.eventType} (${messageId}) ya recibido: se descarta sin volver a aplicarlo`,
        );
        return { status: 'duplicate' };
      }
      // Se reintenta lo que se guardó, no lo que trae este sobre: un reenvío por
      // HTTP no puede cambiarle el contenido a un evento fallido. Si quedó
      // redactado no hay nada que reproducir y va el data nuevo, ya validado.
      // El hilo también es el guardado: un reenvío con otro correlationId, o sin
      // ninguno y con un eventId que no es un UUID RFC, partiría el flujo en dos.
      // El occurredAt, igual y sin respaldo: es lo que ordena, y un reenvío con
      // otra fecha podría adelantar un evento viejo.
      const fila = await this.prisma.inboxEvent.findUniqueOrThrow({
        where: { messageId },
        select: { payload: true, correlationId: true, occurredAt: true },
      });
      if (!esRedactado(fila.payload)) data = fila.payload as Record<string, unknown>;
      if (fila.correlationId) trace = { ...trace, correlationId: fila.correlationId };
      occurredAt = fila.occurredAt;
      this.logger.log(`${envelope.eventType} (${messageId}) había fallado: se reintenta`);
    }

    const handler = this.handlers.get(envelope.eventType);
    if (!handler) {
      // No es un error: hay eventos de la cohorte que nos llegan y no nos
      // tocan. Queda la fila con eventType, messageId y el error 'sin handler
      // registrado', pero no el contenido.
      await this.markProcessed(messageId, 'sin handler registrado');
      this.logger.warn(
        `${envelope.eventType} (${messageId}) no tiene handler: se registra y se descarta`,
      );
      return { status: 'ignored', detail: 'sin handler registrado' };
    }

    try {
      await eventContext.run(trace, () => handler(data, occurredAt));
      await this.markProcessed(messageId);
      this.logger.log(`${envelope.eventType} (${messageId}) procesado`);
      return { status: 'processed' };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.prisma.inboxEvent.update({
        where: { messageId },
        data: { error: message.slice(0, 500) },
      });
      this.logger.error(`${envelope.eventType} (${messageId}) falló: ${message}`);
      return { status: 'failed', detail: message };
    }
  }

  private validar(eventType: string, data: Record<string, unknown>): string[] {
    try {
      return this.options.get(eventType)?.validate?.(data) ?? [];
    } catch (error) {
      // Fail-open: un validador defectuoso no debe dar 500 a todos los eventos
      // de ese tipo. No se interpola `data`, que es contenido de terceros.
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`${eventType}: validate falló (${message}), se procesa sin validar`);
      return [];
    }
  }

  private debePersistir(eventType: string, data: Record<string, unknown>): boolean {
    if (!this.handlers.has(eventType)) return false;
    try {
      // El default es guardar (fail-open para un futuro consumer que olvide la
      // opción): todo consumer que maneje contenido de terceros debe declarar
      // `persistPayload`.
      return this.options.get(eventType)?.persistPayload?.(data) ?? true;
    } catch (error) {
      // Una regla defectuosa no debe romper el ingest ni perder el mensaje: ante
      // la duda se redacta. No se interpola `data`, que es contenido de terceros.
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`${eventType}: persistPayload falló (${message}), se redacta el payload`);
      return false;
    }
  }

  private async markProcessed(messageId: string, note?: string): Promise<void> {
    await this.prisma.inboxEvent.update({
      where: { messageId },
      data: { processedAt: new Date(), error: note ?? null },
    });
  }
}
