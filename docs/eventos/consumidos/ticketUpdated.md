# `ticketUpdated` ← M2

**El único evento de M2 que escuchamos, y nuestro único disparador de entrada.** Todo el circuito reclamo → servicio → vecino empieza acá.

No consumimos `ticketCreated`: va hacia M1 con los datos mínimos del registro del ciudadano, y nada de eso sirve para abrir un servicio.

## Qué hace M6 al recibirlo

Depende del discriminador `updateType`. La v1.75 —vigente (WIP), reemplaza a la v1.74 WIP; la v1.71, la v1.72 y la v1.74 nunca se cruzaron— define trece valores posibles (§7.2), los mismos que la v1.73, la v1.6 y la v1.5 — **la tabla de abajo cubre los trece**, no solo los que nos interesan: seis disparan acción, siete se ignoran a propósito.

| `updateType` | Qué hacemos |
|---|---|
| `ROUTED` | **Abrimos el [expediente ambiental](../../entidades/environmental-report.md).** Es la entrada. **Nunca abre un `Service` directamente**: eso necesitaría el catálogo de Request Types que M2 no publicó. De acá sale la inspección — que no crea un servicio, se engancha a un `Service` `POINT` ya existente (`assertPointService`) |
| `INFORMATION_PROVIDED` | Sumamos al expediente lo que el vecino respondió. No hay ID de correlación: como máximo hay una solicitud activa por ticket, así que la respuesta siempre corresponde a la nuestra. Viene en `details.informationResponse.message`, en `attachments[]`, o en ambos — §7.6 garantiza al menos uno de los dos. `citizenResponse` guarda el `message` y una línea `fileName: url` por adjunto. `publicMessage` es la glosa de M2 y no se usa. **Cierra la solicitud pendiente** (#169): en el mismo update limpia `information_requested_at`, `information_request_message` e `information_request_required_by`, así que el orden por `citizen_response_at` vale también para cerrarla y una respuesta atrasada no la pisa. Sin solicitud pendiente la respuesta se guarda igual. Además la cierra un `ticketUpdated` de cambio de estado (`STATUS_CHANGED`, `ROUTED`, `REOPENED`, `RESOLVED`, `CLOSED`, `CANCELLED`, `DUPLICATE_LINKED`) con `currentStatus` distinto de `PENDING_INFORMATION`; `PRIORITY_CHANGED`, `ESCALATION_CHANGED`, `CONTENT_UPDATED` y `PROGRESS` no (ver [ciclo](../../entidades/environmental-report.md)) |
| `CANCELLED` | Cancelamos los `Service` `SCHEDULED`/`RESCHEDULED` que tengan este `ticketId`. La inspección no se toca — `EnvironmentalInspection` es un modelo propio, sin `ticketId` — y su servicio solo cae si se programó con `origin = TICKET`. Si el expediente está en `UNDER_REVIEW`, pasa a `DISMISSED`; **en cualquier otro estado no lo toca** Si el expediente estaba `FORWARDED` (lo devolvimos y M2 canceló administrativamente el ticket), se cierra (`CLOSED`). |
| `REOPENED` | Reabrimos: el vecino rechazó la solución y vuelve a gestión |
| `PRIORITY_CHANGED` | Actualizamos `priority` del expediente. Hoy es el único camino por el que cambia después del alta: no existe `PATCH /environmental-reports/:id`. **§7.2 de la v1.75 lo marca como valor contractual reservado**: M2 no lo emite automáticamente y *no se publica por el mero recálculo interno*. **Lo seguimos aceptando y procesando igual** (`TicketsConsumer` tiene el handler): si M2 lo activa, ya funciona |
| `ESCALATION_CHANGED` | Marcamos **o desmarcamos** `escalated` según `details.escalation.active` (§5.6, §7.7) y se lo mostramos al supervisor. Sin un `active` booleano no tocamos el flag. El `ROUTED` también lo trae, en `details.routing.escalation`: un ticket derivado ya escalado nace escalado |
| `CONTENT_UPDATED` | **Nada, decisión propia — pero por otro motivo que antes.** La v1.6 **sí** define `details.content` (§7.7) con `requestType, category, subcategory, ticketType, summary, description, formData, resolutionDueAt`, así que el argumento de "no hay campo del que copiar" caducó. Lo seguimos ignorando porque §7.3 aclara que la clasificación **queda bloqueada una vez que el ticket fue `ROUTED`**: un `CONTENT_UPDATED` que nos llegue es casi siempre anterior a que exista expediente nuestro, y si llega después no puede haber cambiado la clasificación. Si trae `publicMessage`, lo dejamos en el registro de mensajes para trazabilidad |
| `PROGRESS` | **Nada.** §7.2 de la v1.75 lo marca como valor contractual reservado: M2 no lo emite automáticamente, y por §10 el `PROGRESS` que le mandamos por `updateTicketStatus` no vuelve como `ticketUpdated` |
| `DUPLICATE_LINKED` | **Nada.** Gestión de vinculación que hace M2; no genera trabajo operativo propio |
| `INFORMATION_REQUIRED` (variante de `ticketUpdated`, no confundir con la de `updateTicketStatus`) | **Nada.** Su propio contrato dice explícitamente que este tipo de update es solo para uso interno y de M1 |
| `STATUS_CHANGED`, `RESOLVED`, `CLOSED` | **Nada.** Si llegan (los origina M2 por su cuenta, por ejemplo un `CLOSED` por confirmación del vecino o por timeout) se descartan; no esperamos eco del cierre que publicamos nosotros |

> **No implementar handler para ninguna de las siete filas de "Nada".** Están en la tabla justamente para que quede escrito que se ignoran a propósito, y para que la lista de trece quede completa y no haya que volver a auditarla contra el contrato.

La cancelación llega por acá: no hace falta un `ticketCancelled`, que es uno de los huérfanos de la cohorte.

### `currentStatus`: el estado del ticket que llevamos (#303)

De todo `ticketUpdated` de un ticket **nuestro** (`responsibleAreaId = M6`), sea cual sea su `updateType` (también los que no tienen otro efecto), guardamos `data.currentStatus` en `ticket_m2_state` con `source = RECEIVED` y `receivedAt = data.updatedAt` (respaldo: el `occurredAt` del sobre). Sirve para elegir `STARTED` o `PROGRESS` al informar la programación a M2. Manda sobre una deducción nuestra, pero uno **más viejo** que el último recibido no lo pisa. De un ticket ajeno no se persiste nada. **Solo se guarda un `currentStatus` de la lista cerrada de §3** (`REGISTERED`, `IN_REVIEW`, `ROUTED`, `IN_PROGRESS`, `PENDING_INFORMATION`, `DUPLICATE`, `RESOLVED`, `CLOSED`, `CANCELLED`): otro valor se descarta con un warn saneado, sin romper el handler. Ver [`updateTicketStatus`](../publicados/updateTicketStatus.md).

### Orden: por `data.updatedAt`, no por llegada (#270)

**Desde el 20/10 (M2) se ordena por `data.updatedAt`**, cuándo M2 persistió el cambio, y no por el `occurredAt` del sobre, que es cuándo se publicó y puede ser posterior si la publicación se demoró o se reintentó. El `occurredAt` queda de respaldo si `updatedAt` falta, es ilegible o está más de 5 minutos en el futuro. Los timestamps sirven para descartar un evento viejo que llega tarde, no para decidir el estado del ticket (eso lo define `currentStatus` de M2). No se comparan con timestamps de otro productor (por ejemplo, el `updateOccurredAt` de M3). Donde más abajo dice «`occurredAt`» en este apartado, leer «el timestamp de orden».

El Core reintenta un handler fallido con su backoff (hasta tres reintentos con esperas de 5 s, 30 s y 2 min, ver [m9.md](../../integracion/m9.md)) hasta la DLQ y M9 no garantiza el orden, así que un evento viejo puede aplicarse **después** de uno más nuevo del mismo ticket. Los `updateType` que pisan un dato lo comparan con el `occurredAt` del último aplicado **a ese dato**, guardado en el expediente:

| `updateType` | Marca en `environmental_report` |
|---|---|
| `PRIORITY_CHANGED` | `priority_changed_at` |
| `ESCALATION_CHANGED` | `escalation_changed_at` |
| `INFORMATION_PROVIDED` | `citizen_response_at` |
| `REOPENED`, `CANCELLED` | `ticket_status_at` (compartida: un `REOPENED` atrasado no revive el expediente de un reclamo que se canceló después) |

- **Una marca por dato, no una sola**: un `PRIORITY_CHANGED` nuevo no descarta un `ESCALATION_CHANGED` atrasado pero legítimo.
- Un evento con `occurredAt` **anterior o igual** a la marca se ignora con un `warn` y sale `processed`: reintentarlo no lo haría más nuevo. Igual es el de un evento ya aplicado (el reintento de uno cuyo efecto quedó escrito), y re-aplicarlo no es idempotente: un `REOPENED` reabriría un expediente que el operador volvió a cerrar, y un `CANCELLED` cancelaría servicios programados después. El costo: dos eventos distintos del mismo dato con el mismo milisegundo, se queda el primero que llega.
- La comparación va en el `where` del update, no en una lectura previa: no hay carrera entre dos eventos del mismo ticket. En `CANCELLED` la marca se escribe primero y en la misma transacción que la cancelación de servicios: si no pasa, no se cancela nada, y un `REOPENED` más nuevo espera el lock de la fila en vez de colarse en el medio.
- El reintento ordena con el `occurredAt` **guardado** en `inbox_event.occurred_at`, no con el del reenvío.
- **Sin `occurredAt` en el sobre** (el de M2 puede no traerlo) no hay con qué comparar: se aplica como antes, sin tocar la marca, y queda un `warn`. Lo mismo con las filas anteriores a las columnas (marca null).
- **Tope de futuro**: un `occurredAt` más de 5 minutos adelante del reloj de M6 se trata como ausente (se aplica sin ordenar, no deja marca y en `inbox_event.occurred_at` queda null), con un `warn`. Sin el tope, una fecha en 9999 —un reloj roto, o cualquiera con JWT por `POST /events/inbox`— congelaría el dato para siempre.
- `ROUTED` no ordena. Un segundo `ROUTED` **con el mismo `eventId`** (un reintento) lo descarta el inbox. Uno con **otro `eventId`** es una re-derivación real tras una devolución (M2, 20/10). Si el expediente está en `FORWARDED` (lo devolvimos nosotros) se **reactiva**: pasa a `UNDER_REVIEW` y se refresca el snapshot (tipo, dirección, prioridad, escalamiento, marcas de orden) sin crear otro ([#170](https://github.com/hllous/Backend-M6-DAPS2/issues/170)). **Reactivar publica `updateTicketStatus / STARTED`** («Su denuncia ambiental está en análisis.», `PROGRESS` si el ticket ya figura `IN_PROGRESS`) con `causationId` = `eventId` del `ROUTED`, en la misma transacción y solo si el update tocó la fila ([#309](https://github.com/hllous/Backend-M6-DAPS2/issues/309)). En cualquier otro estado se ignora con un log: desestimado, sin infracción y cerrado se cerraron hacia M2 y no vuelven a derivarse. Nunca abre un segundo expediente.
- **Un `ROUTED` de otra área cierra el expediente devuelto.** Si un ticket que devolvimos (`FORWARDED`) se reasigna, llega un `ROUTED` con otro `responsibleAreaId` (es un broadcast, lo recibimos igual). Antes del filtro de área, un `ROUTED` ajeno cierra (`CLOSED`) el expediente `FORWARDED` de ese `ticketId`, usando solo `ticketId` y área: no se persiste nada del contenido. La marca de orden evita que un `ROUTED` viejo que llega tarde cierre un expediente más nuevo. Un `ROUTED` viejo que llega tarde tampoco reactiva un expediente `FORWARDED`.

### Antes que su `ROUTED` (#275)

Si el `ROUTED` que abre el expediente falla y el Core lo reintenta, un evento más nuevo del mismo ticket puede llegar antes de que exista el expediente.

- **`PRIORITY_CHANGED`, `ESCALATION_CHANGED` e `INFORMATION_PROVIDED` fallan** si el ticket es nuestro y no hay expediente: salen `failed` → `nack`, y el Core los reintenta con su backoff, ya detrás del `ROUTED`. El error dice solo `el expediente todavía no existe para el ticket <ticketId>; se reintenta tras el ROUTED`, sin nada más del payload. Todo `ROUTED` nuestro abre expediente (no hay tipo que lo descarte, y un `ROUTED` repetido reusa el existente), así que la ausencia significa que el `ROUTED` falló o todavía no llegó.
- **El `ROUTED` deja las marcas 1 ms antes de su `occurredAt`** (`ticket_status_at` siempre; `priority_changed_at` y `escalation_changed_at` solo si el snapshot trae prioridad y escalamiento). El snapshot ya refleja lo anterior: un cambio más viejo que reintenta después se ignora y uno más nuevo aplica. El milisegundo de menos es para que un cambio explícito **del mismo instante** le gane al snapshot: M2 puede derivar y escalar (o repriorizar) en la misma transacción con el mismo `now()`, y con la marca en `occurredAt` ese cambio se ignoraría aunque el snapshot traiga el valor viejo. El reintento de un cambio ya aplicado se sigue reconociendo, porque ese deja su propio `occurredAt` como marca. `citizen_response_at` queda null porque el snapshot no trae la respuesta del vecino: una anterior al `ROUTED` se guarda igual. Sin `occurredAt`, marcas null como antes.
- **Siguen saliendo `processed`, sin reintento:** un ticket ajeno (el filtro de `responsibleAreaId` va antes); un evento sin el dato que pisa (sin prioridad reconocible, sin `escalation.active`, sin respuesta); `REOPENED` sin expediente, porque un `REOPENED` supone una solución nuestra previa y no puede llegar antes del `ROUTED`: si no hay expediente, no hay nada que reabrir; y `CANCELLED` sin expediente, que cancela los servicios igual (un expediente que abra después el `ROUTED` nace `RECEIVED`, estado que `CANCELLED` no toca).
- **El costo:** no hay forma de saber si el `ROUTED` va a llegar. Si no llega nunca (se perdió, agotó sus reintentos o es de antes de que M6 estuviera suscripto), los cambios de ese ticket agotan sus reintentos (unos minutos, según el backoff del Core) y terminan en la DLQ del Core: visibles y acotados, en vez de perderse en silencio.
- **Recuperación, si un ticket nuestro nunca tuvo `ROUTED`** (por ejemplo, derivado antes de que exista la suscripción, #266): abrir el expediente a mano con `POST /environmental-reports` mandando el `ticketId` del reclamo (el DTO lo acepta), y después reprocesar desde la DLQ del Core los cambios de ese ticket. El expediente creado así no tiene marcas, así que el primer cambio reprocesado aplica y los demás se ordenan entre sí por su `occurredAt`.
- ✅ **Confirmado por M2 (20/10):** toda derivación a M6 llega con un `ROUTED`. En la v1.75 no había reasignación entre módulos; **con la v1.77 sí** (tras un `REQUEST_TYPE_MISMATCH` confirmado, siempre con un `ROUTED` a la nueva área, `reassignment=true`), así que un ticket puede llegar de otra área y, si el nuevo responsable es M6 y no hay expediente, es un alta normal. Ver [#307](https://github.com/hllous/Backend-M6-DAPS2/issues/307).
- ✅ **v1.77: `purpose=RECLASSIFICATION` se ignora.** Un `INFORMATION_REQUIRED`/`INFORMATION_PROVIDED` de una reclasificación es entre M2 y el vecino y ningún módulo operativo actúa por él, **aunque `responsibleAreaId` coincida** (es el provisional: para un ticket que devolvimos sigue siendo M6). `purpose` viaja en `details.informationRequest.purpose` o `details.informationResponse.purpose`. `INFORMATION_REQUIRED` ya se ignoraba (no tiene handler); `INFORMATION_PROVIDED` lo descarta antes de tocar el expediente, así que tampoco falla por «expediente inexistente» (#275). La señal para actuar es un `ROUTED` posterior, con `details.routing.reassignment=true` si es una nueva derivación. Ver [#307](https://github.com/hllous/Backend-M6-DAPS2/issues/307).
- **v1.77, sin usar (decisión cerrada, [#307](https://github.com/hllous/Backend-M6-DAPS2/issues/307)):** `details.routing.category` y `subcategory` (nombres visibles) no se leen; el tipo de denuncia se sigue deduciendo de `requestType` y `summary`. Motivo: los ejemplos de M2 traen category/subcategory de otras áreas (p. ej. M3, «Calles, veredas e infraestructura urbana») y hoy no hay forma de saber cómo vendrán los de Ambiente. Se reabre solo si el tipo de denuncia sale mal con datos reales. `reassignment` tampoco se lee: reactivar o crear depende de si ya hay expediente, no de ese flag.
- ✅ **Orden resuelto (M2, 20/10):** ordenar por `data.updatedAt`, con el `occurredAt` del sobre de respaldo, solo dentro del mismo productor. Implementado en `TicketsConsumer.handle()`. Las marcas guardadas antes de este cambio eran del `occurredAt`; como todavía no hay tráfico real del Core, no se migraron.

> **M2 no replica un hecho externo como `ticketUpdated` espejo (§10).** Una resolución, una cancelación o un `INFORMATION_REQUIRED` que M2 recibe por [`updateTicketStatus`](../publicados/updateTicketStatus.md) **no vuelve** como `ticketUpdated`: no esperemos eco de lo que publicamos nosotros. Los `ticketUpdated` que llegan son los que M2 origina por su cuenta.

## Campos que necesitamos de `ROUTED` (v1.75, igual que la v1.73)

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
| `details.routing.location.neighborhoodId` | **No se usa hoy.** El plan era asignar zona operativa a partir del barrio, pero el handler no lo lee — pendiente de que adoptemos el catálogo de barrios que M9 ya expone ([#376](https://github.com/hllous/Backend-M6-DAPS2/issues/376)) |
| `details.routing.requestType` | Contenido/categoría del reclamo. String, sin ID |
| `details.routing.summary`, `.description` | Contenido del reclamo |

Nice to have, si ya lo publican: `formData`, `resolutionDueAt`, `currentPriority`, `attachments[]`, `escalation`.

## Lo que sigue bloqueado

🔴 **Nada del snapshot de `ROUTED` está bloqueado**, pero la v1.6 lo movió de lugar y le sacó las coordenadas. Es trabajo nuestro de adaptación, no un pedido pendiente a M2.

✅ **`RESOLVED` directo desde `ROUTED` quedó resuelto.** §8.2 de la v1.6: *"M2 no mantiene una configuración por RequestType para habilitar o impedir la resolución directa"*, y `STARTED`/`PROGRESS` son hechos opcionales. Ya no hay catálogo que esperar. Ver [`updateTicketStatus`](../publicados/updateTicketStatus.md).

Detalle completo en [bloqueantes.md](../../integracion/m2.md#m2--atención-ciudadana--un-bloqueante-que-no-se-mueve-una-regresión).

## Nota de vocabulario

Los cinco eventos que este módulo esperaba —`complaintForwarded`, `complaintEscalated`, `complaintResolved`, `complaintClosed`, `complaintReopened`— **no existen**: son variantes de este. El renombre `complaint` → `ticket` ya está hecho de nuestro lado.
