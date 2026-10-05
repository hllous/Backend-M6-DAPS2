# `streetClosureEnded` ← M7

El corte de calle terminó.

> ✅ **Payload actualizado (30/08).** M7 ahora incluye `closureRequestId`, cerrando la asimetría que tenía este evento frente a `streetClosureApproved` y `streetClosureRejected`.

## Qué hace M6 al recibirlo

Libera la dependencia de la [`StreetClosureRequest`](../../entidades/derivaciones.md#streetclosurerequest--m7) y habilita la reprogramación de lo que hubiera quedado esperando.

## Payload confirmado

```
streetClosureEnded
  streetClosureId, closureRequestId, completionDateTime, notes
```

| Campo | Nota |
|---|---|
| `streetClosureId` | El identificador propio de M7 para el corte |
| ✅ `closureRequestId` | El `closureRequestId` que mandamos en [`streetClosureRequested`](../publicados/streetClosureRequested.md), de ida y vuelta. Ya no hace falta correlacionar por otra vía |
| `completionDateTime` | Cuándo terminó. Según el documento de M7; el consumer no lo lee |
| `requestingModule` | El código no lo lee ni lo valida en ninguno de los tres eventos de corte. Su valor (`"Obras"`/`"Ambiente"`) no está verificado contra lo que M7 manda en `streetClosureEnded` |

**Qué lee el código** (`OutboundResponsesConsumer`): `closureRequestId` es **obligatorio y debe ser uuid** — sin él el inbox responde 400 (`sourceRequestId` se acepta como alias de entrada, no es el contrato de M7). Además toma `streetClosureId` (o `closureId`) y lo guarda como `closureId` solo si el corte no tenía uno. No hay mapeo `streetClosureId → closureRequestId` propio: si M7 manda este evento sin `closureRequestId`, se rechaza, no se correlaciona por otra vía.

## La asimetría, ya resuelta

**Hasta el 25/08, este evento no traía el origen de la solicitud** — a diferencia de [`streetClosureApproved`](streetClosureApproved.md) y [`streetClosureRejected`](streetClosureRejected.md), que sí lo traían. La idea era persistir el mapeo `streetClosureId → closureRequestId` desde el `streetClosureApproved` anterior; nunca se implementó.

**El documento de referencia nuevo de M7 (30/08) agrega `closureRequestId` directamente en `streetClosureEnded`.** La correlación depende exclusivamente de ese campo: no hay mapeo propio de respaldo.

## El typo, ya resuelto

**En la lista anterior de M7 figuraba como `streetClousureEnded`**, con una `u` de más. El documento de referencia (25/08) ya lo escribe bien: **`streetClosureEnded`**, coincidiendo con lo que usamos nosotros y M3.

## Evento tardío o repetido

Se acepta desde `APPROVED` y también desde `REQUESTED`: los eventos viajan por routing keys distintas sin orden garantizado, así que `streetClosureEnded` puede adelantarse a `streetClosureApproved`. En ese caso se guarda el `streetClosureId` como `closureId` si no lo teníamos, y el `streetClosureApproved` que llegue después se descarta (`ENDED` es terminal). Desde `REJECTED` o `ENDED` se descarta con un `warn`, sin error: el inbox responde `processed`.
