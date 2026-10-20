# `updateTicketStatus` → M2

El canal del vecino, y el único evento que M2 consume de las áreas operativas. **El payload lo define M2 en su contrato — vigente v1.78 (WIP), recibida y cruzada el 20/10; respecto de la v1.77 solo cambia `updatedBy.id` (UUID o `null`, ver abajo) y, antes de eso, desde la v1.6 no cambió este evento; la v1.71, la v1.72 y la v1.74 nunca se cruzaron — y lo adoptamos tal cual**: no pedimos campos nuevos ni proponemos alternativas.

Schema: [`updateTicketStatus.schema.json`](updateTicketStatus.schema.json).

## Cuándo se dispara

Cuando cambia el estado de un [`Service`](../../entidades/service.md) o de una inspección **que nacieron de un reclamo**. Un servicio planificado —la recolección de todos los martes— no tiene `ticketId` y no genera nada hacia M2.

> **La regla:** proyectamos si y solo si el `Service` o el [`EnvironmentalReport`](../../entidades/environmental-report.md) tiene `ticketId`. Sin esta regla, M2 recibe eventos de tickets que no existen.

## Payload (v1.78; solo `updatedBy.id` cambió desde la v1.6)

```
ticketId, updateType,
publicMessage?, internalMessage?, progress?, details?,
attachments[]?, updatedBy, updateOccurredAt
```

🔄 **Cambió respecto de la v1.5 que habíamos adoptado antes:**

- `statusChangedAt` se renombró a **`updateOccurredAt`** (§8.1). Guarda cuándo ocurrió realmente el hecho operativo de nuestro lado, que puede ser bastante antes de que el evento salga: el sobre lleva `occurredAt` para la publicación y el payload conserva el tiempo real del negocio.
- **`updatedBy.type` ya no es `AREA_USER`** — ese valor nunca existió en su enum. La v1.6 (§5.2) cierra la lista en `CITIZEN | AGENT | AREA_RESPONSIBLE | ADMIN | EXTERNAL_USER | SYSTEM`, con una regla de clasificación explícita: una persona que actúa desde otro módulo y cuyo hecho llega a M2 por integración es **`EXTERNAL_USER`**, cualquiera sea el rol que tenga acá; un hecho automático es **`SYSTEM`**, y ahí `id` puede ser `null`.
- El adjunto **perdió `attachmentId`** (§5.3): queda `{fileName, contentType, url, sizeBytes?}`. Como §13 fija `additionalProperties: false`, mandarlo es rechazo del evento, no un campo que se ignora.
- `resolution.type` cambió `INFORMATION_PROVIDED` por **`INQUIRY_ANSWERED`** (§8.5).
- El **sobre** ya no lleva `subject`: el sobre del Core no lo tiene, así que dejamos de mandar `tickets/{ticketId}` (§4 de M2) y la correlación con M2 va solo por `data.ticketId`. Ver [`envelope.ts`](../../../src/events/envelope.ts).

🔴 **v1.78 (20/10): `updatedBy.id` es `UUID | null`.** La v1.77 admitía `string | integer | null` (el ejemplo era `"USR-M3-77"`); la v1.78 no admite códigos ni enteros. Para una acción en M2 es el `citizenId` del `ModuleUser`; para `EXTERNAL_USER` es el UUID de la persona en el módulo de origen; es `null` en `SYSTEM` o cuando no hay una persona concreta identificable. El paquete de M2 pasó a 68 casos inválidos (los dos nuevos: `actor.id` no UUID y numérico).

**Pendiente nuestro (issue por abrir, sin implementar):** `updateTicketStatus()` de `src/events/payloads.ts` manda `{ type: 'EXTERNAL_USER', id: <sub del JWT> }`, y ese `sub` puede no ser un UUID (el JWT es provisorio, [ADR-002](../../decisiones/adr-002-auth-provisoria.md), y M1 documenta `user_id` como `bigint` en su login). Bajo la v1.78 M2 o el Core lo rechazarían. Remedio propuesto: si el actor no es un UUID, mandar `id: null`. El [schema local](updateTicketStatus.schema.json) todavía acepta cualquier string en `id`: no se endurece hasta que el código lo cumpla.

Lo que **no** cambió: `progress` sigue siendo un `Int` de porcentaje y `STARTED`/`PROGRESS` siguen sin estructura de `details`. El bloqueante de la fecha agendada sigue abierto — ver más abajo.

