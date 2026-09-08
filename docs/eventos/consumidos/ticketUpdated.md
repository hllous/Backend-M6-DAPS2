# `ticketUpdated` ← M2

**El único evento de M2 que escuchamos, y nuestro único disparador de entrada.** Todo el circuito reclamo → servicio → vecino empieza acá.

No consumimos `ticketCreated`: va hacia M1 con los datos mínimos del registro del ciudadano, y nada de eso sirve para abrir un servicio.

## Qué hace M6 al recibirlo

Depende del discriminador `updateType`. La v1.6 define trece valores posibles (§7.2), los mismos que la v1.5 — **la tabla de abajo cubre los trece**, no solo los que nos interesan: seis disparan acción, siete se ignoran a propósito.

| `updateType` | Qué hacemos |
|---|---|
| `ROUTED` | **Abrimos el [expediente ambiental](../../entidades/environmental-report.md) o el [servicio](../../entidades/service.md) puntual.** Es la entrada |
| `INFORMATION_PROVIDED` | Sumamos al expediente lo que el vecino respondió. No hay ID de correlación: como máximo hay una solicitud activa por ticket, así que la respuesta siempre corresponde a la nuestra. Viene en `details.informationResponse.message`, en `attachments[]`, o en ambos — §7.6 garantiza al menos uno de los dos |
| `CANCELLED` | Cancelamos el servicio o la inspección ya programados |
| `REOPENED` | Reabrimos: el vecino rechazó la solución y vuelve a gestión |
| `PRIORITY_CHANGED` | Reordenamos la cola de la cuadrilla |
| `ESCALATION_CHANGED` | Lo marcamos como escalado y se lo mostramos al supervisor |
| `CONTENT_UPDATED` | **Nada, decisión propia — pero por otro motivo que antes.** La v1.6 **sí** define `details.content` (§7.7) con `requestType, category, subcategory, ticketType, summary, description, formData, resolutionDueAt`, así que el argumento de "no hay campo del que copiar" caducó. Lo seguimos ignorando porque §7.3 aclara que la clasificación **queda bloqueada una vez que el ticket fue `ROUTED`**: un `CONTENT_UPDATED` que nos llegue es casi siempre anterior a que exista expediente nuestro, y si llega después no puede haber cambiado la clasificación. Si trae `publicMessage`, lo dejamos en el registro de mensajes para trazabilidad |
| `PROGRESS` | **Nada.** Es el eco público de un `updateTicketStatus/PROGRESS` que en general originamos nosotros mismos |
| `DUPLICATE_LINKED` | **Nada.** Gestión de vinculación que hace M2; no genera trabajo operativo propio |
| `INFORMATION_REQUIRED` (variante de `ticketUpdated`, no confundir con la de `updateTicketStatus`) | **Nada.** Su propio contrato dice explícitamente que este tipo de update es solo para uso interno y de M1 |
| `STATUS_CHANGED`, `RESOLVED`, `CLOSED` | **Nada.** Se reciben y se descartan: en esos casos el cierre lo originamos nosotros |

> **No implementar handler para ninguna de las siete filas de "Nada".** Están en la tabla justamente para que quede escrito que se ignoran a propósito, y para que la lista de trece quede completa y no haya que volver a auditarla contra el contrato.

La cancelación llega por acá: no hace falta un `ticketCancelled`, que es uno de los huérfanos de la cohorte.

## Campos que necesitamos de `ROUTED` (v1.6)

```
comunes:  ticketId, citizenId, isAnonymous, responsibleAreaId, updateType,
          currentStatus, currentPriority, progress?, publicMessage?,
          attachments[]?, updatedAt
details.routing:  requestType (string), ticketType, summary, description,
                   formData?, location?, resolutionDueAt?, escalation?
```

🔄 **La v1.6 revirtió parte de lo que la v1.5 nos había resuelto.**

En la v1.5, `requestType`, `summary`, `description` y `location` eran campos **comunes** de todo `ticketUpdated`. La v1.6 (§7.1) los sacó de la tabla de comunes y los dejó **solo dentro de `details.routing`** (§7.4). Es el cambio más caro de esta versión: leerlos del nivel raíz devuelve `undefined` y abre expedientes vacíos sin error ni log.

- **`requestType` es ahora un string plano** (§5.5), no el objeto `catalogRef {id, name}` de la v1.5. Y explicita que **no se exponen IDs internos** de Category/Subcategory/RequestType: el mapeo por `requestType.id` que esperábamos hacer cuando publicaran el catálogo ya no va a ser posible nunca. Clasificamos por nombre visible o no clasificamos.
- **`location` perdió `latitude` y `longitude`** (§5.4). Quedan `addressLine, street, streetNumber, neighborhoodId, reference`. Nuestros `lat`/`lng` van a estar siempre en null: la georreferenciación sale de la dirección o no sale.

**Lo que sí sigue común, y es lo que importa para rutear:** `responsibleAreaId` (nos dice si el `ROUTED` es nuestro), `citizenId`, `isAnonymous` y `currentPriority`.

> El consumer lee `details.routing` primero y **cae al nivel raíz** si no está. El contrato ya cambió de opinión una vez sobre dónde viven estos campos; aceptar las dos formas no cuesta nada y nos deja indiferentes a cuál terminen publicando.

| Campo | Por qué lo necesitamos |
|---|---|
| `ticketId` | Lo guardamos en el `Service` y en el `EnvironmentalReport` |
| `responsibleAreaId` | ✅ Nos dice si el `ROUTED` es nuestro |
| `citizenId`, `isAnonymous` | Decide si hace falta identificar al denunciante para el expediente |
| `details.routing.location.neighborhoodId` | ✅ Asignamos zona operativa y cuadrilla a partir del barrio |
| `details.routing.requestType` | Contenido/categoría del reclamo. String, sin ID |
| `details.routing.summary`, `.description` | Contenido del reclamo |

Nice to have, si ya lo publican: `formData`, `resolutionDueAt`, `currentPriority`, `attachments[]`, `escalation`.

## Lo que sigue bloqueado

🔴 **Nada del snapshot de `ROUTED` está bloqueado**, pero la v1.6 lo movió de lugar y le sacó las coordenadas. Es trabajo nuestro de adaptación, no un pedido pendiente a M2.

✅ **`RESOLVED` directo desde `ROUTED` quedó resuelto.** §8.2 de la v1.6: *"M2 no mantiene una configuración por RequestType para habilitar o impedir la resolución directa"*, y `STARTED`/`PROGRESS` son hechos opcionales. Ya no hay catálogo que esperar. Ver [`updateTicketStatus`](../publicados/updateTicketStatus.md).

Detalle completo en [bloqueantes.md](../../bloqueantes.md#m2--atención-ciudadana--un-bloqueante-que-no-se-mueve-una-regresión).

## Nota de vocabulario

Los cinco eventos que este módulo esperaba —`complaintForwarded`, `complaintEscalated`, `complaintResolved`, `complaintClosed`, `complaintReopened`— **no existen**: son variantes de este. El renombre `complaint` → `ticket` ya está hecho de nuestro lado.
