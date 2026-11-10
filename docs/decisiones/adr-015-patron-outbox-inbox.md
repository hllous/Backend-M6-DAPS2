# ADR-015: Patrón Outbox/Inbox para la mensajería con el bus

## Metadata

- **Status:** Accepted
- **Date:** 2026-11-10
- **Deciders:** equipo M6 (Grupo 04)
- **Owner:** Benjamin Martinez (DEV Backend)
- **Related Issues:** #621
- **Related ADRs:** [ADR-006](adr-006-rabbitmq-como-bus.md), [ADR-007](adr-007-contrato-de-integracion-del-core.md), [ADR-014](adr-014-patron-state-maquinas-de-estado.md)

---

## 1. Context and Problem Statement

### Context

M6 cambia datos en su base y tiene que avisar al resto por el bus RabbitMQ (ADR-006, ADR-007). Del lado de entrada, el Core reintenta y puede duplicar, y no garantiza orden.

### Problem

Publicar al broker dentro del request deja dos fallas posibles: cambio sin evento si el broker cae, o evento sin cambio si la transacción revierte. Y consumir sin idempotencia reaplica duplicados.

---

## 2. Decision Drivers

- Atomicidad entre el cambio de dominio y el evento a publicar.
- Tolerancia a duplicados y desorden en la entrada.
- El dominio no debe depender de que el broker esté arriba.
- Sin infraestructura extra fuera del alcance del TPO.

---

## 3. Considered Options

### Option A: Publicar directo al bus desde el service tras el commit

**Pros:**
- Simple, sin tablas extra.

**Cons:**
- Pierde eventos si el broker o el proceso caen entre commit y publish.

### Option B: Transacción distribuida (2PC)

**Pros:**
- Atomicidad formal.

**Cons:**
- El broker no participa.

### Option C: CDC (Debezium)

**Pros:**
- Publica sin tocar el código de dominio.

**Cons:**
- Infraestructura extra fuera del alcance.

### Option D: Outbox/inbox sobre la propia base

**Pros:**
- Cambio y evento en la misma transacción.
- La deduplicación por id hace inocuos los reintentos del Core.

**Cons:**
- Entrega at-least-once con latencia de polling; tablas que retener.

---

## 4. Decision Outcome

**Chosen Option:** D, outbox transaccional para publicar e inbox idempotente para consumir.

### Rationale

- **Outbox**: `OutboxService.enqueue(tx, entry)` (`src/events/outbox/outbox.service.ts`) exige el cliente de transacción y escribe la fila `PENDING` junto con el cambio de dominio. `OutboxDispatcher` (`src/events/outbox/outbox-dispatcher.service.ts`) la envía al exchange `muni.inbox` a través del puerto `EventPublisher` (`src/events/publishers/event-publisher.port.ts`; implementaciones `rabbitmq.publisher.ts` y `logging.publisher.ts`). Reintento manual de los `FAILED` en `OutboxAdminService` (`outbox-admin.service.ts`, `OUTBOX_TRANSITIONS`, ADR-014).
- **Inbox**: `InboxService.ingest()` (`src/events/inbox/inbox.service.ts`) valida el sobre, registra el evento por su id (duplicado = ya procesado, no se reaplica) y despacha a los handlers de `src/events/consumers/`. Entran por el mismo camino el consumer RabbitMQ (`consumers/rabbitmq.consumer.ts`) y `POST /events/inbox`. Limpieza con `inbox-retention.sweeper.ts`.
- Los handlers toleran desorden: filtran por estado de origen (ADR-014) en vez de asumir secuencia.

---

## 5. Consequences

### Positive Consequences

- Cambio y evento son atómicos; el dominio no depende de que haya broker.
- Duplicados del Core son inocuos.

### Negative Consequences

- Entrega at-least-once con la latencia del polling del dispatcher.
- Tablas de outbox e inbox que retener y monitorear.

### Technical Implications

- Todo evento nuevo se declara en `event-types.ts` y `payloads.ts` y se documenta en `docs/eventos/`.
- Los services que publican reciben el cliente de transacción de Prisma y llaman a `enqueue` dentro de ella.

---

## 6. Implementation and Validation

- [x] `OutboxService`, `OutboxDispatcher`, `OutboxAdminService`, `InboxService` y `inbox-retention.sweeper.ts` implementados.
- [x] Tests unitarios: `outbox.service.spec.ts`, `outbox-dispatcher.service.spec.ts`, `outbox-admin.service.spec.ts`, `inbox.service.spec.ts`, `inbox-retention.sweeper.spec.ts`, `rabbitmq.publisher.spec.ts`, `logging.publisher.spec.ts`, `consumers.spec.ts`.
- [x] e2e: `test/outbox-retry.e2e-spec.ts`, `test/inbox.e2e-spec.ts`, `test/rabbitmq-real.e2e-spec.ts`.
- [x] Contratos en `docs/eventos/`.

---

## 7. References

- Issue #621. [ADR-006](adr-006-rabbitmq-como-bus.md), [ADR-007](adr-007-contrato-de-integracion-del-core.md), [ADR-014](adr-014-patron-state-maquinas-de-estado.md).
