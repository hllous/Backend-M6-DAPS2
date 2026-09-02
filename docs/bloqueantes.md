# Estado de la integración

> **Fuente única.** Este archivo reemplaza el estado que estaba duplicado en [`LEEME.md`](../LEEME.md), [`Eventos.txt`](../Eventos.txt) y [`fuentes/alcance-entregable.md`](../fuentes/alcance-entregable.md) §7. Si algo de eso dice otra cosa, vale lo que dice acá.
>
> Última revisión general: **2 sep 2026**. Se resolvieron las divergencias de enums por [ADR-003](decisiones/adr-003-divergencias-enums.md) —manda el catálogo, se corrige el acuerdo— y quedan tres avisos pendientes a M3, M4 y M7. M7 volvió con un cruce que confirma `streetClosureRequested` y `treePruningScheduled` campo por campo, pero se contradice a sí mismo sobre `requestingModule` vs `sourceModule`. M1 compartió su catálogo v2: M1 emite el JWT de usuario y M6 lo valida; su contrato criptográfico todavía no está publicado. Antes, el 30 ago 2026: M7 actualizó su documento de referencia: `streetClosureEnded` ya trae `closureRequestId` (cierra la asimetría que tenía) y propuso unificar `streetClosureRequested` con el payload de M3, propuesta que aceptamos. Antes, el 25 ago: M2 publicó la v1.5 (reemplaza la v1.2), M4 publicó `Modulo_4_Eventos.docx`, y M3 confirmó `sourceRequestId`. Se edita a medida que cada grupo contesta — actualizá la fila y su fecha, no reescribas el archivo.

## Tablero

