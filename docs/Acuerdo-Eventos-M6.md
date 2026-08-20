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

**1. `updateTicketStatus` → M2** · *el payload lo define M2 en su contrato v1.2*

```
ticketId, publicId, expectedTicketVersion, updateType,
message?, details?, attachments[]?, updatedBy, updatedAt

updateType: STARTED | PROGRESS | INFORMATION_REQUIRED |
            RETURNED | RESOLVED | REJECTED
updatedBy:  { type: AREA_USER, id }
```

No lleva `status`: informamos el hecho y **M2 decide el estado**. Tampoco lleva `sourceRef` — su contrato prohíbe mandarles IDs de nuestras entidades internas, así que la correlación `ticketId ↔ serviceId` la guardamos de nuestro lado. El detalle de cada variante está en 1.2.

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

**8. `streetClosureRequested` → M7**

```
requestId, sourceModule, sourceRef,
reason, streets[], from, to, closureType, requestedAt

sourceModule: siempre M6
sourceRef:    el serviceId o interventionId que origina el corte
closureType:  TOTAL | PARTIAL
```

---

## 1.2 Para M2 — Atención ciudadana

### `updateTicketStatus` — el único, con el contrato de M2

Leímos el contrato v1.2 y **adoptamos su payload tal cual**. No pedimos campos nuevos ni proponemos alternativas: nos adaptamos a lo que ya definieron.

```
ticketId, publicId, expectedTicketVersion, updateType,
message?, details?, attachments[]?, updatedBy, updatedAt
```

Tres cosas que nos cambian la implementación y conviene dejar dichas:

- **No mandamos el estado, mandamos el hecho.** `updateType` dice qué pasó y M2 decide la transición. Nuestro modelo no vuelve a nombrar estados de M2 en ningún lado.
- **Guardamos `ticketId`, `publicId` y `ticketVersion`** en el `Service` y en el `EnvironmentalReport`, para poder devolver `expectedTicketVersion` en cada actualización. Es un campo nuevo de nuestras tablas.
- **No mandamos `sourceRef`.** Su contrato prohíbe transportar IDs de entidades internas de otros módulos, así que la correlación `ticketId ↔ serviceId ↔ inspectionId` queda en una tabla nuestra.

### De qué hecho nuestro sale cada `updateType`

Esta es la tabla con la que lo implementamos. La columna izquierda son **hechos internos de nuestro modelo**, no eventos publicados: salvo `urbanServiceScheduled`, ninguno sale al bus. Cuando ocurre el hecho, publicamos el `updateTicketStatus` que le corresponde.

| Hecho nuestro | `updateType` | Qué mandamos en `details` |
|---|---|---|
| `urbanServiceScheduled` | `PROGRESS` | `progress.estimatedCompletionAt` con la fecha y franja agendadas |
| `urbanServiceStarted` | `STARTED` | vacío; `message` para el vecino |
| `urbanServiceDelayed` | `PROGRESS` | `progress.estimatedCompletionAt` con la nueva estimación, y el motivo en `message` |
| `urbanServiceCompleted` | `RESOLVED` | `resolution.type` + `resolution.publicMessage`, y la foto del trabajo en `attachments[]` |
| `environmentalInspectionScheduled` | `STARTED` | vacío |
| `environmentalInspectionCompleted`, sin irregularidad | `RESOLVED` | `resolution.publicMessage`: "no se encontraron irregularidades" |
| `environmentalInspectionCompleted`, con acta | `PROGRESS` | el caso sigue en M4. Nunca el contenido del acta |
| Se desestima el reporte | `REJECTED` | `cancellation.reasonCode` + motivo |
| El reclamo no es de nuestra área | `RETURNED` | `returnInfo.reasonCode`. Vuelve a M2 para que lo re-derive, en vez de cancelárselo al vecino |
| El inspector necesita un dato del vecino | `INFORMATION_REQUIRED` | `informationRequestId`, `messageForCitizen`, `requestedItems[]` |

Los otros dos no tienen una traducción directa, y conviene que quede escrito por qué:

