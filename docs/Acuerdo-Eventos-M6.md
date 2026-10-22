# Acuerdo de Eventos — Módulo 6

**Ambiente, Higiene y Servicios Urbanos · Grupo 04 · versión 2.1 · 22 de octubre de 2026**

Este documento sirve para cerrar el contrato de eventos antes de empezar a programar. Tiene tres partes y les pedimos tres cosas distintas:

| Parte | Qué contiene | Qué les pedimos |
|---|---|---|
| **1** | Los 6 eventos que publicamos, con su estructura y todos sus campos | **Confírmennos que los consumen.** Están agrupados por destinatario |
| **2** | Los eventos suyos que consumimos | **Devuélvannos el payload**, con los campos que les marcamos como imprescindibles |
| **3** | Las incongruencias que encontramos en la lista común | **Respondan las que les tocan** |

Notación: `?` es campo opcional o que puede venir en nulo, `[]` es lista. Todos los nombres van en **camelCase**, que es lo que usa la recopilación de la cohorte.

**Los mensajes completos, con el sobre del Core, están en [Sobres-M6.md](Sobres-M6.md)**: un ejemplo copiable de cada evento que publicamos y de cada uno que recibimos. Este Acuerdo describe los `data`; el sobre que los transporta es el del Core (`eventId`, `eventType`, `eventVersion`, `occurredAt`, `sourceModule`, `correlationId`, `causationId?`, `data`). Ese sobre llega a cada módulo re-serializado por el Core (sin los campos en `null` y con `occurredAt` normalizado), y los `correlationId` y `causationId` que heredamos solo tienen que tener la forma 8-4-4-4-12; el detalle está en la Parte 1 de Sobres.

---

# Parte 1 — Lo que publicamos

Seis eventos, **todos con consumidor declarado**. No publicamos nada que nadie escuche.

| Evento | Va a | Se dispara cuando |
|---|---|---|
| `updateTicketStatus` | **M2** | Cambia el estado de algo nacido de un reclamo |
| `containerDamaged` | **M3** | Se detecta un contenedor dañado o faltante |
| `treeRiskDetected` | **M3** | Un relevamiento arroja riesgo `HIGH` o `CRITICAL` |
| `environmentalViolationDetected` | **M4** | Se emite un acta ambiental |
| `infrastructureRepairRequested` | **M3** | Detectamos un daño de infraestructura ajeno |
| `streetClosureRequested` | **M7** | Un servicio o una poda requiere cortar la calle |

> **Eran quince y quedaron seis: la decisión y el porqué.** Cuando M2 confirmó que todo lo suyo va por `updateTicketStatus`, siete eventos de dominio —`urbanServiceStarted`, `urbanServiceDelayed`, `urbanServiceCompleted`, `zoneNotServiced`, `containerOverflowed`, `environmentalInspectionScheduled` y `environmentalInspectionCompleted`— se quedaron sin ningún consumidor.
>
> **Los sacamos del contrato.** Los hechos siguen existiendo en nuestro modelo y son los que, cuando corresponde, disparan un `updateTicketStatus`, pero **no los publicamos al bus**: un cambio de estado interno se escribe en nuestra base, no se anuncia. Publicar un evento cuesta schema, publisher, test y documentación, y no íbamos a pagarlo por siete suscripciones que no existen. Si alguno les hace falta, pídanlo y lo publicamos: el payload ya está diseñado.
>
> **Descartados el 21/10: `urbanServiceScheduled` y `treePruningScheduled`.** M7 confirmó que solo consume `streetClosureRequested`, así que dejamos de emitirlos. El corte de calle se pide siempre con `streetClosureRequested`, con `sourceRef` apuntando al servicio o a la poda. `treeRiskDetected` va solo a M3.
---

## 1.1 Los seis payloads

Cada evento con sus campos, y abajo de cada uno los valores que puede tomar cada campo cerrado. `?` es opcional, `[]` es lista, `{ }` es un objeto anidado.

**Objetos que se repiten en varios eventos:**

```
location       { street, number?, neighborhoodId?, lat?, lng? }
attachments[]  { url, mimeType, description? }
evidence[]     { url, mimeType, description? }
```

**Quién genera cada identificador:**

```
Nuestros:     serviceId, inspectionId, reportId, violationId, requestId,
              interventionId, containerId, treeId, zoneId, crewId, vehicleId
De M2:        ticketId
De M4:        establishmentId
A confirmar:  neighborhoodId (catálogo de barrios de M9 ya publicado; falta que cargue los barrios reales y que M6 lo adopte)
De M1:        citizenId, organizationId
```

`neighborhoodId` es **opcional** y hoy viaja ausente: es el `id` (UUID) del catálogo de barrios de M9 (`GET /api/v1/catalogos/barrios`), que M9 ya expone con datos de arranque ficticios. M6 lo va a adoptar cuando M9 cargue los barrios reales. El Core reconoció el 22 de octubre que el catálogo es suyo.

Los campos que terminan en `At` son **fecha y hora**. El formato es el del sobre del Core: `occurredAt` en ISO 8601 con offset (ver Sobres, Parte 1).

---

**1. `updateTicketStatus` → M2** · *el payload lo define M2 en su contrato, vigente v1.78 (WIP)*

```
ticketId, updateType,
publicMessage?, internalMessage?, progress?, details?,
attachments[]?, updatedBy, updateOccurredAt

updateType: STARTED | PROGRESS | INFORMATION_REQUIRED |
            RETURNED | RESOLVED | REJECTED
updatedBy:  { type: EXTERNAL_USER, id } | { type: SYSTEM, id: null }
            id: UUID | null (v1.78: no se admiten códigos ni enteros)
```

No lleva `status`: informamos el hecho y **M2 decide el estado**. Tampoco lleva `sourceRef` — su contrato prohíbe mandarles IDs de nuestras entidades internas, así que la correlación `ticketId ↔ serviceId` la guardamos de nuestro lado. `expectedTicketVersion` salió del contrato en la v1.5 y `publicId` no viaja en este evento (§8.1 de la v1.70): la correlación es solo por `ticketId`. El sobre del Core ya no lleva `subject` (era del sobre de M2): la correlación va por `data.ticketId`. El detalle de cada variante está en 1.2.

**2. `containerDamaged` → M3**

```
containerId, containerCode, zoneId, location,
damageType, severity, requiresPublicWorks, detectedAt, ticketId?

severity:            LOW | MEDIUM | HIGH | CRITICAL
requiresPublicWorks: booleano — en true, el arreglo le corresponde a M3
damageType:          sale de nuestro catálogo, viaja como texto
```

**3. `treeRiskDetected` → M3**

```
treeId, surveyCode, species, zoneId, location,
riskLevel, riskType, healthStatus, suggestedIntervention?,
requiresStreetClosure, requiresPublicWorks, surveyedAt

riskLevel:             LOW | MEDIUM | HIGH | CRITICAL
                       (el evento solo se publica con HIGH o CRITICAL)
healthStatus:          HEALTHY | WEAKENED | DISEASED | DEAD
suggestedIntervention: FORMATION_PRUNING | SAFETY_PRUNING | REMOVAL | PLANTING | TREATMENT — opcional
requiresStreetClosure: booleano
requiresPublicWorks:   booleano
```

