# Acuerdo de Eventos — Módulo 6

**Ambiente, Higiene y Servicios Urbanos · Grupo 04**

Este documento sirve para cerrar el contrato de eventos antes de empezar a programar. Tiene tres partes y les pedimos tres cosas distintas:

| Parte | Qué contiene | Qué les pedimos |
|---|---|---|
| **1** | Los 8 eventos que publicamos, con su estructura y todos sus campos | **Confírmennos que los consumen.** Están agrupados por destinatario |
| **2** | Los eventos suyos que consumimos | **Devuélvannos el payload**, con los campos que les marcamos como imprescindibles |
| **3** | Las incongruencias que encontramos en la lista común | **Respondan las que les tocan** |

Notación: `?` es campo opcional o que puede venir en nulo, `[]` es lista. Todos los nombres van en **camelCase**, que es lo que usa la recopilación de la cohorte.

---

# Parte 1 — Lo que publicamos

Ocho eventos, **todos con consumidor declarado**. No publicamos nada que nadie escuche.

| Evento | Va a | Se dispara cuando |
|---|---|---|
| `updateTicketStatus` | **M2** | Cambia el estado de algo nacido de un reclamo |
| `urbanServiceScheduled` | **M7** | Se agenda un servicio |
| `containerDamaged` | **M3** | Se detecta un contenedor dañado o faltante |
| `treeRiskDetected` | **M3**, **M7** | Un relevamiento arroja riesgo `HIGH` o `CRITICAL` |
| `treePruningScheduled` | **M7** | Se programa una poda |
| `environmentalViolationDetected` | **M4** | Se emite un acta ambiental |
| `infrastructureRepairRequested` | **M3** | Detectamos un daño de infraestructura ajeno |
| `streetClosureRequested` | **M7** | Un servicio o intervención requiere cortar la calle |

> **Eran quince y quedaron ocho: la decisión y el porqué.** Cuando M2 confirmó que todo lo suyo va por `updateTicketStatus`, siete eventos de dominio —`urbanServiceStarted`, `urbanServiceDelayed`, `urbanServiceCompleted`, `zoneNotServiced`, `containerOverflowed`, `environmentalInspectionScheduled` y `environmentalInspectionCompleted`— se quedaron sin ningún consumidor.
>
> **Los sacamos del contrato.** Los hechos siguen existiendo en nuestro modelo y son los que disparan cada `updateTicketStatus`, pero **no los publicamos al bus**: un cambio de estado interno se escribe en nuestra base, no se anuncia. Publicar un evento cuesta schema, publisher, test y documentación, y no íbamos a pagarlo por siete suscripciones que no existen. Si alguno les hace falta, pídanlo y lo publicamos: el payload ya está diseñado.

---

## 1.1 Los ocho payloads

Cada evento con sus campos, y abajo de cada uno los valores que puede tomar cada campo cerrado. `?` es opcional, `[]` es lista, `{ }` es un objeto anidado.

**Objetos que se repiten en varios eventos:**

```
location       { street, number?, neighborhoodId, lat?, lng? }
timeWindow     { from, to }                     horas HH:mm
attachments[]  { url, mimeType, description? }
evidence[]     { url, mimeType, description? }
```

**Quién genera cada identificador:**

```
Nuestros:     serviceId, inspectionId, reportId, violationId, requestId,
              interventionId, containerId, treeId, zoneId, crewId, vehicleId
De M2:        ticketId
De M4:        establishmentId
De M9:        neighborhoodId
De M1:        citizenId, organizationId
```

Los campos que terminan en `At` son **fecha y hora**; `scheduledDate` es solo el día y la franja la da `timeWindow`. El formato exacto lo define M9 en el sobre común.

---

**1. `updateTicketStatus` → M2** · *el payload lo define M2 en su contrato v1.5*

```
ticketId, updateType,
publicMessage?, internalMessage?, progress?, details?,
attachments[]?, updatedBy, statusChangedAt

updateType: STARTED | PROGRESS | INFORMATION_REQUIRED |
            RETURNED | RESOLVED | REJECTED
updatedBy:  { type: AREA_USER, id }
```

