# `ticketUpdated` ← M2

**El único evento de M2 que escuchamos, y nuestro único disparador de entrada.** Todo el circuito reclamo → servicio → vecino empieza acá.

No consumimos `ticketCreated`: va hacia M1 con los datos mínimos del registro del ciudadano, y nada de eso sirve para abrir un servicio.

## Qué hace M6 al recibirlo

Depende del discriminador `updateType`. **Un solo evento, siete comportamientos.**

| `updateType` | Qué hacemos |
|---|---|
| `ROUTED` | **Abrimos el [expediente ambiental](../../entidades/environmental-report.md) o el [servicio](../../entidades/service.md) puntual.** Es la entrada |
| `INFORMATION_PROVIDED` | Sumamos al expediente lo que el vecino respondió, correlacionado por `informationRequestId` |
| `CANCELLED` | Cancelamos el servicio o la inspección ya programados |
| `REOPENED` | Reabrimos: el vecino rechazó la solución y vuelve a gestión |
| `PRIORITY_CHANGED` | Reordenamos la cola de la cuadrilla |
| `ESCALATION_CHANGED` | Lo marcamos como escalado y se lo mostramos al supervisor |
| `STATUS_CHANGED`, `RESOLVED`, `CLOSED` | **Nada.** Se reciben y se descartan: en esos casos el cierre lo originamos nosotros |

> **No implementar un handler para los tres últimos.** Están en la tabla justamente para que quede escrito que se ignoran a propósito.

La cancelación llega por acá: no hace falta un `ticketCancelled`, que es uno de los huérfanos de la cohorte.

## Campos que necesitamos de `ROUTED`

```
comunes:  ticketId, publicId, ticketVersion, updateType,
          currentStatus, currentPriority?, attachments[]?, updatedAt
details:  requestTypeId, ticketType, summary, description,
          formData?, location, isAnonymous, resolutionDueAt?
```

| Campo | Por qué lo necesitamos |
|---|---|
| 🔴 **el módulo responsable** | No existe en el payload. Ver abajo |
| 🔴 `location { street, number, neighborhoodId }` | Asignamos zona operativa y cuadrilla a partir del barrio |
| `ticketId`, `publicId` | Los guardamos en el `Service` y en el `EnvironmentalReport` |
| `ticketVersion` | Para poder devolver `expectedTicketVersion` en cada [`updateTicketStatus`](../publicados/updateTicketStatus.md). **Es una columna nueva de nuestras tablas** |
| `requestTypeId` | Entero de su catálogo. Hoy es lo único parecido a un ruteo |
| `summary`, `description` | Contenido del reclamo |
| `isAnonymous` | Decide si hace falta identificar al denunciante |

Nice to have, si ya lo publican: `formData`, `resolutionDueAt`, `currentPriority`, `attachments[]`, `lat`/`lng` dentro de `location`.

## Lo que está bloqueado

🔴 **Cómo sabemos que un `ROUTED` es nuestro.** El evento no lleva módulo ni área de destino. Si el ruteo es por contenido y no por cola dedicada, necesitamos una de dos: que `ROUTED` incluya el módulo responsable, **o** que nos pasen el catálogo de `requestTypeId` que caen en ambiente, higiene y servicios urbanos. Cualquiera sirve; sin ninguna hay que escuchar los reclamos de las ocho áreas y adivinar. Es el mismo problema que antes llamábamos `targetArea`.

🔴 **`location` necesita estructura.** En el ejemplo del contrato viene como `{"address": "Lima y Chile"}`. Con texto libre no se puede rutear el trabajo.

⚠️ **`citizenId` no viaja.** El snapshot trae `isAnonymous` pero no el ciudadano, y lo necesitamos para el expediente ambiental cuando la denuncia no es anónima. Si prefieren no transportarlo, lo resolvemos por REST contra M1.

⚠️ **`RESOLVED` directo desde `ROUTED`.** Su matriz lo admite "solo si el Request Type admite resolución directa". Muchos de nuestros servicios se resuelven sin pasar por `STARTED` —una recolección de la ruta del día que además cierra un reclamo—, así que necesitamos saber cuáles de nuestros request types están marcados así.

Detalle completo en [bloqueantes.md](../../bloqueantes.md#m2--atención-ciudadana-).

## Nota de vocabulario

Los cinco eventos que este módulo esperaba —`complaintForwarded`, `complaintEscalated`, `complaintResolved`, `complaintClosed`, `complaintReopened`— **no existen**: son variantes de este. El renombre `complaint` → `ticket` ya está hecho de nuestro lado.
