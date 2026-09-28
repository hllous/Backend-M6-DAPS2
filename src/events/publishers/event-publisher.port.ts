import { EventEnvelope } from '../envelope';

/**
 * Puerto de publicación.
 *
 * El dominio no sabe si abajo hay un RabbitMQ o un log. M9 anunció RabbitMQ
 * pero todavía no expuso el broker (docs/bloqueantes.md) y desplegar uno en el
 * free tier de Render no es viable, así que el adaptador por defecto escribe
 * en el log y el de RabbitMQ se activa solo cuando hay `RABBITMQ_URL`.
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