No lleva `status`: informamos el hecho y **M2 decide el estado**. Tampoco lleva `sourceRef` — su contrato prohíbe mandarles IDs de nuestras entidades internas, así que la correlación `ticketId ↔ serviceId` la guardamos de nuestro lado. `publicId` y `expectedTicketVersion` salieron del contrato en la v1.5: la correlación es solo por `ticketId`. El detalle de cada variante está en 1.2.

**2. `urbanServiceScheduled` → M7**

```
serviceId, serviceTypeCode, category, mode,
zoneIds[], routeId?, targetRef?,
scheduledDate, timeWindow { from, to },
crewId?, vehicleId?, origin, ticketId?

mode:   ROUTE | POINT
origin: SCHEDULED | TICKET | INSPECTION | INTERNAL
```

**3. `containerDamaged` → M3**

```
containerId, containerCode, zoneId, location,
damageType, severity, requiresPublicWorks, detectedAt, ticketId?

severity:            LOW | MEDIUM | HIGH | CRITICAL
requiresPublicWorks: booleano — en true, el arreglo le corresponde a M3
damageType:          sale de nuestro catálogo, viaja como texto
```

**4. `treeRiskDetected` → M3, M7**

```
treeId, surveyCode, species, zoneId, location,
riskLevel, riskType, healthStatus, suggestedIntervention,
requiresStreetClosure, requiresPublicWorks, surveyedAt

riskLevel:             LOW | MEDIUM | HIGH | CRITICAL
                       (el evento solo se publica con HIGH o CRITICAL)
healthStatus:          HEALTHY | DECLINING | DEAD
suggestedIntervention: PRUNING | FELLING | TREATMENT | MONITORING
requiresStreetClosure: booleano
requiresPublicWorks:   booleano
```

**5. `treePruningScheduled` → M7**

```
interventionId, serviceId, interventionType, treeIds[], zoneId, location,
scheduledDate, timeWindow { from, to }, crewId, requiresStreetClosure

interventionType:      PRUNING | FELLING | PLANTING | TREATMENT
requiresStreetClosure: booleano — en true, después les llega la solicitud de corte
```

**6. `environmentalViolationDetected` → M4**

```
violationId, noticeNumber, issuedAt,
reportId, inspectionId, ticketId?,
violationType, severity, location,
establishmentId,
priorNoticeCount,
evidence[], suggestedAction

severity:         LOW | MEDIUM | HIGH | CRITICAL
suggestedAction:  WARNING | FINE | CLOSURE — no es vinculante
priorNoticeCount: entero, actas previas al mismo establecimiento
violationType:    sale de nuestro catálogo, viaja como texto
```

**7. `infrastructureRepairRequested` → M3**

```
requestId, damageType, severity, location,
detectedIn, ticketId?, publicSafetyRisk, requestedAt

severity:         LOW | MEDIUM | HIGH | CRITICAL
publicSafetyRisk: booleano
detectedIn:       nuestro serviceId o inspectionId que originó la detección
```

**8. `streetClosureRequested` → M7** · *esquema unificado con la solicitud de M3 (30/08)*

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

Leímos el contrato, ahora en su **v1.5** (reemplazó la v1.2 sobre la que habíamos escrito esto), y **adoptamos su payload tal cual**. No pedimos campos nuevos ni proponemos alternativas: nos adaptamos a lo que ya definieron.

```
ticketId, updateType,
publicMessage?, internalMessage?, progress?, details?,
attachments[]?, updatedBy, statusChangedAt
```

🔄 **Cambió respecto de la v1.2:** `publicId` y `expectedTicketVersion` salieron del contrato (nunca fueron parte del canal máquina-a-máquina); `message` se partió en `publicMessage`/`internalMessage`; `updatedAt` se renombró a `statusChangedAt`; y `progress` pasó a ser un campo común de tipo `Int` (porcentaje), no el objeto `progress.estimatedCompletionAt` que usábamos para la fecha agendada — ver más abajo.

Tres cosas que nos cambian la implementación y conviene dejar dichas:

- **No mandamos el estado, mandamos el hecho.** `updateType` dice qué pasó y M2 decide la transición. Nuestro modelo no vuelve a nombrar estados de M2 en ningún lado.
- **No hace falta guardar `publicId` ni `ticketVersion`.** La v1.5 confirmó que la correlación es solo por `ticketId`; no hay versión que devolver.
- **No mandamos `sourceRef`.** Su contrato prohíbe transportar IDs de entidades internas de otros módulos, así que la correlación `ticketId ↔ serviceId ↔ inspectionId` queda en una tabla nuestra.