| Con quién | Qué falta | Estado | Última act. |
|---|---|---|---|
| **M2** | `responsibleAreaId`, `citizenId`, `isAnonymous` y `location` estructurada (`neighborhoodId`, `street`, `streetNumber`, `latitude`, `longitude`) ahora son campos comunes de `ticketUpdated` en la v1.5 | ✅ Cerrado | 25 ago 2026 |
| **M2** | `progress` de `updateTicketStatus` en la v1.5 es un `Int` (porcentaje), no la fecha/franja agendada que necesitamos mandar. No hay estructura de `details` definida para `STARTED`/`PROGRESS` | 🔴 Bloqueante | 25 ago 2026 |
| **M9** | Ausente de la recopilación. Falta la lista de eventos del Core | 🔴 Bloqueante | 17 ago 2026 |
| **M1** | M1 confirmado como emisor del JWT de usuario; faltan `alg`, `iss`, `aud`, claves/JWKS, claims y TTL para que M6 pueda verificarlo | ⚠️ Confirmado el emisor; contrato técnico pendiente | 1 sep 2026 |
| **M9** | Token de servicio del Core para tráfico máquina-a-máquina: emisión, obtención, claims y validación sin definir | 🔴 Bloqueante si M6 necesita una consulta inter-módulo síncrona | 1 sep 2026 |
| **M9** | Claim set del JWT sin definir. El enunciado le asigna la identidad a M9 **y** a M1. Mitigado de nuestro lado con una estrategia HS256 provisoria y guard global ([ADR-002](decisiones/adr-002-auth-provisoria.md)): la API ya no está abierta, pero los tokens no son los definitivos y la autorización por rol sigue sin existir | 🔴 Bloqueante — el principal del proyecto | 2 sep 2026 |
| **M1** | M1 confirmado como emisor del JWT de usuario; faltan `alg`, `iss`, `aud`, claves/JWKS, claims y TTL para que M6 pueda verificarlo | ⚠️ Confirmado el emisor; contrato técnico pendiente | 1 sep 2026 |
| **M9** | Token de servicio del Core para tráfico máquina-a-máquina: emisión, obtención, claims y validación sin definir | 🔴 Bloqueante si M6 necesita una consulta inter-módulo síncrona | 1 sep 2026 |
| **M9** | Catálogo de barrios con `neighborhoodId` estable, sin exponer. M2 ya lo usa en `location`, así que el catálogo tiene que existir en algún lado aunque no lo hayamos visto publicado | 🔴 Bloqueante | 17 ago 2026 |
| **M9** | "Zona operativa" (nuestra, agrupa barrios) contra "zona" (de ellos). Misma palabra, distinta cosa | ⚠️ A definir | 17 ago 2026 |
| **M9** | `notificationSent` no lo publica nadie hoy. **Se implementó la Fase 6 sin handler para él**: escribir código para un evento que no existe no tiene sentido. Confirmar si se saca de lo consumido | ⚠️ A confirmar | 2 sep 2026 |
| **M4** | `sourceViolationId` en `commercialFineGenerated` y `closureUpdate` | ✅ Cerrado | 24 ago 2026 |
| **M4** | `decidedAt` y `externalRef`: los habían sacado del payload, confirmaron que los reincorporan. El documento vigente todavía no los muestra en el ejemplo | ⚠️ Confirmado, pendiente de publicar | 24 ago 2026 |
| **M4** | `closureOrdered` y `closureLifted` se fusionaron en un evento único, `closureUpdate` con `status: ORDERED \| LIFTED`. Actualizar el lado consumidor | ✅ Cerrado (cambio de forma, no bloqueante) | 24 ago 2026 |
| **M4** | `commercialFineGenerated` sigue rotulado solo "→ Rentas": confirmar que también nos lo rutean a nosotros | ⚠️ A confirmar | 25 ago 2026 |
| **M4** | ¿`actId` es el mismo dato que `externalRef`, o son dos identificadores distintos? | ⚠️ Pregunta abierta | 25 ago 2026 |
| **M4** | Ya no publican `ticketInProgress` en su documento actual. Antes lo mandaban a M2, que no lo consumía. Confirmar si dejaron de emitir el avance o si va por otro canal | ⚠️ A confirmar | 25 ago 2026 |
| **M3** | Cuándo se dispara `workOrderScheduled`: ¿al abrir la orden o recién al ponerle fecha? | ⚠️ A confirmar | 17 ago 2026 |
| **M3** | `sourceRequestId` en `workOrderScheduled` y `workOrderCompleted` | ✅ Cerrado | 25 ago 2026 |
| **M3** | Nombre de campo a confirmar: nuestro diseño esperaba `attachments[]` en `workOrderCompleted`, lo que confirmaron es `evidence`. Probablemente el mismo dato con otro nombre | ⚠️ A confirmar | 25 ago 2026 |
| **M7** | Payload completo de `streetClosureApproved`, `streetClosureRejected` y `streetClosureEnded`, confirmado con su documento de referencia | ✅ Cerrado | 25 ago 2026 |
| **M7** | El origen de la solicitud vuelve como `closureRequestId` + `requestingModule` (no `sourceRequestId`/`sourceModule` como pedíamos, pero el dato está) en las **tres** respuestas de corte, incluida `streetClosureEnded` | ✅ Cerrado | 30 ago 2026 |
| **M7** | Typo en su lista: `streetClousureEnded` → `streetClosureEnded` | ✅ Cerrado | 25 ago 2026 |
| **M7** | `streetClosureRequested` tenía forma distinta según el origen (Obras vs. Ambiente/nosotros). M7 propuso un esquema único y lo aceptamos, renombrando `requestId→closureRequestId`, `streets[]→affectedSections`, `from`/`to`→`requestedFrom`/`requestedTo` | ✅ Cerrado | 30 ago 2026 |
| **M7** | Payloads de `urbanServiceScheduled` y `treeRiskDetected`: preguntaron si los teníamos definidos. Ya estaban — se les compartió el documento completo con los 8 eventos que publicamos | ✅ Cerrado | 30 ago 2026 |
| **M1** | Catálogo v2 recibido: tiene endpoints y eventos de identidad, pero M6 no consume ninguno en su alcance actual | ✅ Sin dependencia actual | 1 sep 2026 |
| **M1** | Decidir si el acta ambiental va al expediente digital. Nuestra postura: no — el hecho les llega vía M4 | ⚠️ A definir | 17 ago 2026 |
| **Cohorte** | Fijar el sobre común. M2 ya formalizó el suyo en la v1.5 (`specVersion`, `eventId`, `eventType`, `occurredAt`, `producer`, `subject`, `data`) — sigue siendo el único envelope escrito de la cohorte | ⚠️ A definir | 25 ago 2026 |
| **Interno** | Los enums del [acuerdo publicado](Acuerdo-Eventos-M6.md) no coincidían con el catálogo en seis casos. Decidido por [ADR-003](decisiones/adr-003-divergencias-enums.md): manda el catálogo, se corrige el acuerdo | ✅ Cerrado | 2 sep 2026 |
| **Interno** | Regenerar el acuerdo publicado con los enums corregidos y volver a circularlo | ⚠️ Pendiente | 2 sep 2026 |
| **M7** | Avisar que `ServiceOrigin` tiene 5 valores (`PLANNED`/`MANUAL`/`WEATHER_ALERT`, no `SCHEDULED`/`INTERNAL`), que `TreeHealthStatus` no colapsa en `DECLINING` y que `TreeInterventionType` distingue las dos podas y usa `REMOVAL`, no `FELLING` | ⚠️ Aviso pendiente | 2 sep 2026 |
| **M3** | Avisar que `TreeHealthStatus` conserva `WEAKENED` y `DISEASED` en vez de `DECLINING`, en `treeRiskDetected` | ⚠️ Aviso pendiente | 2 sep 2026 |
| **M4** | Confirmar que toleran `FORMAL_NOTICE` como cuarto valor de `suggestedAction`. El campo no es vinculante, así que no debería bloquearles el circuito, pero son los que actúan sobre el valor | ⚠️ A confirmar | 2 sep 2026 |
| **M7** | `streetClosureRequested`: su mensaje del 02/09 decía `requestingModule: "Obras" \| "Ambiente"` en la prosa y `sourceModule: M3 \| M6` en la tabla de campos. **Se resolvió a favor de la tabla: mandamos `sourceModule = "M6"`.** Conviene confirmárselo, porque sus tres eventos de respuesta usan `requestingModule` | ⚠️ Resuelto de nuestro lado, avisar | 2 sep 2026 |
| **M9** | Catálogo de barrios: sin él no podemos completar `location.neighborhoodId`, que era requerido en tres eventos que van a M3 y M7. Pasó a opcional y viaja ausente | 🔴 Bloqueante, ahora con consecuencia concreta | 2 sep 2026 |
| **M3 y M7** | Avisar que `location.neighborhoodId` llega vacío hasta que M9 publique su catálogo, y que `location.street` lleva la dirección sin partir en calle y número | ⚠️ Aviso pendiente | 2 sep 2026 |
| **M9** | Sin broker Kafka expuesto, los eventos quedan en el outbox y solo se registran en el log. El circuito está implementado y listo para enchufar | 🔴 Bloqueante | 2 sep 2026 |
| **M7** | `treePruningScheduled` exige `crewId` y `timeWindow`, que en nuestro modelo son opcionales hasta que se asignan. Implica que el evento no puede salir al programar, sino recién con cuadrilla y ventana cargadas | ⚠️ A resolver de nuestro lado | 2 sep 2026 |