**4. `environmentalViolationDetected` → M4**

```
violationId, noticeNumber, issuedAt,
reportId, inspectionId, ticketId?,
violationType, severity, location,
establishmentId,
priorNoticeCount,
evidence[], suggestedAction

severity:         LOW | MEDIUM | HIGH | CRITICAL
suggestedAction:  WARNING | FORMAL_NOTICE | FINE | CLOSURE — no es vinculante
priorNoticeCount: entero, actas previas al mismo establecimiento
violationType:    sale de nuestro catálogo, viaja como texto
```

**5. `infrastructureRepairRequested` → M3**

```
requestId, damageType, severity, location,
detectedIn, ticketId?, publicSafetyRisk, requestedAt

severity:         LOW | MEDIUM | HIGH | CRITICAL
publicSafetyRisk: booleano
detectedIn:       nuestro serviceId o inspectionId que originó la detección
```

**6. `streetClosureRequested` → M7** · *esquema unificado con la solicitud de M3 (30/08)*

```
closureRequestId, sourceModule, sourceRef,
reason, affectedSections[], requestedFrom, requestedTo, closureType?, requestedAt

sourceModule: M3 | M6 — nosotros, siempre M6
sourceRef:    el serviceId o interventionId que origina el corte
closureType:  TOTAL | PARTIAL (opcional en el esquema unificado; lo mandamos siempre)
```

Antes de la unificación, M7 recibía este evento con forma distinta según el origen: nuestros campos eran `requestId`, `streets[]`, `from`, `to`. M7 propuso un esquema común para Obras y Ambiente, y lo aceptamos.

---

## 1.2 Para M2 — Atención ciudadana

### `updateTicketStatus` — el único, con el contrato de M2

Leímos el contrato, ahora en su **v1.78** (WIP; reemplaza a la v1.77 —el único cambio de contrato es que `updatedBy.id` pasa a UUID o `null`—, y antes la v1.75, la v1.74, la v1.73, la v1.70, la v1.6, la v1.5 y la v1.2 sobre la que habíamos escrito esto. En lo que enviamos y recibimos no cambió desde la v1.6, salvo el `updatedBy.id` de la v1.78), y **adoptamos su payload tal cual**. No pedimos campos nuevos ni proponemos alternativas: nos adaptamos a lo que ya definieron.

```
ticketId, updateType,
publicMessage?, internalMessage?, progress?, details?,
attachments[]?, updatedBy, updateOccurredAt
```

🔄 **Cambió respecto de la v1.2:** `publicId` y `expectedTicketVersion` salieron del contrato (nunca fueron parte del canal máquina-a-máquina; `publicId` volvió en la v1.70, pero solo en lo que publica M2); `message` se partió en `publicMessage`/`internalMessage`; y `progress` pasó a ser un campo común de tipo `Int` (porcentaje), no el objeto `progress.estimatedCompletionAt` que usábamos para la fecha agendada — ver más abajo.

🔄 **Y cambió otra vez en la v1.6:** `statusChangedAt` se renombró a `updateOccurredAt`; el actor `AREA_USER` **no existe** en su enum y una persona que actúa desde otro módulo va como `EXTERNAL_USER`, un proceso automático como `SYSTEM`; el adjunto perdió `attachmentId`; y `resolution.type` cambió `INFORMATION_PROVIDED` por `INQUIRY_ANSWERED`.

🔄 **Y en la v1.78:** `updatedBy.id` es un **UUID o `null`**; ya no admite códigos tipo `USR-M3-77` ni enteros. Para una persona de otro módulo (`EXTERNAL_USER`) es su UUID en el módulo de origen; si no hay una persona concreta identificable, va `null`. Mandamos el identificador del usuario autenticado solo si tiene forma de UUID (8-4-4-4-12); si no, va `id: null` con `type: EXTERNAL_USER`. Falta que M1 aclare qué id real viaja en su login.

Tres cosas que nos cambian la implementación y conviene dejar dichas:

- **No mandamos el estado, mandamos el hecho.** `updateType` dice qué pasó y M2 decide la transición. No le mandamos a M2 un estado: le mandamos el hecho.
- **La correlación es solo por `ticketId`.** La v1.70 volvió a publicar `publicId` en `ticketUpdated` como referencia humana: lo guardamos en el expediente para mostrarlo y buscarlo, pero no viaja en `updateTicketStatus` (§8.1) ni es credencial. No hay versión que devolver.
- **No mandamos `sourceRef`.** Su contrato prohíbe transportar IDs de entidades internas de otros módulos, así que la correlación `ticketId ↔ serviceId ↔ inspectionId` queda en una tabla nuestra.

### De qué hecho nuestro sale cada `updateType`

Esta es la tabla con la que lo implementamos. La columna izquierda son **hechos internos de nuestro modelo**, no eventos publicados: ninguno sale al bus (`urbanServiceScheduled` dejó de emitirse el 21/10). Cuando ocurre el hecho, publicamos el `updateTicketStatus` que le corresponde.

| Hecho nuestro | `updateType` | Qué mandamos |
|---|---|---|
| Se agenda un servicio nacido de un reclamo, o se confirma su reprogramación | `STARTED` o `PROGRESS`, según el estado del ticket (ver abajo) | fecha y franja agendadas **como texto en `publicMessage`** (así lo confirmó M2 el 20/10: el contrato no tiene campo estructurado) |
| Se reactiva un expediente devuelto porque M2 lo derivó otra vez | `STARTED` (o `PROGRESS` si el ticket ya está `IN_PROGRESS`) | `publicMessage`: «Su denuncia ambiental está en análisis.» |
| Inicia un servicio nacido de un reclamo | `STARTED` (o `PROGRESS` si el ticket ya está `IN_PROGRESS`) | `publicMessage`: «La cuadrilla comenzó a atender su reclamo.». Agendar ya arrancó el ticket, así que no repetimos `STARTED` |
| Se inicia la revisión de un expediente (denuncia ambiental) | `STARTED` (o `PROGRESS` si el ticket ya está `IN_PROGRESS`) | `publicMessage`: «Su denuncia ambiental está en análisis.» |
| Se avisa una demora de un servicio en curso | `PROGRESS` | motivo en `publicMessage`/`internalMessage`. Solo con el servicio en curso; una demora antes de arrancar no se informa |
| Se completa un servicio | `RESOLVED` | `details.resolution.type` (`ACTION_COMPLETED`) y `publicMessage` («El servicio se completó.»). El contrato admite la foto del trabajo en `attachments[]`, pero hoy no la mandamos |
| Se emite un acta ambiental | `PROGRESS` (`STARTED` si el ticket está en `ROUTED`, `IN_REVIEW` o sin estado conocido; nada con `PENDING_INFORMATION` o estado terminal) | `publicMessage`: «Se constató una infracción y se emitió el acta correspondiente.». El caso sigue en M4; nunca el contenido del acta |
| Se cancela un servicio | `REJECTED` | `details.cancellation.reasonCode` (`OTHER`) + el motivo del operador en `internalMessage`, siempre |
| Se desestima el expediente | `REJECTED` | `details.cancellation.reasonCode` (`DOES_NOT_APPLY`) + el motivo del operador en `internalMessage`, siempre |
| El reclamo no es de nuestra área (se devuelve el expediente) | `RETURNED` | `details.returnInfo.reasonCode` (`REQUEST_TYPE_MISMATCH`) + el motivo del operador en `internalMessage`, siempre. Vuelve a M2 para que lo re-derive, en vez de cancelárselo al vecino |
| Se cierra el expediente | `RESOLVED` | `details.resolution.type` (`ACTION_COMPLETED`) y `publicMessage` («Su denuncia ambiental fue cerrada.»). Si el expediente ya estaba devuelto o desestimado, no sale nada |
| El operador necesita un dato del vecino (expediente con reclamo, en revisión y sin otra solicitud pendiente) | `INFORMATION_REQUIRED` | Emitimos `INFORMATION_REQUIRED` cuando el operador lo pide. `details.informationRequest.messageForCitizen` (obligatorio, hasta 500 caracteres; es el mismo texto que `publicMessage`) y `requiredBy` opcional (fecha límite sugerida, futura, que M2 fija como efectiva a su criterio; si no el pedido se rechaza con 400; ISO con zona; si el operador manda solo una fecha, vence a las 23:59:59 hora argentina); `internalMessage` con una nota interna opcional que el vecino no ve. Sin `progress` ni adjuntos. Solo sale con el ticket en `IN_PROGRESS` o `ROUTED`, o sin estado conocido (ver abajo) |