### De qué hecho nuestro sale cada `updateType`

Esta es la tabla con la que lo implementamos. La columna izquierda son **hechos internos de nuestro modelo**, no eventos publicados: salvo `urbanServiceScheduled`, ninguno sale al bus. Cuando ocurre el hecho, publicamos el `updateTicketStatus` que le corresponde.

| Hecho nuestro | `updateType` | Qué mandamos |
|---|---|---|
| `urbanServiceScheduled` | `PROGRESS` | fecha y franja agendadas — **sin campo definido en la v1.5, ver pedido nuevo abajo** |
| `urbanServiceStarted` | `STARTED` | vacío; `publicMessage` para el vecino |
| `urbanServiceDelayed` | `PROGRESS` | nueva estimación y motivo en `publicMessage`/`internalMessage` — la fecha en sí sigue sin campo definido |
| `urbanServiceCompleted` | `RESOLVED` | `details.resolution.type` + `publicMessage`, y la foto del trabajo en `attachments[]` |
| `environmentalInspectionScheduled` | `STARTED` | vacío |
| `environmentalInspectionCompleted`, sin irregularidad | `RESOLVED` | `details.resolution.type` + `publicMessage`: "no se encontraron irregularidades" |
| `environmentalInspectionCompleted`, con acta | `PROGRESS` | el caso sigue en M4. Nunca el contenido del acta |
| Se desestima el reporte | `REJECTED` | `details.cancellation.reasonCode` + motivo en `publicMessage`/`internalMessage` |
| El reclamo no es de nuestra área | `RETURNED` | `details.returnInfo.reasonCode`. Vuelve a M2 para que lo re-derive, en vez de cancelárselo al vecino |
| El inspector necesita un dato del vecino | `INFORMATION_REQUIRED` | `details.informationRequest.messageForCitizen` (+ `requiredBy` opcional) |

Los enums de `resolution.type`, `returnInfo.reasonCode` y `cancellation.reasonCode` ya están publicados en la v1.5 (antes no estaban enumerados) — están detallados en la ficha [M6-para-M2.md](M6-por-modulo/M6-para-M2.md).

Los otros dos no tienen una traducción directa, y conviene que quede escrito por qué:

- **`zoneNotServiced` no es un reclamo, es una zona.** Cuando un recorrido deja una zona sin atender no hay un `ticketId`, hay *n*. Lo que sale hacia M2 es **un `updateTicketStatus` con `PROGRESS` por cada reclamo abierto de esa zona**: el abanico lo abrimos nosotros, a partir de un hecho que del lado de M2 no tiene forma de representarse entero.
- **`containerOverflowed` depende del origen.** Si el desborde lo reportó un vecino, hay `ticketId` y sale el `updateTicketStatus`. Si lo detectamos nosotros en la recorrida, no hay reclamo al que contestarle y hacia M2 no sale nada.

### Lo que el contrato nos resolvió

Tres cosas que teníamos anotadas como problema dejaron de serlo:

- **`detail` ya no es todo el canal.** Era nuestra objeción principal: el vecino iba a ver solo prosa. Con `resolution.type` el cierre tiene un texto propio en `publicMessage` y con `attachments[]` podemos mandar la foto del trabajo terminado. Lo único que sigue sin resolver es la **fecha agendada**: el campo común `progress` de la v1.5 es un `Int` (porcentaje), no una fecha, y no hay estructura de `details` definida para `STARTED`/`PROGRESS`. Lo dejamos como pedido nuevo.
- **Podemos pedirle información al ciudadano.** `INFORMATION_REQUIRED` era el canal que dábamos por perdido cuando desapareció `additionalInfoRequired`. No desapareció: se convirtió en una variante. El inspector que necesita una referencia más precisa o una foto nocturna ya tiene por dónde pedirla. La v1.5 ya no correlaciona por `informationRequestId` (ese campo nunca llegó a existir formalmente): la respuesta siempre corresponde a la única solicitud activa que puede haber por ticket.
- **`RETURNED` es mejor que rechazar.** Cuando un reclamo no es nuestro, devolverlo a M2 para que lo re-derive es distinto de cancelárselo al vecino. Antes teníamos un solo `REJECTED` para las dos cosas.

