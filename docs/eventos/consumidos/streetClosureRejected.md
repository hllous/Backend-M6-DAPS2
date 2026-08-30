# `streetClosureRejected` ← M7

M7 no autorizó el corte de calle que pedimos.

> ✅ **Payload confirmado (25/08).** Ver [`streetClosureApproved`](streetClosureApproved.md) para el contexto del documento de referencia que publicó M7.

## Qué hace M6 al recibirlo

Marca la [`StreetClosureRequest`](../../entidades/derivaciones.md#streetclosurerequest--m7) como rechazada y **reprograma o cancela** el [`Service`](../../entidades/service.md) dependiente.

Cuál de las dos depende del trabajo: una poda de seguridad se reprograma, un servicio que ya no tiene sentido se cancela. Si el trabajo nació de un reclamo, el cambio se le informa al vecino con un [`updateTicketStatus`](../publicados/updateTicketStatus.md).

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

Los campos de origen llegaron con otro nombre del que pedimos (`closureRequestId`/`requestingModule`), pero el dato está — igual que en [`streetClosureEnded`](streetClosureEnded.md) desde el 30/08.
