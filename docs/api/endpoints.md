# Endpoints REST de M6

Resumen de lo que expone el backend. La fuente de verdad interactiva es el Swagger en `/api/docs`; este archivo existe para poder ver el mapa completo sin levantar nada, y porque el [DoD](../gestion/definition-of-done.md) lo pide para cada endpoint nuevo.

> **Actualizado al 02/09/2026** — Fase 1 del plan de implementación (catálogos). 77 rutas.

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

> El CRUD de `Service` en sí es la **Fase 2** y todavía no existe. Lo que sigue son los catálogos que lo habilitan.

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
| 2 | `services` — el CRUD de `Service`, su máquina de estados, `ZoneResult` y `CollectionRecord` |
| 3 | Outbox y publicación de eventos a Kafka |
| 4 | `environmental-reports`, `environmental-inspections`, actas y resoluciones |
| 5 | `outbound-requests` — derivaciones a M3 y M7 |
| 6 | Inbox y consumidores de eventos |
| 7 | `citizen-portal` (público), adjuntos, indicadores del tablero |