**Qué elegimos para la programación.** Según el estado del ticket que M6 deduce de lo que ya envió y de lo que M2 informa en `ticketUpdated`: `STARTED` si nunca lo vimos o está en `ROUTED` o `IN_REVIEW` (también al reprogramar, mientras siga en uno de esos estados); `PROGRESS` si está en `IN_PROGRESS`; con cualquier otro estado (`REGISTERED`, `DUPLICATE`, `PENDING_INFORMATION`, `RESOLVED`, `CLOSED`, `CANCELLED`) no mandamos nada.

Los enums de `resolution.type`, `returnInfo.reasonCode` y `cancellation.reasonCode` están publicados desde la v1.5 (antes no estaban enumerados; en la v1.6 `resolution.type` usa `INQUIRY_ANSWERED` en lugar de `INFORMATION_PROVIDED`).

**Secuencia.** `STARTED` va siempre antes de `PROGRESS`, y no repetimos un `STARTED` con el ticket ya en `IN_PROGRESS` (va `PROGRESS`): M2 trata como prematuro un `PROGRESS` sobre un ticket que sigue en `ROUTED`. El primer `updateTicketStatus` de un ticket es siempre `STARTED`, `RESOLVED`, `RETURNED` o `REJECTED`, o `INFORMATION_REQUIRED` si todavía no conocemos su estado. `RETURNED` y `REJECTED` llevan siempre un motivo (`internalMessage`, que M2 acepta como alternativa a `publicMessage`), porque el operador no puede derivar ni desestimar sin escribirlo.

**Pedido de información al vecino (`INFORMATION_REQUIRED`).** Solo sale si M6 conoce o supone el ticket en `IN_PROGRESS` o `ROUTED`, o todavía no tiene un estado conocido para él; con `PENDING_INFORMATION`, `IN_REVIEW` o un estado terminal no mandamos nada y el pedido del operador se rechaza. Una sola solicitud pendiente por expediente. Esperamos de vuelta un `ticketUpdated / INFORMATION_PROVIDED` con la respuesta del vecino: la guardamos y damos la solicitud por cerrada (el que trae `purpose = "RECLASSIFICATION"` no cuenta como respuesta). Mientras hay una solicitud pendiente, M6 no devuelve, desestima ni cierra ese expediente. **Cómo termina el pedido.** Si el vecino responde, esperamos `INFORMATION_PROVIDED` con el `currentStatus` al que volvió el ticket. Si el pedido vence sin respuesta, M2 cancela el ticket (no vuelve al estado anterior) y esperamos un `ticketUpdated` `CANCELLED` con `reasonCode` `INFO_TIMEOUT`: cierra nuestra solicitud y desestima el expediente que estaba en revisión. Una cancelación administrativa también llega como `CANCELLED`. `requiredBy` es una fecha sugerida: M2 fija la efectiva. Mientras haya un pedido abierto no mandamos un segundo `INFORMATION_REQUIRED`. Además, la solicitud se da por cerrada con un `ticketUpdated` de cambio de estado (`STATUS_CHANGED`, `ROUTED`, `REOPENED`, `RESOLVED`, `CLOSED`, `CANCELLED` o `DUPLICATE_LINKED`) cuyo `currentStatus` sea uno de los nueve estados de M2 y no sea `PENDING_INFORMATION`; un evento viejo (atrasado respecto del último estado recibido) o un `currentStatus` fuera de esos nueve estados no la cierra, y una reclasificación (`RECLASSIFICATION`) nunca la cierra. `CANCELLED` la cierra aunque no traiga `currentStatus`. Es un `updateType` que ya existía en el contrato de M2; M6 pasa a ser productor. El ejemplo completo está en [Sobres-M6.md](Sobres-M6.md).

Los otros dos no tienen una traducción directa, y conviene que quede escrito por qué:

- **`zoneNotServiced` no es un reclamo, es una zona.** Cuando un recorrido deja una zona sin atender no hay un `ticketId`, hay *n*. El diseño es **un `updateTicketStatus` con `PROGRESS` por cada reclamo abierto de esa zona** (el abanico lo abriríamos nosotros, a partir de un hecho que del lado de M2 no tiene forma de representarse entero), pero **hoy no lo emitimos**.
- **`containerOverflowed` depende del origen.** Si el desborde lo reportó un vecino, hay `ticketId` y sale el `updateTicketStatus`. Si lo detectamos nosotros en la recorrida, no hay reclamo al que contestarle y hacia M2 no sale nada. Hoy tampoco sale el del vecino: es el diseño previsto.

### Lo que el contrato nos resolvió

Tres cosas que teníamos anotadas como problema dejaron de serlo:

- **`detail` ya no es todo el canal.** Era nuestra objeción principal: el vecino iba a ver solo prosa. Con `resolution.type` el cierre tiene un texto propio en `publicMessage` y con `attachments[]` podemos mandar la foto del trabajo terminado. La **fecha agendada** también quedó resuelta el 20/10: el campo común `progress` sigue siendo un `Int` (porcentaje) y no hay estructura de `details` para `STARTED`/`PROGRESS`, pero M2 confirmó que la fecha y la franja van como **texto en `publicMessage`**, y ya lo mandamos así.
- **Podemos pedirle información al ciudadano.** `INFORMATION_REQUIRED` era el canal que dábamos por perdido cuando desapareció `additionalInfoRequired`. No desapareció: se convirtió en una variante. El operador que necesita una referencia más precisa o una foto nocturna tiene por dónde pedirla: emitimos `INFORMATION_REQUIRED` cuando lo necesita (ver la Parte 1). La v1.5 ya no correlaciona por `informationRequestId` (ese campo nunca llegó a existir formalmente): la respuesta siempre corresponde a la única solicitud activa que puede haber por ticket.
- **`RETURNED` es mejor que rechazar.** Cuando un reclamo no es nuestro, devolverlo a M2 para que lo re-derive es distinto de cancelárselo al vecino. Antes teníamos un solo `REJECTED` para las dos cosas.