## El detalle, por contraparte

### M2 — Atención ciudadana 🔴 (un bloqueante nuevo, tres cerrados)

Publicaron **la v1.5**, que reemplaza la v1.2 que habíamos adoptado. Sigue siendo sobre común, JSON Schema, matriz de transiciones, idempotencia y DLQ — el documento de integración más completo de la cohorte y el único que define un envelope.

**Lo que enviamos cambió de forma respecto de la v1.2.** El evento sigue siendo uno solo, [`updateTicketStatus`](eventos/publicados/updateTicketStatus.md), pero: `publicId` y `expectedTicketVersion` salieron del contrato (la correlación es solo por `ticketId`, no hace falta devolver versión de nada), `message` se partió en `publicMessage`/`internalMessage`, `updatedAt` se renombró a `statusChangedAt`, y `progress` pasó a ser un campo común de tipo `Int` (porcentaje), no el objeto con la fecha agendada que usábamos.

**Ese último cambio abrió un bloqueante nuevo:** no hay ninguna estructura de `details` definida para `STARTED`/`PROGRESS` en la v1.5 ("details obligatorio: Ninguno"), así que no sabemos cómo mandar la fecha/franja agendada de un servicio. Hay que preguntarles si va como texto en `publicMessage` o si van a definir algo tipo `details.schedule`.

