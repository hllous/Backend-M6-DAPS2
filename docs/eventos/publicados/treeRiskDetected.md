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

⚠️ **Dos enums en conflicto** con el acuerdo publicado: `healthStatus` ([divergencia 3](../../enumeraciones.md#divergencias-con-el-acuerdo-publicado)) y `suggestedIntervention` ([divergencia 4](../../enumeraciones.md#divergencias-con-el-acuerdo-publicado), que además agrega un `MONITORING` que no existe en el catálogo). Hay que resolverlos antes de implementar.

## Qué le pedimos al consumidor

Nada de vuelta. M3 lo aceptó tal cual en su lista de consumo, así que **queda descartado** el evento genérico con `hazardType` que se había ofrecido como alternativa. Su lista actualizada ya no tiene el alias `urbanRiskDetected`.
