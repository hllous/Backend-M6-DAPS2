# `workOrderScheduled` ← M3

Acuse de la solicitud de reparación que les mandamos. **Contrato cerrado con M3 el 5 oct 2026** ([bloqueantes.md](../../integracion/m3.md#m3--obras-públicas)).

## Qué hace M6 al recibirlo

Pasa la [`RepairRequest`](../../entidades/derivaciones.md#repairrequest--m3) correspondiente a **en curso**.

## Campos

| Campo | Nota |
|---|---|
| ✅ `sourceRequestId` | **Obligatorio**, uuid. Es el `requestId` que mandamos en [`infrastructureRepairRequested`](../publicados/infrastructureRepairRequested.md). Confirmado (25/08) |
| `workOrderId` | Se guarda en la `RepairRequest` si viene, como string sin validar el formato. **M3 v0.6 (20/10) propone que sea el UUID técnico de la orden** (ej. `1bb68ec6-56b2-43a8-956b-6949ac740b8a`); pendiente de que M6 lo valide. Hoy toleramos cualquier string |
| `workOrderNumber` | **Propuesta de M3 v0.6, opcional:** referencia humana de la orden (ej. `"OT-2026-0098"`). Hoy se tolera y **no se persiste** (el consumer no lo lee) |
| `estimatedDuration` | Se tolera. No lo usamos |

## Ejemplo de M3 (v0.6, 20/10, revisión bilateral)

El `data` que propone M3; en el sobre, `causationId` es el `eventId` de nuestro `infrastructureRepairRequested` y `sourceModule` es `obras`:

```json
{
  "sourceRequestId": "4f5a6b7c-8d9e-4f0a-9b1c-d3e4f5a6b7c8",
  "workOrderId": "1bb68ec6-56b2-43a8-956b-6949ac740b8a",
  "workOrderNumber": "OT-2026-0098",
  "estimatedDuration": "PT4H"
}
```

M3 pide a M6 tres cosas: validar sus schemas de `workOrderScheduled` y `workOrderCompleted`, confirmar `workOrderId` UUID con `workOrderNumber` opcional, y correr la prueba `requestId` → `sourceRequestId`. Estado en [m3.md](../../integracion/m3.md#m3--obras-públicas). **Superado por la prueba del 5/11:** M3 recibió nuestra solicitud por el Core y publicó `workOrderScheduled` y `workOrderCompleted`, y la derivación quedó Cerrada ([historial](../../integracion/historial.md)); el «backend sin adaptador» era de su §9 al 20/10. Sigue sin verificarse la validación formal de sus schemas y la hora exacta de cada publicación.

## Cuándo se dispara

✅ **Sin impacto, aceptado en ambos casos.** M3 lo dispara cuando quiera: al abrir la orden (como el viejo `workOrderCreated`, que no consumimos) o recién al agendarla. El consumer funciona igual; solo cambia qué tan pronto pasa la solicitud a en curso. Si `workOrderCompleted` llega sin haber visto este evento, la solicitud cierra directo desde `REQUESTED`.

Es el único evento consumido nuevo respecto del diseño original.

## Evento tardío o repetido

Solo aplica si la solicitud sigue en `REQUESTED`. Si ya está en curso o cerrada (evento repetido, o `workOrderCompleted` que llegó antes), se descarta con un `warn`, sin error: el inbox lo responde `processed`.