- **`zoneNotServiced` no es un reclamo, es una zona.** Cuando un recorrido deja una zona sin atender no hay un `ticketId`, hay *n*. Lo que sale hacia M2 es **un `updateTicketStatus` con `PROGRESS` por cada reclamo abierto de esa zona**: el abanico lo abrimos nosotros, a partir de un hecho que del lado de M2 no tiene forma de representarse entero.
- **`containerOverflowed` depende del origen.** Si el desborde lo reportó un vecino, hay `ticketId` y sale el `updateTicketStatus`. Si lo detectamos nosotros en la recorrida, no hay reclamo al que contestarle y hacia M2 no sale nada.

### Lo que el contrato v1.2 nos resolvió

Tres cosas que teníamos anotadas como problema dejaron de serlo:

- **`detail` ya no es todo el canal.** Era nuestra objeción principal: el vecino iba a ver solo prosa. Con `progress.estimatedCompletionAt` la fecha agendada viaja como dato, con `resolution.publicMessage` el cierre tiene un texto propio y con `attachments[]` podemos mandar la foto del trabajo terminado. No hace falta agregarles nada.
- **Podemos pedirle información al ciudadano.** `INFORMATION_REQUIRED` era el canal que dábamos por perdido cuando desapareció `additionalInfoRequired`. No desapareció: se convirtió en una variante. El inspector que necesita una referencia más precisa o una foto nocturna ya tiene por dónde pedirla, y la respuesta nos vuelve correlacionada por `informationRequestId`.
- **`RETURNED` es mejor que rechazar.** Cuando un reclamo no es nuestro, devolverlo a M2 para que lo re-derive es distinto de cancelárselo al vecino. Antes teníamos un solo `REJECTED` para las dos cosas.

### Lo que se cae

Los diez eventos de dominio que les ofrecíamos como detalle **ya no se los mandamos**. Tres siguen publicados porque los consumen M3 y M7; los otros siete se quedaron sin ningún consumidor y los sacamos del contrato.

### Los siete que sacamos del contrato

Estos hechos existen en nuestro modelo y son los que disparan cada `updateTicketStatus`, pero **dejamos de publicarlos**: `urbanServiceStarted`, `urbanServiceDelayed`, `urbanServiceCompleted`, `zoneNotServiced`, `containerOverflowed`, `environmentalInspectionScheduled` y `environmentalInspectionCompleted`.

Los teníamos en el contrato porque se los ofrecíamos a M2 como detalle de lo que pasaba con el reclamo. Cuando M2 definió que todo lo suyo entra por `updateTicketStatus`, se quedaron sin ningún consumidor, y un evento que nadie escucha no es parte de un contrato de integración: es código que hay que escribir, versionar y mantener para nadie.

**El dato no se pierde.** Su contrato v1.2 hace viajar lo importante: la fecha agendada como `progress.estimatedCompletionAt`, el cierre como `resolution.publicMessage`, la evidencia como `attachments[]`. Lo que queda afuera son nuestros identificadores internos, que el propio contrato de M2 prohíbe transportar.

Si alguno les hace falta —M9 para un tablero de cumplimiento de recorridos, o M2 si más adelante quiere la franja horaria completa— **pídanlo y lo publicamos**. El payload ya está diseñado; lo que no hacemos es publicarlo por las dudas.

## 1.3 Para M3 — Obras públicas

Tres eventos, y ya confirmaron que los consumen los tres: `infrastructureRepairRequested` (7), `containerDamaged` (3) y `treeRiskDetected` (4).

`requiresPublicWorks = true` es la señal de que el daño les corresponde a ustedes. `treeRiskDetected` solo se dispara con `riskLevel` en `HIGH` o `CRITICAL`.

**Les pedimos que devuelvan nuestro `requestId` como `sourceRequestId`** en `workOrderScheduled` y `workOrderCompleted`. Sin ese campo hay que correlacionar por dirección, que es frágil.

## 1.4 Para M4 — Habilitaciones

Un evento: `environmentalViolationDetected` (6).