**Lo que recibimos se destrabó del todo.** Los tres campos que bloqueaban [`ticketUpdated`](eventos/consumidos/ticketUpdated.md) ahora son campos comunes del evento, no solo de `details` en `ROUTED`:

- **`responsibleAreaId`** dice a qué módulo va cada `ROUTED`. Ya no hace falta el catálogo de `requestTypeId` ni adivinar.
- **`location`** viene estructurada: `addressLine, street, streetNumber, neighborhoodId, latitude, longitude, reference`. Podemos rutear por zona.
- **`citizenId`** e **`isAnonymous`** viajan en cualquier actualización, no solo la primera.

Además: `informationRequestId` desapareció — la v1.5 lo reemplaza por una invariante de "como máximo una `InformationRequest` activa por ticket", así que la correlación no necesita ID. Y los tres enums que faltaban (`resolution.type`, `returnInfo.reasonCode`, `cancellation.reasonCode`) ya están publicados.

**Decisión propia, no pedido:** ante la ambigüedad de qué Request Types admiten `RESOLVED` directo desde `ROUTED` (el catálogo no está publicado), decidimos publicar siempre `STARTED` inmediatamente antes de `RESOLVED`, sin excepción. Es válido en cualquier caso de su matriz y no depende de que publiquen nada más.

### M9 — Core 🔴

**No hay sección de M9 en la recopilación.** Sin la lista del Core no se valida nada, y es el módulo del que depende el resto.

Además de los tres bloqueantes del tablero: `notificationSent` y `notificationFailed` los consumen M8 y nosotros, y en esta lista no los publica nadie. M7 menciona un `notificationRequest` de M2 que ningún otro módulo declaró. Si solo M2 puede pedir notificaciones, estaríamos recibiendo acuses de mensajes que nunca pedimos — en ese caso conviene sacar `notificationSent` de lo que consumimos.

Vale la pena pedirles el **catálogo de eventos documentado** (nombre exacto, módulo productor, consumidores registrados) como primer entregable del Core, antes que el ruteo: el enunciado ya se lo asigna, y con eso ninguno de los huérfanos de la cohorte habría llegado hasta acá.

### M3 — Obras públicas ✅ con una pregunta menor

Consumen los tres que les mandamos ([`infrastructureRepairRequested`](eventos/publicados/infrastructureRepairRequested.md), [`containerDamaged`](eventos/publicados/containerDamaged.md), [`treeRiskDetected`](eventos/publicados/treeRiskDetected.md)) y nos publican `workOrderScheduled` y `workOrderCompleted`.

**`sourceRequestId` ya viaja en los dos eventos** — era nuestro bloqueante principal con ellos, queda cerrado. `workOrderScheduled` sumó `estimatedDuration` y `workOrderCompleted` sumó `consumedMaterials` y `evidence`.

