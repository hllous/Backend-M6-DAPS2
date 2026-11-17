# Documento de diseño

> Versión 1.0 · 17/11/2026 · Grupo 04 · Módulo 6

Diseño del backend del Módulo 6 (Ambiente, Higiene y Servicios Urbanos) del TPO «Municipalidad UADE». Cada afirmación se verificó contra el código de `develop` al 16/11/2026. La cátedra pide al menos tres patrones justificados, uno de ellos State en la entidad central, con 409 ante toda transición inválida.

## 1. Objetivos de diseño

| Objetivo | Cómo se logra |
|---|---|
| Integrar sin acoplar bases | Eventos asincrónicos con Outbox e Inbox (4.2, 4.3) |
| Un estado inválido nunca se aplica | State con tablas de transiciones y 409 (sección 5) |
| Aislar lo que no controlamos | Puertos y adaptadores para M1 y el bus (4.4) |
| Tolerar reintentos y concurrencia | `Idempotency-Key` e `If-Match` (4.5, 4.6) |
| Seguro por defecto | Guards globales que fallan cerrado (6.1) |

Restricciones: stack fijado (NestJS, TypeScript, Prisma, PostgreSQL; ADR-001); el JWT lo emite M1 (ADR-004); bus, sobre, reintentos y DLQ son del Core de M9 (ADR-007).

## 2. Arquitectura

Tres capas por recurso en `src/modules/<recurso>/`:

| Capa | Archivo | Responsabilidad |
|---|---|---|
| Presentación | `*.controller.ts` | HTTP, Swagger, `@Roles()`; sin lógica |
| Dominio | `*.service.ts` | Reglas, máquinas de estado, transacciones, outbox, auditoría |
| Datos | `PrismaService` | Acceso a PostgreSQL |

Los DTO se validan con `class-validator` en un `ValidationPipe` global (`src/configure-app.ts`).

| Comunicación | Mecanismo | Código |
|---|---|---|
| Publicar eventos | Outbox, luego exchange `muni.inbox` del Core | `src/events/outbox/` |
| Consumir eventos | Cola `q.ambiente`, Inbox idempotente | `src/events/consumers/`, `src/events/inbox/` |
| Identidad de M1 | REST de solo lectura con el token de módulo | `src/identity/` |
| Token y registro en el Core | REST | `src/core/` |
| Evidencia | Cloudflare R2 | `src/modules/attachments/` |

M6 no habla directo con M2, M3, M4 ni M7: todo pasa por el bus. Diagramas y secuencias: [`docs/arquitectura/README.md`](../arquitectura/README.md).

Despliegue: local con `docker compose up --build` (PostgreSQL 16, RabbitMQ 4.4, backend, seed, M1 falso, frontend; `docker-compose.yml`); producción en Render (backend), Supabase (base) y Vercel (frontend) según [`docs/operacion/referencia.md`](../operacion/referencia.md).

## 3. Modelo de datos

`prisma/schema.prisma` tiene 44 modelos y 40 enums. Diagrama y decisiones: [`docs/DER.md`](../DER.md); entidades y diagramas de estado: [`docs/entidades/`](../entidades/).

| Grupo | Modelos |
|---|---|
| Catálogo y planificación | `ServiceType`, `Zone`, `Route`, `ServiceFrequency`, `Commune` y sus tablas asociativas |
| Recursos | `Crew`, `CrewMember`, `CrewZoneAssignment`, `Vehicle` |
| Ejecución | `Service`, `ServiceZone`, `ZoneResult`, `ServiceDelayNotice`, `CollectionRecord`, `DisposalSite`, `Attachment` |
| Inventario | `Container`, `ContainerStatusHistory`, `GreenPoint`, `Tree`, `TreeSurvey`, `TreeIntervention`, `GreenSpace` |
| Control ambiental | `EnvironmentalReport`, `EnvironmentalInspection`, `ViolationNotice`, `SanctionOutcome` |
| Derivaciones | `RepairRequest`, `StreetClosureRequest`, `ClosureStreet` |
| Mensajería | `OutboxEvent`, `InboxEvent`, `TicketM2State`, `OutboxRetryAudit` |
| Seguridad y auditoría | `UserRoleAssignment`, `RoleAssignmentAudit`, `DomainAuditLog`, `IdempotencyRecord` |