- **`establishmentId` es obligatorio y viaja siempre.** Intimar, clausurar y multar se le aplican a un comercio habilitado; un acta sin establecimiento no les serviría, así que esas las cerramos nosotros y no se las mandamos.
- **`suggestedAction` no es vinculante.** La decisión es de ustedes.
- **`priorNoticeCount`** es la cantidad de actas previas al mismo establecimiento según nuestro histórico: les adelanta la reincidencia.

**Les pedimos que devuelvan `violationId` como `sourceViolationId`** en `commercialFineGenerated`, `closureOrdered` y `closureLifted`. Sin él no sabemos cuál de nuestras actas resolvieron y el expediente no cierra nunca.

## 1.5 Para M7 — Tránsito

Cuatro eventos, y ya confirmaron que los reciben los cuatro.

El que dispara acción es `streetClosureRequested` (8). `sourceModule` viene en `M6`, que es el campo que ustedes mismos pidieron. `sourceRef` apunta al servicio o a la intervención que origina el corte. Mismo contrato que la solicitud que les manda M3.

Los otros tres son informativos: `urbanServiceScheduled` (2) —para que sepan que hay un camión circulando—, `treePruningScheduled` (5) con `requiresStreetClosure` —la poda que va a necesitar corte les llega antes que la solicitud— y `treeRiskDetected` (4).

**Les pedimos que devuelvan `sourceRequestId` y `sourceModule`** en las tres respuestas de corte.

---

# Parte 2 — Lo que consumimos

Estos son **todos** los eventos que escuchamos. No consumimos nada más: si su módulo publica algo que no está en esta lista, no lo estamos leyendo.

| Evento | De quién | Qué hacemos con él |
|---|---|---|
| `ticketUpdated` | **M2** | Único evento suyo que escuchamos. `ROUTED` nos abre el expediente; el resto lo hace avanzar |
| `workOrderScheduled` | **M3** | Pasamos la solicitud de reparación a `IN_PROGRESS` |
| `workOrderCompleted` | **M3** | Cerramos la solicitud de reparación |
| `commercialFineGenerated` | **M4** | Registramos la resolución del acta, pasamos a `SANCTIONED` y cerramos |
| `closureOrdered` | **M4** | Ídem, con la clausura como resolución |
| `closureLifted` | **M4** | Registramos el levantamiento de la clausura y cerramos el expediente |
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

Leímos el contrato v1.2 completo. **Adoptamos su modelo sin pedir eventos nuevos ni cambios de forma.** De sus dos eventos publicados escuchamos uno solo:

| Evento | Qué hacemos con él |
|---|---|
| `ticketUpdated` | El único. Según el `updateType` nos abre el expediente o lo hace avanzar |
| `ticketCreated` | **No lo consumimos.** Va hacia M1 y lleva los datos mínimos del registro del ciudadano. Nada de eso nos sirve para abrir un servicio |

Los `updateType` que nos importan:

| `updateType` | Qué hacemos |
|---|---|
| `ROUTED` | **Abrimos el expediente ambiental o el servicio puntual.** Es nuestro único disparador de entrada |
| `INFORMATION_PROVIDED` | Sumamos al expediente lo que el vecino respondió, correlacionado por `informationRequestId` |
| `CANCELLED` | Cancelamos el servicio o la inspección ya programados |
| `REOPENED` | Reabrimos: el vecino rechazó la solución y vuelve a gestión |
| `PRIORITY_CHANGED` | Reordenamos la cola de la cuadrilla |
| `ESCALATION_CHANGED` | Lo marcamos como escalado y se lo mostramos al supervisor |

`STATUS_CHANGED`, `RESOLVED` y `CLOSED` los escuchamos pero no hacemos nada con ellos: en esos casos el cierre lo originamos nosotros.

**Campos que necesitamos de `ticketUpdated / ROUTED`:**

```
comunes:  ticketId, publicId, ticketVersion, updateType,
          currentStatus, currentPriority?, attachments[]?, updatedAt
details:  requestTypeId, ticketType, summary, description,
          formData?, location, isAnonymous, resolutionDueAt?
```

