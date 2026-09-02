# `treePruningScheduled` → M7

La poda programada. M7 la recibe antes que la solicitud de corte, para que sepan que viene.

Schema: [`treePruningScheduled.schema.json`](treePruningScheduled.schema.json).

## Cuándo se dispara

Al programar una [`TreeIntervention`](../../entidades/tree-intervention.md) como [`Service`](../../entidades/service.md). La fecha, la ventana y la cuadrilla salen del servicio, que va identificado por si M7 quiere seguirlo.

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