Relaciones clave: `TreeIntervention.serviceId` y `EnvironmentalInspection.serviceId` apuntan al `Service` (la intervención guarda qué hacer; el servicio, cuándo y con quién); inspección y acta son 1 a 1; los ids de otros módulos (`ticketId`, `leaderUserId`) se guardan sin clave foránea.

## 4. Patrones de diseño

| Nº | Patrón | Código principal | ADR |
|---|---|---|---|
| 4.1 | State | `VALID_TRANSITIONS`, `assertTransition` | 014 |
| 4.2 | Transactional Outbox | `OutboxService`, `OutboxDispatcher` | 015 |
| 4.3 | Idempotent Receiver (Inbox) | `InboxService.ingest` | 015 |
| 4.4 | Port and Adapter | `IdentityPort`, `EventPublisher` | 016 |
| 4.5 | Optimistic Locking | `ifMatchWhere`, `ETagInterceptor` | 012 |
| 4.6 | Idempotency-Key | `IdempotencyInterceptor` | 013 |

No hay capa Repository: los services usan `PrismaService` directamente (ADR-001).

### 4.1 State

- Problema: estados cerrados en varias entidades; un `if` por endpoint deja huecos y cada servicio inventa su error.
- Decisión: una tabla `Record<Estado, Estado[]>` por entidad y un guard único que lanza `ConflictException` (409). Se descartó una clase por estado (mucho código para poco comportamiento) y XState (dependencia nueva).
- Código y pruebas: sección 5.
- Consecuencia: la tabla dice qué se puede; las precondiciones (cuadrilla, vehículo, motivo) siguen en el service.

### 4.2 Transactional Outbox

- Problema: guardar y luego publicar puede dejar base y bus desincronizados.
- Decisión: publicar es insertar una fila `PENDING` en `outbox_event` en la misma transacción del cambio. `OutboxDispatcher` la envía cada 10 s, lotes de 50, hasta 5 intentos y luego `FAILED`. El `eventId` del sobre es el id de la fila.
- Código: `OutboxService.enqueue(tx, entry)` y `enqueueMany` (`src/events/outbox/outbox.service.ts`); `OutboxDispatcher` (`outbox-dispatcher.service.ts`); reintento manual en `OutboxAdminService` (`outbox-admin.service.ts`).
- Pruebas: `outbox.service.spec.ts` (15), `outbox-dispatcher.service.spec.ts` (14), `outbox-admin.service.spec.ts` (20); e2e `test/outbox-retry.e2e-spec.ts`.
- Consecuencia: entrega al menos una vez; un solo dispatcher sin lock (una réplica en Render). ADR-015.

### 4.3 Idempotent Receiver (Inbox)

- Problema: el Core reintenta y entrega fuera de orden; un evento repetido no puede duplicar efectos.
- Decisión: `InboxService.ingest()` inserta en `inbox_event` con `messageId` único (el `eventId`); un duplicado ya procesado no se reaplica. Los handlers filtran por estado de origen reutilizando las tablas de State.
- Código: `InboxService.ingest` (`src/events/inbox/inbox.service.ts`); consumers en `src/events/consumers/`.
- Pruebas: `inbox.service.spec.ts` (39), `rabbitmq.consumer.spec.ts` (42), `consumers.spec.ts` (211); e2e `test/inbox.e2e-spec.ts`.
- Consecuencia: inbox y efecto del handler no comparten transacción, así que cada handler tolera correr de nuevo. ADR-015.

### 4.4 Port and Adapter