### Lo que se cae

Los diez eventos de dominio que les ofrecíamos como detalle **ya no se los mandamos**. Tres siguen publicados porque los consumen M3 y M7; los otros siete se quedaron sin ningún consumidor y los sacamos del contrato.

### Los siete que sacamos del contrato

Estos hechos existen en nuestro modelo y son los que, cuando corresponde, disparan un `updateTicketStatus`, pero **dejamos de publicarlos**: `urbanServiceStarted`, `urbanServiceDelayed`, `urbanServiceCompleted`, `zoneNotServiced`, `containerOverflowed`, `environmentalInspectionScheduled` y `environmentalInspectionCompleted`.

Los teníamos en el contrato porque se los ofrecíamos a M2 como detalle de lo que pasaba con el reclamo. Cuando M2 definió que todo lo suyo entra por `updateTicketStatus`, se quedaron sin ningún consumidor, y un evento que nadie escucha no es parte de un contrato de integración: es código que hay que escribir, versionar y mantener para nadie.

**El dato no se pierde.** Su contrato hace viajar el cierre como `resolution.type` + `publicMessage`, la evidencia como `attachments[]` y la fecha y franja agendadas como texto en `publicMessage`. Lo que queda afuera son nuestros identificadores internos, que el propio contrato de M2 prohíbe transportar.

Si alguno les hace falta —M9 para un tablero de cumplimiento de recorridos, o M2 si más adelante quiere la franja horaria completa— **pídanlo y lo publicamos**. El payload ya está diseñado; lo que no hacemos es publicarlo por las dudas.

## 1.3 Para M3 — Obras públicas

Tres eventos, y ya confirmaron que los consumen los tres: `infrastructureRepairRequested` (5), `containerDamaged` (2) y `treeRiskDetected` (3).

`requiresPublicWorks = true` es la señal de que el daño les corresponde a ustedes. `treeRiskDetected` solo se dispara con `riskLevel` en `HIGH` o `CRITICAL`.

✅ **Nuestro `requestId` ya viaja como `sourceRequestId`** en `workOrderScheduled` y `workOrderCompleted`. Confirmado por M3. Era nuestro pedido — queda cerrado.

✅ **Cierre del 5 oct 2026:** `workOrderCompleted` lleva `outcome` (texto libre) y `attachments[]` con la forma de adjunto de M2 (`{fileName, contentType, url, sizeBytes?}`); `evidence` queda descartado. `containerDamaged` y `treeRiskDetected` son avisos sin respuesta: no deben emitir `workOrderCompleted` hacia nosotros.

## 1.4 Para M4 — Habilitaciones

Un evento: `environmentalViolationDetected` (4).

- **`establishmentId` es obligatorio y viaja siempre** (el formato del identificador es de M4: los ejemplos usan `EST-004512`, a confirmar con ellos). Intimar, clausurar y multar se le aplican a un comercio habilitado; un acta sin establecimiento no les serviría, así que esas las cerramos nosotros y no se las mandamos.
- **`suggestedAction` no es vinculante.** La decisión es de ustedes.
- **`priorNoticeCount`** es la cantidad de actas previas al mismo establecimiento según nuestro histórico: les adelanta la reincidencia.

✅ **`violationId` ya viaja como `sourceViolationId`** en `commercialFineGenerated` y `closureUpdate` — lo pedimos porque sin él no sabíamos cuál de nuestras actas resolvían y el expediente no cerraba nunca. Confirmado en su documento de referencia vigente.

**Aviso de renombre:** su `closureOrdered` y `closureLifted` se fusionaron en un solo evento, `closureUpdate`, con `status: ORDERED | LIFTED`. Lo escuchamos así de nuestro lado.

**`decidedAt` y `externalRef` confirmados el 24/08.** Nos avisaron que los habían sacado del payload y que los reincorporan porque los necesitamos sí o sí.

## 1.5 Para M7 — Tránsito

Un solo evento: `streetClosureRequested` (6). M7 confirmó que es lo único que consume de nosotros, así que desde el 21/10 no les enviamos `urbanServiceScheduled` ni `treePruningScheduled`, y `treeRiskDetected` va solo a M3.

Es el que dispara acción, con el esquema unificado que propusieron y aceptamos el 30/08 — mismo payload que la solicitud que les manda M3. `sourceModule` viene en `M6`, que es el campo que ustedes mismos pidieron. `sourceRef` apunta al servicio o a la poda que origina el corte. Cuando un servicio o una poda necesita cortar la calle, la solicitud se pide siempre con este evento.

✅ **Pedido cerrado: ya devuelven el origen de la solicitud, en las tres respuestas.** Publicaron el payload completo de las tres respuestas de corte: `closureRequestId` (nuestro `closureRequestId`, de ida y vuelta) y `requestingModule` (valores `"Obras"` / `"Ambiente"` — nosotros somos `"Ambiente"`) viajan en `streetClosureApproved`, `streetClosureRejected` **y, desde el 30/08, también en `streetClosureEnded`**, que hasta entonces era la excepción. Era el pedido de prioridad alta.

✅ **Typo corregido.** El documento escribe `streetClosureEnded` bien; el pedido de prioridad media queda cerrado.

---

# Parte 2 — Lo que consumimos

Estos son **todos** los eventos que escuchamos. No consumimos nada más: si su módulo publica algo que no está en esta lista, no lo estamos leyendo.

| Evento | De quién | Qué hacemos con él |
|---|---|---|
| `ticketUpdated` | **M2** | Único evento suyo que escuchamos. `ROUTED` nos abre el expediente; el resto lo hace avanzar |
| `workOrderScheduled` | **M3** | Pasamos la solicitud de reparación a `IN_PROGRESS` |
| `workOrderCompleted` | **M3** | Cerramos la solicitud de reparación |
| `commercialFineGenerated` | **M4** | Registramos la resolución del acta, pasamos a `SANCTIONED` y cerramos |
| `closureUpdate` (`status: ORDERED`) | **M4** | Ídem, con la clausura como resolución |
| `closureUpdate` (`status: LIFTED`) | **M4** | Registramos el levantamiento de la clausura y cerramos el expediente |
| `streetClosureApproved` | **M7** | Habilitamos la ejecución del servicio bloqueado |
| `streetClosureRejected` | **M7** | Reprogramamos o cancelamos el servicio dependiente |
| `streetClosureEnded` | **M7** | Liberamos la dependencia |
| `notificationSent` | **M9** | Registramos el acuse |

Diez eventos, de cinco módulos. **De M1, M5 y M8 no consumimos ningún evento.**

