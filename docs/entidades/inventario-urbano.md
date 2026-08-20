# Inventario urbano

El patrimonio ambiental que administramos, sin contar los contenedores ([container.md](container.md)) ni las intervenciones sobre el arbolado ([tree-intervention.md](tree-intervention.md)).

| Entidad | Campos principales |
|---|---|
| `GreenPoint` | Punto verde de entrega voluntaria. `code`, `name`, `location`, `acceptedWasteTypes[]`, `zoneId`, `status` |
| `Tree` | `surveyCode`, `species`, `location`, `heightM`, `diameterCm`, `zoneId`, más el historial de `TreeSurvey` |
| `TreeSurvey` | `treeId`, `surveyedAt`, `inspectorId`, `healthStatus`, `riskLevel`, `riskType`, `suggestedIntervention`, `requiresStreetClosure`, `requiresPublicWorks`, `notes` |
| `GreenSpace` | `name`, `spaceType`, `areaM2`, `zoneId`, `status` |

Enums: `acceptedWasteTypes[]` es `WasteType`, `healthStatus` es `TreeHealthStatus`, `riskLevel` es `RiskLevel`, `riskType` es `RiskType`, `suggestedIntervention` es `TreeInterventionType`, `spaceType` es `GreenSpaceType` — ver [enumeraciones.md](../enumeraciones.md). `zoneId` → [`Zone`](configuracion-y-recursos.md#zone).

## `Tree` y `TreeSurvey` — el censo

El árbol es la entidad estable; el relevamiento es la foto. **`Tree` guarda el historial completo de `TreeSurvey`**, no solo el último: el estado sanitario de un árbol es una serie, y comparar relevamientos es lo que justifica una poda o una extracción.

El relevamiento es el que decide: `riskLevel` y `riskType` salen de acá, y `suggestedIntervention` es lo que después se materializa en una [`TreeIntervention`](tree-intervention.md).

**Un `TreeSurvey` con `riskLevel` en `HIGH` o `CRITICAL` dispara [`treeRiskDetected`](../eventos/publicados/treeRiskDetected.md)** → M3 y M7. Con cualquier otro valor no sale nada.

`requiresPublicWorks` señala el componente que no nos corresponde (una raíz que levantó la vereda); `requiresStreetClosure` anticipa que la intervención va a necesitar cortar la calle.

## `GreenPoint`

Punto de entrega voluntaria. `acceptedWasteTypes[]` define qué se puede dejar ahí. Se vacía y se mantiene como [`Service`](service.md) con `mode = POINT`.

## `GreenSpace`

Plazas, parques, canteros y ramblas. El riego y el corte de césped se programan como servicios sobre el espacio.