- Problema: M1 y el bus son externos y su contrato cambia; el dominio no debe depender de HTTP ni de AMQP.
- Decisión: clases abstractas como puertos, adaptadores inyectados por DI.
- Código: `IdentityPort` (`src/identity/identity.port.ts`) con `M1IdentityClient`; `EventPublisher` (`src/events/publishers/event-publisher.port.ts`) con `RabbitMqEventPublisher` y `LoggingEventPublisher`; `M1RoleAdapter` (`src/auth/m1-role.adapter.ts`).
- Pruebas: `m1-identity.client.spec.ts` (22), `rabbitmq.publisher.spec.ts` (18), `m1-role.adapter.spec.ts` (14).
- Consecuencia: sin `M1_BASE_URL` o `RABBITMQ_URL` el adaptador se degrada y la app arranca. ADR-016, ADR-009.

### 4.5 Optimistic Locking (ETag e If-Match)

- Problema: dos operadores actúan sobre una versión vieja.
- Decisión: ETag débil derivado de `updatedAt`; `If-Match` opcional, 412 si no coincide, con `updatedAt` en el `where` del `UPDATE` (atómico). Alcance: contenedores, servicios, intervenciones de arbolado y expedientes.
- Código: `src/common/etag.ts` (`ifMatchWhere`, `ETagInterceptor`).
- Pruebas: `etag.spec.ts` (6), `services-if-match.spec.ts` (7); e2e `test/etag-if-match.e2e-spec.ts`.
- Consecuencia: es retrocompatible y el 412 se evalúa antes que el 409. ADR-012.

### 4.6 Idempotency-Key

- Problema: un POST de alta reintentado duplica el recurso.
- Decisión: header opcional, un interceptor, `@Idempotent()` por handler. Misma clave y cuerpo repite la respuesta; otro cuerpo da 422; en curso da 409.
- Código: `src/common/idempotency/idempotency.interceptor.ts`.
- Pruebas: `idempotency.interceptor.spec.ts` (17); e2e `test/idempotency.e2e-spec.ts`.
- Consecuencia: el registro no es atómico con la transacción de dominio (ADR-013).

## 5. Patrón State en la entidad central

### 5.1 Entidad central: `Service`

`docs/entidades/service.md` la define como la entidad central. En el código, `TreeIntervention` y `EnvironmentalInspection` se ejecutan mediante un `Service` (`serviceId`). El vaciado de un contenedor también es un `Service`, y cerrarlo mueve el contenedor en la misma transacción. Además, el servicio proyecta el avance a M2.

### 5.2 Tabla de transiciones

`VALID_TRANSITIONS: Record<ServiceStatus, ServiceStatus[]>` en `src/modules/services/services.service.ts`. Como es un `Record`, agregar un estado sin su fila no compila.

| Acción | Endpoint | Estado actual | Estado nuevo | Rol |
|---|---|---|---|---|
| Iniciar | `POST /services/:id/start` | `SCHEDULED` | `IN_PROGRESS` | Cuadrilla |
| Suspender | `POST /services/:id/suspend` | `IN_PROGRESS` | `SUSPENDED` | Cuadrilla |
| Reanudar | `POST /services/:id/resume` | `SUSPENDED` | `IN_PROGRESS` | Cuadrilla |
| Completar | `POST /services/:id/complete` | `IN_PROGRESS` | `COMPLETED` o `PARTIALLY_COMPLETED` | Cuadrilla |
| Cancelar | `POST /services/:id/cancel` | `SCHEDULED`, `RESCHEDULED`, `SUSPENDED` | `CANCELLED` | Operaciones |
| Reprogramar | `POST /services/:id/reschedule` | `SCHEDULED` | `RESCHEDULED` | Operaciones |
| Confirmar reprogramación | `POST /services/:id/confirm-reschedule` | `RESCHEDULED` | `SCHEDULED` | Operaciones |

`COMPLETED`, `PARTIALLY_COMPLETED` y `CANCELLED` son terminales. Cuadrilla es `M6_CAMPO_CUADRILLA` (y además miembro de la cuadrilla del servicio, si no 403 `NOT_ASSIGNED`); Operaciones es `M6_ADMIN` y `M6_OFICINA_OPERACIONES` (`src/auth/role-groups.ts`). `complete` elige el estado final según los resultados por zona; `start` exige cuadrilla y, si el tipo lo pide, vehículo. Cuatro escritores automáticos mueven el estado (alerta meteorológica, rechazo de corte de M7, vencimiento de corte, cancelación de M2) con el estado de origen en el `where` de un `updateMany`. No lanzan 409: descartan lo que no aplica.