| Campo | Nota |
|---|---|
| `ticketId` | De M2. Lo guardamos en el `Service` y en el `EnvironmentalReport` |
| `updateType` | `STARTED` \| `PROGRESS` \| `INFORMATION_REQUIRED` \| `RETURNED` \| `RESOLVED` \| `REJECTED` |
| `publicMessage?` | Texto libre para el vecino |
| `internalMessage?` | Nota privada, nunca se muestra al vecino |
| `progress?` | `Int`, porcentaje estimado. **No sirve para la fecha/franja agendada** — ver bloqueante |
| `details?` | Objeto cuya forma depende del `updateType` — ver la tabla de abajo |
| `attachments[]?` | En el formato de M2: `{ fileName, contentType, url, sizeBytes? }`, no el nuestro. **Sin `attachmentId`** desde la v1.6 |
| `updatedBy` | `{ type: EXTERNAL_USER, id }` para una persona (`id`: UUID o `null` desde la v1.78); `{ type: SYSTEM, id: null }` si el hecho lo generó un proceso automático |
| `updateOccurredAt` | Cuándo ocurrió el hecho, no cuándo se publicó |

**No lleva `status`.** Informamos el hecho y M2 decide la transición: nuestro modelo no vuelve a nombrar estados de M2 en ningún lado.

**No lleva `sourceRef`.** Su contrato prohíbe transportar IDs de entidades internas de otros módulos, así que la correlación `ticketId ↔ serviceId ↔ inspectionId` queda en una tabla nuestra.

