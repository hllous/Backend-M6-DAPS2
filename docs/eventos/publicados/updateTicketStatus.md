# `updateTicketStatus` → M2

El canal del vecino, y el único evento que M2 consume de las áreas operativas. **El payload lo define M2 en su contrato — v1.5, reemplaza la v1.2 — y lo adoptamos tal cual**: no pedimos campos nuevos ni proponemos alternativas.

Schema: [`updateTicketStatus.schema.json`](updateTicketStatus.schema.json).

## Cuándo se dispara

Cuando cambia el estado de un [`Service`](../../entidades/service.md) o de una inspección **que nacieron de un reclamo**. Un servicio planificado —la recolección de todos los martes— no tiene `ticketId` y no genera nada hacia M2.

> **La regla:** proyectamos si y solo si el `Service` o el [`EnvironmentalReport`](../../entidades/environmental-report.md) tiene `ticketId`. Sin esta regla, M2 recibe eventos de tickets que no existen.

## Payload (v1.5)

```
ticketId, updateType,
publicMessage?, internalMessage?, progress?, details?,
attachments[]?, updatedBy, statusChangedAt
```

🔄 **Cambió respecto de la v1.2 que habíamos adoptado antes:**

- `publicId` y `expectedTicketVersion` **salieron del contrato**. Nunca fueron parte del canal máquina-a-máquina — la v1.5 aclara que la correlación es solo por `ticketId`. No hace falta persistir `ticketVersion` ni devolver versión de nada.
- `message` se partió en **`publicMessage`** (lo ve el vecino) e **`internalMessage`** (nota privada, nunca se republica).
- `updatedAt` se renombró a **`statusChangedAt`**.
- `progress` ahora es un campo de primer nivel, pero es un **`Int` (porcentaje estimado)** — no el objeto `progress.estimatedCompletionAt` que usábamos para la fecha agendada. No hay traducción directa para nuestro caso de uso; ver el bloqueante más abajo.

| Campo | Nota |
|---|---|
| `ticketId` | De M2. Lo guardamos en el `Service` y en el `EnvironmentalReport` |
| `updateType` | `STARTED` \| `PROGRESS` \| `INFORMATION_REQUIRED` \| `RETURNED` \| `RESOLVED` \| `REJECTED` |
| `publicMessage?` | Texto libre para el vecino |
| `internalMessage?` | Nota privada, nunca se muestra al vecino |
| `progress?` | `Int`, porcentaje estimado. **No sirve para la fecha/franja agendada** — ver bloqueante |
| `details?` | Objeto cuya forma depende del `updateType` — ver la tabla de abajo |
| `attachments[]?` | En el formato de M2: `{ attachmentId, fileName, contentType, url, sizeBytes }`, no el nuestro |
| `updatedBy` | `{ type: AREA_USER, id }` |
| `statusChangedAt` | Fecha y hora |

**No lleva `status`.** Informamos el hecho y M2 decide la transición: nuestro modelo no vuelve a nombrar estados de M2 en ningún lado.

**No lleva `sourceRef`.** Su contrato prohíbe transportar IDs de entidades internas de otros módulos, así que la correlación `ticketId ↔ serviceId ↔ inspectionId` queda en una tabla nuestra.

**No guardamos `publicId` ni `ticketVersion`.** Ya no hace falta con la v1.5: solo correlacionamos por `ticketId`.

`updateType` no usa nuestro enum `TicketStatusUpdate`, que [ADR-003](../../decisiones/adr-003-divergencias-enums.md) eliminó del catálogo: el vocabulario lo define M2 y lo adoptamos tal cual.

### 🔴 Bloqueante: `progress` no sirve para la fecha agendada

El campo común `progress` de la v1.5 es un `Int` (porcentaje estimado), no una fecha. Y no hay ninguna estructura de `details` definida para `STARTED`/`PROGRESS` — el punto 8.2 de su contrato dice "details obligatorio: Ninguno". Necesitamos saber cómo mandar la fecha/franja agendada del servicio: ¿va como texto en `publicMessage`, o van a definir una estructura tipo `details.schedule`? Ver [bloqueantes.md](../../bloqueantes.md#tablero).

### Siempre `STARTED` antes de `RESOLVED`

**Decisión de diseño propia, no depende de M2.** Su matriz permite saltar directo de `ROUTED` a `RESOLVED` para los Request Types que ustedes marquen como "admite resolución directa", pero no publicaron ese catálogo. En vez de esperarlo, publicamos siempre `STARTED` inmediatamente antes de `RESOLVED` — es válido en cualquier caso de su matriz. Esto incluye los servicios que se resuelven por una ruta ya agendada (recolección, barrido), donde `STARTED` sale con el mismo timestamp que `RESOLVED`.

### Enums ya publicados en la v1.5

- `resolution.type`: `ACTION_COMPLETED | REQUEST_FULFILLED | INFORMATION_PROVIDED | ACKNOWLEDGED | NO_FURTHER_ACTION_REQUIRED`
- `returnInfo.reasonCode`: `INVALID_INFORMATION | REQUEST_TYPE_MISMATCH | INSUFFICIENT_CONTEXT | OTHER`
- `cancellation.reasonCode`: `OUT_OF_SCOPE | DOES_NOT_APPLY | INVALID_REQUEST_TYPE | INVALID_DATA | REJECTED_BY_AREA | OTHER`

## De qué hecho interno sale cada `updateType`

Esta es la tabla con la que se implementa. **La columna izquierda son hechos internos de nuestro modelo, no eventos publicados**: salvo `urbanServiceScheduled`, ninguno sale al bus (ver [descartados.md](descartados.md)). Cuando ocurre el hecho, publicamos el `updateTicketStatus` que le corresponde.

| Hecho nuestro | `updateType` | Qué mandamos |
|---|---|---|
| `urbanServiceScheduled` | `PROGRESS` | fecha y franja agendadas — **sin campo definido, ver bloqueante arriba** |
| `urbanServiceStarted` | `STARTED` | vacío |
| `urbanServiceDelayed` | `PROGRESS` | motivo en `publicMessage` o `internalMessage` |
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

`INFORMATION_REQUIRED` se correlaciona sin ID: la v1.5 reemplazó `informationRequestId` por una invariante de "como máximo una `InformationRequest` activa por ticket a la vez", así que la respuesta del vecino siempre corresponde a la nuestra. Llega como [`ticketUpdated / INFORMATION_PROVIDED`](../consumidos/ticketUpdated.md).

## Un hecho, dos eventos, un solo efecto

Al cerrar un servicio nacido de un reclamo se publica el hecho interno **y** este `updateTicketStatus`. Como M2 solo consume el segundo no hay doble efecto, pero conviene dejarlo asentado: la regla 1 del enunciado exige que un evento ya procesado no genere efectos duplicados, y esto se parece a una violación sin serlo.