### 5.3 Implementación

1. `assertTransition(from, to)` (privado en `ServicesService`) busca el destino en la tabla y, si no está, lanza `ConflictException`: «No se puede pasar de 'X' a 'Y'. Transiciones válidas desde 'X': [...]».
2. `transition(...)` es el camino de `start`, `suspend`, `resume`, `cancel`, `reschedule` y `confirmReschedule`: llama a `assertTransition` y abre una `$transaction` con el `UPDATE`, la auditoría y el outbox. `complete` también llama a `assertTransition`. `resume` tiene una guarda propia (solo desde `SUSPENDED`).
3. El `UPDATE` lleva el estado leído en el `where`; si otro request movió el servicio, Prisma lanza `P2025`, que se traduce a 409 (o 412 con `If-Match`).
4. `HttpExceptionFilter` convierte todo `ConflictException` en `application/problem+json` con `status: 409`.

Orden de los controles: 401, 403 de rol, 404, 403 de pertenencia, 412 de `If-Match` y, al final, 409 de estado.

### 5.4 Garantía del 409 y tests

Todo cambio de estado por HTTP pasa por `assertTransition` (o por la guarda de `resume`, que lanza el mismo error). La tabla es total y la carrera entre dos pedidos se cubre con el estado en el `where`.

| Archivo | Qué prueba | Tests |
|---|---|---|
| `src/modules/services/services-transitions.spec.ts` | Todo par acción y estado de origen que la tabla no permite da 409 y no escribe nada (ni servicio, ni outbox, ni auditoría) | 53 |
| `test/services-lifecycle.e2e-spec.ts` | `suspend` desde `SCHEDULED` y `start` desde `COMPLETED` dan 409 (Postgres real) | 2 |

Los 53 son: 33 pares del complemento de la tabla (`start` 5, `suspend` 6, `cancel` 4, `reschedule` 6, `confirmReschedule` 6, `complete` 6), 6 de `complete` hacia `PARTIALLY_COMPLETED`, 6 de `resume` y 8 pares fijos de estados terminales que siguen exigiendo 409 aunque se afloje la tabla.

Ejecución real (16/11/2026, `npx vitest run`): `services-transitions.spec.ts` y los demás specs de transiciones: 562 de 562 en verde; 18 archivos de servicios, árboles, derivaciones e inspecciones: 942 de 942; suite unitaria completa: 132 archivos y 3064 de 3064 tests en verde. Los e2e no se ejecutaron (truncan la base); se citan por lo que afirman en el código.

### 5.5 Las otras entidades con máquina de estado

| Entidad | Estados | Tabla | Dónde se lanza el 409 | Tests |
|---|---|---|---|---|
| `Service` | 7 | `VALID_TRANSITIONS` | `assertTransition`, guarda de `resume` | `services-transitions.spec.ts` (53) |
| `Container` | 6 | `CONTAINER_TRANSITIONS` | `transition()` en `containers.service.ts` | `containers.service.spec.ts` (76 en total) |
| `TreeIntervention` | 4 | `VALID_TRANSITIONS` | `transition()` en `tree-interventions.service.ts` | `tree-interventions-transitions.spec.ts` (15) |
| `EnvironmentalReport` | 11 | `REPORT_TRANSITIONS` | `assertTransition` en `environmental-reports.service.ts` | `environmental-reports.service.spec.ts` (134 en total; compara tabla y guard para los 121 pares) |
| `RepairRequest` | 3 | `REPAIR_TRANSITIONS` | `assertTransition` en `outbound-requests.transitions.ts` | `outbound-requests-transitions.spec.ts` (46) y `outbound-requests.transitions.spec.ts` (7) |
| `StreetClosureRequest` | 5 | `CLOSURE_TRANSITIONS` | ídem | ídem |
| `OutboxEvent` | 3 | `OUTBOX_TRANSITIONS` | `outbox-admin.service.ts` (reintento) | `outbox-admin.service.spec.ts` (20 en total) |