🔴 **Cómo sabemos que un `ROUTED` es nuestro.** El evento no lleva módulo ni área de destino. Si el ruteo es por contenido y no por cola dedicada, necesitamos una de dos: que `ROUTED` incluya el módulo responsable, o **que nos pasen el catálogo de `requestTypeId` que caen en ambiente, higiene y servicios urbanos**. Cualquiera de las dos nos sirve; sin ninguna tenemos que escuchar los reclamos de las ocho áreas y adivinar. Es el mismo problema que antes llamábamos `targetArea`.

🔴 **`location` necesita estructura.** En el ejemplo del contrato viene como `{"address": "Lima y Chile"}`. Nosotros asignamos zona operativa y cuadrilla a partir del barrio, así que necesitamos **`neighborhoodId`** —el del catálogo de M9— más calle y número, y `lat`/`lng` si los tienen. Con una cadena de texto libre no podemos rutear el trabajo.

⚠️ **`citizenId` en `ROUTED`.** El snapshot trae `isAnonymous` pero no el ciudadano. Lo necesitamos para el expediente ambiental cuando la denuncia no es anónima. Si prefieren no transportarlo, decímoslo y lo resolvemos por REST contra M1.

⚠️ **`RESOLVED` directo desde `ROUTED`.** Su matriz lo admite "solo si el Request Type admite resolución directa". Muchos de nuestros servicios se resuelven sin pasar por `STARTED` —una recolección de la ruta del día que además cierra un reclamo—, así que necesitamos saber cuáles de nuestros request types están marcados así.

✅ **Lo que ya no preguntamos.** `ticketInfoProvided` y `additionalInfoRequired` no desaparecieron: se convirtieron en `ticketUpdated / INFORMATION_PROVIDED` y `updateTicketStatus / INFORMATION_REQUIRED`. La cancelación tampoco se perdió: es `ticketUpdated / CANCELLED`. Y `targetArea` en `ticketCreated` dejó de tener sentido, porque ese evento no es para nosotros.

## M3 — Obras públicas

| Evento | Campos imprescindibles |
|---|---|
| `workOrderScheduled` | 🔴 `sourceRequestId` |
| `workOrderCompleted` | 🔴 `sourceRequestId`, `outcome`, `completedAt` |

`workOrderUpdated` va solo hacia M2 y no lo necesitamos: nuestra solicitud de reparación tiene tres estados —pedida, en curso, cerrada— y con esos dos alcanza.

⚠️ **Una pregunta sobre `workOrderScheduled`.** En su lista anterior el acuse era `workOrderCreated`, que significaba "la recibí y abrí la orden". `workOrderScheduled` significa "le puse fecha", que puede ser bastante después. Necesitamos saber si se dispara al crear la orden o recién al programarla: si es lo segundo, entre que les mandamos la solicitud y ustedes la agendan no tenemos ninguna señal y no podemos distinguir "todavía no la vieron" de "la están por hacer".

## M4 — Habilitaciones

| Evento | Campos imprescindibles |
|---|---|
| `commercialFineGenerated` | 🔴 `sourceViolationId`, `decision`, `decidedAt`, `externalRef` |
| `closureOrdered` | 🔴 `sourceViolationId`, `decision`, `decidedAt`, `externalRef` |
| `closureLifted` | 🔴 `sourceViolationId`, `decision`, `decidedAt`, `externalRef` |

🔴 **`sourceViolationId` es bloqueante.** Es el `violationId` que les mandamos en el acta. `establishmentId` es opcional pero lo aprovechamos.

⚠️ **`commercialFineGenerated` figura rotulado solo hacia Rentas.** Confirmen que también nos lo rutean a nosotros.

**Decisión que les avisamos: no les pedimos un evento de desestimación.** El caso "M4 decide que no corresponde castigo" no dispara ningún evento, ni siquiera `closureLifted`. Lo resolvemos de nuestro lado cerrando el expediente por vencimiento de un plazo configurable. Una dependencia menos.

**Lo que les pedimos por REST:** búsqueda de establecimiento por dirección, CUIT o barrio. Como el acta no se deriva sin `establishmentId`, es lo que nos permite completarla antes de emitirla.

## M5 — Rentas

**Sin integración directa.** No publicamos nada hacia ustedes ni consumimos nada de ustedes.