Queda una pregunta de nombre, no bloqueante: nuestro diseño esperaba `attachments[]` en `workOrderCompleted`, lo que confirmaron es `evidence`. Probablemente el mismo dato con otro nombre — conviene confirmarlo antes de fijar el parser.

Sigue la pregunta de `workOrderScheduled`: reemplazó a `workOrderCreated` y no significan lo mismo. "Creada" es "la recibí"; "programada" es "le puse fecha", que puede ser bastante después. Si es lo segundo, entre que mandamos la solicitud y ellos la agendan no tenemos ninguna señal, y no podemos distinguir "todavía no la vieron" de "la están por hacer".

> El desajuste de nombres con M3 fue **heredado, no lo inventó nadie**: el enunciado dice que M6 publica `RiesgoArboladoDetectado` y, dos páginas después, que M3 consume `RiesgoUrbanoDetectado`. Dos nombres para el mismo evento en el mismo documento.

### M4 — Habilitaciones ✅ con dos preguntas abiertas

Consumen [`environmentalViolationDetected`](eventos/publicados/environmentalViolationDetected.md) y publican `commercialFineGenerated` y `closureUpdate` (antes `closureOrdered`/`closureLifted` separados — ver más abajo).

**`sourceViolationId` ya viaja**, confirmado en el payload de ejemplo de `commercialFineGenerated` y `closureUpdate`. Era nuestro pedido bloqueante principal con M4, queda cerrado.

**Cambio de forma: `closureOrdered` y `closureLifted` se fusionaron en `closureUpdate`.** En su lista anterior eran dos eventos separados; en el documento actual (`Modulo_4_Eventos.docx`) los unificaron en uno con `status: ORDERED | LIFTED`. No es un pedido nuestro, es cómo lo publican — actualizamos el lado consumidor para escucharlo así.

**`decidedAt` y `externalRef` confirmados verbalmente el 24/08**, con aviso de que los habían sacado del payload y los van a reincorporar porque los necesitamos. El documento que tenemos todavía no los muestra en el ejemplo — pendiente de que se vea publicado.

Quedan dos preguntas sin bloquear nada:

- **`commercialFineGenerated` sigue rotulado solo "→ Rentas"** en su documento. Falta que confirmen que también nos lo rutean a nosotros — sin este evento no cerramos el expediente por la vía de la multa.
- **¿`actId` es lo mismo que `externalRef`?** Su payload ya incluye `actId` en `commercialFineGenerated` y `closureUpdate`. Si es el mismo número que `externalRef`, es un campo duplicado que se puede simplificar.

Aviso nuevo, no bloqueante: **ya no vemos `ticketInProgress` en su lista de publicados.** Antes lo mandaban hacia M2, que no lo consumía (solo escucha `updateTicketStatus`). Confirmar si dejaron de emitir el avance del reclamo o si va por otro canal que no vemos en este documento.

También les pedimos por REST la búsqueda de establecimiento por dirección, CUIT o barrio: como el acta no se deriva sin `establishmentId`, es lo que nos permite completarla antes de emitirla. Sigue pendiente.

### M7 — Tránsito ✅

El cruce más limpio, y con payload confirmado desde el 25/08 y actualizado el 30/08.

El origen de la solicitud vuelve como **`closureRequestId` + `requestingModule`** (valores `"Obras"`/`"Ambiente"` — nosotros somos `"Ambiente"`), no con los nombres `sourceRequestId`/`sourceModule` que habíamos pedido, pero el dato está.

**La asimetría de `streetClosureEnded` quedó resuelta (30/08).** Hasta el 25/08 ese evento no traía el origen, solo `streetClosureId` — había que persistirlo desde el `streetClosureApproved` anterior para correlacionar el cierre. El documento de referencia nuevo de M7 ya agrega `closureRequestId` también ahí, igualando los tres eventos de respuesta.

El typo `streetClousureEnded` ya está corregido desde el 25/08: escriben `streetClosureEnded` bien, coincidiendo con lo que usamos nosotros y M3.

