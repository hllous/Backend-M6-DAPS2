# `updateTicketStatus` → M2

El canal del vecino, y el único evento que M2 consume de las áreas operativas. **El payload lo define M2 en su contrato v1.2 y lo adoptamos tal cual**: no pedimos campos nuevos ni proponemos alternativas.

Schema: [`updateTicketStatus.schema.json`](updateTicketStatus.schema.json).

## Cuándo se dispara

Cuando cambia el estado de un [`Service`](../../entidades/service.md) o de una inspección **que nacieron de un reclamo**. Un servicio planificado —la recolección de todos los martes— no tiene `ticketId` y no genera nada hacia M2.

> **La regla:** proyectamos si y solo si el `Service` o el [`EnvironmentalReport`](../../entidades/environmental-report.md) tiene `ticketId`. Sin esta regla, M2 recibe eventos de tickets que no existen.

## Payload

```
ticketId, publicId, expectedTicketVersion, updateType,
message?, details?, attachments[]?, updatedBy, updatedAt
```

| Campo | Nota |
|---|---|
| `ticketId`, `publicId` | De M2. Los guardamos en el `Service` y en el `EnvironmentalReport` |
| `expectedTicketVersion` | Control optimista de concurrencia. Exige persistir `ticketVersion` de nuestro lado: es una columna nueva |
| `updateType` | `STARTED` \| `PROGRESS` \| `INFORMATION_REQUIRED` \| `RETURNED` \| `RESOLVED` \| `REJECTED` |
| `message?` | Texto libre para el vecino |
| `details?` | Objeto cuya forma depende del `updateType` — ver la tabla de abajo |
| `attachments[]?` | En el formato de M2: `{ attachmentId, fileName, contentType, url, sizeBytes }`, no el nuestro |
| `updatedBy` | `{ type: AREA_USER, id }` |
| `updatedAt` | Fecha y hora |

**No lleva `status`.** Informamos el hecho y M2 decide la transición: nuestro modelo no vuelve a nombrar estados de M2 en ningún lado.

**No lleva `sourceRef`.** Su contrato prohíbe transportar IDs de entidades internas de otros módulos, así que la correlación `ticketId ↔ serviceId ↔ inspectionId` queda en una tabla nuestra.

`updateType` no usa nuestro enum `TicketStatusUpdate`, que quedó [obsoleto](../../enumeraciones.md#divergencias-con-el-acuerdo-publicado).

## De qué hecho interno sale cada `updateType`

Esta es la tabla con la que se implementa. **La columna izquierda son hechos internos de nuestro modelo, no eventos publicados**: salvo `urbanServiceScheduled`, ninguno sale al bus (ver [descartados.md](descartados.md)). Cuando ocurre el hecho, publicamos el `updateTicketStatus` que le corresponde.

| Hecho nuestro | `updateType` | Qué va en `details` |
|---|---|---|
| `urbanServiceScheduled` | `PROGRESS` | `progress.estimatedCompletionAt` con la fecha y franja agendadas |
| `urbanServiceStarted` | `STARTED` | vacío; el texto para el vecino va en `message` |
| `urbanServiceDelayed` | `PROGRESS` | `progress.estimatedCompletionAt` con la nueva estimación, y el motivo en `message` |
| `urbanServiceCompleted` | `RESOLVED` | `resolution.type` + `resolution.publicMessage`, y la foto del trabajo en `attachments[]` |
| `environmentalInspectionScheduled` | `STARTED` | vacío |
| `environmentalInspectionCompleted`, sin irregularidad | `RESOLVED` | `resolution.publicMessage`: "no se encontraron irregularidades" |
| `environmentalInspectionCompleted`, con acta | `PROGRESS` | El caso sigue en M4. **Nunca el contenido del acta** |
| Se desestima el reporte | `REJECTED` | `cancellation.reasonCode` + motivo |
| El reclamo no es de nuestra área | `RETURNED` | `returnInfo.reasonCode`. Vuelve a M2 para que lo re-derive, en vez de cancelárselo al vecino |
| El inspector necesita un dato del vecino | `INFORMATION_REQUIRED` | `informationRequestId`, `messageForCitizen`, `requestedItems[]` |

Los otros dos hechos no tienen traducción directa:

- **`zoneNotServiced` no es un reclamo, es una zona.** Cuando un recorrido deja una zona sin atender no hay un `ticketId`, hay *n*. Lo que sale es **un `updateTicketStatus` con `PROGRESS` por cada reclamo abierto de esa zona**: el abanico lo abrimos nosotros, a partir de un hecho que del lado de M2 no tiene forma de representarse entero.
- **`containerOverflowed` depende del origen.** Si el desborde lo reportó un vecino hay `ticketId` y sale el evento. Si lo detectamos en la recorrida, no hay reclamo al que contestarle y no sale nada.

## La respuesta vuelve por `ticketUpdated`

`INFORMATION_REQUIRED` se correlaciona con lo que el vecino conteste mediante `informationRequestId`, que genera el módulo que pregunta. La respuesta llega como [`ticketUpdated / INFORMATION_PROVIDED`](../consumidos/ticketUpdated.md).

## Un hecho, dos eventos, un solo efecto

Al cerrar un servicio nacido de un reclamo se publica el hecho interno **y** este `updateTicketStatus`. Como M2 solo consume el segundo no hay doble efecto, pero conviene dejarlo asentado: la regla 1 del enunciado exige que un evento ya procesado no genere efectos duplicados, y esto se parece a una violación sin serlo.
