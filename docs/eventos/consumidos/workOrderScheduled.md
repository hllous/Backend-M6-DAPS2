# `workOrderScheduled` ← M3

Acuse de la solicitud de reparación que les mandamos. **Contrato cerrado con M3 el 5 oct 2026** ([bloqueantes.md](../../bloqueantes.md#m3--obras-públicas)).

## Qué hace M6 al recibirlo

Pasa la [`RepairRequest`](../../entidades/derivaciones.md#repairrequest--m3) correspondiente a **en curso**.

## Campos

| Campo | Nota |
|---|---|
| ✅ `sourceRequestId` | **Obligatorio**, uuid. Es el `requestId` que mandamos en [`infrastructureRepairRequested`](../publicados/infrastructureRepairRequested.md). Confirmado (25/08) |
| `workOrderId` | Se guarda en la `RepairRequest` si viene |
| `estimatedDuration` | Se tolera. No lo usamos |

## Cuándo se dispara

✅ **Sin impacto, aceptado en ambos casos.** M3 lo dispara cuando quiera: al abrir la orden (como el viejo `workOrderCreated`, que no consumimos) o recién al agendarla. El consumer funciona igual; solo cambia qué tan pronto pasa la solicitud a en curso. Si `workOrderCompleted` llega sin haber visto este evento, la solicitud cierra directo desde `REQUESTED`.

Es el único evento consumido nuevo respecto del diseño original.

## Evento tardío o repetido

Solo aplica si la solicitud sigue en `REQUESTED`. Si ya está en curso o cerrada (evento repetido, o `workOrderCompleted` que llegó antes), se descarta con un `warn`, sin error: el inbox lo responde `processed`.
