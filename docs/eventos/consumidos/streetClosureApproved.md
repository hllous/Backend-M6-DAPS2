# `streetClosureApproved` ← M7

M7 autorizó el corte de calle que pedimos.

> ✅ **Payload confirmado (25/08).** M7 publicó su documento de referencia con los campos reales, reemplazando el diseño tentativo que teníamos.

## Qué hace M6 al recibirlo

Marca la [`StreetClosureRequest`](../../entidades/derivaciones.md#streetclosurerequest--m7) como aprobada y **habilita la ejecución del [`Service`](../../entidades/service.md) o la [`TreeIntervention`](../../entidades/tree-intervention.md) que estaba bloqueada**.

Correlaciona por `closureRequestId` (obligatorio, uuid) y guarda el `streetClosureId` de M7 como `closureId` del corte. No hay mapeo de respaldo para correlacionar eventos posteriores: [`streetClosureEnded`](streetClosureEnded.md) trae `closureRequestId` propio y es lo único que se usa. El código no lee `requestingModule`.

## Payload confirmado

```
streetClosureApproved
  streetClosureId, closureRequestId, requestingModule ("ambiente" para nosotros),
  startDate, endDate, affectedStreet[],
  detours[ { street, alternateRoute } ], conditions[]
```

| Campo | Nota |
|---|---|
| ✅ `closureRequestId` | El `requestId` que mandamos en [`streetClosureRequested`](../publicados/streetClosureRequested.md), de ida y vuelta. **No se llama `sourceRequestId`** como habíamos pedido, pero es el mismo dato |
| ✅ `requestingModule` | La etiqueta de origen. Para nosotros viaja `"ambiente"`, en minúscula (M7, 20/10). El código no lo lee |
| `startDate`, `endDate` | La ventana que autorizaron, que puede no ser la que pedimos |
| `affectedStreet[]` | Las calles que quedan cortadas |

`detours[]` y `conditions[]` son nice to have; no los usamos.

## Notas

**`startDate` y `endDate` pueden diferir de lo solicitado.** Si la ventana autorizada no coincide con la agendada, el servicio se reprograma dentro de la ventana, no al revés.

El nombre está acordado entre los tres módulos: M3 corrigió su `streetClosureAuthorized` y adoptó este. Los campos de origen tienen otro nombre del que pedimos (`closureRequestId`/`requestingModule` en vez de `sourceRequestId`/`sourceModule`), pero el dato está — ver [bloqueantes.md](../../integracion/m7.md#m7--tránsito-).

## Un corte aprobado puede expirar sin aviso: lo vencemos nosotros (#321)

Según el documento «Payloads actualizados Core v4» de M7 (19/10), un corte `APPROVED` que nunca se activó pasa a `EXPIRED` **sin publicar nada**. Lo resolvemos por tiempo, con el mismo criterio que `ReportDeadlineSweeper`:

- **Se guarda la ventana autorizada.** `startDate` y `endDate` van a `approvedFrom` y `approvedTo` de la `StreetClosureRequest`, sin pisar `closureFrom`/`closureTo` (lo pedido). La ventana autorizada prevalece sobre la pedida. Ausentes o ilegibles no tumban el handler: se omiten y ese corte no se vence nunca (no se inventan fechas; vale también para los aprobados antes del cambio y para el `POST /street-closure-requests/:id/approve` manual, que tampoco guarda ventana y por eso no vence). Un reintento del evento se descarta entero (el corte ya no está `REQUESTED`), así que no pisa la ventana guardada.
- **Barrido.** `StreetClosureExpirySweeper` (cron horario y al arrancar, idempotente) pasa a `EXPIRED` los `APPROVED` con `approvedTo` + **6 horas de gracia** vencido. La gracia evita competir con el [`streetClosureEnded`](streetClosureEnded.md) que M7 publica al vencer un corte que sí estuvo `ACTIVE`.
- **Efecto sobre lo que dependía.** En la misma transacción, un `Service` todavía `SCHEDULED` pasa a `RESCHEDULED` con el motivo «venció la ventana autorizada del corte» (M6 no sabe si el corte llegó a estar activo: `streetClosureActivated` es interno de M7; se reprograma con `confirm-reschedule`); uno iniciado o cerrado no se toca. La `TreeIntervention` tampoco se toca, igual que ante un rechazo.
- **No se publica nada hacia M7**: el corte ya expiró de su lado.

El costo asumido es que una expiración y una demora de M7 se ven igual. Ver [m7.md](../../integracion/m7.md#m7--tránsito-).

## Evento tardío o repetido

Solo aplica si el corte sigue en `REQUESTED`. Sobre uno ya `REJECTED` o `ENDED` (evento tardío, o `streetClosureEnded` que llegó antes) o ya `APPROVED` (repetido) se descarta con un `warn`, sin error: el inbox lo responde `processed`.
