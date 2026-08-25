# `workOrderScheduled` ← M3

Acuse de la solicitud de reparación que les mandamos.

## Qué hace M6 al recibirlo

Pasa la [`RepairRequest`](../../entidades/derivaciones.md#repairrequest--m3) correspondiente a **en curso**.

## Campos imprescindibles

| Campo | Nota |
|---|---|
| ✅ `sourceRequestId` | El `requestId` que mandamos en [`infrastructureRepairRequested`](../publicados/infrastructureRepairRequested.md). **Confirmado (25/08).** Era nuestro bloqueante principal, queda cerrado |
| `estimatedDuration` | Nuevo en la confirmación de M3. Nice to have: permite estimar cuándo se libera lo que dependa de la reparación |

## Lo que falta definir

⚠️ **Cuándo se dispara.** En su lista anterior el acuse era `workOrderCreated`, que significaba "la recibí y abrí la orden". `workOrderScheduled` significa "le puse fecha", que puede ser bastante después.

Si es lo segundo, entre que mandamos la solicitud y ellos la agendan **no tenemos ninguna señal**, y no podemos distinguir "todavía no la vieron" de "la están por hacer". Ver [bloqueantes.md](../../bloqueantes.md#m3--obras-públicas--con-una-pregunta).

Es el único evento consumido nuevo respecto del diseño original: se agrega recién cuando esto se confirme.
