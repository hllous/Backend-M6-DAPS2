# `treePruningScheduled` → M7

La poda programada. M7 la recibe antes que la solicitud de corte, para que sepan que viene.

Schema: [`treePruningScheduled.schema.json`](treePruningScheduled.schema.json).

## Cuándo se dispara

Cuando el [`Service`](../../entidades/service.md) que ejecuta una [`TreeIntervention`](../../entidades/tree-intervention.md) queda con **cuadrilla y franja horaria**, y el evento todavía no salió. Normalmente es al asociarlos (`POST /tree-interventions/:id/assign-service`, si el servicio ya los tiene); si faltaban, se difiere y sale después, en la edición del servicio que completa los dos datos (`assign-crew`, `PATCH /services/:id` o `confirm-reschedule`). La fecha, la ventana y la cuadrilla salen del servicio, que va identificado por si M7 quiere seguirlo.

**Se emite una sola vez.** M7 declara `crewId` y `timeWindow` como requeridos y en nuestro modelo son opcionales hasta que se asignan (#324). `TreeIntervention.pruningScheduledAt` recuerda que ya salió: un cambio posterior de cuadrilla, fecha o franja **no lo reenvía**, porque M7 no define un evento de reprogramación de poda. Un servicio en `RESCHEDULED` tampoco lo emite aunque se le complete la cuadrilla o la franja: espera a `confirm-reschedule`, para que viaje la fecha definitiva.

## Payload

```
interventionId, serviceId, interventionType, treeIds[],
zoneId, location,
scheduledDate, timeWindow { from, to },
crewId, requiresStreetClosure
```

| Campo | Nota |
|---|---|
| `serviceId` | Va explícito para que se pueda correlacionar con [`urbanServiceScheduled`](urbanServiceScheduled.md) |
| `treeIds[]` | Una intervención puede cubrir varios árboles |
| `requiresStreetClosure` | Booleano. **En `true`, después les llega la solicitud de corte** ([`streetClosureRequested`](streetClosureRequested.md)) |

Enums: `interventionType` es `TreeInterventionType` — ver [enumeraciones.md](../../enumeraciones.md).

✅ **`interventionType` conserva los cinco valores del catálogo** ([ADR-003](../../decisiones/adr-003-divergencias-enums.md), divergencia 4): el acuerdo publicado no distinguía las dos podas y llamaba `FELLING` a `REMOVAL`. Pendiente de avisarle a M7.

## Qué le pedimos al consumidor

Nada. Es informativo; lo que dispara acción de M7 es la solicitud de corte.