**Nuevo (30/08): `streetClosureRequested` se unifica con la solicitud de M3.** Hasta ahora M7 recibía este evento con dos formas distintas según el origen (la nuestra y la de Obras). Propusieron un esquema único y lo aceptamos: de nuestro lado implica renombrar `requestId→closureRequestId`, `streets[]→affectedSections` y `from`/`to`→`requestedFrom`/`requestedTo`. Ya actualizado en [`streetClosureRequested.md`](eventos/publicados/streetClosureRequested.md).

**También preguntaron si teníamos definidos `urbanServiceScheduled` y `treeRiskDetected`.** Ya estaban diseñados en este documento; se les compartió el payload completo de los 8 eventos que publicamos.

#### Cruce del 02/09 — confirmaciones y una contradicción

Volvieron con un mensaje que en su mayor parte **repite lo ya cerrado el 30/08**. Lo que aporta:

- **`streetClosureRequested` coincide campo por campo** con nuestro [schema](eventos/publicados/streetClosureRequested.schema.json): `closureRequestId`, `sourceModule`, `sourceRef`, `reason`, `affectedSections[]`, `requestedFrom`, `requestedTo`, `closureType?`, `requestedAt`. Nada que cambiar de nuestro lado.
- **`treePruningScheduled` también coincide exacto**, los 11 campos y el mismo conjunto de requeridos.
- **Volvieron a preguntar por `urbanServiceScheduled` y `treeRiskDetected`**, que ya se les había compartido el 30/08. Conviene reenviarles el documento y confirmar que les llegó.

🔴 **La contradicción, que es lo único accionable:** en el mismo mensaje describen `streetClosureRequested` con `{requestingModule: "Obras" | "Ambiente"}` en la prosa y con `sourceModule: string — M3 o M6` en la tabla de campos. Son dos nombres de campo distintos y dos vocabularios distintos para el mismo dato.

Nuestro schema manda `sourceModule = "M6"`, que es lo que dice su tabla. Pero sus tres eventos de respuesta devuelven `requestingModule` con valores `"Obras"`/`"Ambiente"`, así que puede ser que hayan mezclado el campo de ida con el de vuelta. **Hay que preguntarlo antes de fijar el publisher en la Fase 3**: si mandamos el nombre equivocado, no pueden rutear la respuesta.

⚠️ **Un problema nuestro que salió de su tabla:** `treePruningScheduled` declara `crewId` y `timeWindow` como requeridos, y en nuestro modelo `Service.crewId` es opcional hasta que se asigna la cuadrilla y `windowFrom`/`windowTo` son opcionales. El evento entonces **no puede publicarse al programar la intervención**, sino recién cuando el servicio tiene cuadrilla y ventana. Hay que decidir en la Fase 3 si se difiere la publicación hasta ese momento o si se le pide a M7 que los acepte opcionales.

### M1 — Ciudadanos ⚪ JWT confirmado; sin integración de dominio actual

**M1 emite el JWT de usuario y M6 lo valida.** Es el acuerdo de identidad que tomamos para avanzar. Todavía no recibimos el contrato verificable del token: algoritmo de firma, emisor (`iss`), audiencia (`aud`), clave pública/JWKS o mecanismo equivalente, claims, TTL y política de refresh. M6 no debe emitir ni reinterpretar un token propio; implementará la validación como una integración configurable hasta recibir esos datos.

M1 publicó eventos de ciudadanos, organizaciones y representaciones, además de endpoints REST inter-módulo. **No los consumimos por ahora:** los casos de uso actuales de M6 no requieren replicar ni consultar esos datos. Por eso no abrimos un consumidor ni una dependencia de sus endpoints. Si un caso futuro necesita información de identidad, debe hacerlo a través de un puerto de aplicación (adaptador), para poder resolver después si el transporte será REST síncrono o request/response por Kafka sin filtrar esa decisión al dominio.

