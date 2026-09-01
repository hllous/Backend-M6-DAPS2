# `ticketUpdated` ← M2

**El único evento de M2 que escuchamos, y nuestro único disparador de entrada.** Todo el circuito reclamo → servicio → vecino empieza acá.

No consumimos `ticketCreated`: va hacia M1 con los datos mínimos del registro del ciudadano, y nada de eso sirve para abrir un servicio.

## Qué hace M6 al recibirlo

Depende del discriminador `updateType`. La v1.5 define trece valores posibles (§7.2) — **la tabla de abajo cubre los trece**, no solo los que nos interesan: seis disparan acción, siete se ignoran a propósito.

| `updateType` | Qué hacemos |
|---|---|
| `ROUTED` | **Abrimos el [expediente ambiental](../../entidades/environmental-report.md) o el [servicio](../../entidades/service.md) puntual.** Es la entrada |
| `INFORMATION_PROVIDED` | Sumamos al expediente lo que el vecino respondió. La v1.5 no usa ID de correlación: como máximo hay una solicitud activa por ticket, así que la respuesta siempre corresponde a la nuestra |
| `CANCELLED` | Cancelamos el servicio o la inspección ya programados |
| `REOPENED` | Reabrimos: el vecino rechazó la solución y vuelve a gestión |
| `PRIORITY_CHANGED` | Reordenamos la cola de la cuadrilla |
| `ESCALATION_CHANGED` | Lo marcamos como escalado y se lo mostramos al supervisor |
| `CONTENT_UPDATED` | **Nada, decisión propia.** Su matriz dice "área responsable sólo si el contenido le corresponde", pero la v1.5 no define ningún `details` para este tipo: no hay campo estructurado del que copiar `summary`/`description`/`formData` corregidos. Si trae `publicMessage`, lo dejamos en el registro de mensajes del ticket para trazabilidad; no reescribimos el expediente ni el servicio con él. Si en el futuro definen un `details.content` estructurado, se reevalúa |
| `PROGRESS` | **Nada.** Es el eco público de un `updateTicketStatus/PROGRESS` que en general originamos nosotros mismos |
| `DUPLICATE_LINKED` | **Nada.** Gestión de vinculación que hace M2; no genera trabajo operativo propio |
| `INFORMATION_REQUIRED` (variante de `ticketUpdated`, no confundir con la de `updateTicketStatus`) | **Nada.** Su propio contrato dice explícitamente que este tipo de update es solo para uso interno y de M1 |
| `STATUS_CHANGED`, `RESOLVED`, `CLOSED` | **Nada.** Se reciben y se descartan: en esos casos el cierre lo originamos nosotros |

> **No implementar handler para ninguna de las siete filas de "Nada".** Están en la tabla justamente para que quede escrito que se ignoran a propósito, y para que la lista de trece quede completa y no haya que volver a auditarla contra el contrato.

La cancelación llega por acá: no hace falta un `ticketCancelled`, que es uno de los huérfanos de la cohorte.

## Campos que necesitamos de `ROUTED` (v1.5)

```
comunes:  ticketId, citizenId, isAnonymous, responsibleAreaId, updateType,
          currentStatus, currentPriority, publicMessage?, attachments[]?, updatedAt
details.routing:  requestType (catalogRef), ticketType, summary, description,
                   formData?, location?, resolutionDueAt?, escalation?
```

🔄 **Cambios respecto de la v1.2 que ya nos resuelven los tres bloqueantes históricos:**

- **`responsibleAreaId` ahora es campo común de todo `ticketUpdated`.** Ya sabemos que un `ROUTED` es nuestro sin adivinar ni necesitar catálogo de `requestTypeId`.
- **`citizenId` e `isAnonymous` ahora son campos comunes**, no solo de `details` en `ROUTED`. Los tenemos en cualquier actualización, no solo la primera.
- **`location` ahora viene estructurada**: `addressLine, street, streetNumber, neighborhoodId, latitude, longitude, reference`. Ya tenemos `neighborhoodId` para rutear por zona.
- `requestType` pasó de ser un `requestTypeId` suelto a un objeto `catalogRef` (`{id, name}`).
- Ya no existen `publicId` ni `ticketVersion` en el contrato — no hace falta guardarlos.

| Campo | Por qué lo necesitamos |
|---|---|
| `ticketId` | Lo guardamos en el `Service` y en el `EnvironmentalReport` |
| `responsibleAreaId` | ✅ Nos dice si el `ROUTED` es nuestro |
| `citizenId`, `isAnonymous` | Decide si hace falta identificar al denunciante para el expediente |
| `location.neighborhoodId` | ✅ Asignamos zona operativa y cuadrilla a partir del barrio |
| `requestType.id`, `requestType.name` | Contenido/categoría del reclamo |
| `summary`, `description` | Contenido del reclamo |

Nice to have, si ya lo publican: `formData`, `resolutionDueAt`, `currentPriority`, `attachments[]`, `escalation`.

## Lo que sigue bloqueado

🔴 **Nada del snapshot de `ROUTED` sigue bloqueado.** Los tres puntos históricos (módulo responsable, `location` estructurada, `citizenId`) se cerraron con la v1.5.

⚠️ **`RESOLVED` directo desde `ROUTED`.** Su matriz lo admite "solo si el Request Type admite resolución directa", pero no publicaron ese catálogo. **Decisión de diseño propia:** en vez de esperar la confirmación, publicamos siempre `STARTED` inmediatamente antes de `RESOLVED` — es válido en cualquier caso de su matriz y no depende del catálogo. Ver [`updateTicketStatus`](../publicados/updateTicketStatus.md).

Detalle completo en [bloqueantes.md](../../bloqueantes.md#m2--atención-ciudadana--un-bloqueante-nuevo-tres-cerrados).

## Nota de vocabulario

Los cinco eventos que este módulo esperaba —`complaintForwarded`, `complaintEscalated`, `complaintResolved`, `complaintClosed`, `complaintReopened`— **no existen**: son variantes de este. El renombre `complaint` → `ticket` ya está hecho de nuestro lado.
