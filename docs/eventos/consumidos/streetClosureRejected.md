# `streetClosureRejected` ← M7

M7 no autorizó el corte de calle que pedimos.

## Qué hace M6 al recibirlo

Marca la [`StreetClosureRequest`](../../entidades/derivaciones.md#streetclosurerequest--m7) como rechazada y **reprograma o cancela** el [`Service`](../../entidades/service.md) dependiente.

Cuál de las dos depende del trabajo: una poda de seguridad se reprograma, un servicio que ya no tiene sentido se cancela. Si el trabajo nació de un reclamo, el cambio se le informa al vecino con un [`updateTicketStatus`](../publicados/updateTicketStatus.md).

## Campos imprescindibles

| Campo | Nota |
|---|---|
| `sourceRequestId` | El `requestId` que mandamos. Sin él no sabemos qué servicio reprogramar |
| `rejectionReason` | Decide si tiene sentido volver a pedirlo con otra ventana |

## Notas

`rejectionReason` es lo que separa "esta calle no se puede cortar" de "no en ese horario". Del primero no se reintenta; del segundo sí, con otra ventana.

Falta que M7 devuelva `sourceRequestId` y `sourceModule` en las tres respuestas.
