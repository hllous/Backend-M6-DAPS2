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
| `ENVIRONMENTAL_REPORT` | `CREATE`, `START_REVIEW`, `FORWARD`, `DISMISS`, `CLOSE`, `REQUEST_INFORMATION` (sin el mensaje) y `STATUS_CHANGE` para lo que dispara la inspección o el acta |
| `ENVIRONMENTAL_INSPECTION` | `SCHEDULE`, `COMPLETE` |
| `VIOLATION_NOTICE` | `ISSUE` (la nota dice si se derivó a M4) |
| `REPAIR_REQUEST` | `CREATE`, `START`, `CLOSE` |
| `STREET_CLOSURE_REQUEST` | `CREATE`, `APPROVE`, `REJECT`, `END` |
| `TREE_INTERVENTION` | `CREATE`, `SUBMIT_FOR_AUTHORIZATION`, `AUTHORIZE`, `REJECT`, `ASSIGN_SERVICE` |
| `SERVICE` | `CREATE`, `UPDATE`, `ASSIGN_CREW`, `START`, `SUSPEND`, `RESUME`, `COMPLETE`, `CANCEL`, `RESCHEDULE`, `CONFIRM_RESCHEDULE` |
| `CREW` | `CREATE`, `ACTIVATE`/`DEACTIVATE`, `ADD_MEMBERS`, `REMOVE_MEMBER`, `REASSIGN_ZONE` |
| `ZONE`, `VEHICLE`, `ROUTE` | `CREATE`, `ACTIVATE`/`DEACTIVATE` |

### Lo que no queda registrado

- Las transiciones que hace el **sistema** y no una persona: los consumidores de eventos (`ticketUpdated`, `weatherAlert`, `streetClosure*`, `workOrder*`, `sanctionApplied`…) y los barridos (vencimiento del plazo del acta, vencimiento de cortes). No hay un actor humano en el token; quedan en su propio historial y en el inbox.
- Los avisos de demora, resultados por zona y registros de recolección de un servicio (no son estados).
- La edición de campos que no son estado (`PATCH` de contenedor, de cuadrilla, zona, vehículo o recorrido salvo `active`), el alta de paradas de un recorrido y las altas/bajas de barrios de una zona.
- Los puntos verdes, espacios verdes y árboles (no están en el alcance del pedido).

## Consulta

`GET /audit?entityType=&entityId=&page=&pageSize=` — solo `M6_ADMIN` y `M6_AUDITOR`, del más reciente al más antiguo. Ver [endpoints.md](../api/endpoints.md#audit--auditoría-de-dominio).
