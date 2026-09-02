# Enumeraciones

Catálogo de valores cerrados usados en [entidades](entidades/) y [eventos](eventos/). Diseño tentativo hasta la primera entrega.

> **Es la fuente.** Los archivos de evento y de entidad linkean acá en vez de repetir los valores. Si agregás un valor, agregalo en esta tabla y no en el archivo que lo usa.
>
> Migrado de [`fuentes/alcance-entregable.md`](../fuentes/alcance-entregable.md) §5.3. Ojo con las [divergencias contra el acuerdo publicado](#divergencias-con-el-acuerdo-publicado--resueltas), ya resueltas al final.

## Catálogo

| Enumeración | Valores |
|---|---|
| `ServiceCategory` | `WASTE_COLLECTION`, `STREET_CLEANING`, `CONTAINERS`, `TREES`, `GREEN_SPACES`, `ENVIRONMENTAL_CONTROL` |
| `ServiceMode` | `ROUTE`, `POINT` |
| `ServiceStatus` | `SCHEDULED`, `RESCHEDULED`, `IN_PROGRESS`, `SUSPENDED`, `COMPLETED`, `PARTIALLY_COMPLETED`, `CANCELLED` |
| `ServiceOrigin` | `PLANNED`, `TICKET`, `WEATHER_ALERT`, `INSPECTION`, `MANUAL` |
| `TicketStatusUpdate` | `IN_PROGRESS`, `UPDATED`, `COMPLETED`, `REJECTED` — **obsoleto**, ver divergencia 1 |
| `DelayType` | `START`, `DURATION` |
| `ZoneResultStatus` | `SERVICED`, `PARTIAL`, `NOT_SERVICED` |
| `NotServicedReason` | `VEHICLE_BREAKDOWN`, `CREW_UNAVAILABLE`, `BLOCKED_ACCESS`, `STREET_CLOSURE`, `WEATHER`, `EXCESS_VOLUME`, `SECURITY_INCIDENT`, `OTHER` |
| `WasteType` | `HOUSEHOLD`, `RECYCLABLE`, `BULKY`, `GREEN`, `MIXED` |
| `DisposalSiteType` | `LANDFILL`, `TRANSFER_STATION`, `RECYCLING_PLANT`, `COMPOSTING_PLANT` |
| `ContainerType` | `HOUSEHOLD`, `RECYCLABLE`, `BULKY`, `GREEN` |
| `ContainerStatus` | `ACTIVE`, `OVERFLOWED`, `DAMAGED`, `UNDER_REPAIR`, `RELOCATING`, `REMOVED` |
| `DamageType` | `STRUCTURAL`, `BURNT`, `LID_BROKEN`, `WHEELS_BROKEN`, `VANDALIZED`, `MISSING` |
| `Severity` | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| `TreeHealthStatus` | `HEALTHY`, `WEAKENED`, `DISEASED`, `DEAD` |
| `RiskLevel` | `NONE`, `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| `RiskType` | `FALLING_BRANCH`, `TRUNK_INSTABILITY`, `ROOT_UPLIFT`, `POWER_LINE_CONTACT`, `SIGN_OBSTRUCTION`, `PEST_INFESTATION` |
| `TreeInterventionType` | `FORMATION_PRUNING`, `SAFETY_PRUNING`, `REMOVAL`, `PLANTING`, `TREATMENT` |
| `TreeInterventionStatus` | `REQUESTED`, `PENDING_AUTHORIZATION`, `AUTHORIZED`, `REJECTED` |
| `GreenSpaceType` | `SQUARE`, `PARK`, `PLANTER`, `MEDIAN`, `PROMENADE` |
| `EnvironmentalReportType` | `NOISE`, `DUMPING`, `ILLEGAL_DUMPSITE`, `WATER_DISCHARGE`, `AIR_EMISSION`, `ODOR`, `PEST_INFESTATION`, `OTHER` |
| `EnvironmentalReportStatus` | `RECEIVED`, `UNDER_REVIEW`, `FORWARDED`, `DISMISSED`, `INSPECTION_SCHEDULED`, `INSPECTED`, `NO_VIOLATION`, `VIOLATION_FOUND`, `NOTICE_ISSUED`, `SANCTIONED`, `CLOSED` |
| `InspectionOutcome` | `NO_VIOLATION`, `VIOLATION_FOUND`, `INCONCLUSIVE` |
| `InspectionNextStep` | `NOTICE_TO_BE_ISSUED`, `REINSPECTION`, `CASE_CLOSED` |
| `ViolationType` | `NOISE_LIMIT`, `ILLEGAL_DUMPING`, `UNTREATED_DISCHARGE`, `HAZARDOUS_WASTE`, `AIR_EMISSION`, `NO_WASTE_MANAGEMENT`, `INSPECTION_OBSTRUCTION` |
| `SuggestedAction` | `WARNING`, `FORMAL_NOTICE`, `FINE`, `CLOSURE` |
| `SanctionDecision` | `FINE_ISSUED`, `CLOSURE_ORDERED`, `FORMAL_NOTICE_ISSUED`, `DISMISSED` |
| `CrewType` | `MUNICIPAL`, `COOPERATIVE`, `CONTRACTOR` |
| `VehicleType` | `COMPACTOR_TRUCK`, `DUMP_TRUCK`, `SWEEPER`, `WATER_TANKER`, `CRANE_TRUCK`, `VAN` |
| `Shift` | `MORNING`, `AFTERNOON`, `NIGHT` |
| `RepairDamageType` | `BROKEN_PAVEMENT`, `BROKEN_SIDEWALK`, `BROKEN_STREETLIGHT`, `BLOCKED_DRAIN`, `DAMAGED_STRUCTURE` |
| `StreetClosureType` | `TOTAL`, `PARTIAL` |

Son 32. `DamageType` y `ViolationType` viajan **como texto** en los eventos que salen: el [acuerdo](Acuerdo-Eventos-M6.md) §1.1 los declara así ("sale de nuestro catálogo, viaja como texto"), porque el consumidor no tiene por qué validar contra un catálogo nuestro. Adentro del módulo siguen siendo enums.

## Divergencias con el acuerdo publicado — resueltas

> **Resueltas por [ADR-003](decisiones/adr-003-divergencias-enums.md) (02/09/2026).** Se mantiene el catálogo de este archivo y se corrige el [acuerdo publicado](Acuerdo-Eventos-M6.md) §1.1. El criterio: el catálogo está materializado en `prisma/schema.prisma`, en la migración aplicada en Render y en el código ya mergeado; el acuerdo es un documento que se regenera. Y en cuatro de los seis casos el catálogo tiene más información que el acuerdo.
>
> Esta tabla queda como registro de qué se decidió y qué hay que comunicarle a cada grupo. El estado vivo de esos avisos está en [bloqueantes.md](bloqueantes.md).

| # | Enum | Qué queda | Qué decía el acuerdo | A quién hay que avisarle |
|---|---|---|---|---|
| 1 | `TicketStatusUpdate` | **Se elimina del catálogo.** El vocabulario es de M2 | `updateType`: `STARTED`, `PROGRESS`, `INFORMATION_REQUIRED`, `RETURNED`, `RESOLVED`, `REJECTED` | Nadie: adoptamos el suyo tal cual |
| 2 | `ServiceOrigin` | `PLANNED`, `TICKET`, `WEATHER_ALERT`, `INSPECTION`, `MANUAL` | `SCHEDULED`, `TICKET`, `INSPECTION`, `INTERNAL` | **M7**, en [`urbanServiceScheduled`](eventos/publicados/urbanServiceScheduled.md) |
| 3 | `TreeHealthStatus` | `HEALTHY`, `WEAKENED`, `DISEASED`, `DEAD` | `HEALTHY`, `DECLINING`, `DEAD` | **M3 y M7**, en [`treeRiskDetected`](eventos/publicados/treeRiskDetected.md) |
| 4 | `TreeInterventionType` | `FORMATION_PRUNING`, `SAFETY_PRUNING`, `REMOVAL`, `PLANTING`, `TREATMENT` | `PRUNING`, `FELLING`, `PLANTING`, `TREATMENT` | **M7**, en [`treePruningScheduled`](eventos/publicados/treePruningScheduled.md) y `treeRiskDetected` |
| 5 | `SuggestedAction` | `WARNING`, `FORMAL_NOTICE`, `FINE`, `CLOSURE` | `WARNING`, `FINE`, `CLOSURE` | **M4**, en [`environmentalViolationDetected`](eventos/publicados/environmentalViolationDetected.md). Es el caso más expuesto: M4 actúa sobre el valor, aunque el campo es no vinculante |
| 6 | `RiskLevel` | `NONE`, `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` | Nadie: el evento solo se publica con `HIGH` o `CRITICAL`, `NONE` nunca sale del módulo |

### `MONITORING`, que no existía en ningún lado

El acuerdo declaraba `MONITORING` como valor posible de `suggestedIntervention` en `treeRiskDetected`, y no está en ningún enum. **Se descarta:** monitorear no es una intervención, es la ausencia de una. `TreeSurvey.suggestedIntervention` ya es nullable en Prisma, así que el campo pasa a ser **opcional** en el schema del evento — antes era requerido, lo que además hacía impublicable un relevamiento de riesgo alto sin intervención sugerida.
