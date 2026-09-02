# `treeRiskDetected` → M3, M7

Un árbol con riesgo alto. Va a dos módulos: M3 por el componente de infraestructura (una raíz que levantó la vereda), M7 por el corte de calle que la intervención puede necesitar.

Schema: [`treeRiskDetected.schema.json`](treeRiskDetected.schema.json).

## Cuándo se dispara

Cuando un [`TreeSurvey`](../../entidades/inventario-urbano.md#tree-y-treesurvey--el-censo) arroja `riskLevel` en **`HIGH` o `CRITICAL`**. Con cualquier otro valor no sale nada.

## Payload

```
treeId, surveyCode, species, zoneId, location,
riskLevel, riskType, healthStatus,
suggestedIntervention,
requiresStreetClosure, requiresPublicWorks,
surveyedAt
```

| Campo | Nota |
|---|---|
| `riskLevel` | Solo `HIGH` o `CRITICAL` salen del módulo |
| `suggestedIntervention` | Lo que el relevamiento recomienda. No es vinculante para nadie: la intervención la programamos nosotros |
| `requiresStreetClosure` | Booleano. Anticipa que después va a llegar un [`streetClosureRequested`](streetClosureRequested.md) |
| `requiresPublicWorks` | Booleano. El componente que le toca a M3 |

Enums: `riskLevel` es `RiskLevel`, `riskType` es `RiskType`, `healthStatus` es `TreeHealthStatus`, `suggestedIntervention` es `TreeInterventionType` — ver [enumeraciones.md](../../enumeraciones.md).

✅ **Los dos enums quedaron resueltos** por [ADR-003](../../decisiones/adr-003-divergencias-enums.md): `healthStatus` conserva `WEAKENED` y `DISEASED` en vez de colapsarlos en `DECLINING` (divergencia 3), e `interventionType` conserva los cinco valores del catálogo (divergencia 4). El `MONITORING` que el acuerdo agregaba **se descarta**: monitorear no es una intervención sino la ausencia de una, así que `suggestedIntervention` pasa a ser **opcional** y su ausencia es la que lo expresa. Pendiente de avisarle a M3 y M7.

## Qué le pedimos al consumidor

Nada de vuelta. M3 lo aceptó tal cual en su lista de consumo, así que **queda descartado** el evento genérico con `hazardType` que se había ofrecido como alternativa. Su lista actualizada ya no tiene el alias `urbanRiskDetected`.