Abajo, módulo por módulo, están los campos sin los cuales el flujo no funciona. **Cualquier campo extra que ya publiquen lo aprovechamos**, pero estos son los que necesitamos sí o sí.

## M1 — Ciudadanos y organizaciones

**No consumimos ningún evento de M1.** Lo que necesitamos son dos consultas, y hoy no hay por dónde hacerlas: su documento del 13/10 define dos eventos de **respuesta** para M6, `citizenInfoDelivered` (por `citizenId`) y `organizationInfoDelivered` (por `cuit`), pero no el pedido que los dispara, y su único endpoint REST es el login. **Les pedimos que definan cómo se piden** (un evento de consulta con su payload, o endpoints REST).

| Consulta | Campos | Para qué |
|---|---|---|
| Ciudadano por `citizenId` | `citizenId`, `fullName`, `documentId`, `phone`, `email`, `address { street, number, neighborhoodId }` | Cuando el inspector detecta una infracción de oficio y el infractor es persona física, necesitamos identificarlo para emitir el acta |
| Organización por `organizationId` | `organizationId`, `legalName`, `tradeName`, `taxId`, `status` | Cada cuadrilla guarda el `organizationId` de la cooperativa que la opera. Sin esto no podemos mostrar su nombre en ninguna pantalla |

⚠️ **El de organización llega por `cuit`**, y en su ejemplo vale `3311`: parece el `organizationId`, no un CUIT (el CUIT es `taxId`, `30712345678`). ¿Con cuál se consulta? También mezclan `ACTIVA` (`organizationInfoDelivered`) y `ACTIVE` (`organizationRegistered`) para el mismo estado.

**Decisión que les avisamos:** el acta de constatación ambiental **no** va al expediente digital. Reciben actuaciones de M4, M5, M7 y M8, y podría llamar la atención que de nosotros no reciban nada. Es a propósito: el acta la derivamos a M4, que decide la sanción y sí les reporta el resultado. El hecho les llega igual, por un solo camino, en lugar de entrarles dos veces. Si prefieren tener también la constatación original, avísennos y les publicamos `environmentalViolationDetected`.

## M2 — Atención ciudadana

Leímos el contrato completo, ahora en su **v1.78** (WIP; en lo que usamos solo cambió lo que se detalla más abajo). **Adoptamos su modelo sin pedir eventos nuevos ni cambios de forma**, y entre la v1.5 y la v1.6 resolvieron por su cuenta cuatro de los pedidos que teníamos anotados abajo. De sus dos eventos publicados escuchamos uno solo:

| Evento | Qué hacemos con él |
|---|---|
| `ticketUpdated` | El único. Según el `updateType` nos abre el expediente o lo hace avanzar |
| `ticketCreated` | **No lo consumimos.** Va hacia M1 y lleva los datos mínimos del registro del ciudadano. Nada de eso nos sirve para abrir un servicio |

Los `updateType` que nos importan:

| `updateType` | Qué hacemos |
|---|---|
| `ROUTED` | **Abrimos el expediente ambiental o el servicio puntual.** Es nuestro único disparador de entrada. Puede llegar **más de una vez** para el mismo `ticketId` (reclasificación tras un `RETURNED`): con otro `eventId` es una re-derivación real y **reactivamos el expediente que habíamos devuelto** en lugar de abrir otro; con el mismo `eventId` es un reintento y se descarta. Si el ticket se reasignó a **otra área**, el `ROUTED` llega igual (es un broadcast): cerramos nuestro expediente devuelto, sin guardar nada del contenido |
| `INFORMATION_PROVIDED` | Sumamos al expediente lo que el vecino respondió. No usa ID: como máximo hay una solicitud activa por ticket. **Con `purpose = "RECLASSIFICATION"` lo ignoramos**, aunque `responsibleAreaId` sea M6: es un trámite administrativo entre M2 y M1 |
| `CANCELLED` | Cancelamos el servicio o la inspección ya programados. Si M2 cancela administrativamente un ticket que habíamos devuelto, cerramos el expediente; si el expediente está en revisión, pasa a desestimado (`DISMISSED`). En ambos casos cierra la solicitud de información pendiente, aunque el evento no traiga `currentStatus` |
| `REOPENED` | Reabrimos: el vecino rechazó la solución y vuelve a gestión |
| `PRIORITY_CHANGED` | Reordenamos la cola de la cuadrilla |
| `ESCALATION_CHANGED` | Lo marcamos como escalado y se lo mostramos al supervisor |

`STATUS_CHANGED`, `RESOLVED` y `CLOSED` no cambian el estado del expediente: el cierre lo originamos nosotros. Guardamos su `currentStatus` y, si hay una solicitud de información pendiente y ese estado no es `PENDING_INFORMATION`, la damos por cerrada (ver más arriba). `INFORMATION_REQUIRED` de M2 tampoco hace nada: es un pedido entre M2 y el vecino.

**Orden.** Los `ticketUpdated` de un mismo ticket se ordenan por **`data.updatedAt`** (cuándo M2 persistió el cambio); el `occurredAt` del sobre, que puede ser posterior si se demoró la publicación, queda solo de respaldo. Los timestamps sirven para descartar un evento viejo que llega tarde, no para decidir el estado del ticket (eso lo define el `currentStatus` de M2), y no se comparan con los de otro productor.

**Broadcast.** `ticketUpdated` llega a todos los módulos. Los de un ticket cuyo `responsibleAreaId` no es M6 se ignoran y no se persiste su contenido de negocio; la única excepción es cerrar nuestro expediente devuelto cuando el ticket pasa a otra área, y para eso usamos solo `ticketId` y `responsibleAreaId`.

**Campos que necesitamos de `ticketUpdated / ROUTED`** (vigente v1.78):

```
comunes:  ticketId, citizenId (UUID, null si isAnonymous), isAnonymous,
          responsibleAreaId, updateType, currentStatus, currentPriority,
          progress?, publicMessage?, attachments[]?, updatedAt
details.routing:  requestType (string), category, subcategory, ticketType,
                   summary, description, formData?, location?,
                   resolutionDueAt?, escalation?, reassignment?
```

**`currentStatus`.** De todo `ticketUpdated` de un ticket nuestro leemos y guardamos `currentStatus`, también de los `updateType` que no hacen nada más, pero solo si es uno de los nueve estados de la §3 de M2 (`REGISTERED`, `IN_REVIEW`, `ROUTED`, `IN_PROGRESS`, `PENDING_INFORMATION`, `DUPLICATE`, `RESOLVED`, `CLOSED`, `CANCELLED`); cualquier otro valor se ignora con un log. Ese estado decide si al agendar un servicio mandamos `STARTED`, `PROGRESS` o nada.

✅ **Cómo sabemos que un `ROUTED` es nuestro — resuelto desde la v1.5.** `responsibleAreaId` viaja como campo común de todo `ticketUpdated`. Ya no hace falta catálogo de `requestTypeId` ni adivinar entre las ocho áreas.