### Lo que se cae

Los diez eventos de dominio que les ofrecíamos como detalle **ya no se los mandamos**. Tres siguen publicados porque los consumen M3 y M7; los otros siete se quedaron sin ningún consumidor y los sacamos del contrato.

### Los siete que sacamos del contrato

Estos hechos existen en nuestro modelo y son los que disparan cada `updateTicketStatus`, pero **dejamos de publicarlos**: `urbanServiceStarted`, `urbanServiceDelayed`, `urbanServiceCompleted`, `zoneNotServiced`, `containerOverflowed`, `environmentalInspectionScheduled` y `environmentalInspectionCompleted`.

Los teníamos en el contrato porque se los ofrecíamos a M2 como detalle de lo que pasaba con el reclamo. Cuando M2 definió que todo lo suyo entra por `updateTicketStatus`, se quedaron sin ningún consumidor, y un evento que nadie escucha no es parte de un contrato de integración: es código que hay que escribir, versionar y mantener para nadie.

**El dato no se pierde, salvo la fecha agendada.** Su contrato hace viajar el cierre como `resolution.type` + `publicMessage` y la evidencia como `attachments[]`. Lo que queda afuera son nuestros identificadores internos, que el propio contrato de M2 prohíbe transportar — y, por ahora, la fecha/franja agendada del servicio, que no tiene campo definido (ver pedido nuevo en la ficha de M2).

Si alguno les hace falta —M9 para un tablero de cumplimiento de recorridos, o M2 si más adelante quiere la franja horaria completa— **pídanlo y lo publicamos**. El payload ya está diseñado; lo que no hacemos es publicarlo por las dudas.

## 1.3 Para M3 — Obras públicas

Tres eventos, y ya confirmaron que los consumen los tres: `infrastructureRepairRequested` (7), `containerDamaged` (3) y `treeRiskDetected` (4).

`requiresPublicWorks = true` es la señal de que el daño les corresponde a ustedes. `treeRiskDetected` solo se dispara con `riskLevel` en `HIGH` o `CRITICAL`.

✅ **Nuestro `requestId` ya viaja como `sourceRequestId`** en `workOrderScheduled` y `workOrderCompleted`. Confirmado por M3. Era nuestro pedido — queda cerrado.

🟡 **Nombre a confirmar:** `workOrderCompleted` trae `evidence`, y nuestro diseño tentativo esperaba `attachments[]`. Probablemente sea el mismo dato con otro nombre.

## 1.4 Para M4 — Habilitaciones

Un evento: `environmentalViolationDetected` (6).

- **`establishmentId` es obligatorio y viaja siempre.** Intimar, clausurar y multar se le aplican a un comercio habilitado; un acta sin establecimiento no les serviría, así que esas las cerramos nosotros y no se las mandamos.
- **`suggestedAction` no es vinculante.** La decisión es de ustedes.
- **`priorNoticeCount`** es la cantidad de actas previas al mismo establecimiento según nuestro histórico: les adelanta la reincidencia.

✅ **`violationId` ya viaja como `sourceViolationId`** en `commercialFineGenerated` y `closureUpdate` — lo pedimos porque sin él no sabíamos cuál de nuestras actas resolvían y el expediente no cerraba nunca. Confirmado en su documento de referencia vigente.

**Aviso de renombre:** su `closureOrdered` y `closureLifted` se fusionaron en un solo evento, `closureUpdate`, con `status: ORDERED | LIFTED`. Lo escuchamos así de nuestro lado.

**`decidedAt` y `externalRef` confirmados el 24/08.** Nos avisaron que los habían sacado del payload y que los reincorporan porque los necesitamos sí o sí.

## 1.5 Para M7 — Tránsito

Cuatro eventos, y ya confirmaron que los reciben los cuatro.

El que dispara acción es `streetClosureRequested` (8), con el esquema unificado que propusieron y aceptamos el 30/08 — mismo payload que la solicitud que les manda M3. `sourceModule` viene en `M6`, que es el campo que ustedes mismos pidieron. `sourceRef` apunta al servicio o a la intervención que origina el corte.

