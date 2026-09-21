import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { InboundEnvelope } from '../envelope';

/**
 * Un handler de evento entrante. Recibe el `data` del sobre.
 *
 * Si tira, la fila del inbox queda sin `processedAt` y con el error, para
 * poder reintentarla. No debe ser idempotente por su cuenta: de eso se encarga
 * el inbox.
 */
export type InboxHandler = (data: Record<string, unknown>) => Promise<void>;

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
 * paralelo con otra igual.
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
   * sus campos obligatorios; no queda fila guardada. Hoy solo lo llama el
   * controller HTTP. Un consumidor Kafka futuro debe capturarla y mandar el
   * mensaje a DLQ o commitear el offset: si no, entra en reintento infinito.
   */
  async ingest(envelope: InboundEnvelope): Promise<IngestResult> {
    const messageId = envelope.eventId;
    const data = (envelope.data ?? {}) as Record<string, unknown>;

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

    // El unique de messageId es lo que decide si es duplicado: dejamos que
    // falle el insert en vez de consultar antes, porque entre la consulta y el
    // insert podría entrar el mismo mensaje otra vez.
    try {
      await this.prisma.inboxEvent.create({
        data: {
          messageId,
          eventType: envelope.eventType,
          payload: (persist ? envelope.data : REDACTED_PAYLOAD) as Prisma.InputJsonObject,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        this.logger.log(
          `${envelope.eventType} (${messageId}) ya recibido: se descarta sin volver a aplicarlo`,
        );
        return { status: 'duplicate' };
      }
      throw error;
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
      await handler(data);
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
