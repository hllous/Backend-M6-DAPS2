# `workOrderCompleted` ← M3

La reparación terminó. Es el cierre de nuestra derivación hacia Obras Públicas.

## Qué hace M6 al recibirlo

Cierra la [`RepairRequest`](../../entidades/derivaciones.md#repairrequest--m3) asociada.

Si el daño estaba en un [`Container`](../../entidades/container.md), es también lo que lo devuelve de `UNDER_REPAIR` a `ACTIVE`.

## Campos imprescindibles

| Campo | Nota |
|---|---|
| 🔴 `sourceRequestId` | El `requestId` que mandamos. Sin él no sabemos qué solicitud cerrar |
| `outcome` | Cómo terminó |
| `completedAt` | Cuándo |

## Notas

**`workOrderValidated` desapareció** de su lista y está bien así: la solicitud la cierra este evento y no hay ambigüedad sobre cuál es el cierre.

**`workOrderUpdated` va solo hacia M2 y no lo necesitamos.** Nuestra solicitud de reparación tiene tres estados —pedida, en curso, cerrada— y con `workOrderScheduled` + este alcanza.

El nombre coincide exacto de los dos lados: no hubo que renombrar nada.
