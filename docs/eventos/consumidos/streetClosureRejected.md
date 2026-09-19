# `streetClosureRejected` ← M7

M7 no autorizó el corte de calle que pedimos.

> ✅ **Payload confirmado (25/08).** Ver [`streetClosureApproved`](streetClosureApproved.md) para el contexto del documento de referencia que publicó M7.

## Qué hace M6 al recibirlo

Marca la [`StreetClosureRequest`](../../entidades/derivaciones.md#streetclosurerequest--m7) como rechazada y **marca para reprogramar** (`SCHEDULED → RESCHEDULED`) el [`Service`](../../entidades/service.md) dependiente.

Cancelarlo en vez de reprogramarlo (un servicio que sin el corte ya no tiene sentido) queda a criterio del operador; el consumer no cancela nada.

## Payload confirmado

```
streetClosureRejected
  closureRequestId, rejectionReason, requestingModule (Obras|Ambiente)
```

| Campo | Nota |
|---|---|
| ✅ `closureRequestId` | El `requestId` que mandamos. **No se llama `sourceRequestId`** como habíamos pedido, pero es el mismo dato — sin él no sabemos qué servicio reprogramar |
| `rejectionReason` | Decide si tiene sentido volver a pedirlo con otra ventana |
| ✅ `requestingModule` | Nosotros somos `"Ambiente"` |

## Notas

`rejectionReason` es lo que separa "esta calle no se puede cortar" de "no en ese horario". Del primero no se reintenta; del segundo sí, con otra ventana.

M6 copia `rejectionReason` al `statusReason` del servicio marcado para reprogramar, así el operador ve el motivo. Si llega un sobre con el nombre viejo `reason` también se toma.

Los campos de origen llegaron con otro nombre del que pedimos (`closureRequestId`/`requestingModule`), pero el dato está — igual que en [`streetClosureEnded`](streetClosureEnded.md) desde el 30/08.
