# `streetClosureApproved` ← M7

M7 autorizó el corte de calle que pedimos.

> ✅ **Payload confirmado (25/08).** M7 publicó su documento de referencia con los campos reales, reemplazando el diseño tentativo que teníamos.

## Qué hace M6 al recibirlo

Marca la [`StreetClosureRequest`](../../entidades/derivaciones.md#streetclosurerequest--m7) como aprobada y **habilita la ejecución del [`Service`](../../entidades/service.md) o la [`TreeIntervention`](../../entidades/tree-intervention.md) que estaba bloqueada**.

Persiste el origen de la solicitud (`closureRequestId`) junto con el `streetClosureId` — lo va a necesitar cuando llegue [`streetClosureEnded`](streetClosureEnded.md), que no trae ese dato.

## Payload confirmado

```
streetClosureApproved
  streetClosureId, closureRequestId, requestingModule (Obras|Ambiente),
  startDate, endDate, affectedStreet[],
  detours[ { street, alternateRoute } ], conditions[]
```

| Campo | Nota |
|---|---|
| ✅ `closureRequestId` | El `requestId` que mandamos en [`streetClosureRequested`](../publicados/streetClosureRequested.md), de ida y vuelta. **No se llama `sourceRequestId`** como habíamos pedido, pero es el mismo dato |
| ✅ `requestingModule` | La etiqueta de origen. Nosotros somos `"Ambiente"` |
| `startDate`, `endDate` | La ventana que autorizaron, que puede no ser la que pedimos |
| `affectedStreet[]` | Las calles que quedan cortadas |

`detours[]` y `conditions[]` son nice to have; no los usamos.

## Notas

**`startDate` y `endDate` pueden diferir de lo solicitado.** Si la ventana autorizada no coincide con la agendada, el servicio se reprograma dentro de la ventana, no al revés.

El nombre está acordado entre los tres módulos: M3 corrigió su `streetClosureAuthorized` y adoptó este. Los campos de origen tienen otro nombre del que pedimos (`closureRequestId`/`requestingModule` en vez de `sourceRequestId`/`sourceModule`), pero el dato está — ver [bloqueantes.md](../../bloqueantes.md#m7--tránsito-).