Su catálogo v2 trae inconsistencia en organización: `cuit: 3311` es aparentemente `organizationId`, mientras que `taxId: "30712345678"` es el CUIT; también mezcla `ACTIVE` y `ACTIVA`. M1 confirmó que lo documentó mal y lo corregirá. No afecta a M6 mientras no consumamos ese contrato.

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
| `closureOrdered` + `closureLifted` → `closureUpdate` | M4 fusionó los dos eventos en uno con `status: ORDERED \| LIFTED`. No es una decisión nuestra — actualizamos el consumidor para seguir su forma actual |
| `violationDismissed` → `closureLifted` (histórico, ver fila anterior) | Decisión propia: adoptamos la señal que M4 ya publica en vez de pedirles un evento nuevo. **No cubre** el caso "M4 decide que no corresponde castigo", que no dispara nada — eso lo cierra el vencimiento de plazo configurable, asentado como `CLOSED` sin `SanctionOutcome` |
| Cancelación del reclamo | Llega como `ticketUpdated / CANCELLED`. No hace falta un `ticketCancelled` |
| Evento genérico de riesgo con `hazardType` | Descartado. M3 aceptó `treeRiskDetected` tal cual |
| Los 7 eventos sin consumidor | Fuera del contrato publicado. Ver [`eventos/publicados/descartados.md`](eventos/publicados/descartados.md) |

## Riesgos de la cohorte que nos salpican

**Tormenta de eventos técnicos.** Todos los módulos publicamos `eventProcessingFailed` **y** todos lo consumimos. Si falla el procesamiento de un `eventProcessingFailed`, se publica otro: un ciclo que ninguna DLQ frena, porque el problema no es el reintento. Propuesta: que los eventos técnicos —`eventProcessingFailed` y `eventRejected`— vayan solo hacia M9, que tiene el tablero de DLQ, y queden excluidos de la ruta que dispara una publicación de falla.

**Colisión de nombres con M4.** Ellos publican `inspectionScheduled` / `inspectionCompleted` / `inspectionFailed` sin prefijo; son inspecciones *comerciales*. Los nuestros van prefijados (`environmental…`), así que de nuestro lado está bien, pero M2 es destinatario de los dos. Conviene que el catálogo del Core registre el módulo de origen, o que M4 prefije los suyos.

**El sobre común.** M2 definió `specVersion`, `eventId`, `eventType`, `eventVersion`, `occurredAt`, `producer`, `subject` y `data`. Es el único envelope escrito que existe. M9 tendría que adoptarlo o publicar el suyo — hoy cada módulo asume uno distinto.

**Los adjuntos se llaman distinto.** M2 usa `attachment { attachmentId, fileName, contentType, url, sizeBytes }`; nosotros veníamos con `{ url, mimeType, description }`. Nos alineamos al suyo en lo que va hacia M2; conviene unificarlo en toda la cohorte antes de implementar.

**Huérfanos ajenos** (alguien los espera y nadie los publica): el par `paymentRegistered` / `debtSettled` es el más caro — rompe el cierre financiero de M4 y M7 con Rentas, porque M5 los publica como `paymentRecorded` y `debtCancelled`. La lista completa está en [`Cruce-Eventos-M6.md`](Cruce-Eventos-M6.md) Parte 3; no la duplicamos acá porque no nos toca mantenerla.

## Plan B si M2 no resuelve

El riesgo no es que M2 diga que no: es que la reunión pase y el evento de derivación siga sin aparecer.

**Hay una segunda entrada que no depende de nadie: la detección de oficio.** El inspector detecta la infracción, el supervisor releva el árbol, el operario reporta el contenedor desbordado. La primera entrega se puede demostrar entera por ese camino — programación, ejecución, resultado por zona, censo de arbolado, acta y derivación a M4. Lo que queda afuera es el circuito reclamo → servicio → vecino, que es de integración y corresponde a la segunda entrega.