✅ **`citizenId` — resuelto desde la v1.5, mejor de lo pedido.** Es campo común de todo `ticketUpdated`, no solo de `details` en `ROUTED`. Junto con `isAnonymous`, también común.

⚠️ **La v1.6 devolvió el snapshot a `details.routing`.** `requestType`, `summary`, `description` y `location` habían pasado a campos comunes en la v1.5; la v1.6 los sacó de esa tabla (§7.1) y los dejó solo dentro de `details.routing` (§7.4). Nos adaptamos y leemos las dos formas, pero conviene que quede fijo: es el segundo cambio de lugar de los mismos cuatro campos.

⚠️ **`location` ya no trae coordenadas.** La v1.5 la definía con `latitude`/`longitude`; la v1.6 (§5.4) las quitó y deja `addressLine, street, streetNumber, neighborhoodId, reference`. Georreferenciamos desde la dirección. `neighborhoodId` sigue estando, que es lo que necesitamos para rutear por zona.

⚠️ **`requestType` es un string plano y no hay IDs.** La v1.6 (§5.5) lo serializa como nombre visible y explicita que no expone IDs internos de Category/Subcategory/RequestType. Clasificamos por texto: el mapeo por ID que esperábamos hacer cuando publicaran el catálogo ya no es posible.

✅ **`RESOLVED` directo desde `ROUTED` — resuelto por la v1.6.** §8.2 dice que M2 **no** mantiene una configuración por RequestType para habilitar o impedir la resolución directa, y que `STARTED`/`PROGRESS` son hechos opcionales. Ya no hay catálogo que esperar. Mantenemos igual la costumbre de publicar `STARTED` antes de `RESOLVED` porque refleja el hecho real, no porque haga falta.

✅ **La fecha agendada — resuelta el 20/10.** `progress` sigue siendo un `Int` (porcentaje), pero M2 confirmó que la fecha y la franja agendadas van como **texto en `publicMessage`**: `STARTED` con la programación la primera vez (agendar cuenta como tomar la gestión) y `PROGRESS` para reprogramar (si el ticket ya está `IN_PROGRESS`, siempre `PROGRESS`). No hay campo estructurado y no lo va a haber en esta versión. Está implementado.

⚠️ **`category` y `subcategory`** son obligatorios en `details.routing` desde la v1.77. Los aceptamos pero no los leemos: seguimos clasificando por `requestType` y `summary`. `neighborhoodId` es un UUID.

✅ **Reasignación entre áreas (v1.77).** Tras un `REQUEST_TYPE_MISMATCH` confirmado, `responsibleAreaId` puede cambiar o quedar en la misma, y siempre llega un `ROUTED` a la nueva área con `reassignment = true`. Si sigue siendo M6, reactivamos el expediente; si pasó a otra área, lo cerramos.

✅ **Lo que ya no preguntamos.** `ticketInfoProvided` y `additionalInfoRequired` no desaparecieron: se convirtieron en `ticketUpdated / INFORMATION_PROVIDED` y `updateTicketStatus / INFORMATION_REQUIRED`. La cancelación tampoco se perdió: es `ticketUpdated / CANCELLED`. Y `targetArea` en `ticketCreated` dejó de tener sentido, porque ese evento no es para nosotros. Los enums de `resolution.type`, `returnInfo.reasonCode` y `cancellation.reasonCode`, que antes no estaban enumerados, están publicados desde la v1.5.

## M3 — Obras públicas

| Evento | Campos imprescindibles |
|---|---|
| `workOrderScheduled` | ✅ `sourceRequestId` confirmado |
| `workOrderCompleted` | ✅ `sourceRequestId`, `outcome`, `completedAt` confirmados |

🟡 **Propuesta de M3, pendiente de validación (v0.6 del 20/10).** M3 propone que `workOrderId` sea el **UUID técnico** de la orden y que se agregue `workOrderNumber` **opcional** con la referencia humana (por ejemplo `"OT-2026-0098"`), en `workOrderScheduled` y `workOrderCompleted`, con `sourceRequestId` igual a nuestro `requestId`. **No está acordado:** nos pidieron validar sus schemas, confirmar esos dos campos y correr la prueba `requestId` → `sourceRequestId`. Hoy toleramos cualquier texto en `workOrderId` y no leemos `workOrderNumber`, así que no rompe nada. Ejemplo de M3 para `workOrderScheduled`:

```
sourceRequestId:   4f5a6b7c-8d9e-4f0a-9b1c-d3e4f5a6b7c8
workOrderId:       1bb68ec6-56b2-43a8-956b-6949ac740b8a
workOrderNumber:   OT-2026-0098
estimatedDuration: PT4H
```

`workOrderUpdated` va solo hacia M2 y no lo necesitamos: nuestra solicitud de reparación tiene tres estados —pedida, en curso, cerrada— y con esos dos alcanza.

✅ **`workOrderScheduled` (cerrado el 5 oct 2026).** Pueden dispararlo al abrir la orden o al agendarla: aceptado en ambos casos, sin impacto. Consumimos solo `workOrderScheduled` y `workOrderCompleted` (no `workOrderCreated` ni `workOrderValidated`) y cerramos la solicitud con `workOrderCompleted`.

## M4 — Habilitaciones

| Evento | Campos imprescindibles |
|---|---|
| `commercialFineGenerated` | ✅ `sourceViolationId` · 🟢 `decision`, `decidedAt`, `externalRef` confirmados (24/08) |
| `closureUpdate` (`status: ORDERED | LIFTED`) | ✅ `sourceViolationId` · 🟢 `decision`, `decidedAt`, `externalRef` confirmados (24/08) |

✅ **`sourceViolationId` ya viaja**, en `commercialFineGenerated` y en `closureUpdate`. Era un pedido nuestro — queda cerrado. `establishmentId` es opcional pero lo aprovechamos.

🟢 **`decidedAt` y `externalRef` confirmados el 24/08.** Nos habían dicho que los sacaron del payload; nos avisaron que los reincorporan porque los necesitamos sí o sí. Pendiente de verlos en la próxima versión del documento.

**Aviso de renombre:** `closureOrdered` y `closureLifted` se fusionaron en `closureUpdate` con `status: ORDERED | LIFTED`.

✅ **`commercialFineGenerated` también nos llega.** M4 confirmó el 21 de octubre que lo recibimos además de Rentas cuando la multa nace de una infracción ambiental, y `closureUpdate` cuando corresponda; estamos suscriptos a ambos en el Core.

**Decisión que les avisamos: no les pedimos un evento de desestimación.** El caso "M4 decide que no corresponde castigo" no dispara ningún evento, ni siquiera `closureUpdate / LIFTED`. Lo resolvemos de nuestro lado cerrando el expediente por vencimiento de un plazo configurable. Una dependencia menos.

**Lo que les pedimos por REST:** búsqueda de establecimiento por dirección, CUIT o barrio. Como el acta no se deriva sin `establishmentId`, es lo que nos permite completarla antes de emitirla.

## M5 — Rentas

**Sin integración directa.** No publicamos nada hacia ustedes ni consumimos nada de ustedes.

