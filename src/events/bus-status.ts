/**
 * `disabled`: sin `RABBITMQ_URL`, no hay consumidor. `reconnecting`: todavía no
 * conectó (o se cayó) y `recovery` reintenta. `connected`: la cola está
 * verificada y se consume.
 */
export type BusState = 'connected' | 'reconnecting' | 'disabled';

/**
 * Estado del consumidor del bus, para `/health/ready`. Lo escribe
 * `RabbitMqConsumer` y lo lee `HealthController`; vive aparte para que Health no
 * dependa de EventsModule más que por este token (el módulo es global).
 */
export class BusStatus {
  state: BusState = 'disabled';
}