Transiciones y roles principales de las demás:

| Entidad | Acción | Desde | Hacia | Rol |
|---|---|---|---|---|
| Contenedor | `report-overflow` / `empty` | `ACTIVE` / `OVERFLOWED` | `OVERFLOWED` / `ACTIVE` | Cuadrilla |
| Contenedor | `report-damage` | `ACTIVE` | `DAMAGED` | Cuadrilla |
| Contenedor | `start-repair` / `complete-repair` | `DAMAGED` / `UNDER_REPAIR` | `UNDER_REPAIR` / `ACTIVE` | Operaciones |
| Contenedor | `relocate` / `confirm-relocation` | `ACTIVE` / `RELOCATING` | `RELOCATING` / `ACTIVE` | Operaciones |
| Contenedor | `remove` | `DAMAGED` | `REMOVED` | Operaciones |
| Intervención | `submit-for-authorization` | `REQUESTED` | `PENDING_AUTHORIZATION` | Operaciones |
| Intervención | `authorize` | `PENDING_AUTHORIZATION` (poda: también `REQUESTED`) | `AUTHORIZED` | Admin en extracción; Operaciones en poda |
| Intervención | `reject` | `PENDING_AUTHORIZATION` | `REJECTED` | Admin en extracción; Operaciones en poda |
| Expediente | `start-review` | `RECEIVED` | `UNDER_REVIEW` | Ambiental |
| Expediente | `forward` / `dismiss` | `UNDER_REVIEW` | `FORWARDED` / `DISMISSED` | Ambiental |
| Expediente | alta de inspección | `UNDER_REVIEW` | `INSPECTION_SCHEDULED` | Ambiental |
| Expediente | cierre de inspección | `INSPECTION_SCHEDULED` | `INSPECTED`, luego `NO_VIOLATION` o `VIOLATION_FOUND` | Inspector |
| Expediente | emisión del acta | `VIOLATION_FOUND` | `NOTICE_ISSUED` | Ambiental |
| Expediente | `close` | `FORWARDED`, `DISMISSED`, `NO_VIOLATION`, `SANCTIONED` | `CLOSED` | Ambiental |
| Expediente | resolución de M4, plazo vencido, `ticketUpdated` | `NOTICE_ISSUED`, `CLOSED`, otros | `SANCTIONED`/`CLOSED`, `UNDER_REVIEW` | Sistema |
| Reparación | `start` / `close` | `REQUESTED` / `REQUESTED`, `IN_PROGRESS` | `IN_PROGRESS` / `CLOSED` | Admin |
| Corte de calle | `approve` / `reject` | `REQUESTED` | `APPROVED` / `REJECTED` | Admin |
| Corte de calle | `end` | `REQUESTED`, `APPROVED`, `EXPIRED` | `ENDED` | Admin |
| Corte de calle | vence `approvedTo` | `APPROVED` | `EXPIRED` | Sistema |
| Outbox | reintento manual | `FAILED` | `PENDING` | Admin |

Ambiental es `M6_ADMIN` y `M6_OFICINA_AMBIENTAL`; Inspector es `M6_CAMPO_INSPECTOR`; Admin es `M6_ADMIN`.

### 5.6 Hallazgos: respuestas que no son 409

Las transiciones que las tablas prohíben dan 409 en todas las entidades. Estas son las excepciones que hay en el código:

| Nº | Dónde | Qué responde |
|---|---|---|
| H1 | `issueNotice` (`environmental-inspections.service.ts`) | 400 si la inspección no cerró con `VIOLATION_FOUND`; el chequeo precede a la transición del expediente |
| H2 | `submitForAuthorization` (`tree-interventions.service.ts`) | 400 si la intervención es una poda, en cualquier estado |
| H3 | `confirmReschedule` y cierre de inspección | La validación de entrada (fecha, `nextStep`) da 400 antes que el 409 de estado |
| H4 | `TreeIntervention`, `EnvironmentalReport`, `RepairRequest`, `StreetClosureRequest` | El `UPDATE` no lleva el estado leído en el `where`: sin `If-Match`, dos pedidos concurrentes pueden aplicarse ambos (hueco reconocido en ADR-014) |