Lo único que puede interesarles: cuando constatamos una infracción ambiental emitimos un acta pero **no generamos el cargo económico**. El acta va a M4, que decide la sanción y publica `commercialFineGenerated`, que ustedes sí consumen. **Una multa comercial que les llegue puede tener origen en una constatación ambiental nuestra.**

## M7 — Tránsito ✅ Contrato confirmado, actualizado 30/08

| Evento | Campos imprescindibles |
|---|---|
| `streetClosureApproved` | ✅ `streetClosureId`, `closureRequestId`, `requestingModule`, `startDate`, `endDate` |
| `streetClosureRejected` | ✅ `closureRequestId`, `rejectionReason`, `requestingModule` |
| `streetClosureEnded` | ✅ `streetClosureId`, `closureRequestId`, `completionDateTime`, `notes` |

Payloads reales, del documento de referencia que publicó M7:
```
streetClosureApproved
  streetClosureId, closureRequestId, requestingModule ("ambiente" para nosotros),
  startDate, endDate, affectedStreet[],
  detours[ { street, alternateRoute } ], conditions[]

streetClosureRejected
  closureRequestId, rejectionReason, requestingModule ("ambiente" para nosotros)

streetClosureEnded
  streetClosureId, closureRequestId, completionDateTime, notes
```

✅ **Ya no es el diseño tentativo `sourceRequestId`/`sourceModule`/`from`/`to`.** Los nombres reales son `closureRequestId`, `requestingModule` (para nosotros, `"ambiente"` en minúscula, confirmado por M7 el 20/10) y `startDate`/`endDate`.

✅ **`streetClosureEnded` ya correlaciona por sí solo (30/08).** Hasta el 25/08 no traía `closureRequestId` y había que persistir `streetClosureId` desde el `streetClosureApproved` anterior para poder cerrar la dependencia. El documento de referencia nuevo ya lo incluye directamente.

✅ **Typo corregido.** El documento ya escribe `streetClosureEnded` bien, sin la `u` de más.

🆕 **Corte aprobado que vence sin aviso (20/10).** Guardamos `startDate` y `endDate` de `streetClosureApproved` como la ventana autorizada. Como no hay un evento para un corte que expira sin terminar, a partir de las 6 horas del `endDate` sin recibir `streetClosureEnded` lo pasamos a un estado nuevo, `EXPIRED`; si el servicio que dependía de ese corte seguía agendado, queda para reprogramar. No publicamos nada hacia ustedes. Solo vence un corte que llegó en un `streetClosureApproved` con un `endDate` legible: sin `endDate`, nunca vence. Una intervención de arbolado asociada al corte no se toca, y un servicio ya iniciado o cerrado tampoco: solo uno todavía agendado pasa a reprogramar. Si después llega un `streetClosureEnded` de ese corte, lo aceptamos. Supuesto nuestro: **M7, confirmen** que una expiración sin `streetClosureEnded` es un caso posible y que esta lectura les sirve.

✅ **Nuevo (30/08): `streetClosureRequested` unificado con M3.** Hasta ahora M7 recibía este evento con forma distinta según el origen (la nuestra y la de Obras). Propusieron un esquema único — ver §1.5 — y lo aceptamos: de nuestro lado implica renombrar `requestId→closureRequestId`, `streets[]→affectedSections` y `from`/`to`→`requestedFrom`/`requestedTo`.

## M8 — Desarrollo social

**Sin integración prevista**, y su lista lo confirma. Aclaración por si aparece la duda: las cooperativas existen en nuestro módulo como **cuadrillas de trabajo**, no como beneficiarias de un programa. Su registro como organización es de M1.

## M9 — Core

| Evento | Campos imprescindibles |
|---|---|
| `notificationSent` | `notificationId`, `channel`, `sentAt`, `sourceRef` |

⚠️ **Puede que terminemos sacándolo.** Nadie publica hoy algo que dispare una notificación, y M7 menciona un `notificationRequest` de M2 que ningún otro módulo declaró. Si resulta que solo M2 puede pedir notificaciones, estaríamos recibiendo acuses de mensajes que nunca pedimos y lo damos de baja.

M9 respondió el 20/10 que `notificationSent` **no existe en su catálogo**: ningún módulo lo declara ni lo escucha. El enunciado del TPO (§9 y §6) pone las notificaciones en el Core y lista `NotificacionEnviada` entre los eventos que consumimos, así que **no lo sacamos todavía**: pedimos que lo publiquen o que se retire de todos los módulos.

**Lo que consultamos por REST:** el catálogo de barrios (`GET /api/v1/catalogos/barrios`; M9 reconoció el 22 de octubre que es suyo, con datos ficticios hasta que carguen los barrios reales). Está en adopción.

---

# Parte 3 — Incongruencias

## 3.1 Las que nos afectan

| # | Qué pasa | Con quién |
|---|---|---|
| 1 | **M2 publicó su contrato (ahora v1.78, WIP) y ningún otro módulo está escrito contra él.** M4, M5 y M8 siguen publicando `ticketInProgress`, `ticketUpdate`, `ticketCompleted` y `ticketRejected`, que M2 no consume: lo suyo va por `updateTicketStatus` con `updateType`. Y los seis eventos de ciclo de vida que M1, M3, M5, M7 y M8 esperan son hoy variantes de `ticketUpdated`, no eventos. **Los cinco tienen que releer el contrato**. El documento de M1 del 13/10 ya no lista esos eventos, pero sus ejemplos de `updateTicketStatus` de M2 (`COMPLETED`, `UPDATED`, `ADDITIONAL_INFO_REQUIRED`, `statusChangedAt`, `AREA_USER`) son del contrato viejo | M1, M3, M4, M5, M8 |
| 2 | ✅ **`commercialFineGenerated`:** M4 confirmó el 21/10 que también nos lo rutean (y `closureUpdate` cuando corresponda); estamos suscriptos a ambos | M4 |
| 3 | **M4 declara consumir `updateTicketStatus`.** Es el canal de entrada de M2 desde las áreas operativas: ningún otro módulo tendría que escucharlo | M4 |
| 4 | ~~**`workOrderScheduled` reemplazó a `workOrderCreated`**~~ ✅ Cerrado el 5 oct 2026: se dispare al abrir o al agendar, no nos cambia nada | M3 |
| 5 | ✅ **Cerrado el 7 oct 2026: el sobre vigente es el del Core.** M2 había definido `specVersion`, `eventId`, `eventType`, `eventVersion`, `occurredAt`, `producer`, `subject` y `data`; M9 publicó el suyo (`eventId`, `eventType`, `eventVersion`, `occurredAt`, `sourceModule`, `correlationId?`, `causationId?`, `data`) para toda la cohorte y el de M2 queda reemplazado, también para M2 | M9, toda la cohorte |
| 6 | **Los adjuntos se llaman distinto.** M2 usa `attachment { fileName, contentType, url, sizeBytes? }` (sin `attachmentId` desde la v1.6); nosotros veníamos con `{ url, mimeType, description }`. Nos alineamos al suyo en lo que va hacia M2, pero conviene unificarlo en toda la cohorte antes de implementar | toda la cohorte |

