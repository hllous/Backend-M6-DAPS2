# `Service` — la entidad central

Un **`Service`** es toda unidad de trabajo programable del módulo: siempre tiene tipo, fecha, ventana horaria, cuadrilla, vehículo si corresponde, estado y evidencia. Lo que varía es sobre qué se ejecuta.

| `mode` | Objetivo | Ejemplo | Resultado |
|---|---|---|---|
| `ROUTE` | Secuencia ordenada de zonas | Recolección domiciliaria Zona Norte | Un `ZoneResult` por zona |
| `POINT` | Un bien del inventario o una ubicación | Vaciar el contenedor CT-0442; podar el árbol TR-01293 | Un único resultado |

Todo `Service` lleva `zoneIds[]` y **nunca viene vacío**: las zonas del recorrido en `ROUTE`, una sola en `POINT`. Se copia al programar y no se recalcula, para que editar un recorrido no altere lo ya ejecutado.

En `POINT` la zona sale del bien del inventario, o del barrio de la dirección si el objetivo es una ubicación suelta.

Las podas y las inspecciones ambientales también son servicios: [`TreeIntervention`](tree-intervention.md) y [`EnvironmentalInspection`](control-ambiental.md) guardan **qué** hay que hacer, y el `Service` **cuándo**, con qué cuadrilla y cómo terminó.

## Campos

| Entidad | Campos principales |
|---|---|
| `Service` | `serviceTypeId`, `mode`, `zoneIds[]`, `routeId` \| `targetRef`, `scheduledDate`, `timeWindow`, `crewId`, `vehicleId`, `status`, `statusReason`, `origin`, `ticketId`, `attachments[]`, `notes`. `crewId` es opcional hasta que se asigna la cuadrilla. `assignmentOverrideNote` / `By` / `At` solo se llenan si la asignación se hizo **sobre un solapamiento** |
| `ServiceDelayNotice` | Hijo de un `Service`, uno por aviso de demora. `delayType`, `delayMinutes`, `reason`, `newEstimatedEnd`, `serviceStatus`, `reportedBy`, `detectedAt`, `supersededById`. El vigente es el que no fue reemplazado |
| `ZoneResult` | Hijo de un `Service` con `mode = ROUTE`, uno por zona. `zoneId`, `status`, `reason`, `proposedDate`, `notes`, `attachments[]`, `recordedAt` |
| `CollectionRecord` | `wasteType`, `volumeM3`, `weightKg`, `disposalSiteId` |
| `DisposalSite` | `code`, `siteType`, `name` |

