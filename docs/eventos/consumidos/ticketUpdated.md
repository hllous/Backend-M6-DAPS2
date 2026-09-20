# `ticketUpdated` ← M2

**El único evento de M2 que escuchamos, y nuestro único disparador de entrada.** Todo el circuito reclamo → servicio → vecino empieza acá.

No consumimos `ticketCreated`: va hacia M1 con los datos mínimos del registro del ciudadano, y nada de eso sirve para abrir un servicio.

## Qué hace M6 al recibirlo

Depende del discriminador `updateType`. La v1.73 —vigente (WIP), reemplaza a la v1.72 WIP; la v1.71 y la v1.72 nunca se cruzaron— define trece valores posibles (§7.2), los mismos que la v1.6 y la v1.5 — **la tabla de abajo cubre los trece**, no solo los que nos interesan: seis disparan acción, siete se ignoran a propósito.

| `updateType` | Qué hacemos |
|---|---|
| `ROUTED` | **Abrimos el [expediente ambiental](../../entidades/environmental-report.md).** Es la entrada. **Nunca abre un `Service` directamente**: eso necesitaría el catálogo de Request Types que M2 no publicó. De acá sale la inspección — que no crea un servicio, se engancha a un `Service` `POINT` ya existente (`assertPointService`) |
| `INFORMATION_PROVIDED` | Sumamos al expediente lo que el vecino respondió. No hay ID de correlación: como máximo hay una solicitud activa por ticket, así que la respuesta siempre corresponde a la nuestra. Viene en `details.informationResponse.message`, en `attachments[]`, o en ambos — §7.6 garantiza al menos uno de los dos. `citizenResponse` guarda el `message` y una línea `fileName: url` por adjunto. `publicMessage` es la glosa de M2 y no se usa |
| `CANCELLED` | Cancelamos los `Service` `SCHEDULED`/`RESCHEDULED` que tengan este `ticketId`. La inspección no se toca — `EnvironmentalInspection` es un modelo propio, sin `ticketId` — y su servicio solo cae si se programó con `origin = TICKET`. Si el expediente está en `UNDER_REVIEW`, pasa a `DISMISSED`; **en cualquier otro estado no lo toca** |
| `REOPENED` | Reabrimos: el vecino rechazó la solución y vuelve a gestión |
| `PRIORITY_CHANGED` | Actualizamos `priority` del expediente. Hoy es el único camino por el que cambia después del alta: no existe `PATCH /environmental-reports/:id`. **§7.2 de la v1.73 lo marca como valor contractual reservado**: M2 no lo emite automáticamente y *no se publica por el mero recálculo interno*. **Lo seguimos aceptando y procesando igual** (`TicketsConsumer` tiene el handler): si M2 lo activa, ya funciona |
| `ESCALATION_CHANGED` | Marcamos **o desmarcamos** `escalated` según `details.escalation.active` (§5.6, §7.7) y se lo mostramos al supervisor. Sin un `active` booleano no tocamos el flag. El `ROUTED` también lo trae, en `details.routing.escalation`: un ticket derivado ya escalado nace escalado |
| `CONTENT_UPDATED` | **Nada, decisión propia — pero por otro motivo que antes.** La v1.6 **sí** define `details.content` (§7.7) con `requestType, category, subcategory, ticketType, summary, description, formData, resolutionDueAt`, así que el argumento de "no hay campo del que copiar" caducó. Lo seguimos ignorando porque §7.3 aclara que la clasificación **queda bloqueada una vez que el ticket fue `ROUTED`**: un `CONTENT_UPDATED` que nos llegue es casi siempre anterior a que exista expediente nuestro, y si llega después no puede haber cambiado la clasificación. Si trae `publicMessage`, lo dejamos en el registro de mensajes para trazabilidad |
| `PROGRESS` | **Nada.** §7.2 de la v1.73 lo marca como valor contractual reservado: M2 no lo emite automáticamente, y por §10 el `PROGRESS` que le mandamos por `updateTicketStatus` no vuelve como `ticketUpdated` |
| `DUPLICATE_LINKED` | **Nada.** Gestión de vinculación que hace M2; no genera trabajo operativo propio |
| `INFORMATION_REQUIRED` (variante de `ticketUpdated`, no confundir con la de `updateTicketStatus`) | **Nada.** Su propio contrato dice explícitamente que este tipo de update es solo para uso interno y de M1 |
| `STATUS_CHANGED`, `RESOLVED`, `CLOSED` | **Nada.** Si llegan (los origina M2 por su cuenta, por ejemplo un `CLOSED` por confirmación del vecino o por timeout) se descartan; no esperamos eco del cierre que publicamos nosotros |