Lo único que puede interesarles: cuando constatamos una infracción ambiental emitimos un acta pero **no generamos el cargo económico**. El acta va a M4, que decide la sanción y publica `commercialFineGenerated`, que ustedes sí consumen. **Una multa comercial que les llegue puede tener origen en una constatación ambiental nuestra.**

## M7 — Tránsito

| Evento | Campos imprescindibles |
|---|---|
| `streetClosureApproved` | `sourceRequestId`, `from`, `to` |
| `streetClosureRejected` | `sourceRequestId`, `rejectionReason` |
| `streetClosureEnded` | `sourceRequestId` |

Campos completos:
```
streetClosureId, sourceRequestId, sourceModule,
from, to, detours[], rejectionReason (si aplica)
```

⚠️ **En su lista figura `streetClousureEnded`**, con la `u` de más. Va `streetClosureEnded`, que es como lo tenemos nosotros.

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
| 1 | **M2 publicó su contrato v1.2 y ningún otro módulo está escrito contra él.** M1, M4, M5 y M8 siguen publicando `ticketInProgress`, `ticketUpdate`, `ticketCompleted` y `ticketRejected`, que M2 no consume: lo suyo va por `updateTicketStatus` con `updateType`. Y los seis eventos de ciclo de vida que M1, M3, M5, M7 y M8 esperan son hoy variantes de `ticketUpdated`, no eventos. **Los cinco tienen que releer el contrato** | M1, M3, M4, M5, M8 |
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
| `roadAccidentRegistered` | M3 | **nadie** | M7 publica `trafficOperationCreated`, `infractionRegistered` y `vehicleImpounded`, ninguno es este. M3 antes lo llamaba `trafficIncidentRegistered`: cambió el nombre, no el problema |
| `ticketRouted`, `ticketEscalated`, `ticketResolved`, `ticketClosed`, `ticketReopened`, `ticketCancelled`, `ticketInfoProvided` | M1, M3, M5, M7, M8 | **nadie** | **Es el huérfano más grande de la cohorte, y ahora tiene solución escrita.** Los siete existen en el contrato v1.2 de M2, pero como `updateType` de `ticketUpdated`, no como eventos: `ROUTED`, `ESCALATION_CHANGED`, `RESOLVED`, `CLOSED`, `REOPENED`, `CANCELLED`, `INFORMATION_PROVIDED`. No hay que pedir nada, hay que suscribirse a `ticketUpdated` y ramificar |
| `publicWorksProjectApproved`, `publicWorksProjectCompleted` | **nadie** | M3 | M3 los dirige a M1, que consume `constructionApproved`. Eran doce, quedaron dos |
| Todo lo de M8 hacia M2 | **nadie** | M8 | M2 no consume nada de M8 |
| `workOrderScheduled`, `workOrderCompleted`, `workOrderUpdated` hacia M2 | **nadie** | M3 | M2 no consume nada de M3 |
| `additionalInfoRequired` | **nadie** | M1 | El contrato v1.2 lo reemplazó por `updateTicketStatus / INFORMATION_REQUIRED`. M1 tiene que publicar esa variante en vez del evento |
| `representationExpired`, `citizenBlocked`, `citizenDeceased` | **nadie** | M1 | Sin consumidor declarado. Puede estar bien, pero conviene confirmarlo |
| `eventRejected` | **nadie** | todos | Todos lo publican y nadie lo consume. Debería consumirlo M9 |

## 3.3 Un riesgo en el bloque común

Todos los módulos publicamos `eventProcessingFailed` **y** todos lo consumimos. Si el procesamiento de un `eventProcessingFailed` falla, se publica otro: una tormenta de eventos técnicos que se retroalimenta y que ninguna DLQ frena, porque el problema no es el reintento sino el ciclo.

**Propuesta:** que los eventos técnicos —`eventProcessingFailed` y `eventRejected`— vayan solo hacia M9, que es quien tiene el tablero de DLQ, y queden excluidos de la ruta que dispara una publicación de falla. Ningún módulo de negocio necesita enterarse de que otro no pudo procesar algo: necesita que se lo reenvíen.