Los otros tres son informativos: `urbanServiceScheduled` (2) —para que sepan que hay un camión circulando—, `treePruningScheduled` (5) con `requiresStreetClosure` —la poda que va a necesitar corte les llega antes que la solicitud— y `treeRiskDetected` (4).

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

**Sin eventos en ninguna dirección.** Lo que necesitamos son dos consultas REST.

| Consulta | Campos | Para qué |
|---|---|---|
| Ciudadano por `citizenId` | `citizenId`, `fullName`, `documentId`, `phone`, `email`, `address { street, number, neighborhoodId }` | Cuando el inspector detecta una infracción de oficio y el infractor es persona física, necesitamos identificarlo para emitir el acta |
| Organización por `organizationId` | `organizationId`, `legalName`, `tradeName`, `taxId`, `status` | Cada cuadrilla guarda el `organizationId` de la cooperativa que la opera. Sin esto no podemos mostrar su nombre en ninguna pantalla |

**Decisión que les avisamos:** el acta de constatación ambiental **no** va al expediente digital. Reciben actuaciones de M4, M5, M7 y M8, y podría llamar la atención que de nosotros no reciban nada. Es a propósito: el acta la derivamos a M4, que decide la sanción y sí les reporta el resultado. El hecho les llega igual, por un solo camino, en lugar de entrarles dos veces. Si prefieren tener también la constatación original, avísennos y les publicamos `environmentalViolationDetected`.

## M2 — Atención ciudadana

Leímos el contrato completo, ahora en su **v1.5** (reemplazó la v1.2). **Adoptamos su modelo sin pedir eventos nuevos ni cambios de forma**, y la v1.5 resolvió por su cuenta tres de los pedidos que teníamos anotados abajo. De sus dos eventos publicados escuchamos uno solo:

| Evento | Qué hacemos con él |
|---|---|
| `ticketUpdated` | El único. Según el `updateType` nos abre el expediente o lo hace avanzar |
| `ticketCreated` | **No lo consumimos.** Va hacia M1 y lleva los datos mínimos del registro del ciudadano. Nada de eso nos sirve para abrir un servicio |

Los `updateType` que nos importan:

| `updateType` | Qué hacemos |
|---|---|
| `ROUTED` | **Abrimos el expediente ambiental o el servicio puntual.** Es nuestro único disparador de entrada |
| `INFORMATION_PROVIDED` | Sumamos al expediente lo que el vecino respondió. La v1.5 ya no usa ID: como máximo hay una solicitud activa por ticket |
| `CANCELLED` | Cancelamos el servicio o la inspección ya programados |
| `REOPENED` | Reabrimos: el vecino rechazó la solución y vuelve a gestión |
| `PRIORITY_CHANGED` | Reordenamos la cola de la cuadrilla |
| `ESCALATION_CHANGED` | Lo marcamos como escalado y se lo mostramos al supervisor |

`STATUS_CHANGED`, `RESOLVED` y `CLOSED` los escuchamos pero no hacemos nada con ellos: en esos casos el cierre lo originamos nosotros.

**Campos que necesitamos de `ticketUpdated / ROUTED`** (actualizado a v1.5):

```
comunes:  ticketId, citizenId, isAnonymous, responsibleAreaId, updateType,
          currentStatus, currentPriority, publicMessage?, attachments[]?, updatedAt
details.routing:  requestType (catalogRef), ticketType, summary, description,
                   formData?, location?, resolutionDueAt?, escalation?
```

✅ **Cómo sabemos que un `ROUTED` es nuestro — resuelto por la v1.5.** `responsibleAreaId` ahora viaja como campo común de todo `ticketUpdated`. Ya no hace falta catálogo de `requestTypeId` ni adivinar entre las ocho áreas.

✅ **`location` ya tiene estructura — resuelto por la v1.5.** Ahora viene como `addressLine, street, streetNumber, neighborhoodId, latitude, longitude, reference`. Ya tenemos `neighborhoodId` para rutear por zona.

✅ **`citizenId` — resuelto por la v1.5, mejor de lo pedido.** Ahora es campo común de todo `ticketUpdated`, no solo de `details` en `ROUTED`. Junto con `isAnonymous`, también común.

