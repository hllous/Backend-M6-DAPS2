# `updateTicketStatus` → M2

El canal del vecino, y el único evento que M2 consume de las áreas operativas. **El payload lo define M2 en su contrato — v1.6, reemplaza la v1.5 — y lo adoptamos tal cual**: no pedimos campos nuevos ni proponemos alternativas.

Schema: [`updateTicketStatus.schema.json`](updateTicketStatus.schema.json).

## Cuándo se dispara

Cuando cambia el estado de un [`Service`](../../entidades/service.md) o de una inspección **que nacieron de un reclamo**. Un servicio planificado —la recolección de todos los martes— no tiene `ticketId` y no genera nada hacia M2.

> **La regla:** proyectamos si y solo si el `Service` o el [`EnvironmentalReport`](../../entidades/environmental-report.md) tiene `ticketId`. Sin esta regla, M2 recibe eventos de tickets que no existen.

## Payload (v1.6)

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
- El **sobre** cambió y nos afecta acá: `subject` tiene que ser `tickets/{ticketId}` (§4), no el id de nuestro `Service`. Ver [`envelope.ts`](../../../src/events/envelope.ts).

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
| `updatedBy` | `{ type: EXTERNAL_USER, id }` para una persona; `{ type: SYSTEM, id: null }` si el hecho lo generó un proceso automático |
| `updateOccurredAt` | Cuándo ocurrió el hecho, no cuándo se publicó |

**No lleva `status`.** Informamos el hecho y M2 decide la transición: nuestro modelo no vuelve a nombrar estados de M2 en ningún lado.

**No lleva `sourceRef`.** Su contrato prohíbe transportar IDs de entidades internas de otros módulos, así que la correlación `ticketId ↔ serviceId ↔ inspectionId` queda en una tabla nuestra.

**No guardamos `publicId` ni `ticketVersion`.** No hacen falta desde la v1.5: solo correlacionamos por `ticketId`.

`updateType` no usa nuestro enum `TicketStatusUpdate`, que [ADR-003](../../decisiones/adr-003-divergencias-enums.md) eliminó del catálogo: el vocabulario lo define M2 y lo adoptamos tal cual.

### 🔴 Bloqueante: `progress` no sirve para la fecha agendada

