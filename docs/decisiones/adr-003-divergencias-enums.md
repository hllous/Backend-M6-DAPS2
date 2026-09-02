# ADR-003: Resolución de las divergencias de enums con el acuerdo publicado

## Estado

**Propuesto** — 2026-09-02

## Contexto

Seis enums difieren entre el catálogo interno ([`enumeraciones.md`](../enumeraciones.md)) y lo que quedó escrito en [`Acuerdo-Eventos-M6.md`](../Acuerdo-Eventos-M6.md) §1.1, que es el documento que ya circuló a los otros grupos. La divergencia está registrada como bloqueante interno desde el **18/08** y nunca se resolvió.

**Cuatro de las seis salen al bus.** Los `.schema.json` de [`eventos/publicados/`](../eventos/publicados/) son la fuente para validar y generar tipos, y hoy tres de ellos llevan un `CONFLICTO SIN RESOLVER` escrito a mano en la `description` del campo. Si publicamos un valor que el consumidor no reconoce, el evento le llega y no lo puede mapear: no falla ruidosamente, se pierde silenciosamente del otro lado.

Esto deja de ser teórico ahora. La **Fase 3** implementa el outbox y la publicación a Kafka, y el primer evento que salga fija el vocabulario de hecho. Además, tres de los enums en conflicto ya están materializados en `prisma/schema.prisma`, en la migración inicial aplicada en Render, y en el código de las Fases 0, 1 y 2 ya mergeadas.

Esa asimetría es el dato que ordena la decisión: **el catálogo es código desplegado; el acuerdo es un documento**.

## Decisión

**El catálogo interno gana en las seis divergencias. Se corrige el acuerdo publicado y se avisa a las contrapartes afectadas.**

Además, dos correcciones puntuales sobre los schemas de eventos que salieron a la luz al revisar esto:

- **`treeRiskDetected.suggestedIntervention` pasa a ser opcional** y se descarta el valor `MONITORING` que el acuerdo declaraba. "Monitorear" no es una intervención: es la ausencia de una. `TreeSurvey.suggestedIntervention` ya es nullable en el schema de Prisma, así que el campo requerido en el evento era además inconsistente con el modelo — un relevamiento con riesgo alto y sin intervención sugerida no se habría podido publicar.
- **`TicketStatusUpdate` se borra del catálogo.** No es un enum nuestro: el vocabulario lo define M2 en su contrato y lo adoptamos tal cual. Nunca llegó a `prisma/schema.prisma`.

Detalle por divergencia:

| # | Enum | Queda | Qué se corrige | Sale al bus |
|---|---|---|---|---|
| 1 | `TicketStatusUpdate` | Se elimina | El vocabulario es de M2 (`STARTED`, `PROGRESS`, `INFORMATION_REQUIRED`, `RETURNED`, `RESOLVED`, `REJECTED`) | Sí, hacia M2 |
| 2 | `ServiceOrigin` | `PLANNED`, `TICKET`, `WEATHER_ALERT`, `INSPECTION`, `MANUAL` | El acuerdo pasa a los 5 valores del catálogo | Sí, hacia M7 |
| 3 | `TreeHealthStatus` | `HEALTHY`, `WEAKENED`, `DISEASED`, `DEAD` | El acuerdo deja de colapsar en `DECLINING` | Sí, hacia M3 y M7 |
| 4 | `TreeInterventionType` | `FORMATION_PRUNING`, `SAFETY_PRUNING`, `REMOVAL`, `PLANTING`, `TREATMENT` | El acuerdo deja de usar `PRUNING`/`FELLING`; se descarta `MONITORING` | Sí, hacia M7 |
| 5 | `SuggestedAction` | `WARNING`, `FORMAL_NOTICE`, `FINE`, `CLOSURE` | El acuerdo suma `FORMAL_NOTICE` | Sí, hacia M4 |
| 6 | `RiskLevel` | `NONE`, `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` | Nada que comunicar | No: el evento solo se publica con `HIGH` o `CRITICAL` |

## Alternativas consideradas

- **Adoptar el acuerdo publicado y cambiar el catálogo.** Es lo que evita cualquier conversación con los otros grupos, y era defendible en agosto, cuando el catálogo era también un documento. Hoy implica una migración de Prisma sobre cuatro enums, una migración de datos sobre las filas ya cargadas, y tocar código de tres PRs mergeados —el control de autorización de extracciones de `tree-interventions` depende del literal `REMOVAL`, que el acuerdo llama `FELLING`—. Se descarta por costo, y porque en cuatro de los seis casos el acuerdo tiene **menos** información que el catálogo (ver abajo).

