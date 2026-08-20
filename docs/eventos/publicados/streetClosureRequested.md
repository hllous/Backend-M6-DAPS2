# `streetClosureRequested` → M7

La solicitud de corte de calle. Es el único de los cuatro que le mandamos a M7 que dispara acción de su lado.

Schema: [`streetClosureRequested.schema.json`](streetClosureRequested.schema.json).

## Cuándo se dispara

Al crear una [`StreetClosureRequest`](../../entidades/derivaciones.md#streetclosurerequest--m7), cuando un [`Service`](../../entidades/service.md) o una [`TreeIntervention`](../../entidades/tree-intervention.md) requiere cortar la calle.

## Payload

```
requestId, sourceModule, sourceRef,
reason, streets[], from, to,
closureType, requestedAt
```

| Campo | Nota |
|---|---|
| `sourceModule` | Siempre `M6`. **Es el campo que M7 pidió por su cuenta**, y coincidía con lo que necesitábamos |
| `sourceRef` | El `serviceId` o `interventionId` que origina el corte |
| `requestId` | Nuestro. Es el que le pedimos a M7 que devuelva |
| `from`, `to` | Ventana del corte |

Enums: `closureType` es `StreetClosureType` — ver [enumeraciones.md](../../enumeraciones.md).

Mismo contrato que la solicitud que M7 recibe de M3.

## Qué le pedimos al consumidor

**Que devuelvan `sourceRequestId` y `sourceModule`** en las tres respuestas: [`streetClosureApproved`](../consumidos/streetClosureApproved.md), [`streetClosureRejected`](../consumidos/streetClosureRejected.md) y [`streetClosureEnded`](../consumidos/streetClosureEnded.md). Sin eso no sabemos cuál de nuestras solicitudes contestaron.

⚠️ En la lista de M7 el tercero figura como `streetClousureEnded`, con una `u` de más. Falta avisarles.
