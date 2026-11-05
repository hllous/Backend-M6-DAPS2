# Auditoría de dominio

Quién hizo qué sobre los datos de dominio y cuándo ([#460](https://github.com/hllous/Backend-M6-DAPS2/issues/460)). Responde desde la API preguntas como «¿quién cerró este expediente?» o «¿quién dio de baja esta cuadrilla?». Es **adicional** a los historiales propios de cada entidad (`ContainerStatusHistory`, `GET /containers/:id/history`) y a `role_assignment_audit` (cambios de rol): no los reemplaza.

| Entidad | Campos principales |
|---|---|
| `DomainAuditLog` | `entityType`, `entityId`, `action`, `fromStatus?`, `toStatus?`, `actorUserId`, `actorRoles[]`, `note?`, `occurredAt` |

Tabla `domain_audit_log`, índice `(entity_type, entity_id, occurred_at)`.

## Reglas

- **Misma transacción.** `AuditService.record(tx, …)` (`src/common/audit/`) exige el cliente de la transacción, igual que el outbox: la fila y el cambio caen juntos o no cae ninguno. Una transición rechazada (409) no deja fila.
- **El actor sale del token** (`req.user`: `userId` y los roles de M6 efectivos al momento), nunca del body.
- **Solo agregado.** Un trigger de la base rechaza `UPDATE`, `DELETE` y `TRUNCATE`, igual que en `role_assignment_audit`. **No se purga**: la retención es indefinida. Un superusuario puede saltarlo (`session_replication_role = replica`); los e2e lo hacen en su limpieza y el usuario de la aplicación no debería ser superusuario. Los vaciados de la base (ver [seed.md](../seed.md)) deben dejarla afuera, como a `role_assignment_audit`.
- **Sin datos personales por diseño.** Se guardan ids, estados y, en `note`, el motivo que el flujo ya pide, tal cual lo escribió el usuario (texto libre, tope de 500 caracteres): quien lo escribe no debe poner nombres ni documentos, porque el registro no se purga. Ejemplos: cancelar, suspender, reprogramar, reubicar una cuadrilla. No se copian payloads ni el contenido del acta ni los mensajes al vecino.
- **No se audita la lectura** de datos sensibles (el acta identifica al infractor) en esta etapa.

## Qué queda registrado

`entityType` es un valor cerrado (`AUDIT_ENTITY_TYPES`). `fromStatus`/`toStatus` son el estado de la entidad; en los catálogos con baja lógica son `ACTIVE`/`INACTIVE`; en una inspección, `toStatus` es el resultado (`outcome`).

| `entityType` | Acciones |
|---|---|
| `CONTAINER` | `CREATE`, `REPORT_OVERFLOW`, `EMPTY`, `REPORT_DAMAGE`, `START_REPAIR`, `COMPLETE_REPAIR`, `RELOCATE`, `CONFIRM_RELOCATION`, `REMOVE`, y `COMPLETE_SERVICE` cuando lo mueve el cierre de un servicio |
| `ENVIRONMENTAL_REPORT` | `CREATE`, `START_REVIEW`, `FORWARD`, `DISMISS`, `CLOSE`, `REACTIVATE`, `REOPEN`, `PRIORITY_CHANGE`, `INFORMATION_PROVIDED`, `CANCEL_INFORMATION_REQUEST`, `ESCALATION_CHANGE`, `REQUEST_INFORMATION` (sin el mensaje) y `STATUS_CHANGE` para lo que dispara la inspección o el acta |
| `ENVIRONMENTAL_INSPECTION` | `SCHEDULE`, `COMPLETE` |
| `VIOLATION_NOTICE` | `ISSUE` (la nota dice si se derivó a M4) |
| `REPAIR_REQUEST` | `CREATE`, `START`, `CLOSE` |
| `STREET_CLOSURE_REQUEST` | `CREATE`, `APPROVE`, `REJECT`, `END` |
| `TREE_INTERVENTION` | `CREATE`, `SUBMIT_FOR_AUTHORIZATION`, `AUTHORIZE`, `REJECT`, `ASSIGN_SERVICE` |
| `SERVICE` | `CREATE`, `UPDATE`, `ASSIGN_CREW`, `START`, `SUSPEND`, `RESUME`, `COMPLETE`, `CANCEL`, `RESCHEDULE`, `CONFIRM_RESCHEDULE` |
| `CREW` | `CREATE`, `ACTIVATE`/`DEACTIVATE`, `ADD_MEMBERS`, `REMOVE_MEMBER`, `REASSIGN_ZONE` |
| `ZONE`, `VEHICLE`, `ROUTE` | `CREATE`, `ACTIVATE`/`DEACTIVATE` |
| `SANCTION_OUTCOME` | `RECORD_OUTCOME` (`toStatus` y `note` son la decisión de M4; solo lo escribe el consumidor de M4) |

### Respuestas de M3 y M7

`workOrderScheduled`/`workOrderCompleted` (M3) y `streetClosureApproved`/`Rejected`/`Ended` (M7) se auditan con las mismas `action` que las manuales (`START`, `CLOSE`, `APPROVE`, `REJECT`, `END`) y el actor `system:m3` o `system:m7` (`actorRoles` vacío), en la misma transacción del cambio. Solo si el estado realmente cambió: un evento repetido o tardío no deja fila. `fromStatus` es el estado visto al leer la solicitud, antes de la transacción: con eventos concurrentes sobre la misma solicitud podría quedar desfasado (carrera improbable, sin `SELECT FOR UPDATE`). `system:m3`/`system:m7` significa "llegó por el inbox", ya sea por el bus o por `POST /events/inbox` manual: un admin puede inyectar el evento y hoy no se distingue el origen. La reprogramación del servicio por un corte rechazado queda como `SERVICE` · `RESCHEDULE` · `system:m7`, en la misma transacción.

### Eventos de M2, M4 y alerta meteorológica

Mismo criterio (actor `system:<módulo>`, `actorRoles` vacío, misma transacción, solo si el update tocó filas; un evento repetido o atrasado no deja fila):

| Origen (actor) | Cambio | Entidad · acción |
|---|---|---|
| `ticketUpdated` ROUTED (`system:m2`) | alta del expediente | `ENVIRONMENTAL_REPORT` · `CREATE` (a `RECEIVED`) |
| ROUTED re-derivado | `FORWARDED` → `UNDER_REVIEW` | `ENVIRONMENTAL_REPORT` · `REACTIVATE` |
| ROUTED a otra área | `FORWARDED` → `CLOSED` | `ENVIRONMENTAL_REPORT` · `CLOSE` |
| CANCELLED | `UNDER_REVIEW` → `DISMISSED`; `FORWARDED` → `CLOSED` | `ENVIRONMENTAL_REPORT` · `DISMISS` / `CLOSE` |
| CANCELLED | servicios `SCHEDULED`/`RESCHEDULED` → `CANCELLED` (una fila por servicio) | `SERVICE` · `CANCEL` |
| REOPENED | → `UNDER_REVIEW` | `ENVIRONMENTAL_REPORT` · `REOPEN` |
| PRIORITY_CHANGED, INFORMATION_PROVIDED, ESCALATION_CHANGED | datos sin máquina de estados: `fromStatus` es el estado del expediente, `toStatus` queda vacío | `ENVIRONMENTAL_REPORT` · `PRIORITY_CHANGE`, `INFORMATION_PROVIDED`, `ESCALATION_CHANGE` |
| cualquier `ticketUpdated` que cambia el estado en M2 (no a `PENDING_INFORMATION`) | se apaga la solicitud de información pendiente | `ENVIRONMENTAL_REPORT` · `CANCEL_INFORMATION_REQUEST` |
| `commercialFineGenerated` / `closureUpdate` (`system:m4`) | alta de la resolución espejo de M4 | `SANCTION_OUTCOME` · `RECORD_OUTCOME` |
| `commercialFineGenerated` / `closureUpdate` (`system:m4`) | `NOTICE_ISSUED` → `SANCTIONED` → `CLOSED` (una fila por transición) | `ENVIRONMENTAL_REPORT` · `STATUS_CHANGE` |
| `weatherAlertIssued` (`system:weather`) | servicios `SCHEDULED` → `RESCHEDULED` (una fila por servicio) | `SERVICE` · `RESCHEDULE` |

La `note` nunca lleva el texto del vecino (`INFORMATION_PROVIDED` solo dice que respondió). `weatherAlertIssued` no lo publica ningún módulo (lo simulamos nosotros), por eso el actor es `system:weather` y no `system:m9`. `TicketM2State` **no** se audita: que es un espejo del estado de M2.

### Lo que no queda registrado

- Las transiciones que hace el **sistema** y no una persona, fuera de los eventos entrantes de arriba: los barridos (vencimiento del plazo del acta, vencimiento de cortes). No hay un actor humano en el token; quedan en su propio historial y en el inbox.
- Los avisos de demora, resultados por zona y registros de recolección de un servicio (no son estados).
- La edición de campos que no son estado (`PATCH` de contenedor, de cuadrilla, zona, vehículo o recorrido salvo `active`), el alta de paradas de un recorrido y las altas/bajas de barrios de una zona.
- Los puntos verdes, espacios verdes y árboles (no están en el alcance del pedido).

## Consulta

`GET /audit?entityType=&entityId=&page=&pageSize=` — solo `M6_ADMIN` y `M6_AUDITOR`, del más reciente al más antiguo. Ver [endpoints.md](../api/endpoints.md#audit--auditoría-de-dominio).