✅ **`RESOLVED` directo desde `ROUTED` — decidimos no pedirlo.** La v1.5 permite saltar `STARTED` para los Request Types que M2 marque como "admite resolución directa", pero no publicaron el catálogo. En vez de esperar la confirmación, publicamos siempre `STARTED` inmediatamente antes de `RESOLVED` —incluso para los servicios que se resuelven por una ruta ya agendada, como una recolección de la ruta del día que además cierra un reclamo—: es válido en cualquier caso y no depende de su catálogo.

🔴 **Nuevo: `progress` no sirve para nuestra fecha agendada.** El campo común `progress` de `updateTicketStatus` (lo que nosotros publicamos) es un `Int` (porcentaje), no una fecha, y la v1.5 no define ninguna estructura de `details` para `STARTED`/`PROGRESS`. Necesitamos saber cómo mandar la fecha/franja agendada del servicio.

✅ **Lo que ya no preguntamos.** `ticketInfoProvided` y `additionalInfoRequired` no desaparecieron: se convirtieron en `ticketUpdated / INFORMATION_PROVIDED` y `updateTicketStatus / INFORMATION_REQUIRED`. La cancelación tampoco se perdió: es `ticketUpdated / CANCELLED`. Y `targetArea` en `ticketCreated` dejó de tener sentido, porque ese evento no es para nosotros. Los enums de `resolution.type`, `returnInfo.reasonCode` y `cancellation.reasonCode`, que antes no estaban enumerados, ya están publicados en la v1.5.

## M3 — Obras públicas

| Evento | Campos imprescindibles |
|---|---|
| `workOrderScheduled` | ✅ `sourceRequestId` confirmado |
| `workOrderCompleted` | ✅ `sourceRequestId`, `outcome`, `completedAt` confirmados |

`workOrderUpdated` va solo hacia M2 y no lo necesitamos: nuestra solicitud de reparación tiene tres estados —pedida, en curso, cerrada— y con esos dos alcanza.

⚠️ **Una pregunta sobre `workOrderScheduled`.** En su lista anterior el acuse era `workOrderCreated`, que significaba "la recibí y abrí la orden". `workOrderScheduled` significa "le puse fecha", que puede ser bastante después. Necesitamos saber si se dispara al crear la orden o recién al programarla: si es lo segundo, entre que les mandamos la solicitud y ustedes la agendan no tenemos ninguna señal y no podemos distinguir "todavía no la vieron" de "la están por hacer".

## M4 — Habilitaciones

| Evento | Campos imprescindibles |
|---|---|
| `commercialFineGenerated` | ✅ `sourceViolationId` · 🟢 `decision`, `decidedAt`, `externalRef` confirmados (24/08) |
| `closureUpdate` (`status: ORDERED | LIFTED`) | ✅ `sourceViolationId` · 🟢 `decision`, `decidedAt`, `externalRef` confirmados (24/08) |

✅ **`sourceViolationId` ya viaja**, en `commercialFineGenerated` y en `closureUpdate`. Era nuestro bloqueante — queda cerrado. `establishmentId` es opcional pero lo aprovechamos.

🟢 **`decidedAt` y `externalRef` confirmados el 24/08.** Nos habían dicho que los sacaron del payload; nos avisaron que los reincorporan porque los necesitamos sí o sí. Pendiente de verlos en la próxima versión del documento.

**Aviso de renombre:** `closureOrdered` y `closureLifted` se fusionaron en `closureUpdate` con `status: ORDERED | LIFTED`.

⚠️ **`commercialFineGenerated` sigue rotulado solo hacia Rentas.** Confirmen que también nos lo rutean a nosotros — sigue sin confirmar.

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
  streetClosureId, closureRequestId, requestingModule (Obras|Ambiente),
  startDate, endDate, affectedStreet[],
  detours[ { street, alternateRoute } ], conditions[]

streetClosureRejected
  closureRequestId, rejectionReason, requestingModule (Obras|Ambiente)

streetClosureEnded
  streetClosureId, closureRequestId, completionDateTime, notes