Referencias a otras entidades: `serviceTypeId` → [`ServiceType`](configuracion-y-recursos.md#servicetype), `routeId` → [`Route`](configuracion-y-recursos.md#route), `crewId` → [`Crew`](configuracion-y-recursos.md#crew), `vehicleId` → [`Vehicle`](configuracion-y-recursos.md#vehicle), `zoneIds[]` → [`Zone`](configuracion-y-recursos.md#zone). `targetRef` apunta a un bien de [inventario urbano](inventario-urbano.md) o a un [`Container`](container.md).

Enums: `mode` es `ServiceMode`, `status` es `ServiceStatus`, `origin` es `ServiceOrigin`, `ZoneResult.status` es `ZoneResultStatus`, `ZoneResult.reason` es `NotServicedReason`, `wasteType` es `WasteType`, `siteType` es `DisposalSiteType` — ver [enumeraciones.md](../enumeraciones.md).

`ticketId` es de M2 y viaja solo cuando `origin = TICKET`. Es lo único que necesitamos guardar para correlacionar. `expectedTicketVersion` salió del contrato en la v1.5. `publicId` volvió en la v1.70 como referencia humana, pero el `Service` no lo guarda: el `ticketId` entra por `POST /services` y no hay de dónde tomar el `publicId` (ver #145 y [`updateTicketStatus`](../eventos/publicados/updateTicketStatus.md)).

## Estados

El mismo diagrama vale para `mode = ROUTE` y para `mode = POINT`.

```mermaid
stateDiagram-v2
    [*] --> SCHEDULED
    SCHEDULED --> CANCELLED
    SCHEDULED --> RESCHEDULED : se reprograma
    RESCHEDULED --> SCHEDULED : nueva fecha
    RESCHEDULED --> CANCELLED : ya no se hace
    SCHEDULED --> IN_PROGRESS : la cuadrilla inicia
    IN_PROGRESS --> SUSPENDED
    SUSPENDED --> IN_PROGRESS : se reanuda
    SUSPENDED --> CANCELLED
    IN_PROGRESS --> COMPLETED : todo atendido
    IN_PROGRESS --> PARTIALLY_COMPLETED : alguna zona NOT_SERVICED o PARTIAL
    CANCELLED --> [*]
    COMPLETED --> [*]
    PARTIALLY_COMPLETED --> [*]
```

`DELAYED` **no es un estado**: es un aviso, y vive en su propia tabla. El servicio sigue en `SCHEDULED` o en `IN_PROGRESS` mientras se demora, y esos son los dos únicos momentos en los que un retraso significa algo — uno cerrado ya no se demora, y uno suspendido tiene su motivo en `statusReason`.

El tipo tiene que coincidir con el momento: `START` es empezar tarde y solo aplica antes de arrancar; `DURATION` es tardar más, y solo aplica con la cuadrilla trabajando. Aceptar la combinación cruzada dejaría entrar datos que después nadie sabe leer.

Los avisos se acumulan. Uno nuevo **reemplaza** al vigente (`supersededById`) en vez de pisarlo, y el reemplazado queda en el historial: un aviso emitido no se corrige, se emite otro — el mismo criterio que el acta.

## Asignar sobre un solapamiento

Que la cuadrilla esté tomada ese día en una franja que se pisa **avisa, no bloquea**. La realidad de la calle gana: a veces la misma cuadrilla hace dos cosas y quien planifica lo sabe. Sin `overrideNote` la asignación rebota con 409 nombrando los servicios en conflicto; con la nota se hace igual y queda registrado quién decidió y cuándo.

La nota se guarda **solo si hubo solapamiento**. Guardarla siempre dejaría rastro de un override que nunca ocurrió.

Una franja horaria ausente se trata como **todo el día**: es lo único honesto cuando no sabemos cuándo empieza, y suponer lo contrario haría desaparecer el aviso justo donde menos información hay. `GET /services/:id/assignment-conflicts` existe para poder avisar antes de enviar — el 409 es la red, no el camino.

**`RESCHEDULED` no obliga a reprogramar.** Es el estado "hay que moverlo pero todavía no sé adónde", y el sistema mete servicios ahí solo: lo hacen el rechazo de un corte de calle de M7 y la alerta meteorológica. Si el motivo es definitivo —M7 rechaza el corte porque hay obra por dos meses— cancelar es la decisión correcta y sale directo, sin pasar por una fecha inventada.

## Qué publica

- Al agendarse: [`urbanServiceScheduled`](../eventos/publicados/urbanServiceScheduled.md) → M7.
- Si nació de un reclamo (`origin = TICKET`), cada cambio relevante dispara un [`updateTicketStatus`](../eventos/publicados/updateTicketStatus.md) → M2. **Si no hay `ticketId`, no sale nada hacia M2**: un servicio planificado —la recolección de todos los martes— no proyecta.

Un aviso de demora sobre un servicio nacido de un reclamo sale como `updateTicketStatus / PROGRESS`: el motivo viaja como mensaje interno, al vecino se le dice que se demora y no por qué.

Los hechos de inicio, demora, cierre y zona no atendida existen en el modelo pero **no salen al bus** como tales: ver [descartados.md](../eventos/publicados/descartados.md).