### Lo que M3 ya resolvió

Su lista actualizada cerró tres cosas de un saque:

- **Borraron `urbanRiskDetected` y `urbanServiceRepairRequested`**, que eran los nombres del enunciado para eventos que nosotros renombramos. Ahora consumen exactamente nuestros tres: `infrastructureRepairRequested`, `containerDamaged` y `treeRiskDetected`.
- **Adoptaron el vocabulario de corte de calle de M7**: `streetClosureApproved`, `streetClosureRejected` y `streetClosureEnded`. Antes usaban `streetClosureAuthorized` / `Activated` / `Finished`, que M7 no publica.
- **Bajaron los `publicWorksProject*` de doce a dos.**

Con M3 no queda ninguna pregunta abierta (cierre del 5 oct 2026).

## 3.2 Las que no nos afectan pero van a romper el ruteo

Un huérfano es un evento que alguien espera y nadie publica. Esta lista se achicó con la actualización de M3, pero sigue siendo larga.

| Evento | Lo espera | Lo publica | Qué pasa |
|---|---|---|---|
| `paymentRegistered`, `debtSettled` | M4, M7 | **nadie** | M5 los publica como `paymentRecorded` y `debtCancelled`. **Rompe el cierre financiero de infracciones y habilitaciones** |
| `caseFileResolved` | M3, M7 | ~~nadie~~ **M1**, con otro nombre | M1 lo publica ahora (documento del 13/10) como `casefileResolved`, con la `f` minúscula, y lo muestra solo para M3. Es el mismo problema de siempre, esta vez de mayúsculas: no le llega a nadie hasta que se alinee el nombre |
| `registeredCitizen`, `registeredOrganization` | M5 | ~~nadie~~ **M1**, con otros nombres | M1 publica ahora `citizenUpdated` (con `updateType: REGISTERED`) para M2 y M5, y `organizationRegistered`. M5 sigue esperando los nombres viejos |
| `enablingFeeGenerated`, `enablingSuspended` | M5 | **nadie** | Alias viejos de `permitFeeGenerated` y `permitSuspended`. M5 ya consume el primero por duplicado bajo los dos nombres |
| `licenseRequestInitiated`, `licenseApproved` | M1 | **nadie** | M4 usa `permitApplicationStarted` y `permitApproved`. M1 tiene los dos vocabularios en su misma lista |
| `constructionApproved` | M1 | **nadie** | M3 lo llama `publicWorksProjectApproved` |
| `workScheduled`, `workFinished` | M7 | **nadie** | M3 **ya los publica hacia M7** como `workOrderScheduled` y `workOrderCompleted`. Solo falta que M7 los renombre en su lista |
| `roadAccidentRegistered` | M3 | ~~nadie~~ **M7** | ✅ **Resuelto (25/08).** M7 publicó el payload completo en su documento de referencia. M3 antes lo llamaba `trafficIncidentRegistered`: cambió el nombre, no el problema, y ahora el evento existe |
| `ticketRouted`, `ticketEscalated`, `ticketResolved`, `ticketClosed`, `ticketReopened`, `ticketCancelled`, `ticketInfoProvided` | M1, M3, M5, M7, M8 | **nadie** | **Es el huérfano más grande de la cohorte, y ahora tiene solución escrita.** Los siete existen en el contrato v1.2 de M2, pero como `updateType` de `ticketUpdated`, no como eventos: `ROUTED`, `ESCALATION_CHANGED`, `RESOLVED`, `CLOSED`, `REOPENED`, `CANCELLED`, `INFORMATION_PROVIDED`. No hay que pedir nada, hay que suscribirse a `ticketUpdated` y ramificar |
| `publicWorksProjectApproved`, `publicWorksProjectCompleted` | **nadie** | M3 | M3 los dirige a M1, que consume `constructionApproved`. Eran doce, quedaron dos |
| Todo lo de M8 hacia M2 | **nadie** | M8 | M2 no consume nada de M8 |
| `workOrderScheduled`, `workOrderCompleted`, `workOrderUpdated` hacia M2 | **nadie** | M3 | M2 no consume nada de M3 |
| `additionalInfoRequired` | **nadie** | M1 | El contrato de M2 lo reemplazó por `updateTicketStatus / INFORMATION_REQUIRED`. El documento de M1 del 13/10 ya no lo lista como evento, pero sus ejemplos todavía usan `ADDITIONAL_INFO_REQUIRED`, que no existe en la v1.78 |
| `representationExpired`, `citizenBlocked`, `citizenDeceased` | **nadie** | M1 | `citizenBlocked` y `citizenDeceased` ya no son eventos: son `citizenUpdated` con `updateType: BLOCKED` o `DECEASED`, que M1 manda a M2 y M5. `representationExpired` sigue publicado sin consumidor declarado. Conviene confirmarlo |
| `eventProcessingFailed`, `eventRejected` | **nadie** | todos | ✅ **Dados de baja el 20/10:** eran del Core, nunca circuló ninguno y M9 los saca del catálogo. Lo que falló se consulta en `GET /api/v1/dlq` y `/dlq/{id}/audit`, y el estado de cada entrega en `GET /api/v1/events/{eventId}` |

## 3.3 Un riesgo en el bloque común

✅ **Resuelto el 20/10.** Habíamos advertido que `eventProcessingFailed` podía generar una tormenta de eventos técnicos. M9 confirmó que `eventProcessingFailed` y `eventRejected` son del propio Core, que nunca circuló ninguno y que los da de baja del catálogo: la DLQ (`GET /api/v1/dlq`), su auditoría (`/dlq/{id}/audit`) y el estado de cada evento (`/events/{eventId}`) ya cubren ese papel. M6 no los publica ni los consume; si alguien los tenía declarados, que los saque.


---

## Historial de versiones

El número de versión es del **documento** (no confundir con la `eventVersion` de los mensajes ni con las versiones del contrato de M2, como la v1.78). El Acuerdo y los Sobres comparten número porque viajan juntos. **Mayor** cuando cambia el contrato y los demás módulos tienen que hacer algo; **menor** para aclaraciones o confirmaciones. La numeración se puso el 22 de octubre de 2026: las ediciones anteriores se numeraron después, a partir del historial.

| Versión | Fecha | Qué cambió |
|---|---|---|
| **2.1** | 22 de octubre de 2026 | Confirmaciones de M2 (el pedido de información que vence cancela el ticket; `STARTED` solo desde `ROUTED`), de M4 (nos rutean `commercialFineGenerated`; `actId` y `externalRef` son distintos) y de M9 (el catálogo de barrios es del Core y ya está publicado). Sin cambios de contrato |
| **2.0** | 21 de octubre de 2026 | Publicamos **seis** eventos: `urbanServiceScheduled` y `treePruningScheduled` dejan de emitirse (M7 solo consume `streetClosureRequested`). Emitimos `INFORMATION_REQUIRED`. Baja de los eventos técnicos. Cadena de reintentos de la guía común del Core |
| **1.0** | 13 de octubre de 2026 | Primera edición con el sobre del Core y el anexo de Sobres (M2 v1.75) |