- **Traducir en el borde: mantener el catálogo internamente y mapear al vocabulario del acuerdo al publicar.** Suena conciliador y es lo peor de los dos mundos. Agrega una capa de traducción por evento que hay que mantener, y **pierde información igual**: no hay a qué mapear `WEAKENED` y `DISEASED` que no sea colapsarlos, ni forma de expresar `WEATHER_ALERT` o `FORMAL_NOTICE`. Se paga complejidad para seguir perdiendo el dato.

- **Dejarlo abierto y decidir cuando alguien se queje.** Es el statu quo desde el 18/08. Con la Fase 3 el primer evento publicado fija el vocabulario de hecho, sin que nadie lo haya decidido, y el que se entera es el consumidor. Se descarta.

- **El catálogo gana, se corrige el acuerdo (la elegida).** El catálogo es lo que está en la base y en el código desplegado; el acuerdo es un `.md` que se regenera. Y en cuatro de las seis el catálogo es estrictamente más informativo:
  - `WEATHER_ALERT` distingue un servicio nacido de una alerta meteorológica, que es exactamente lo que la Fase 6 necesita marcar cuando se reprograma en masa. El acuerdo no tiene cómo expresarlo.
  - `WEAKENED` y `DISEASED` son dos diagnósticos distintos que el inspector registra en el relevamiento. `DECLINING` los borra.
  - `FORMATION_PRUNING` y `SAFETY_PRUNING` responden a motivos distintos: una es estética y programable, la otra es por riesgo. `PRUNING` los borra.
  - `FORMAL_NOTICE` es un escalón real entre el apercibimiento y la multa.

  Hay además un argumento independiente del costo: **`SCHEDULED` como valor de `ServiceOrigin` colisiona con `SCHEDULED` como valor de `ServiceStatus`**, y los dos viajan en el mismo payload de `urbanServiceScheduled`. La misma palabra significando dos cosas distintas en el mismo objeto es una fuente de bugs del lado del consumidor. `PLANNED` no tiene ese problema.

## Consecuencias

### Positivas

- Los tres `.schema.json` quedan sin el `CONFLICTO SIN RESOLVER` y pasan a ser una fuente confiable para generar tipos en la Fase 3.
- No hay migración de Prisma, ni migración de datos, ni cambios en el código ya mergeado.
- Se conserva la información que el acuerdo perdía en cuatro de los seis casos.
- Se cierra la fila "Interno" del tablero de [bloqueantes.md](../bloqueantes.md), abierta desde el 18/08.

### Negativas

- **Hay que avisarle a tres grupos**, y el aviso llega después de que el documento circuló: M7 (`ServiceOrigin`, `TreeHealthStatus`, `TreeInterventionType`), M3 (`TreeHealthStatus`), M4 (`SuggestedAction`). Es trabajo de coordinación que no controlamos y que puede tardar.
- Si alguno **ya implementó el parser contra el acuerdo**, el cambio lo rompe de su lado, y la culpa de la asimetría es nuestra: publicamos un documento que no coincidía con lo que teníamos. Hay que preguntarlo explícitamente, no asumirlo.
- **`SuggestedAction` es el caso más expuesto**, porque M4 es quien actúa sobre el valor. El riesgo está acotado a que el campo es **no vinculante** por diseño —la decisión sancionatoria es de ellos—, así que un valor que no reconozcan no les bloquea el circuito. Aun así, hay que confirmarlo.
- El acuerdo publicado queda desactualizado hasta que se regenere y vuelva a circular.

### Neutras

- `enumeraciones.md` deja de tener una sección de "divergencias sin resolver" y pasa a registrar lo decidido, con referencia a este ADR.
- `treeRiskDetected.suggestedIntervention` sale de la lista de campos requeridos del schema.
- `RiskLevel` no requiere ninguna comunicación: `NONE` nunca sale del módulo.

## Referencias

- [`enumeraciones.md`](../enumeraciones.md) — el catálogo, y la tabla de divergencias que este ADR cierra
- [`Acuerdo-Eventos-M6.md`](../Acuerdo-Eventos-M6.md) §1.1 — el documento que circuló y hay que corregir
- [`bloqueantes.md`](../bloqueantes.md) — fila "Interno" del tablero, abierta desde el 18/08
- Schemas afectados: [`urbanServiceScheduled`](../eventos/publicados/urbanServiceScheduled.schema.json), [`treeRiskDetected`](../eventos/publicados/treeRiskDetected.schema.json), [`environmentalViolationDetected`](../eventos/publicados/environmentalViolationDetected.schema.json)
- [ADR-001](adr-001-stack-tecnologico.md) — Prisma como ORM, que es lo que hace que el catálogo esté materializado en la base