Por diseño, un usuario sin rol o ajeno a la cuadrilla recibe 403, y un ETag viejo recibe 412, antes que el 409.

## 6. Calidad y atributos no funcionales

### 6.1 Seguridad

| Aspecto | Cómo | Fuente |
|---|---|---|
| Cadena global | `ThrottlerGuard`, `JwtAuthGuard`, `RolesGuard` en ese orden | `src/app.module.ts` |
| Autenticación | JWT de M1; solo `sub_type = EMPLEADO`; lo público lleva `@Public()` | `jwt.strategy.ts`, `jwt-auth.guard.ts` |
| Autorización | `@Roles` por endpoint; una escritura sin `@Roles` da 403 | `roles.guard.ts`, `route-roles.spec.ts` (11) |
| Roles | Seis roles `M6Role`, con el rol de M1 como techo | ADR-008, `m1-role.adapter.ts` |
| Validación | `ValidationPipe` con `whitelist` y `forbidNonWhitelisted` | `src/configure-app.ts` |
| Rate limit | 600 por minuto por IP y endpoint; inbox 300; evidencia 30; `/health` excluido | ADR-010, `src/common/rate-limits.ts` |
| Errores | `application/problem+json` (RFC 9457) con `traceId` | ADR-011, `http-exception.filter.ts` |

### 6.2 Resiliencia

| Aspecto | Cómo | Fuente |
|---|---|---|
| Timeout a M1 | 4 s (`M1_TIMEOUT_MS`); al validar cuadrillas, un fallo de M1 da 503 | `m1-identity.client.ts`, `CrewsService.validateAgainstM1`, ADR-009 |
| Reintentos del outbox | 5 intentos y luego `FAILED` reintentable a mano | `outbox-dispatcher.service.ts` |
| Entrada | `nack` sin reencolar; reintentos y DLQ del Core | ADR-007 |
| Degradación | Sin `RABBITMQ_URL` publica a log; sin `M1_BASE_URL` no valida contra M1 | `events.module.ts`, `identity.port.ts` |
| Salud | `/health` y `/health/ready` (503 si la base no responde) | `health.controller.ts` |

### 6.3 Concurrencia y observabilidad

| Aspecto | Cómo | Fuente |
|---|---|---|
| Concurrencia | Estado en el `where`, `If-Match`, `Idempotency-Key`, `messageId` único | 4.3, 4.5, 4.6, 5.3 |
| Trazabilidad | `X-Request-Id` y `traceId` en todo error; `correlationId` y `causationId` en el sobre | `request-id.middleware.ts`, ADR-011, ADR-007 |
| Auditoría | Cada transición deja una fila en `DomainAuditLog` en la misma transacción | `audit.service.ts` |
| Testabilidad | Puertos reemplazables en los specs; specs junto al código, e2e en `test/` | 4.4, `docs/testing.md` |

## 7. Índice de ADR