**No mandamos `publicId`.** La v1.70 lo volvió a publicar en `ticketCreated`/`ticketUpdated` como referencia humana, pero §8.1 aclara que `updateTicketStatus` *"no necesita incluir publicId: ticketId UUID sigue siendo la referencia técnica suficiente"*, y el schema tiene `additionalProperties: false`. Lo guardamos en el expediente solo para mostrarlo y buscarlo (#145); la correlación sigue siendo por `ticketId`. `ticketVersion` no existe desde la v1.5.

`updateType` no usa nuestro enum `TicketStatusUpdate`, que [ADR-003](../../decisiones/adr-003-divergencias-enums.md) eliminó del catálogo: el vocabulario lo define M2 y lo adoptamos tal cual.

### ✅ La fecha agendada va como texto en `publicMessage` (M2, 20/10)

**Resuelto.** M2 confirmó que informar la fecha y la franja como **texto en `publicMessage`** es la forma vigente dentro de `eventVersion "1.0"`: el contrato no tiene campo estructurado y no lo va a tener salvo un cambio coordinado entre módulos. Reglas para mandarlo:

- `PROGRESS` solo es válido con el ticket en `IN_PROGRESS`. En `ROUTED`, M2 hace `nack` y el Core reintenta hasta la DLQ.
- `STARTED` significa para M2 que el área tomó la gestión del ticket, y **agendar el servicio cuenta**: el ticket pasa a `IN_PROGRESS` y el ciudadano lo ve.
- Dos formas válidas: **(a)** `STARTED` con la programación en su propio `publicMessage`, o **(b)** `STARTED` al abrir el expediente y la programación como `PROGRESS`. Una reprogramación posterior es otro `PROGRESS`.
- **El estado del ticket lo tenemos que llevar nosotros** (M2, 20/10): no hay un `ticketUpdated` que avise `IN_PROGRESS`, nuestro `STARTED` es la única fuente. Un `PROGRESS` fuera de estado no rompe nada grave (en `ROUTED` M2 lo trata como prematuro y lo reintenta; en los demás estados inválidos lo registra y lo confirma sin aplicar). Con el ticket en `PENDING_INFORMATION` M2 no acepta `PROGRESS` ni `REJECTED`.
- Hoy no lo mandamos: se implementa en [#303](https://github.com/hllous/Backend-M6-DAPS2/issues/303).

*Histórico, antes de la respuesta:* `progress` no sirve para la fecha agendada.

**Sexta versión seguida sin una estructura propia.** *Novedad del 13/10:* el paquete de schemas de M2 trae `updateTicketStatus_PROGRESS_programacion.json`, un ejemplo de M3 que informa la programación como **texto en `publicMessage`** de un `PROGRESS` (`progress: 10`). Es la opción de texto de nuestro pedido; su schema fuerza `details: null` en `STARTED` y `PROGRESS`, así que `details.schedule` no va a llegar. Falta que M2 lo confirme, y que decidamos nosotros cuándo mandarlo: `PROGRESS` exige el ticket en `IN_PROGRESS` y hoy `urbanServiceScheduled` no emite nada hacia M2 (ver la tabla de abajo). El campo común `progress` es un `Int` 0..100 (porcentaje estimado), no una fecha, y sigue sin haber estructura de `details` para `STARTED`/`PROGRESS` — §8.2 de la v1.75 mantiene "details obligatorio: Ninguno". Necesitamos saber cómo mandar la fecha/franja agendada del servicio: ¿va como texto en `publicMessage`, o van a definir una estructura tipo `details.schedule`? Ver [bloqueantes.md](../../bloqueantes.md#tablero).

⚠️ **Validación nueva en `PROGRESS`.** La v1.6 (§8.2) exige que aporte al menos uno de `progress`, `publicMessage`, `internalMessage` o `attachments`. Un `PROGRESS` vacío ahora es inválido: afectaría sobre todo al fan-out de `zoneNotServiced` si se implementa (hoy no lo está, ver más abajo).

### `STARTED` antes de `RESOLVED` dejó de ser necesario

**La v1.6 lo resolvió a nuestro favor.** §8.2 lo dice sin ambigüedad: *"M2 no mantiene una configuración por RequestType para habilitar o impedir la resolución directa"*, y `RESOLVED` se acepta tanto desde `ROUTED` como desde `IN_PROGRESS`. `STARTED` y `PROGRESS` son hechos opcionales que cada área decide si informa.

Nuestra regla de publicar siempre `STARTED` inmediatamente antes de `RESOLVED` nació de que ese catálogo no existía. Ya no hace falta esperarlo. **La mantenemos igual por ahora** —es válida en cualquier caso y refleja el hecho real de que la cuadrilla empezó—, pero pasó de ser una defensa contra la ambigüedad a una decisión de contenido, y se puede simplificar sin pedirle nada a nadie.

### Reglas de M2 que ya cumplimos (§8.2 y §12 de la v1.75)

Revisadas contra los lugares donde se arma el evento (`ticketEvents` en `EnvironmentalReportsService` y `ServicesService`); no hay un test que las fije todas:

| Regla de M2 | Cómo la cumplimos |
|---|---|
| `PROGRESS` solo con el ticket `IN_PROGRESS`; si no, M2 lo `nack`ea (queda reintentando hasta la DLQ). **Informar `STARTED` antes** | La demora solo se proyecta con el servicio `IN_PROGRESS` (#146); el aviso por acta sale después del `STARTED` de `startReview` |
| `RESOLVED` exige `details.resolution.type` y `publicMessage` | Siempre `ACTION_COMPLETED` y un `publicMessage` fijo |
| `RETURNED` y `REJECTED` exigen `publicMessage` o `internalMessage` | Mandamos `internalMessage` (el motivo del operador, que no se le muestra al vecino) |
| `INFORMATION_REQUIRED` exige `informationRequest.messageForCitizen` | No lo emitimos todavía (ver abajo) |
| Un `updateTicketStatus` solo lo acepta M2 si el `sourceModule` del sobre, traducido a `Mx`, es el `responsibleAreaId` del ticket | Nuestro `sourceModule` es `ambiente`, que M2 traduce a `M6` (§5.1) |
| Reenviar el mismo hecho reusa el `eventId` | El `eventId` es el id de la fila del outbox |

### Enums publicados

- `resolution.type`: `ACTION_COMPLETED | REQUEST_FULFILLED | INQUIRY_ANSWERED | ACKNOWLEDGED | NO_FURTHER_ACTION_REQUIRED` — la v1.6 cambió `INFORMATION_PROVIDED` por `INQUIRY_ANSWERED`
- `returnInfo.reasonCode`: `INVALID_INFORMATION | REQUEST_TYPE_MISMATCH | INSUFFICIENT_CONTEXT | OTHER`
- `cancellation.reasonCode`: `OUT_OF_SCOPE | DOES_NOT_APPLY | INVALID_REQUEST_TYPE | INVALID_DATA | REJECTED_BY_AREA | OTHER`

## De qué hecho interno sale cada `updateType`

Esta es la tabla con la que se implementa. **La columna izquierda son hechos internos de nuestro modelo, no eventos publicados**: salvo `urbanServiceScheduled`, ninguno sale al bus (ver [descartados.md](descartados.md)). Cuando ocurre el hecho, publicamos el `updateTicketStatus` que le corresponde.

| Hecho nuestro | `updateType` | Qué mandamos |
|---|---|---|
| `urbanServiceScheduled` | `STARTED` (primera vez) o `PROGRESS` (reprogramación) | **No se emite hoy; definido por M2 el 20/10, implementación en [#303](https://github.com/hllous/Backend-M6-DAPS2/issues/303).** Fecha y franja como texto en `publicMessage`, sin `details`. Agendar un servicio solo dispara `urbanServiceScheduled` hacia M7 |
| `urbanServiceStarted` | `STARTED` | vacío |
| `urbanServiceDelayed` | `PROGRESS` | motivo en `publicMessage` o `internalMessage`. **Solo con el servicio `IN_PROGRESS`**: antes de arrancar el ticket sigue `ROUTED` y §8.2 rechaza `PROGRESS`, así que un aviso de demora antes de arrancar (`delayType: START`) queda registrado pero no se proyecta (#146) |
| `urbanServiceCompleted` | `RESOLVED` | `details.resolution.type` + `publicMessage`. **`attachments[]` no se manda**: el payload no lleva evidencia hoy, pendiente de decidir qué adjuntos ve el vecino — ver [bloqueantes.md](../../bloqueantes.md) |
| `environmentalInspectionScheduled` | `STARTED` | vacío |
| `environmentalInspectionCompleted`, sin irregularidad | `RESOLVED` | `details.resolution.type` + `publicMessage`: "no se encontraron irregularidades" |
| `environmentalInspectionCompleted`, con acta | `PROGRESS` | El caso sigue en M4. **Nunca el contenido del acta** |
| Se desestima el reporte | `REJECTED` | `details.cancellation.reasonCode` + `publicMessage`/`internalMessage` |
| El reclamo no es de nuestra área | `RETURNED` | `details.returnInfo.reasonCode` + `publicMessage`/`internalMessage`. Vuelve a M2 para que lo re-derive, en vez de cancelárselo al vecino |
| El inspector necesita un dato del vecino | `INFORMATION_REQUIRED` | **Diseñado, sin implementar.** No hay call site que lo dispare hoy: `details.informationRequest.messageForCitizen` (+ `requiredBy` opcional) es el payload previsto, no uno que salga |

🔴 **Pendiente conocido: el cierre por sanción de M4 no emite `RESOLVED`.** Cuando `closureUpdate` o `commercialFineGenerated` cierran el expediente (ver [`closureUpdate`](../consumidos/closureUpdate.md)), el consumidor pasa el `EnvironmentalReport` a `SANCTIONED` y después a `CLOSED` sin publicar nada hacia M2: el vecino no se entera de ese cierre por acá.

Los otros dos hechos no tienen traducción directa:

- **`zoneNotServiced` no es un reclamo, es una zona.** Cuando un recorrido deja una zona sin atender no hay un `ticketId`, hay *n*. El diseño es **un `updateTicketStatus` con `PROGRESS` por cada reclamo abierto de esa zona**, pero **hoy no está implementado**: `POST /services/:id/zone-results` no publica nada hacia M2. El abanico lo abriríamos nosotros, a partir de un hecho que del lado de M2 no tiene forma de representarse entero.
- **`containerOverflowed` depende del origen.** Si el desborde lo reportó un vecino hay `ticketId` y sale el evento. Si lo detectamos en la recorrida, no hay reclamo al que contestarle y no sale nada.

## La respuesta vuelve por `ticketUpdated`

`INFORMATION_REQUIRED` se correlaciona sin ID: desde la v1.5 no hay `informationRequestId`, sino una invariante de "como máximo una `InformationRequest` activa por ticket a la vez", así que la respuesta del vecino siempre corresponde a la nuestra. Llega como [`ticketUpdated / INFORMATION_PROVIDED`](../consumidos/ticketUpdated.md).

**§9 de la v1.75: un Ticket tiene como máximo UNA solicitud de información activa.** Un segundo `INFORMATION_REQUIRED` mientras hay una pendiente **no abre una interacción paralela**: M2 lo rechaza o registra conflicto. El flujo: publicamos `INFORMATION_REQUIRED`; M2 pasa el ticket a `PENDING_INFORMATION` y pausa el SLA; el vecino responde; M2 restaura el estado anterior y publica `ticketUpdated / INFORMATION_PROVIDED`. En el ejemplo de la v1.75 el sobre lleva `sourceModule: "ambiente"`, igual que el nuestro, y `updatedBy: { type: "EXTERNAL_USER", id: "USR-M6-77" }`. **Hoy no emitimos `INFORMATION_REQUIRED`** (no hay call site; la propuesta abierta es el issue #169), así que el riesgo de mandar un segundo pedido con uno activo no existe todavía, pero hay que resolverlo al implementarlo.

## Un hecho, dos eventos, un solo efecto

Al cerrar un servicio nacido de un reclamo se publica el hecho interno **y** este `updateTicketStatus`. Como M2 solo consume el segundo no hay doble efecto, pero conviene dejarlo asentado: la regla 1 del enunciado exige que un evento ya procesado no genere efectos duplicados, y esto se parece a una violación sin serlo.
