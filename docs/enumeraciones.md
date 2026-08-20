# Enumeraciones

Catálogo de valores cerrados usados en [entidades](entidades/) y [eventos](eventos/). Diseño tentativo hasta la primera entrega.

> **Es la fuente.** Los archivos de evento y de entidad linkean acá en vez de repetir los valores. Si agregás un valor, agregalo en esta tabla y no en el archivo que lo usa.
>
> Migrado de [`fuentes/alcance-entregable.md`](../fuentes/alcance-entregable.md) §5.3. Ojo con las [divergencias contra el acuerdo publicado](#divergencias-con-el-acuerdo-publicado) al final.

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

Son 32. `DamageType` y `ViolationType` viajan **como texto** en los eventos que salen: el [acuerdo](../Acuerdo-Eventos-M6.md) §1.1 los declara así ("sale de nuestro catálogo, viaja como texto"), porque el consumidor no tiene por qué validar contra un catálogo nuestro. Adentro del módulo siguen siendo enums.

## Divergencias con el acuerdo publicado

Seis enums difieren entre este catálogo y lo que quedó escrito en [`Acuerdo-Eventos-M6.md`](../Acuerdo-Eventos-M6.md) §1.1, que es el documento que ya circuló a los otros grupos. **No están resueltas** — hay que elegir un lado y corregir el otro antes de implementar, porque los `.schema.json` de [eventos/publicados/](eventos/publicados/) validan contra lo que se decida.

| # | Enum | Catálogo (este archivo) | Acuerdo publicado | Nota |
|---|---|---|---|---|
| 1 | `TicketStatusUpdate` | `IN_PROGRESS`, `UPDATED`, `COMPLETED`, `REJECTED` | `updateType`: `STARTED`, `PROGRESS`, `INFORMATION_REQUIRED`, `RETURNED`, `RESOLVED`, `REJECTED` | **El enum propio quedó obsoleto.** El vocabulario lo define M2 en su contrato v1.2 y lo adoptamos tal cual — ver [`updateTicketStatus`](eventos/publicados/updateTicketStatus.md). Este enum se borra cuando se confirme que nada lo referencia |
| 2 | `ServiceOrigin` | `PLANNED`, `TICKET`, `WEATHER_ALERT`, `INSPECTION`, `MANUAL` | `origin`: `SCHEDULED`, `TICKET`, `INSPECTION`, `INTERNAL` | Dos nombres distintos para lo mismo (`PLANNED`/`SCHEDULED`, `MANUAL`/`INTERNAL`) y `WEATHER_ALERT` no está en el acuerdo. Viaja en [`urbanServiceScheduled`](eventos/publicados/urbanServiceScheduled.md) |
| 3 | `TreeHealthStatus` | `HEALTHY`, `WEAKENED`, `DISEASED`, `DEAD` | `HEALTHY`, `DECLINING`, `DEAD` | El acuerdo colapsa `WEAKENED` y `DISEASED` en `DECLINING`. Viaja en [`treeRiskDetected`](eventos/publicados/treeRiskDetected.md) |
| 4 | `TreeInterventionType` | `FORMATION_PRUNING`, `SAFETY_PRUNING`, `REMOVAL`, `PLANTING`, `TREATMENT` | `PRUNING`, `FELLING`, `PLANTING`, `TREATMENT` | El acuerdo no distingue los dos tipos de poda y llama `FELLING` a `REMOVAL`. Además, el `suggestedIntervention` de `treeRiskDetected` agrega un quinto valor, `MONITORING`, que no existe en ningún lado — puede que corresponda un enum aparte |
| 5 | `SuggestedAction` | `WARNING`, `FORMAL_NOTICE`, `FINE`, `CLOSURE` | `WARNING`, `FINE`, `CLOSURE` | Falta `FORMAL_NOTICE` en el acuerdo. Viaja en [`environmentalViolationDetected`](eventos/publicados/environmentalViolationDetected.md) hacia M4 |
| 6 | `RiskLevel` | `NONE`, `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` | Diferencia sin consecuencia práctica: el evento solo se publica con `HIGH` o `CRITICAL`, así que `NONE` nunca sale del módulo |

Las divergencias 2 a 5 sí salen al bus, así que el que quede mal es un valor que el consumidor no va a reconocer. Anotado también en [bloqueantes.md](bloqueantes.md).