| Nº | Título | Estado | Decisión |
|---|---|---|---|
| [001](../decisiones/adr-001-stack-tecnologico.md) | Stack tecnológico | Aceptado | NestJS, TypeScript, PostgreSQL con Prisma; Next.js en el frontend |
| [002](../decisiones/adr-002-auth-provisoria.md) | Autenticación provisoria | Aceptado (roles superados por 008) | Guard JWT HS256 global con `@Public()` |
| [003](../decisiones/adr-003-divergencias-enums.md) | Divergencias de enums | Aceptado | El catálogo interno gana y se corrige el acuerdo |
| [004](../decisiones/adr-004-jwt-m1-y-puerto-identidad.md) | JWT de M1 y puerto de identidad | Aceptado | M6 solo valida el JWT; identidad detrás de un puerto |
| [005](../decisiones/adr-005-alineacion-frontend-sesion-y-seguridad.md) | Sesión BFF y seguridad con el Frontend | Aceptado | El backend valida el Bearer, separa Oficina y Campo y audita datos sensibles |
| [006](../decisiones/adr-006-rabbitmq-como-bus.md) | RabbitMQ como bus | Reemplazado parcialmente por 007 | RabbitMQ detrás de puertos de publicación y consumo |
| [007](../decisiones/adr-007-contrato-de-integracion-del-core.md) | Contrato de integración del Core | Aceptado | Exchange y cola del Core, sobre común, `nack` sin reencolar |
| [008](../decisiones/adr-008-roles-m6-adaptados-desde-m1.md) | Roles de M6 desde M1 | Aceptado | Seis roles locales con el rol de M1 como techo |
| [009](../decisiones/adr-009-rest-m6-a-m1-consultas-de-identidad.md) | REST a M1 para identidad | Aceptado | REST de solo lectura con module-token y timeout de 4 s |
| [010](../decisiones/adr-010-rate-limit-global.md) | Rate limit global | Aceptado | `ThrottlerGuard` global con topes propios |
| [011](../decisiones/adr-011-errores-problem-details-rfc-9457.md) | Problem Details | Aceptado | Todo error en `application/problem+json` con `traceId` |
| [012](../decisiones/adr-012-concurrencia-optimista-etag.md) | ETag e If-Match | Aceptado | ETag de `updatedAt`; 412 atómico con el `UPDATE` |
| [013](../decisiones/adr-013-idempotency-key.md) | Idempotency-Key | Aceptado | Interceptor único; mismo cuerpo repite, otro da 422 |
| [014](../decisiones/adr-014-patron-state-maquinas-de-estado.md) | Patrón State | Aceptado | Tabla de transiciones y guard único con 409 |
| [015](../decisiones/adr-015-patron-outbox-inbox.md) | Patrón Outbox/Inbox | Aceptado | Outbox transaccional e inbox idempotente |
| [016](../decisiones/adr-016-patron-adapter-puerto-de-identidad.md) | Patrón Adapter | Aceptado | `IdentityPort` y `M1IdentityClient` |
| [017](../decisiones/adr-017-herramientas-analisis-estatico-y-seguridad.md) | Análisis estático y de seguridad | Aceptado | SonarCloud, Trivy y ZAP en el CI |

Patrón a ADR: State 014; Outbox e Inbox 015; Port and Adapter 016 (con 004 y 009); Optimistic Locking 012; Idempotency-Key 013.

## 8. Deuda técnica confirmada

| Tema | Detalle | Fuente |
|---|---|---|
| M3 | Falta el schema único de `streetClosureRequested` y el valor de `data.sourceModule` | `docs/bloqueantes.md` |
| M3 | Falta la validación formal de los schemas de `workOrderScheduled` y `workOrderCompleted` | `docs/bloqueantes.md` |
| M9 y M2 | Decisiones del Core sin tomar (validar `format`, `user_id` por AMQP, clave de barrio, dueño de `updateTicketStatus`) | `docs/bloqueantes.md` |
| M4 | Sin búsqueda de establecimientos el acta no se deriva (#500); plan B: carga manual | `docs/bloqueantes.md` |
| Inbox | El efecto del handler y la fila del inbox no comparten transacción | ADR-015 |
| Outbox | Un solo dispatcher sin lock; válido con una réplica | `outbox-dispatcher.service.ts` |
| Idempotency-Key | Registro no atómico con la transacción; tras 60 s un reintento puede duplicar | ADR-013 |
| If-Match | Opcional y limitado a cuatro recursos | ADR-012 |
| Carrera sin `If-Match` | Ver H4 en 5.6 | ADR-014 |
| Rate limit | Los operadores autenticados comparten un balde de 600 por minuto por endpoint | ADR-010 (nota del 16/11) |

## 9. Fuentes

`docs/arquitectura/`, `docs/decisiones/`, `docs/entidades/`, `docs/DER.md`, `docs/bloqueantes.md`, `docs/integracion/`, `docs/testing.md`, `prisma/schema.prisma`, `src/modules/*`, `src/events/`, `src/common/`, `src/auth/`, `src/identity/`, `docker-compose.yml` y los specs citados.
