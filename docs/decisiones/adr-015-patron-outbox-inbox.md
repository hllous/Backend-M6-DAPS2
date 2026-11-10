# ADR-015: Patrón Outbox/Inbox para la mensajería con el bus

## Estado

**Aceptado** — 2026-11-10

## Contexto

M6 cambia datos en su base y tiene que avisar al resto por el bus RabbitMQ (ADR-006, ADR-007). Publicar al broker dentro del request deja dos fallas posibles: cambio sin evento si el broker cae, o evento sin cambio si la transacción revierte. Del lado de entrada, el Core reintenta y puede duplicar, y no garantiza orden.

## Decisión

Outbox transaccional para publicar e inbox idempotente para consumir.

- **Outbox**: `OutboxService.enqueue(tx, entry)` (`src/events/outbox/outbox.service.ts`) exige el cliente de transacción y escribe la fila `PENDING` junto con el cambio de dominio. `OutboxDispatcher` (`src/events/outbox/outbox-dispatcher.service.ts`) la envía al exchange `muni.inbox` a través del puerto `EventPublisher` (`src/events/publishers/event-publisher.port.ts`; implementaciones `rabbitmq.publisher.ts` y `logging.publisher.ts`). Reintento manual de los `FAILED` en `OutboxAdminService` (`outbox-admin.service.ts`, `OUTBOX_TRANSITIONS`, ADR-014).
- **Inbox**: `InboxService.ingest()` (`src/events/inbox/inbox.service.ts`) valida el sobre, registra el evento por su id (duplicado = ya procesado, no se reaplica) y despacha a los handlers de `src/events/consumers/`. Entran por el mismo camino el consumer RabbitMQ (`consumers/rabbitmq.consumer.ts`) y `POST /events/inbox`. Limpieza con `inbox-retention.sweeper.ts`.
- Los handlers toleran desorden: filtran por estado de origen (ADR-014) en vez de asumir secuencia.

## Alternativas consideradas

- **Publicar directo en el service tras el commit**: descartada, pierde eventos si el broker o el proceso caen entre commit y publish.
- **Transacción distribuida (2PC)**: descartada, el broker no participa.
- **CDC (Debezium)**: descartada, infraestructura extra fuera del alcance.
- **Outbox/inbox sobre la propia base** (elegida).

## Consecuencias

### Positivas

- Cambio y evento son atómicos; el dominio no depende de que haya broker.
- Duplicados del Core son inocuos.

### Negativas

- Entrega at-least-once con la latencia del polling del dispatcher.
- Tablas de outbox e inbox que retener y monitorear.

### Neutras

- Todo evento nuevo se declara en `event-types.ts` y `payloads.ts` y se documenta en `docs/eventos/`.

## Referencias

- Issue #621. [ADR-006](adr-006-rabbitmq-como-bus.md), [ADR-007](adr-007-contrato-de-integracion-del-core.md), [ADR-014](adr-014-patron-state-maquinas-de-estado.md).