```

✅ **Ya no es el diseño tentativo `sourceRequestId`/`sourceModule`/`from`/`to`.** Los nombres reales son `closureRequestId`, `requestingModule` (`"Obras"` | `"Ambiente"` — nosotros somos `"Ambiente"`) y `startDate`/`endDate`.

✅ **`streetClosureEnded` ya correlaciona por sí solo (30/08).** Hasta el 25/08 no traía `closureRequestId` y había que persistir `streetClosureId` desde el `streetClosureApproved` anterior para poder cerrar la dependencia. El documento de referencia nuevo ya lo incluye directamente.

✅ **Typo corregido.** El documento ya escribe `streetClosureEnded` bien, sin la `u` de más.

✅ **Nuevo (30/08): `streetClosureRequested` unificado con M3.** Hasta ahora M7 recibía este evento con forma distinta según el origen (la nuestra y la de Obras). Propusieron un esquema único — ver §1.5 — y lo aceptamos: de nuestro lado implica renombrar `requestId→closureRequestId`, `streets[]→affectedSections` y `from`/`to`→`requestedFrom`/`requestedTo`.

## M8 — Desarrollo social

**Sin integración prevista**, y su lista lo confirma. Aclaración por si aparece la duda: las cooperativas existen en nuestro módulo como **cuadrillas de trabajo**, no como beneficiarias de un programa. Su registro como organización es de M1.

## M9 — Core

| Evento | Campos imprescindibles |
|---|---|
| `notificationSent` | `notificationId`, `channel`, `sentAt`, `sourceRef` |

⚠️ **Puede que terminemos sacándolo.** Nadie publica hoy algo que dispare una notificación, y M7 menciona un `notificationRequest` de M2 que ningún otro módulo declaró. Si resulta que solo M2 puede pedir notificaciones, estaríamos recibiendo acuses de mensajes que nunca pedimos y lo damos de baja.

**Lo que les pedimos por REST:** catálogo de barrios con `neighborhoodId` estable, y validación del JWT.

---

# Parte 3 — Incongruencias

## 3.1 Las que nos afectan

| # | Qué pasa | Con quién |
|---|---|---|
| 1 | **M2 publicó su contrato (ahora v1.5) y ningún otro módulo está escrito contra él.** M1, M4, M5 y M8 siguen publicando `ticketInProgress`, `ticketUpdate`, `ticketCompleted` y `ticketRejected`, que M2 no consume: lo suyo va por `updateTicketStatus` con `updateType`. Y los seis eventos de ciclo de vida que M1, M3, M5, M7 y M8 esperan son hoy variantes de `ticketUpdated`, no eventos. **Los cinco tienen que releer el contrato** | M1, M3, M4, M5, M8 |
| 2 | **`commercialFineGenerated` figura rotulado solo hacia Rentas**, pero nosotros lo necesitamos para cerrar el expediente | M4 |
| 3 | **M4 declara consumir `updateTicketStatus`.** Es el canal de entrada de M2 desde las áreas operativas: ningún otro módulo tendría que escucharlo | M4 |
| 4 | **`workOrderScheduled` reemplazó a `workOrderCreated`** y no significan lo mismo. Hay que confirmar cuándo se dispara | M3 |
| 5 | **El sobre común de M2 no es el sobre de la cohorte.** Definieron `specVersion`, `eventId`, `eventType`, `eventVersion`, `occurredAt`, `producer`, `subject` y `data`, con reglas de idempotencia y DLQ. Es el único envelope escrito que existe. **M9 tendría que adoptarlo o publicar el suyo**, porque hoy cada módulo asume uno distinto | M9, toda la cohorte |
| 6 | **Los adjuntos se llaman distinto.** M2 usa `attachment { attachmentId, fileName, contentType, url, sizeBytes }`; nosotros veníamos con `{ url, mimeType, description }`. Nos alineamos al suyo en lo que va hacia M2, pero conviene unificarlo en toda la cohorte antes de implementar | toda la cohorte |

### Lo que M3 ya resolvió

Su lista actualizada cerró tres cosas de un saque:

- **Borraron `urbanRiskDetected` y `urbanServiceRepairRequested`**, que eran los nombres del enunciado para eventos que nosotros renombramos. Ahora consumen exactamente nuestros tres: `infrastructureRepairRequested`, `containerDamaged` y `treeRiskDetected`.
- **Adoptaron el vocabulario de corte de calle de M7**: `streetClosureApproved`, `streetClosureRejected` y `streetClosureEnded`. Antes usaban `streetClosureAuthorized` / `Activated` / `Finished`, que M7 no publica.
- **Bajaron los `publicWorksProject*` de doce a dos.**

Con M3 nos queda una sola pregunta abierta, la del punto 3.

## 3.2 Las que no nos afectan pero van a romper el ruteo

Un huérfano es un evento que alguien espera y nadie publica. Esta lista se achicó con la actualización de M3, pero sigue siendo larga.

| Evento | Lo espera | Lo publica | Qué pasa |
|---|---|---|---|
| `paymentRegistered`, `debtSettled` | M4, M7 | **nadie** | M5 los publica como `paymentRecorded` y `debtCancelled`. **Rompe el cierre financiero de infracciones y habilitaciones** |
| `caseFileResolved` | M3, M7 | **nadie** | M1 no publica ningún evento de expediente |
| `registeredCitizen`, `registeredOrganization` | M5 | **nadie** | M1 los publica invertidos: `citizenRegistered`, `organizationRegistered` |
| `enablingFeeGenerated`, `enablingSuspended` | M5 | **nadie** | Alias viejos de `permitFeeGenerated` y `permitSuspended`. M5 ya consume el primero por duplicado bajo los dos nombres |
| `licenseRequestInitiated`, `licenseApproved` | M1 | **nadie** | M4 usa `permitApplicationStarted` y `permitApproved`. M1 tiene los dos vocabularios en su misma lista |
| `constructionApproved` | M1 | **nadie** | M3 lo llama `publicWorksProjectApproved` |
| `workScheduled`, `workFinished` | M7 | **nadie** | M3 **ya los publica hacia M7** como `workOrderScheduled` y `workOrderCompleted`. Solo falta que M7 los renombre en su lista |
| `roadAccidentRegistered` | M3 | ~~nadie~~ **M7** | ✅ **Resuelto (25/08).** M7 publicó el payload completo en su documento de referencia. M3 antes lo llamaba `trafficIncidentRegistered`: cambió el nombre, no el problema, y ahora el evento existe |
| `ticketRouted`, `ticketEscalated`, `ticketResolved`, `ticketClosed`, `ticketReopened`, `ticketCancelled`, `ticketInfoProvided` | M1, M3, M5, M7, M8 | **nadie** | **Es el huérfano más grande de la cohorte, y ahora tiene solución escrita.** Los siete existen en el contrato v1.2 de M2, pero como `updateType` de `ticketUpdated`, no como eventos: `ROUTED`, `ESCALATION_CHANGED`, `RESOLVED`, `CLOSED`, `REOPENED`, `CANCELLED`, `INFORMATION_PROVIDED`. No hay que pedir nada, hay que suscribirse a `ticketUpdated` y ramificar |
| `publicWorksProjectApproved`, `publicWorksProjectCompleted` | **nadie** | M3 | M3 los dirige a M1, que consume `constructionApproved`. Eran doce, quedaron dos |
| Todo lo de M8 hacia M2 | **nadie** | M8 | M2 no consume nada de M8 |
| `workOrderScheduled`, `workOrderCompleted`, `workOrderUpdated` hacia M2 | **nadie** | M3 | M2 no consume nada de M3 |
| `additionalInfoRequired` | **nadie** | M1 | El contrato de M2 lo reemplazó por `updateTicketStatus / INFORMATION_REQUIRED`. M1 tiene que publicar esa variante en vez del evento |
| `representationExpired`, `citizenBlocked`, `citizenDeceased` | **nadie** | M1 | Sin consumidor declarado. Puede estar bien, pero conviene confirmarlo |
| `eventRejected` | **nadie** | todos | Todos lo publican y nadie lo consume. Debería consumirlo M9 |

## 3.3 Un riesgo en el bloque común

Todos los módulos publicamos `eventProcessingFailed` **y** todos lo consumimos. Si el procesamiento de un `eventProcessingFailed` falla, se publica otro: una tormenta de eventos técnicos que se retroalimenta y que ninguna DLQ frena, porque el problema no es el reintento sino el ciclo.

**Propuesta:** que los eventos técnicos —`eventProcessingFailed` y `eventRejected`— vayan solo hacia M9, que es quien tiene el tablero de DLQ, y queden excluidos de la ruta que dispara una publicación de falla. Ningún módulo de negocio necesita enterarse de que otro no pudo procesar algo: necesita que se lo reenvíen.