> **No implementar handler para ninguna de las siete filas de "Nada".** Están en la tabla justamente para que quede escrito que se ignoran a propósito, y para que la lista de trece quede completa y no haya que volver a auditarla contra el contrato.

La cancelación llega por acá: no hace falta un `ticketCancelled`, que es uno de los huérfanos de la cohorte.

> **M2 no replica un hecho externo como `ticketUpdated` espejo (§10).** Una resolución, una cancelación o un `INFORMATION_REQUIRED` que M2 recibe por [`updateTicketStatus`](../publicados/updateTicketStatus.md) **no vuelve** como `ticketUpdated`: no esperemos eco de lo que publicamos nosotros. Los `ticketUpdated` que llegan son los que M2 origina por su cuenta.

## Campos que necesitamos de `ROUTED` (v1.73)

```
comunes:  ticketId, publicId, citizenId, isAnonymous, responsibleAreaId, updateType,
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

> ⚠️ **`ticketUpdated` es un broadcast lógico (§2): llega a todos los módulos, no solo al que le toca.** El consumer filtra por `responsibleAreaId` **antes** de mirar `updateType`, para los trece valores — no solo `ROUTED`. Sin el filtro, un reclamo derivado a M3 o M7 abriría igual un expediente de este lado, y una `CANCELLED`/`PRIORITY_CHANGED`/etc. sobre un ticket ajeno terminaría actuando sobre cualquier expediente nuestro que compartiera el mismo `ticketId` por coincidencia. El propio contrato lo dice explícito: *"la corrección del sistema no depende de ese filtrado"* de infraestructura.

> El consumer lee `details.routing` primero y **cae al nivel raíz** si no está. El contrato ya cambió de opinión una vez sobre dónde viven estos campos; aceptar las dos formas no cuesta nada y nos deja indiferentes a cuál terminen publicando.

| Campo | Por qué lo necesitamos |
|---|---|
| `ticketId` | Lo guardamos en el `Service` y en el `EnvironmentalReport`. **Obligatorio junto con `updateType`: sin ellos `POST /events/inbox` responde 400 y no se guarda** |
| `responsibleAreaId` | ✅ Nos dice si el `ROUTED` es nuestro |
| `citizenId`, `isAnonymous` | Decide si hace falta identificar al denunciante para el expediente |
| `details.routing.location.neighborhoodId` | **No se usa hoy.** El plan era asignar zona operativa a partir del barrio, pero el handler no lo lee — pendiente de que M9 publique el catálogo de barrios |
| `details.routing.requestType` | Contenido/categoría del reclamo. String, sin ID |
| `details.routing.summary`, `.description` | Contenido del reclamo |

Nice to have, si ya lo publican: `formData`, `resolutionDueAt`, `currentPriority`, `attachments[]`, `escalation`.

## Lo que sigue bloqueado

🔴 **Nada del snapshot de `ROUTED` está bloqueado**, pero la v1.6 lo movió de lugar y le sacó las coordenadas. Es trabajo nuestro de adaptación, no un pedido pendiente a M2.

✅ **`RESOLVED` directo desde `ROUTED` quedó resuelto.** §8.2 de la v1.6: *"M2 no mantiene una configuración por RequestType para habilitar o impedir la resolución directa"*, y `STARTED`/`PROGRESS` son hechos opcionales. Ya no hay catálogo que esperar. Ver [`updateTicketStatus`](../publicados/updateTicketStatus.md).

Detalle completo en [bloqueantes.md](../../bloqueantes.md#m2--atención-ciudadana--un-bloqueante-que-no-se-mueve-una-regresión).

## Nota de vocabulario

Los cinco eventos que este módulo esperaba —`complaintForwarded`, `complaintEscalated`, `complaintResolved`, `complaintClosed`, `complaintReopened`— **no existen**: son variantes de este. El renombre `complaint` → `ticket` ya está hecho de nuestro lado.
