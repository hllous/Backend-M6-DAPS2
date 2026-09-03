# Endpoints REST de M6

Resumen de lo que expone el backend. La fuente de verdad interactiva es el Swagger en `/api/docs`; este archivo existe para poder ver el mapa completo sin levantar nada, y porque el [DoD](../gestion/definition-of-done.md) lo pide para cada endpoint nuevo.

> **Actualizado al 02/09/2026** — Fase 7 del plan de implementación (vista pública e indicadores del tablero) + evidencia genérica (Issue #64). 130 rutas, agrupadas en 23 tags de Swagger.

## Convenciones

Todas descriptas en [`estandar-swagger.md`](estandar-swagger.md). Lo mínimo para leer esta tabla:

- **Autenticación**: todo exige `Authorization: Bearer <JWT>` salvo lo marcado como público. El `JwtAuthGuard` está registrado como guard global, así que un endpoint nuevo nace protegido; los públicos se marcan explícitamente con `@Public()`. Ver [ADR-002](../decisiones/adr-002-auth-provisoria.md).
- **Autorización por rol**: todavía no existe. Cualquier usuario autenticado puede llamar cualquier endpoint — pendiente de que M1 publique su taxonomía de roles ([bloqueantes.md](../bloqueantes.md)).
- **Listados**: paginados con `?page` (default 1) y `?pageSize` (default 20, máx 100). Devuelven `{ data: [...], meta: { total, page, pageSize, totalPages } }`.
- **Errores**: `{ statusCode, message, error, timestamp, path }`.
- **Tags**: cada recurso tiene su propio tag en Swagger UI, y los 22 tags están declarados en `main.ts` en orden de lectura — primero sobre qué se programa, después la operación, después el inventario.
- **Baja**: es lógica (`active = false`) en todos los catálogos e inventarios. `DELETE` devuelve 204 y el registro sigue existiendo. La excepción está anotada donde corresponde.

---

## `health`

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/health` | Health check. **Público**, no requiere JWT. |

## `zones` — zonas operativas

| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/zones` | Crear zona operativa |
| GET | `/zones` | Listar. Filtros: `active`, `search` (nombre) |
| GET | `/zones/:id` | Detalle, con los barrios asignados |
| PATCH | `/zones/:id` | Actualizar nombre y estado. El código es inmutable |
| DELETE | `/zones/:id` | Baja lógica |
| POST | `/zones/:id/neighborhoods` | Asignar barrios (catálogo de M9). Ignora duplicados |
| DELETE | `/zones/:id/neighborhoods/:neighborhoodId` | Quitar un barrio |

## `routes` — recorridos

| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/routes` | Crear recorrido. Nace sin paradas |
| GET | `/routes` | Listar. Filtros: `active`, `zoneId` (recorridos que pasan por la zona), `search` |
| GET | `/routes/:id` | Detalle con la secuencia de paradas, en orden |
| PATCH | `/routes/:id` | Actualizar nombre y estado |
| DELETE | `/routes/:id` | Baja lógica |
| PUT | `/routes/:id/stops` | **Reemplaza la secuencia completa de paradas.** Cubre alta, baja y reordenamiento en una sola llamada atómica: el orden del array es el orden del recorrido. Una zona no puede repetirse (400) — rompería `ServiceZone` cuando un servicio copie el recorrido. Array vacío deja el recorrido sin paradas |

## `service-frequencies` — frecuencias

| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/service-frequencies` | Crear la regla que genera los servicios planificados. El tipo de servicio tiene que ser de modo `ROUTE` (400 si no) |
| GET | `/service-frequencies` | Listar. Filtros: `serviceTypeId`, `routeId`, `shift`, `weekday` (1=Lunes…7=Domingo), `validOn` (reglas vigentes en esa fecha) |
| GET | `/service-frequencies/:id` | Detalle, con los días de la semana |
| PATCH | `/service-frequencies/:id` | Actualizar días, turno y vigencia. El array de días reemplaza el conjunto completo. El tipo y el recorrido son inmutables |
| DELETE | `/service-frequencies/:id` | **Cierra la vigencia** (`validTo = hoy`), no marca `active`: el modelo no tiene esa columna y el dominio ya expresa la baja con `validTo`. Si la regla todavía no empezó a regir, se cierra en su `validFrom` |

## `service-types` — catálogo de tipos de servicio

| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/service-types` | Crear tipo de servicio |
| GET | `/service-types` | Listar. Filtros: `active`, `category`, `mode`, `search` |
| GET | `/service-types/:id` | Detalle |
| PATCH | `/service-types/:id` | Actualizar nombre, `requiresVehicle` y estado. `code`, `category` y `mode` son inmutables: hay servicios ya programados que los copiaron |
| DELETE | `/service-types/:id` | Baja lógica |

## `disposal-sites` — sitios de disposición final

| Método | Ruta | Qué hace |
|---|---|---|
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

## `services` — programación y ejecución

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
| POST | `/services/:id/complete` | `IN_PROGRESS → COMPLETED` o `PARTIALLY_COMPLETED`. **El estado final se calcula**, no se elige: parcial si alguna zona quedó `NOT_SERVICED` o `PARTIAL`. 409 si falta el resultado de alguna zona. Si el servicio atiende un contenedor y cierra `COMPLETED`, **el contenedor transiciona en la misma transacción** (ver [container.md](../entidades/container.md)); si está en `RELOCATING` hace falta `containerLocation` en el body o da 400 |
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

## `containers` — contenedores

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

## `green-points` — puntos verdes

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

## `tree-surveys` — relevamientos de arbolado

| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/trees/:treeId/surveys` | Cargar un relevamiento |
| GET | `/trees/:treeId/surveys` | Historial de relevamientos. Filtros: `healthStatus`, `riskLevel` |
| GET | `/trees/:treeId/surveys/:surveyId` | Detalle de un relevamiento |

## `tree-interventions` — podas, extracciones, plantaciones y tratamientos

| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/tree-interventions` | Crear intervención sobre uno o más árboles |
| GET | `/tree-interventions` | Listar. Filtros: `interventionType`, `status` |
| GET | `/tree-interventions/:id` | Detalle |
| POST | `/tree-interventions/:id/submit-for-authorization` | `REQUESTED → PENDING_AUTHORIZATION`. Solo para `REMOVAL` |
| POST | `/tree-interventions/:id/authorize` | `→ AUTHORIZED`. Una `REMOVAL` en `REQUESTED` da 409: tiene que pasar por `PENDING_AUTHORIZATION` |
| POST | `/tree-interventions/:id/reject` | `PENDING_AUTHORIZATION → REJECTED` |
| POST | `/tree-interventions/:id/assign-service` | Asociar la intervención al `Service` que la ejecuta. La intervención guarda **qué** hay que hacer; el servicio, **cuándo, con qué cuadrilla y cómo terminó**. Solo una intervención `AUTHORIZED`, contra un servicio `POINT` que no ejecute ya otra |

## `events` — ingesta de eventos entrantes

| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/events/inbox` | Recibe un sobre y lo despacha al handler que corresponda. Devuelve `processed`, `duplicate`, `ignored` o `failed` |
| GET | `/events/handlers` | Los tipos de evento con handler registrado |

**La idempotencia es por `eventId`** y vive en el inbox, no en cada handler: un mensaje ya recibido se descarta sin volver a aplicar el efecto, que es lo que exige la regla 1 del enunciado. La decide el `@unique` de `InboxEvent.messageId`, no una consulta previa que podría correr en paralelo con otra igual.

Un evento sin handler se registra y se descarta sin romper. Si el handler falla, la fila queda sin `processedAt` y con el error, para poder reintentarla.

> Este endpoint existe **porque M9 nunca expuso un bus**: sin él no hay forma de ejercitar los consumidores. Cuando haya broker, el consumidor de Kafka llama al mismo `ingest()`.

## `repair-requests` — reparaciones derivadas a M3

El daño de infraestructura que detectamos pero que no nos corresponde arreglar. La solicitud existe para **poder seguir el pedido**: publicar el evento no alcanza, porque la respuesta de M3 vuelve asincrónica.

| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/repair-requests` | Crear y publicar `infrastructureRepairRequested` → M3. Si el daño salió de un servicio nacido de un reclamo, el `ticketId` viaja en el evento |
| GET | `/repair-requests` | Listar. Filtros: `status`, `damageType`, `severity`, `detectedInId` |
| GET | `/repair-requests/:id` | Detalle, con la orden de trabajo de M3 si la informaron |
| POST | `/repair-requests/:id/start` | → `IN_PROGRESS`. **Normalmente lo dispara `workOrderScheduled`** (Fase 6) |
| POST | `/repair-requests/:id/close` | → `CLOSED`. **Normalmente lo dispara `workOrderCompleted`** |

**Tres estados, no una máquina**: pedida, en curso, cerrada. Alcanza con eso, y por eso no consumimos `workOrderUpdated`.

`publicSafetyRisk` es un campo propio, **no derivado de `severity`**: son dos cosas distintas y M3 prioriza con él.

## `street-closure-requests` — cortes derivados a M7

| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/street-closure-requests` | Crear y publicar `streetClosureRequested` → M7, con **`sourceModule = "M6"`**. Exige al menos un tramo: `affectedSections` no puede viajar vacío |
| GET | `/street-closure-requests` | Listar. Filtros: `status`, `sourceId` |
| GET | `/street-closure-requests/:id` | Detalle con sus tramos |
| POST | `/street-closure-requests/:id/approve` | → `APPROVED`, guarda el `closureId` de M7. **Normalmente lo dispara `streetClosureApproved`** |
| POST | `/street-closure-requests/:id/reject` | → `REJECTED`. **Normalmente lo dispara `streetClosureRejected`** |
| POST | `/street-closure-requests/:id/end` | → `ENDED`. **Normalmente lo dispara `streetClosureEnded`** |

`sourceRef` apunta al `Service` o a la `TreeIntervention` que origina el corte: es lo que hace que la respuesta de M7 se pueda aplicar sobre el trabajo correcto.

> Los endpoints de transición existen para **operación manual y para poder demostrar el circuito mientras no haya bus**. Cuando la Fase 6 conecte los consumidores, lo normal va a ser que los muevan los eventos.

## `environmental-reports` — expedientes ambientales

El expediente de una denuncia ambiental —ruidos, vertidos, microbasurales, emisiones—, con su máquina de 11 estados. Puede nacer de un reclamo de M2 (`ticketId`) o de una **detección de oficio**, que es el camino que no depende de ningún otro módulo.

| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/environmental-reports` | Abrir expediente. Nace en `RECEIVED` |
| GET | `/environmental-reports` | Listar. Filtros: `status`, `reportType`, `priority`, `ticketId`, `search` |
| GET | `/environmental-reports/:id` | Detalle, con su plazo de vencimiento si lo tiene |
| POST | `/environmental-reports/:id/start-review` | `RECEIVED → UNDER_REVIEW` |
| POST | `/environmental-reports/:id/forward` | `UNDER_REVIEW → FORWARDED`. Hacia M2 sale como **`RETURNED`**, no `REJECTED`: devolver lo que no es de nuestra área es distinto de desestimarlo |
| POST | `/environmental-reports/:id/dismiss` | `UNDER_REVIEW → DISMISSED`. Hacia M2 sale como `REJECTED` |
| POST | `/environmental-reports/:id/close` | Cierre manual |

**Cierre por vencimiento.** `NOTICE_ISSUED → CLOSED` lo hace el sistema solo cuando pasa `deadlineAt`, sin endpoint. No es un atajo: M4 no publica nada cuando decide que no corresponde castigo, así que sin ese cierre el expediente quedaría abierto para siempre. El plazo se configura con `SANCTION_DEADLINE_DAYS`.

## `environmental-inspections` — inspecciones y actas

| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/environmental-reports/:reportId/inspections` | Programar. Lleva el expediente a `INSPECTION_SCHEDULED`. Se ejecuta como un `Service` de modo `POINT` |
| GET | `/environmental-reports/:reportId/inspections` | Inspecciones del expediente |
| GET | `/environmental-inspections/:id` | Detalle con checklist y hallazgos |
| POST | `/environmental-inspections/:id/complete` | Cierra con su `outcome`. Lleva el expediente a `INSPECTED` y de ahí, en la misma operación, a `NO_VIOLATION` o `VIOLATION_FOUND`. Un `INCONCLUSIVE` lo deja en `INSPECTED` |
| POST | `/environmental-inspections/:id/violation-notice` | **Emitir el acta.** Solo sobre una inspección `VIOLATION_FOUND` |
| GET | `/environmental-inspections/:id/violation-notice` | El acta emitida |

**`checklist[]`, `findings` e `inspectorId` son internos: nunca salen hacia M2.**

**El acta es inmutable.** No hay `PATCH` ni `DELETE`: si hay un error se emite otra sobre una inspección nueva. Una segunda acta sobre la misma inspección da 409.

**Sin `establishmentId` el acta no se deriva.** Se registra igual, pero no se publica `environmentalViolationDetected` y el expediente cierra de nuestro lado: intimar, clausurar y multar se le aplican a un comercio habilitado, que es lo único sobre lo que M4 puede actuar.

## `evidence` — adjuntos (foto/PDF)

| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/evidence` | Sube un archivo (multipart, uno por llamada) y lo asocia a un `ownerType`/`ownerId` que ya debe existir (`CONTAINER`, `SERVICE`, `ZONE_RESULT`, `INSPECTION`). Requiere el header `Idempotency-Key` |
| GET | `/evidence` | Lista la evidencia de un `ownerType`/`ownerId`, por query params |

**Genérico por diseño (Issue #64).** Un solo módulo sirve a los cuatro tipos de recurso en vez de reimplementar la subida por cada uno — el modelo `Attachment` ya era polimórfico en el schema, esto le agrega el endpoint que faltaba.

**Storage: Cloudflare R2** (S3-compatible), bucket público. La respuesta (`{id, url, filename, contentType, uploadedAt}`) sigue la hipótesis ya documentada por el frontend en su `CONTRACTS.md`, distinta del shape `{attachmentId, fileName, sizeBytes}` que espera M2 en sus eventos — ese mapeo queda para cuando se implemente el envío de `evidence` hacia M2 (ver `bloqueantes.md`).

**Idempotencia real, no solo validada.** `Idempotency-Key` repetida para el mismo owner devuelve el `Attachment` existente en vez de subir de nuevo — respaldado por un constraint único en DB (`ownerType`, `ownerId`, `idempotencyKey`), no por una consulta previa que podría perder una carrera.

## `green-spaces` — espacios verdes

| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/green-spaces` | Registrar plaza, parque, cantero o rambla |
| GET | `/green-spaces` | Listar. Filtros: `active`, `spaceType`, `zoneId` |
| GET | `/green-spaces/:id` | Detalle |
| PATCH | `/green-spaces/:id` | Actualizar |
| DELETE | `/green-spaces/:id` | Baja lógica |

---

## `indicators` — tablero de indicadores

Las cuatro familias que define [`docs/README.md`](../README.md). Todos filtran por período con `from` y `to`; sin ellos, los últimos 30 días.

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/indicators/coverage` | Objetivos atendidos sobre programados, con desglose por zona y por tipo de servicio. Filtros extra: `zoneId`, `serviceTypeId` |
| GET | `/indicators/compliance` | Finalizados en término contra demorados, y ranking de zonas no atendidas con sus motivos. Filtros extra: `zoneId`, `serviceTypeId` |
| GET | `/indicators/incidents` | Contenedores desbordados y dañados por zona, árboles por nivel de riesgo, y denuncias por tipo y estado con el tiempo medio de resolución |
| GET | `/indicators/waste` | Kg y m³ por tipo de residuo y por destino, y porcentaje desviado del relleno |

**La unidad de cobertura es el par (servicio, zona), no el servicio.** Un recorrido que pasa por cuatro zonas y atiende tres no es "un servicio a medias": son tres objetivos cumplidos y uno no. `ServiceZone` ya es ese par y `ZoneResult` es su resultado, así que el desglose por zona sale del mismo dato que el total.

**Los servicios `CANCELLED` no cuentan como incumplimiento.** Un servicio cancelado no es un objetivo fallado, es un objetivo que dejó de existir.

**"En término" se mide con el último `ZoneResult.recordedAt` contra `Service.scheduledDate`.** `Service` no tiene columna de cierre, y `updatedAt` se mueve con cualquier edición posterior: no sirve para medir puntualidad. El resultado de campo sí es la marca de cuándo se terminó el trabajo.

**Contenedores y arbolado son una foto del estado actual, no del período.** El inventario no tiene historial de estados, así que el período solo filtra las denuncias. El nivel de riesgo de cada árbol sale de su último relevamiento, uno por árbol.

**El tiempo medio de resolución cuenta solo los expedientes `CLOSED`**, que es el único estado del que no se sale, medido de `createdAt` a `updatedAt`.

## `citizen-portal` — vista pública

**Los únicos endpoints del módulo que se sirven sin JWT.** El `@Public()` va endpoint por endpoint y no a nivel de clase: el guard global hace que todo endpoint nuevo nazca protegido, y abrir la clase entera haría que el próximo `GET` de acá salga público sin que nadie lo decida.

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/public/reports/:ticketId` | **Público.** Seguimiento de la denuncia por el número de reclamo de M2, que es lo único que el vecino tiene en la mano. 404 exista o no el ticket |
| GET | `/public/services` | **Público.** Cuándo pasa el servicio. Filtros: `zoneId`, `serviceTypeId`, `from`, `to`. Sin fechas, los próximos 30 días |
| GET | `/public/green-points` | **Público.** Puntos verdes activos con su ubicación y qué residuos recibe cada uno. Filtro: `zoneId` |
| GET | `/public/zones` | **Público.** Zonas activas, para que el frontend arme el filtro de los otros dos. Sin paginar |

**Cada respuesta es una proyección explícita, no la fila de la base.** La diferencia importa: si mañana alguien agrega una columna al expediente, una proyección no la publica sola.

**Lo que no sale nunca por acá**, aunque esté en la misma fila: la identidad del inspector, los hallazgos y el checklist, el contenido del acta, la identidad del denunciante, y —en los servicios— la cuadrilla, el vehículo, las notas y el motivo interno de una reprogramación. Hay un test que lo verifica campo por campo.

**El expediente se resume a siete etapas, no a sus once estados.** `EnvironmentalReportStatus` es vocabulario de inspector: distingue cosas que le importan al supervisor, no al vecino. `VIOLATION_FOUND`, `NOTICE_ISSUED` y `SANCTIONED` son la misma etapa para el denunciante — el trámite sancionatorio sigue su curso.
---

## Lo que todavía no existe

Por fase del plan de implementación:

| Fase | Qué falta |
|---|---|
| 3.5 | Adjuntos y evidencia — hoy `evidence` viaja vacío en el acta. El equipo definió **Cloudflare R2** y lo toma otra persona: el backend guarda en `Attachment` la URL pública que devuelve el bucket, más el nombre del archivo |
