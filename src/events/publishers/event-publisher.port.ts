import { EventEnvelope } from '../envelope';

/**
 * Puerto de publicación.
 *
 * El dominio no sabe si abajo hay un Kafka o un log. M9 todavía no expuso
 * ningún broker (docs/bloqueantes.md) y desplegar uno en el free tier de Render
 * no es viable, así que el adaptador por defecto escribe en el log y el de
 * Kafka se activa solo cuando hay `KAFKA_BROKERS` configurado.
 *
 * Mismo criterio que ADR-004 para identidad: puerto en la aplicación, decisión
 * de transporte en infraestructura.
 */
export abstract class EventPublisher {
  /** Publica un sobre. Si tira, el dispatcher deja la fila para reintentar. */
  abstract publish(envelope: EventEnvelope): Promise<void>;

  /** Nombre del adaptador, para poder verlo en el arranque. */
  abstract readonly transport: string;
}
