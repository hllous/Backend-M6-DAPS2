# `streetClosureApproved` ← M7

M7 autorizó el corte de calle que pedimos.

## Qué hace M6 al recibirlo

Marca la [`StreetClosureRequest`](../../entidades/derivaciones.md#streetclosurerequest--m7) como aprobada y **habilita la ejecución del [`Service`](../../entidades/service.md) o la [`TreeIntervention`](../../entidades/tree-intervention.md) que estaba bloqueada**.

## Campos imprescindibles

| Campo | Nota |
|---|---|
| `sourceRequestId` | El `requestId` que mandamos en [`streetClosureRequested`](../publicados/streetClosureRequested.md). Sin él no sabemos qué trabajo desbloquear |
| `from`, `to` | La ventana que autorizaron, que puede no ser la que pedimos |

Payload completo que publican:

```
streetClosureId, sourceRequestId, sourceModule,
from, to, detours[], rejectionReason (si aplica)
```

`detours[]` es nice to have; no lo usamos.

## Notas

**`from` y `to` pueden diferir de lo solicitado.** Si la ventana autorizada no coincide con la agendada, el servicio se reprograma dentro de la ventana, no al revés.

El nombre está acordado entre los tres módulos: M3 corrigió su `streetClosureAuthorized` y adoptó este. Falta que M7 devuelva `sourceRequestId` y `sourceModule` — ver [bloqueantes.md](../../bloqueantes.md#m7--tránsito-).
