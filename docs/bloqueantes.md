# Estado de la integración

> **Fuente única.** Este archivo reemplaza el estado que estaba duplicado en [`LEEME.md`](../LEEME.md), [`Eventos.txt`](../Eventos.txt) y [`fuentes/alcance-entregable.md`](../fuentes/alcance-entregable.md) §7. Si algo de eso dice otra cosa, vale lo que dice acá.
>
> Última revisión general: **17 ago 2026**, contra la recopilación de la cohorte (M1–M8) y el contrato v1.2 de M2. Se edita a medida que cada grupo contesta — actualizá la fila y su fecha, no reescribas el archivo.

## Tablero

| Con quién | Qué falta | Estado | Última act. |
|---|---|---|---|
| **M2** | `ticketUpdated / ROUTED` no dice a qué módulo va: ni módulo, ni área. Necesitamos el campo, **o** el catálogo de `requestTypeId` que caen en ambiente e higiene | 🔴 Bloqueante | 17 ago 2026 |
| **M2** | `location` viene como texto libre (`{"address": "Lima y Chile"}`). Necesitamos `neighborhoodId` del catálogo de M9 + calle y número | 🔴 Bloqueante | 17 ago 2026 |
| **M9** | Ausente de la recopilación. Falta la lista de eventos del Core | 🔴 Bloqueante | 17 ago 2026 |
| **M9** | Claim set del JWT sin definir. El enunciado le asigna la identidad a M9 **y** a M1 | 🔴 Bloqueante — el principal del proyecto | 17 ago 2026 |
| **M9** | Catálogo de barrios con `neighborhoodId` estable, sin exponer. Bloquea también el punto de `location` de M2 | 🔴 Bloqueante | 17 ago 2026 |
| **M9** | "Zona operativa" (nuestra, agrupa barrios) contra "zona" (de ellos). Misma palabra, distinta cosa | ⚠️ A definir | 17 ago 2026 |
| **M9** | `notificationSent` no lo publica nadie hoy. Puede que lo saquemos de lo consumido | ⚠️ A confirmar | 17 ago 2026 |
| **M4** | Que devuelvan `sourceViolationId` en `commercialFineGenerated`, `closureOrdered` y `closureLifted`. Es el `violationId` que mandamos en el acta | ⚠️ Pedido abierto | 17 ago 2026 |
| **M4** | `commercialFineGenerated` está rotulado solo "(rentas)": confirmar que también nos lo rutean | ⚠️ A confirmar | 17 ago 2026 |
| **M3** | Cuándo se dispara `workOrderScheduled`: ¿al abrir la orden o recién al ponerle fecha? | ⚠️ A confirmar | 17 ago 2026 |
| **M3** | `sourceRequestId` en `workOrderScheduled` y `workOrderCompleted` | ⚠️ Pedido abierto | 17 ago 2026 |
| **M7** | `sourceRequestId` + `sourceModule` en las tres respuestas de corte de calle | ⚠️ Pedido abierto | 17 ago 2026 |
| **M7** | Typo en su lista: `streetClousureEnded` va `streetClosureEnded` | ⚠️ Aviso pendiente | 17 ago 2026 |
| **M1** | Confirmar las dos consultas REST (ciudadano por `citizenId`, organización por `organizationId`). No se ven en una lista de eventos, hay que reclamarlas aparte | ⚠️ Pedido abierto | 17 ago 2026 |
| **M1** | Decidir si el acta ambiental va al expediente digital. Nuestra postura: no — el hecho les llega vía M4 | ⚠️ A definir | 17 ago 2026 |
| **Cohorte** | Fijar el sobre común. Hoy el único escrito es el de M2 | ⚠️ A definir | 17 ago 2026 |
| **Interno** | Los enums del [acuerdo publicado](../Acuerdo-Eventos-M6.md) no coinciden con el catálogo en cinco casos. Ver [enumeraciones.md](enumeraciones.md#divergencias-con-el-acuerdo-publicado) | ⚠️ A resolver de nuestro lado | 18 ago 2026 |

## El detalle, por contraparte

### M2 — Atención ciudadana 🔴

Publicaron una guía de integración con **contrato v1.2**: sobre común, JSON Schema, matriz de transiciones, idempotencia y DLQ. Es el documento de integración más completo de la cohorte y el único que define un envelope.

**Lo que enviamos está resuelto.** Un solo evento, [`updateTicketStatus`](eventos/publicados/updateTicketStatus.md), con el payload que ellos definieron, adoptado sin cambios. Nos impone dos cosas de implementación: persistir `ticketVersion` para poder devolver `expectedTicketVersion`, y **no mandar `sourceRef`** — su contrato prohíbe transportar IDs de entidades internas de otros módulos, así que la correlación `ticketId ↔ serviceId ↔ inspectionId` queda en una tabla nuestra.

Tres cosas que su contrato nos resolvió, y que estaban anotadas como problema:

- **`detail` ya no es todo el canal.** `progress.estimatedCompletionAt` lleva la fecha agendada como dato, `resolution.publicMessage` da un texto de cierre propio y `attachments[]` permite mandar la foto del trabajo. Era la objeción principal.
- **`INFORMATION_REQUIRED` devuelve el canal de pedirle un dato al vecino**, que dábamos por perdido cuando desapareció `additionalInfoRequired`.
- **`RETURNED` es distinto de `REJECTED`.** Devolver el reclamo para que M2 lo re-derive no es cancelárselo al vecino. Antes había un solo verbo para las dos cosas.

**Lo que recibimos sigue bloqueado**, en dos campos del snapshot de `ROUTED` (ver [`ticketUpdated`](eventos/consumidos/ticketUpdated.md)):

- **No dice a qué módulo va.** `requestTypeId` es un entero de su catálogo. Si el ruteo es por contenido y no por cola dedicada, sin el campo o sin el catálogo tenemos que escuchar los reclamos de las ocho áreas y adivinar cuáles son nuestros. Es lo que antes llamábamos `targetArea`.
- **`location` es texto libre.** Asignamos zona operativa y cuadrilla a partir del barrio.

Menor, no bloqueante: `citizenId` no viaja en el snapshot, solo `isAnonymous`. Lo pedimos; si no lo transportan lo resolvemos por REST contra M1.

Abierto también: su matriz admite `RESOLVED` directo desde `ROUTED` "solo si el Request Type admite resolución directa". Muchos de nuestros servicios se resuelven sin pasar por `STARTED` —una recolección de la ruta del día que además cierra un reclamo—, así que necesitamos saber cuáles de nuestros request types están marcados así.

### M9 — Core 🔴

**No hay sección de M9 en la recopilación.** Sin la lista del Core no se valida nada, y es el módulo del que depende el resto.

Además de los tres bloqueantes del tablero: `notificationSent` y `notificationFailed` los consumen M8 y nosotros, y en esta lista no los publica nadie. M7 menciona un `notificationRequest` de M2 que ningún otro módulo declaró. Si solo M2 puede pedir notificaciones, estaríamos recibiendo acuses de mensajes que nunca pedimos — en ese caso conviene sacar `notificationSent` de lo que consumimos.

Vale la pena pedirles el **catálogo de eventos documentado** (nombre exacto, módulo productor, consumidores registrados) como primer entregable del Core, antes que el ruteo: el enunciado ya se lo asigna, y con eso ninguno de los huérfanos de la cohorte habría llegado hasta acá.

### M3 — Obras públicas ✅ con una pregunta

Consumen los tres que les mandamos ([`infrastructureRepairRequested`](eventos/publicados/infrastructureRepairRequested.md), [`containerDamaged`](eventos/publicados/containerDamaged.md), [`treeRiskDetected`](eventos/publicados/treeRiskDetected.md)) y nos publican `workOrderCompleted`.

Su lista actualizada cerró tres cosas: borraron los alias `urbanRiskDetected` y `urbanServiceRepairRequested`, eliminaron `workOrderValidated` (la solicitud la cierra `workOrderCompleted`, sin ambigüedad) y adoptaron el vocabulario de corte de calle de M7.

Queda la pregunta de `workOrderScheduled`: reemplazó a `workOrderCreated` y no significan lo mismo. "Creada" es "la recibí"; "programada" es "le puse fecha", que puede ser bastante después. Si es lo segundo, entre que mandamos la solicitud y ellos la agendan no tenemos ninguna señal, y no podemos distinguir "todavía no la vieron" de "la están por hacer".

> El desajuste de nombres con M3 fue **heredado, no lo inventó nadie**: el enunciado dice que M6 publica `RiesgoArboladoDetectado` y, dos páginas después, que M3 consume `RiesgoUrbanoDetectado`. Dos nombres para el mismo evento en el mismo documento.

### M4 — Habilitaciones ⚠️

Consumen [`environmentalViolationDetected`](eventos/publicados/environmentalViolationDetected.md) y publican `commercialFineGenerated` y `closureOrdered`, que consumimos tal cual. Los dos primeros bloqueantes con M4 quedaron cerrados: el acta llega, y llega convertida en cargo.

Queda `sourceViolationId` y la confirmación del ruteo de `commercialFineGenerated`. También les pedimos por REST la búsqueda de establecimiento por dirección, CUIT o barrio: como el acta no se deriva sin `establishmentId`, es lo que nos permite completarla antes de emitirla.

### M7 — Tránsito ✅

El cruce más limpio. Reciben los cuatro que les mandamos y publican los tres que necesitamos. Pidieron por su cuenta el campo de módulo de origen en la solicitud de corte, que era exactamente nuestro pedido. Quedan el `sourceRequestId` de vuelta y el typo.

### M1 — Ciudadanos ⚪ sin eventos

Coherente con lo acordado: sin eventos en ninguna dirección. Los dos pedidos son REST y hay que reclamarlos aparte, porque no se ven en una lista de eventos.

Sobre el expediente digital: M1 consume las actuaciones de todas las áreas —inspecciones de M4, beneficios de M8, infracciones apeladas de M7— menos las nuestras. Nuestra postura es que está bien así, porque el acta la derivamos a M4 y M4 sí les reporta el resultado: el hecho les llega igual, por un solo camino. Falta que lo confirmen, o publicarles `environmentalViolationDetected` también a ellos.

No necesitamos `citizenDeceased`, `addressUpdated` ni `citizenBlocked`: no replicamos el registro de ciudadanos.

### M5 — Rentas ✅ · M8 — Desarrollo social ✅

Sin integración, confirmado de los dos lados. De M5: nuestra acta les llega convertida en cargo a través de M4, no directamente. De M8: las cooperativas existen acá como **cuadrillas** (`Crew`), no como beneficiarias de un programa — su registro como organización es de M1.

## Resueltos — no repreguntar

| Qué | Cómo quedó |
|---|---|
| `complaint` → `ticket` | Migrado. M2 es el dueño del dato y la cohorte entera usa `ticket`. Alcanzó eventos, payloads, dos entidades y el valor `COMPLAINT` del enum `ServiceOrigin` |
| PascalCase → camelCase | Migrado, los 27 eventos. Si el Core matchea el tipo como string literal, `UrbanServiceScheduled` y `urbanServiceScheduled` son dos eventos distintos y ninguno llega |
| `commercialFineIssued` → `commercialFineGenerated` | Adoptamos el nombre de M4 |
| `violationDismissed` → `closureLifted` | Decisión propia: adoptamos la señal que M4 ya publica en vez de pedirles un evento nuevo. **No cubre** el caso "M4 decide que no corresponde castigo", que no dispara nada — eso lo cierra el vencimiento de plazo configurable, asentado como `CLOSED` sin `SanctionOutcome` |
| Cancelación del reclamo | Llega como `ticketUpdated / CANCELLED`. No hace falta un `ticketCancelled` |
| Evento genérico de riesgo con `hazardType` | Descartado. M3 aceptó `treeRiskDetected` tal cual |
| Los 7 eventos sin consumidor | Fuera del contrato publicado. Ver [`eventos/publicados/descartados.md`](eventos/publicados/descartados.md) |

## Riesgos de la cohorte que nos salpican

**Tormenta de eventos técnicos.** Todos los módulos publicamos `eventProcessingFailed` **y** todos lo consumimos. Si falla el procesamiento de un `eventProcessingFailed`, se publica otro: un ciclo que ninguna DLQ frena, porque el problema no es el reintento. Propuesta: que los eventos técnicos —`eventProcessingFailed` y `eventRejected`— vayan solo hacia M9, que tiene el tablero de DLQ, y queden excluidos de la ruta que dispara una publicación de falla.

**Colisión de nombres con M4.** Ellos publican `inspectionScheduled` / `inspectionCompleted` / `inspectionFailed` sin prefijo; son inspecciones *comerciales*. Los nuestros van prefijados (`environmental…`), así que de nuestro lado está bien, pero M2 es destinatario de los dos. Conviene que el catálogo del Core registre el módulo de origen, o que M4 prefije los suyos.

**El sobre común.** M2 definió `specVersion`, `eventId`, `eventType`, `eventVersion`, `occurredAt`, `producer`, `subject` y `data`. Es el único envelope escrito que existe. M9 tendría que adoptarlo o publicar el suyo — hoy cada módulo asume uno distinto.

**Los adjuntos se llaman distinto.** M2 usa `attachment { attachmentId, fileName, contentType, url, sizeBytes }`; nosotros veníamos con `{ url, mimeType, description }`. Nos alineamos al suyo en lo que va hacia M2; conviene unificarlo en toda la cohorte antes de implementar.

**Huérfanos ajenos** (alguien los espera y nadie los publica): el par `paymentRegistered` / `debtSettled` es el más caro — rompe el cierre financiero de M4 y M7 con Rentas, porque M5 los publica como `paymentRecorded` y `debtCancelled`. La lista completa está en [`Cruce-Eventos-M6.md`](../Cruce-Eventos-M6.md) Parte 3; no la duplicamos acá porque no nos toca mantenerla.

## Plan B si M2 no resuelve

El riesgo no es que M2 diga que no: es que la reunión pase y el evento de derivación siga sin aparecer.

**Hay una segunda entrada que no depende de nadie: la detección de oficio.** El inspector detecta la infracción, el supervisor releva el árbol, el operario reporta el contenedor desbordado. La primera entrega se puede demostrar entera por ese camino — programación, ejecución, resultado por zona, censo de arbolado, acta y derivación a M4. Lo que queda afuera es el circuito reclamo → servicio → vecino, que es de integración y corresponde a la segunda entrega.
