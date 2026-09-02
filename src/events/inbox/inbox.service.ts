import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EventEnvelope } from '../envelope';

/**
 * Un handler de evento entrante. Recibe el `data` del sobre.
 *
 * Si tira, la fila del inbox queda sin `processedAt` y con el error, para
 * poder reintentarla. No debe ser idempotente por su cuenta: de eso se encarga
 * el inbox.
 */
export type InboxHandler = (data: Record<string, unknown>) => Promise<void>;

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

  constructor(private readonly prisma: PrismaService) {}

  /** Cada módulo registra los suyos en su `onModuleInit`. */
  register(eventType: string, handler: InboxHandler): void {
    if (this.handlers.has(eventType)) {
      throw new Error(`Ya hay un handler registrado para '${eventType}'`);
    }
    this.handlers.set(eventType, handler);
  }

  registeredTypes(): string[] {
    return [...this.handlers.keys()].sort();
  }

  async ingest(envelope: EventEnvelope): Promise<IngestResult> {
    const messageId = envelope.eventId;

    // El unique de messageId es lo que decide si es duplicado: dejamos que
    // falle el insert en vez de consultar antes, porque entre la consulta y el
    // insert podría entrar el mismo mensaje otra vez.
    try {
      await this.prisma.inboxEvent.create({
        data: {
          messageId,
          eventType: envelope.eventType,
          payload: envelope.data as Prisma.InputJsonObject,
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
      // tocan. Queda la fila para poder ver qué llegó.
      await this.markProcessed(messageId, 'sin handler registrado');
      this.logger.warn(
        `${envelope.eventType} (${messageId}) no tiene handler: se registra y se descarta`,
      );
      return { status: 'ignored', detail: 'sin handler registrado' };
    }

    try {
      await handler((envelope.data ?? {}) as Record<string, unknown>);
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

  private async markProcessed(messageId: string, note?: string): Promise<void> {
    await this.prisma.inboxEvent.update({
      where: { messageId },
      data: { processedAt: new Date(), error: note ?? null },
    });
  }
}
