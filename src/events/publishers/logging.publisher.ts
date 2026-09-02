import { Injectable, Logger } from '@nestjs/common';
import { EventPublisher } from './event-publisher.port';
import { EventEnvelope } from '../envelope';

/**
 * Adaptador por defecto: no publica a ningún lado, deja rastro en el log.
 *
 * No es un stub de relleno — es lo que permite demostrar el circuito completo
 * mientras la cohorte no tenga bus: la fila de `outbox_event` queda con su
 * payload y su `publishedAt`, que es la evidencia de qué se habría emitido.
 */
@Injectable()
export class LoggingEventPublisher extends EventPublisher {
  readonly transport = 'log';
  private readonly logger = new Logger(LoggingEventPublisher.name);

  async publish(envelope: EventEnvelope): Promise<void> {
    this.logger.log(
      `[sin broker] ${envelope.eventType} subject=${envelope.subject} eventId=${envelope.eventId}`,
    );
  }
}
