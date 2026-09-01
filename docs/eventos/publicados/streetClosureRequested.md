# `streetClosureRequested` → M7

La solicitud de corte de calle. Es el único de los cuatro que le mandamos a M7 que dispara acción de su lado.

Schema: [`streetClosureRequested.schema.json`](streetClosureRequested.schema.json).

> ✅ **Payload unificado con M3 (30/08).** M7 recibía este evento con dos formas distintas según el origen (la nuestra y la de Obras) y propuso un esquema único para los dos. Lo aceptamos: los campos de abajo ya son los del esquema unificado, no el diseño anterior.

## Cuándo se dispara

Al crear una [`StreetClosureRequest`](../../entidades/derivaciones.md#streetclosurerequest--m7), cuando un [`Service`](../../entidades/service.md) o una [`TreeIntervention`](../../entidades/tree-intervention.md) requiere cortar la calle.

## Payload

```
closureRequestId, sourceModule, sourceRef,
reason, affectedSections[], requestedFrom, requestedTo,
closureType?, requestedAt
```

| Campo | Nota |
|---|---|
| `closureRequestId` | Nuestro. Antes se llamaba `requestId` — renombrado para compartir esquema con la solicitud que manda M3 |
| `sourceModule` | `M3` \| `M6`. Para nosotros, siempre `M6` |
| `sourceRef` | El `serviceId` o `interventionId` que origina el corte. En la solicitud de M3 cumple el mismo rol que su `workOrderId` |
| `affectedSections[]` | Antes `streets[]` |
| `requestedFrom`, `requestedTo` | Antes `from` / `to` |
| `closureType` | Opcional en el esquema unificado (antes requerido). Nosotros lo seguimos mandando siempre |

Enums: `closureType` es `StreetClosureType` — ver [enumeraciones.md](../../enumeraciones.md).

## Qué le pedimos al consumidor

**Que devuelvan `closureRequestId` y `requestingModule`** en las tres respuestas: [`streetClosureApproved`](../consumidos/streetClosureApproved.md), [`streetClosureRejected`](../consumidos/streetClosureRejected.md) y [`streetClosureEnded`](../consumidos/streetClosureEnded.md). Ya lo hacen los tres — ver [bloqueantes.md](../../bloqueantes.md#m7--tránsito-).
