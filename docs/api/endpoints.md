# Endpoints REST de M6

Resumen de lo que expone el backend. La fuente de verdad interactiva es el Swagger en `/api/docs`; este archivo existe para poder ver el mapa completo sin levantar nada, y porque el [DoD](../gestion/definition-of-done.md) lo pide para cada endpoint nuevo.

> **Actualizado al 02/09/2026** — Fase 2 del plan de implementación (`Service`). 94 rutas.

## Convenciones

Todas descriptas en [`estandar-swagger.md`](estandar-swagger.md). Lo mínimo para leer esta tabla:

- **Autenticación**: todo exige `Authorization: Bearer <JWT>` salvo lo marcado como público. El `JwtAuthGuard` está registrado como guard global, así que un endpoint nuevo nace protegido; los públicos se marcan explícitamente con `@Public()`. Ver [ADR-002](../decisiones/adr-002-auth-provisoria.md).
- **Autorización por rol**: todavía no existe. Cualquier usuario autenticado puede llamar cualquier endpoint — pendiente de que M9 publique su taxonomía de roles ([bloqueantes.md](../bloqueantes.md)).
- **Listados**: paginados con `?page` (default 1) y `?pageSize` (default 20, máx 100). Devuelven `{ data: [...], meta: { total, page, pageSize, totalPages } }`.
- **Errores**: `{ statusCode, message, error, timestamp, path }`.
- **Baja**: es lógica (`active = false`) en todos los catálogos e inventarios. `DELETE` devuelve 204 y el registro sigue existiendo. La excepción está anotada donde corresponde.

---

## `health`

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/health` | Health check. **Público**, no requiere JWT. |

## `zones` — zonas operativas, recorridos y frecuencias

### Zonas

| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/zones` | Crear zona operativa |
| GET | `/zones` | Listar. Filtros: `active`, `search` (nombre) |
| GET | `/zones/:id` | Detalle, con los barrios asignados |
| PATCH | `/zones/:id` | Actualizar nombre y estado. El código es inmutable |
| DELETE | `/zones/:id` | Baja lógica |
| POST | `/zones/:id/neighborhoods` | Asignar barrios (catálogo de M9). Ignora duplicados |
| DELETE | `/zones/:id/neighborhoods/:neighborhoodId` | Quitar un barrio |

### Recorridos

| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/routes` | Crear recorrido. Nace sin paradas |
| GET | `/routes` | Listar. Filtros: `active`, `zoneId` (recorridos que pasan por la zona), `search` |
| GET | `/routes/:id` | Detalle con la secuencia de paradas, en orden |
| PATCH | `/routes/:id` | Actualizar nombre y estado |
| DELETE | `/routes/:id` | Baja lógica |
| PUT | `/routes/:id/stops` | **Reemplaza la secuencia completa de paradas.** Cubre alta, baja y reordenamiento en una sola llamada atómica: el orden del array es el orden del recorrido. Una zona no puede repetirse (400) — rompería `ServiceZone` cuando un servicio copie el recorrido. Array vacío deja el recorrido sin paradas |

### Frecuencias

| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/service-frequencies` | Crear la regla que genera los servicios planificados. El tipo de servicio tiene que ser de modo `ROUTE` (400 si no) |
| GET | `/service-frequencies` | Listar. Filtros: `serviceTypeId`, `routeId`, `shift`, `weekday` (1=Lunes…7=Domingo), `validOn` (reglas vigentes en esa fecha) |
| GET | `/service-frequencies/:id` | Detalle, con los días de la semana |
| PATCH | `/service-frequencies/:id` | Actualizar días, turno y vigencia. El array de días reemplaza el conjunto completo. El tipo y el recorrido son inmutables |
| DELETE | `/service-frequencies/:id` | **Cierra la vigencia** (`validTo = hoy`), no marca `active`: el modelo no tiene esa columna y el dominio ya expresa la baja con `validTo`. Si la regla todavía no empezó a regir, se cierra en su `validFrom` |

## `services` — servicios urbanos y su configuración

### Programación y ejecución

`Service` es la unidad de trabajo programable del módulo: recolección, barrido, lavado, vaciado de contenedor, poda y riego son todos un servicio. Lo que varía es sobre qué se ejecuta — un recorrido de zonas (`ROUTE`) o un objetivo puntual (`POINT`).

| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/services` | Programar. El **modo se copia del `ServiceType`**, no se elige. Un `ROUTE` exige recorrido y copia sus zonas como snapshot; un `POINT` se ubica por el bien del inventario (`targetType` + `targetId`) o por una `zoneId` suelta. `origin = TICKET` exige `ticketId`, y ningún otro origen lo admite. Nace en `SCHEDULED` |
| GET | `/services` | Listar. Filtros: `status`, `serviceTypeId`, `mode`, `origin`, `crewId`, `vehicleId`, `zoneId`, `ticketId`, `scheduledFrom`, `scheduledTo` |
| GET | `/services/:id` | Detalle con zonas, resultados por zona y registros de recolección |
| PATCH | `/services/:id` | Corregir vehículo, ventana horaria y notas, **solo antes de iniciar**. El tipo, el modo, el recorrido, el objetivo y las zonas quedan fijos al programar |
| POST | `/services/:id/assign-crew` | Asignar cuadrilla, y vehículo en la misma operación |

**Máquina de estados.** Una transición inválida devuelve 409 nombrando las válidas desde el estado actual.

| Método | Ruta | Transición |
|---|---|---|
| POST | `/services/:id/start` | `SCHEDULED → IN_PROGRESS`. **409 sin cuadrilla asignada**, o sin vehículo si el `ServiceType` lo exige |
| POST | `/services/:id/suspend` | `IN_PROGRESS → SUSPENDED`. Motivo obligatorio |
| POST | `/services/:id/resume` | `SUSPENDED → IN_PROGRESS`. Limpia el motivo |
| POST | `/services/:id/complete` | `IN_PROGRESS → COMPLETED` o `PARTIALLY_COMPLETED`. **El estado final se calcula**, no se elige: parcial si alguna zona quedó `NOT_SERVICED` o `PARTIAL`. 409 si falta el resultado de alguna zona |
| POST | `/services/:id/cancel` | `SCHEDULED` o `SUSPENDED` → `CANCELLED`. Motivo obligatorio |
| POST | `/services/:id/reschedule` | `SCHEDULED → RESCHEDULED`. Deja el servicio a la espera de fecha nueva, con el motivo. Es donde caen los servicios ante una alerta meteorológica o el rechazo de un corte |
| POST | `/services/:id/confirm-reschedule` | `RESCHEDULED → SCHEDULED` con la fecha y ventana nuevas |

`DELAYED` no es un estado: es un aviso puntual, el servicio sigue en `SCHEDULED` o `IN_PROGRESS`.

**Resultado y residuos.**

| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/services/:id/zone-results` | Informar cómo quedó una zona. Solo con el servicio en `IN_PROGRESS`, una vez por zona, y sobre una zona del servicio. `reason` **obligatorio** si no quedó `SERVICED`, y rechazado si sí |
| GET | `/services/:id/zone-results` | Resultados informados, en orden de registro |
| POST | `/services/:id/collection-records` | Registrar residuos: tipo, volumen, peso y destino final. Solo sobre servicios iniciados o cerrados, contra un sitio de disposición activo |
| GET | `/services/:id/collection-records` | Registros del servicio |

### Catálogos

| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/service-types` | Crear tipo de servicio |
| GET | `/service-types` | Listar. Filtros: `active`, `category`, `mode`, `search` |
| GET | `/service-types/:id` | Detalle |
| PATCH | `/service-types/:id` | Actualizar nombre, `requiresVehicle` y estado. `code`, `category` y `mode` son inmutables: hay servicios ya programados que los copiaron |
| DELETE | `/service-types/:id` | Baja lógica |
| POST | `/disposal-sites` | Crear sitio de disposición final |
| GET | `/disposal-sites` | Listar. Filtros: `active`, `siteType`, `search` |
| GET | `/disposal-sites/:id` | Detalle |
| PATCH | `/disposal-sites/:id` | Actualizar nombre, tipo y estado |
| DELETE | `/disposal-sites/:id` | Baja lógica. Los `CollectionRecord` ya cargados lo referencian |

## `crews` — cuadrillas

| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/crews` | Crear cuadrilla |
| GET | `/crews` | Listar. Filtros: `active`, `crewType`, `defaultShift` |
| GET | `/crews/:id` | Detalle, con los integrantes |
| PATCH | `/crews/:id` | Actualizar |
| DELETE | `/crews/:id` | Baja lógica |
| POST | `/crews/:id/members` | Agregar integrantes |
| DELETE | `/crews/:id/members/:userId` | Quitar un integrante |

## `vehicles` — vehículos

| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/vehicles` | Registrar vehículo |
| GET | `/vehicles` | Listar. Filtros: `active`, `vehicleType` |
| GET | `/vehicles/:id` | Detalle |
| PATCH | `/vehicles/:id` | Actualizar |
| DELETE | `/vehicles/:id` | Baja lógica |

## `containers` — contenedores y puntos verdes

### Contenedores

| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/containers` | Registrar contenedor. Nace en `ACTIVE` |
| GET | `/containers` | Listar. Filtros: `status`, `containerType`, `zoneId`, `search` |
| GET | `/containers/:id` | Detalle |
| PATCH | `/containers/:id` | Actualizar zona, capacidad y ubicación |
| POST | `/containers/:id/report-overflow` | `ACTIVE → OVERFLOWED` |
| POST | `/containers/:id/empty` | `OVERFLOWED → ACTIVE` |
| POST | `/containers/:id/report-damage` | `ACTIVE → DAMAGED`. Registra tipo de daño, severidad y `requiresPublicWorks` |
| POST | `/containers/:id/start-repair` | `DAMAGED → UNDER_REPAIR` |
| POST | `/containers/:id/complete-repair` | `UNDER_REPAIR → ACTIVE` |
| POST | `/containers/:id/relocate` | `ACTIVE → RELOCATING` |
| POST | `/containers/:id/confirm-relocation` | `RELOCATING → ACTIVE` con la nueva ubicación |
| POST | `/containers/:id/remove` | `DAMAGED → REMOVED`. Solo desde `DAMAGED` — ver [container.md](../entidades/container.md) |

Una transición no válida devuelve 409 nombrando las que sí lo son.

### Puntos verdes

| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/green-points` | Registrar punto verde de entrega voluntaria |
| GET | `/green-points` | Listar. Filtros: `active`, `zoneId`, `wasteType`, `search` (nombre o dirección) |
| GET | `/green-points/:id` | Detalle, con los tipos de residuo aceptados |
| PATCH | `/green-points/:id` | Actualizar. El array de tipos de residuo reemplaza el conjunto completo |
| DELETE | `/green-points/:id` | Baja lógica |

## `trees` — arbolado urbano

| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/trees` | Registrar árbol en el censo |
| GET | `/trees` | Listar. Filtros: `active`, `zoneId`, `search` (especie o dirección) |
| GET | `/trees/:id` | Detalle |
| PATCH | `/trees/:id` | Actualizar |
| DELETE | `/trees/:id` | Baja lógica |
| POST | `/trees/:treeId/surveys` | Cargar un relevamiento |
| GET | `/trees/:treeId/surveys` | Historial de relevamientos. Filtros: `healthStatus`, `riskLevel` |
| GET | `/trees/:treeId/surveys/:surveyId` | Detalle de un relevamiento |
| POST | `/tree-interventions` | Crear intervención sobre uno o más árboles |
| GET | `/tree-interventions` | Listar. Filtros: `interventionType`, `status` |
| GET | `/tree-interventions/:id` | Detalle |
| POST | `/tree-interventions/:id/submit-for-authorization` | `REQUESTED → PENDING_AUTHORIZATION`. Solo para `REMOVAL` |
| POST | `/tree-interventions/:id/authorize` | `→ AUTHORIZED`. Una `REMOVAL` en `REQUESTED` da 409: tiene que pasar por `PENDING_AUTHORIZATION` |
| POST | `/tree-interventions/:id/reject` | `PENDING_AUTHORIZATION → REJECTED` |
| POST | `/tree-interventions/:id/assign-service` | Asociar la intervención al `Service` que la ejecuta. La intervención guarda **qué** hay que hacer; el servicio, **cuándo, con qué cuadrilla y cómo terminó**. Solo una intervención `AUTHORIZED`, contra un servicio `POINT` que no ejecute ya otra |

## `green-spaces` — espacios verdes

| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/green-spaces` | Registrar plaza, parque, cantero o rambla |
| GET | `/green-spaces` | Listar. Filtros: `active`, `spaceType`, `zoneId` |
| GET | `/green-spaces/:id` | Detalle |
| PATCH | `/green-spaces/:id` | Actualizar |
| DELETE | `/green-spaces/:id` | Baja lógica |

---

## Lo que todavía no existe

Por fase del plan de implementación:

| Fase | Qué falta |
|---|---|
| 3 | Outbox y publicación de eventos a Kafka |
| 4 | `environmental-reports`, `environmental-inspections`, actas y resoluciones |
| 5 | `outbound-requests` — derivaciones a M3 y M7 |
| 6 | Inbox y consumidores de eventos |
| 7 | `citizen-portal` (público), adjuntos, indicadores del tablero |