**Tercera versión seguida sin resolverse.** El campo común `progress` es un `Int` (porcentaje estimado), no una fecha, y sigue sin haber estructura de `details` para `STARTED`/`PROGRESS` — §8.2 de la v1.6 mantiene "details obligatorio: Ninguno". Necesitamos saber cómo mandar la fecha/franja agendada del servicio: ¿va como texto en `publicMessage`, o van a definir una estructura tipo `details.schedule`? Ver [bloqueantes.md](../../bloqueantes.md#tablero).

⚠️ **Validación nueva en `PROGRESS`.** La v1.6 (§8.2) exige que aporte al menos uno de `progress`, `publicMessage`, `internalMessage` o `attachments`. Un `PROGRESS` vacío ahora es inválido: afecta sobre todo al fan-out de `zoneNotServiced`, que emite uno por cada reclamo abierto de la zona.

### `STARTED` antes de `RESOLVED` dejó de ser necesario

**La v1.6 lo resolvió a nuestro favor.** §8.2 lo dice sin ambigüedad: *"M2 no mantiene una configuración por RequestType para habilitar o impedir la resolución directa"*, y `RESOLVED` se acepta tanto desde `ROUTED` como desde `IN_PROGRESS`. `STARTED` y `PROGRESS` son hechos opcionales que cada área decide si informa.

Nuestra regla de publicar siempre `STARTED` inmediatamente antes de `RESOLVED` nació de que ese catálogo no existía. Ya no hace falta esperarlo. **La mantenemos igual por ahora** —es válida en cualquier caso y refleja el hecho real de que la cuadrilla empezó—, pero pasó de ser una defensa contra la ambigüedad a una decisión de contenido, y se puede simplificar sin pedirle nada a nadie.

### Enums publicados

- `resolution.type`: `ACTION_COMPLETED | REQUEST_FULFILLED | INQUIRY_ANSWERED | ACKNOWLEDGED | NO_FURTHER_ACTION_REQUIRED` — la v1.6 cambió `INFORMATION_PROVIDED` por `INQUIRY_ANSWERED`
- `returnInfo.reasonCode`: `INVALID_INFORMATION | REQUEST_TYPE_MISMATCH | INSUFFICIENT_CONTEXT | OTHER`
- `cancellation.reasonCode`: `OUT_OF_SCOPE | DOES_NOT_APPLY | INVALID_REQUEST_TYPE | INVALID_DATA | REJECTED_BY_AREA | OTHER`

## De qué hecho interno sale cada `updateType`

Esta es la tabla con la que se implementa. **La columna izquierda son hechos internos de nuestro modelo, no eventos publicados**: salvo `urbanServiceScheduled`, ninguno sale al bus (ver [descartados.md](descartados.md)). Cuando ocurre el hecho, publicamos el `updateTicketStatus` que le corresponde.

| Hecho nuestro | `updateType` | Qué mandamos |
|---|---|---|
| `urbanServiceScheduled` | `PROGRESS` | fecha y franja agendadas — **sin campo definido, ver bloqueante arriba** |
| `urbanServiceStarted` | `STARTED` | vacío |
| `urbanServiceDelayed` | `PROGRESS` | motivo en `publicMessage` o `internalMessage`. **Solo con el servicio `IN_PROGRESS`**: antes de arrancar el ticket sigue `ROUTED` y §8.2 rechaza `PROGRESS` (#146) |
| `urbanServiceCompleted` | `RESOLVED` | `details.resolution.type` + `publicMessage`, y la foto del trabajo en `attachments[]` |
| `environmentalInspectionScheduled` | `STARTED` | vacío |
| `environmentalInspectionCompleted`, sin irregularidad | `RESOLVED` | `details.resolution.type` + `publicMessage`: "no se encontraron irregularidades" |
| `environmentalInspectionCompleted`, con acta | `PROGRESS` | El caso sigue en M4. **Nunca el contenido del acta** |
| Se desestima el reporte | `REJECTED` | `details.cancellation.reasonCode` + `publicMessage`/`internalMessage` |
| El reclamo no es de nuestra área | `RETURNED` | `details.returnInfo.reasonCode` + `publicMessage`/`internalMessage`. Vuelve a M2 para que lo re-derive, en vez de cancelárselo al vecino |
| El inspector necesita un dato del vecino | `INFORMATION_REQUIRED` | `details.informationRequest.messageForCitizen` (+ `requiredBy` opcional) |

Los otros dos hechos no tienen traducción directa:

- **`zoneNotServiced` no es un reclamo, es una zona.** Cuando un recorrido deja una zona sin atender no hay un `ticketId`, hay *n*. Lo que sale es **un `updateTicketStatus` con `PROGRESS` por cada reclamo abierto de esa zona**: el abanico lo abrimos nosotros, a partir de un hecho que del lado de M2 no tiene forma de representarse entero.
- **`containerOverflowed` depende del origen.** Si el desborde lo reportó un vecino hay `ticketId` y sale el evento. Si lo detectamos en la recorrida, no hay reclamo al que contestarle y no sale nada.

## La respuesta vuelve por `ticketUpdated`

`INFORMATION_REQUIRED` se correlaciona sin ID: desde la v1.5 no hay `informationRequestId`, sino una invariante de "como máximo una `InformationRequest` activa por ticket a la vez", así que la respuesta del vecino siempre corresponde a la nuestra. La v1.6 (§9) agrega qué pasa si mandamos un segundo pedido con uno activo: **M2 no abre una interacción paralela**, lo rechaza o registra conflicto. Llega como [`ticketUpdated / INFORMATION_PROVIDED`](../consumidos/ticketUpdated.md).

## Un hecho, dos eventos, un solo efecto

Al cerrar un servicio nacido de un reclamo se publica el hecho interno **y** este `updateTicketStatus`. Como M2 solo consume el segundo no hay doble efecto, pero conviene dejarlo asentado: la regla 1 del enunciado exige que un evento ya procesado no genere efectos duplicados, y esto se parece a una violación sin serlo.
