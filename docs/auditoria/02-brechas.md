# Fase 2 — Brecha contra el marco

Puntaje: 0 = ausente, 1 = parcial, 2 = cumple. Evidencia en cada fila; los códigos (A1, B3…) remiten a `01-exactitud.md`. Los sub-criterios marcados "evaluar" no suman al puntaje: se analiza si conviene y se clasifica.

## Puntaje global: 31 / 58 (53 %)

| Criterio | Puntos | Máx. |
|---|---:|---:|
| 1 Diátaxis | 1 | 2 |
| 2 Docs-as-code y fuente única | 1 | 2 |
| 3 ADRs | 2 | 2 |
| 4 Eventos | 8 | 10 |
| 5 Arquitectura | 2 | 6 |
| 6 API | 5 | 6 |
| 7 Operación | 1 | 4 |
| 8 Salud del repo | 4 | 12 |
| 9 Calidad automatizada | 1 | 6 |
| 10 Agentes de IA | 2 | 4 |
| 11 Seguridad en docs | 4 | 4 |

Lectura: el contenido técnico (ADRs, eventos, API, seguridad) está en nivel alto. El puntaje baja por **estructura y automatización** (Diátaxis, operación, salud del repo, chequeos) y por **vistas de arquitectura**.

## Puntuación por criterio

| # | Sub-criterio | Pts | Evidencia |
|---|---|:-:|---|
| 1 | Separación por tipo Diátaxis | 1 | Hay carpetas por función (`api/`, `eventos/`, `decisiones/`, `entidades/`). Mezclan tipos `docs/deploy.md` (A11), `CONTRIBUTING.md` (how-to + referencia), `README.md` y `devops/DEVOPS-SEGUIMIENTO.md`. No hay tutorial de "primer día"; el quickstart está en `README.md:17`. |
| 2 | Hechos calculables generados o validados | 1 | Bien: `openapi.json` generado y con diff en CI (`ci.yml:59-60`); `payloads.spec.ts` valida los `.schema.json`; `docs:roles` genera la tabla de roles. Mal: los conteos 103/152/29/43/22 se repiten a mano en 7 lugares (A9); DER en 2 fuentes (B8); `endpoints.md` (114 KB) duplica a mano parte de `openapi.json`; `deploy.md` tiene 2 tablas de variables (A11). |
| 3 | Consistencia de ADRs | 2 | B7: los 9 estados coinciden con el índice y la supersedencia es bidireccional (ADR-006 ↔ ADR-007). Detalles menores en B7. |
| 4a | Catálogo de eventos | 2 | `docs/eventos/publicados/README.md` y `consumidos/README.md` con tabla emisor/consumidor; 6 publicados y 10 consumidos, como se declara (B12). |
| 4b | Schemas por evento y validación | 2 | 6 `.schema.json` + `_shared.schema.json`, validados en `src/events/payloads.spec.ts:30-42`. |
| 4c | Versionado de contratos | 1 | El sobre lleva `eventVersion: '1.0'` (`src/events/envelope.ts:16,92`). No hay un texto que diga qué es un cambio compatible o cuándo sube la versión. |
| 4d | Semántica at-least-once, idempotencia, reintentos/DLQ | 1 | La información existe, dispersa: ack/nack y reintentos en ADR-007 (L19-20, L35, L71), idempotencia por estado en ADR-007 (L58), outbox/inbox en ADR-006. No hay una página única "cómo se entregan y procesan los eventos". |
| 4e | Eventos sin consumidor | 2 | `consumidos/README.md` aclara `notificationSent` (descartado) y `weatherAlertIssued` (simulado); `publicados/descartados.md` registra lo descartado. |
| 4f | AsyncAPI (evaluar) | — | Ver G9: no conviene. |
| 5a | C4 contexto y contenedores | 0 | Ninguno (`grep C4Context\|C4Container` → 0 en lo versionado). |
| 5b | Diagramas de secuencia de flujos críticos | 0 | Sin `sequenceDiagram` en lo versionado (solo hay en `docs/documentacion/`, copia local ignorada). |
| 5c | Modelo de datos y estados | 2 | Mermaid en `DER.md` y diagramas de estado en `docs/entidades/` (container, environmental-report, service, tree-intervention). |
| 6a | Resúmenes y descripciones | 2 | Las 152 operaciones tienen `summary` y `description`; 879 de 943 propiedades de schemas tienen descripción o ejemplo. |
| 6b | Errores y roles | 2 | 150 de 152 operaciones declaran 4xx; 146 declaran 401 y 403 (las 6 restantes son públicas o de salud). `docs/api/estandar-swagger.md` exige códigos y tiene checklist de PR (L369). |
| 6c | Ejemplos | 1 | Solo 30 de 152 operaciones llevan `example`/`examples`. |
| 7a | Runbooks (síntoma → diagnóstico → acción → verificación → rollback → escalamiento) | 0 | No hay. `deploy.md §5` (Gotchas) y §4 (scripts de sincronización y migración) son lo más cercano; `rollback`/`revertir` no aparece en `deploy.md`. |
| 7b | Variables coherentes entre código, `.env.example` y `deploy.md` | 1 | Código ↔ `.env.example`: coherentes. `deploy.md`: faltan 9 (B3), `CORS_ORIGINS` duplicada con valor viejo (A1), variables del frontend mezcladas (B6), `M1_BASE_URL` repetida (B4). |
| 8a | README | 2 | Stack, cómo correr, enlaces, estructura, integración, equipo y cátedra. Solo falla la copia manual de conteos (A9). |
| 8b | CONTRIBUTING | 2 | Ramas, commits, PR, checklist, reviews, testing, secretos, qué hacer si `develop` se rompe, DoD. |
| 8c | SECURITY.md | 0 | No existe (A7). `docs/QA/07-informe-seguridad.md` es un informe de QA, no una política de reporte. |
| 8d | LICENSE | 0 | No existe. El repo es público: sin licencia rige "todos los derechos reservados". |
| 8e | CHANGELOG (evaluar) | — | Ver G12: no conviene. |
| 8f | Plantilla de PR | 0 | No existe. `CONTRIBUTING.md:67-90` exige un checklist que hoy se copia a mano. |
| 8g | Plantillas de issues | 0 | No existen; el flujo usa labels de triage (`docs/agents/triage-labels.md`). |
| 9a | `docs:check` | 1 | Existe y corre en CI (`ci.yml:39`), pero solo cubre `bloqueantes.md` e `integracion/` (A12). |
| 9b | Links de toda `docs/` | 0 | Hoy hay 2 links rotos fuera de su alcance (A5). El script usado en esta auditoría tiene unas 20 líneas. |
| 9c | Conteos documentados vs `openapi.json`/`schema.prisma` | 0 | Sin chequeo (A9). |
| 9d | markdownlint (evaluar) | — | Ver G20: no conviene por ahora. |
| 10a | AGENTS.md corto y sin estructura vieja | 2 | 7,7 KB, mapa de entrada; comandos verificados contra `package.json` (B9, B12). |
| 10b | Destino explícito de `docs/agents/` y `docs/superpowers/` | 0 | `AGENTS.md:76,84,88` referencia `docs/agents/*` desde "Agent skills" sin explicar qué son. `docs/superpowers/plans/2026-10-28-…md` no lo referencia nadie y es un plan de trabajo fechado, no documentación del producto. |
| 11a | Sin secretos ni credenciales | 2 | `git grep` de JWT, `password=…`, `amqp://user:pass@`: solo `guest:guest` (default de desarrollo, `.env.example:88`) y placeholders en specs. Hay gitleaks en CI sobre todo el historial (`ci.yml:146-165`). |
| 11b | Hosts e IPs justificados | 2 | B10. El CSV de cuentas es ficticio según el equipo (B1). |

## Brechas

Valor: A = alto, M = medio, B = bajo. Esfuerzo: S ≤ 1 h, M ≈ 2-4 h, L > 4 h. "Contrato" = toca algo que circula a otros grupos.

| ID | Brecha | Valor | Esfuerzo | Clasificación | Contrato | Nota |
|---|---|:-:|:-:|---|:-:|---|
| G1 | `LEEME.md` describe un árbol inexistente y mezcla fechas (A2, A3) | A | S | **Imprescindible** | No | Es lo primero que ve un lector. Opciones en Fase 3: reducirlo a una nota de mapeo o fusionarlo con `docs/README.md`. |
| G2 | `deploy.md` mezcla 4 tipos, se contradice y duplica variables (A1, A11, B3, B5, B6) | A | M | **Imprescindible** | No | Partirlo en referencia / how-to / runbooks / historial. |
| G3 | Plantilla de PR ausente (8f) | A | S | **Imprescindible** | No | El flujo ya exige un checklist; sin plantilla se olvida. |
| G4 | `devops/` desactualizado: Kafka, ramas "sin pushear", 2 links rotos, contradice `deploy.md` §7 (A4, A5, B2) | M | M | **Imprescindible** | No | Actualizar, fusionar lo vigente en `deploy.md` y archivar el resto. |
| G5 | Conteos escritos a mano en 7 lugares (A9, 9c) | M | S | Recomendable | No | Chequeo en `docs:check` contra `openapi.json` y `schema.prisma`, o quitar los números donde no aportan. |
| G6 | Links de toda `docs/` sin validar (9b) | M | S | Recomendable | No | Ampliar `docs:check` con un script sin dependencias. |
| G7 | Sin vistas C4 ni secuencia (5a, 5b) | M | M | Recomendable | No | C4 contexto + contenedores y 3 secuencias (publicar vía outbox; consumir vía inbox con idempotencia; login y rol). Mermaid, sin herramientas nuevas. Útil para la defensa oral. |
| G8 | Semántica de entrega dispersa (4c, 4d) | M | S | Recomendable | **Sí, aviso** si se publica hacia otros grupos | Una página interna que reúna lo que ya está en ADR-006/007 y `envelope.ts`. |
| G9 | AsyncAPI sobre los schemas (4f) | B | M | **Sobreingeniería** | Sí | Los consumidores son 8 grupos que leen Markdown y PDF; los `.schema.json` ya se validan en tests. Un `asyncapi.yaml` sumaría una tercera fuente (md, schema, yaml) y un render que nadie usaría. Reevaluar solo si la cátedra o M9 lo piden. |
| G10 | SECURITY.md ausente (8c) | M | S | Recomendable | No | 15 líneas: cómo reportar y qué versión se mantiene. El repo es público. |
| G11 | LICENSE ausente (8d) | M | S | Recomendable | No | Decisión del equipo y de la cátedra; ojo con los datos de GCBA en `docs/geojson/`, que tienen su propia licencia. |
| G12 | CHANGELOG Keep a Changelog + SemVer (8e) | B | M | **Sobreingeniería** | No | `package.json` está en `0.1.0`, no hay tags y el flujo `develop → test → main` ya deja cada cambio en un PR con título convencional (269 commits). Un CHANGELOG manual duplicaría el historial. Alternativa liviana: un tag y un GitHub Release por entrega o parcial. |
| G13 | Plantillas de issue (8g) | B | S | Recomendable | No | Una para bug y otra para tarea, con la etiqueta `needs-triage` ya definida. |
| G14 | Dependencia del repositorio de documentación (A10) | M | M | Recomendable | Parcial | El repo de documentación se usa como cross-reference local (`docs/documentacion/`, ignorada). Falta en este repo una nota que diga qué vive allá (PDF, enunciado, fichas por módulo) y cómo se enlaza, en lugar de rutas que no resuelven. |
| G15 | Andamiaje de agente sin destino explícito (10b) | B | S | Recomendable | No | Mantener `docs/agents/` porque `AGENTS.md` lo referencia y las skills lo esperan, y rotularlo. Retirar `docs/superpowers/` (plan histórico; el historial de git lo conserva). |
| G16 | DER en dos fuentes (B8) | M | S | Recomendable | No | Elegir una (Mermaid, que GitHub renderiza) o marcar `DER.puml` como derivado. |
| G17 | Ejemplos en el Swagger: 30 de 152 (6c) | M | L | Recomendable (acotado) | No | Completar solo los flujos que usan el frontend y la defensa; completar los 152 sería Sobreingeniería. |
| G18 | `endpoints.md` de 114 KB duplica `openapi.json` | M | L | Recomendable (acotado) | No | Ya existe `docs:roles`. Generar la tabla de rutas y roles y dejar a mano lo explicativo; generar todo es Sobreingeniería. |
| G19 | Runbooks inexistentes (7a) | M | M | Recomendable | No | 4 o 5 runbooks cortos: Render dormido o cold start, base caída (`/health/ready` 503), outbox atascado o bus desconectado, evento rechazado por el Core, rotación de `JWT_SECRET`. |
| G20 | markdownlint (9d) | B | M | **Sobreingeniería** | No | Los 134 archivos existentes dispararían muchos avisos de estilo y habría que mantener reglas. G5 y G6 dan más valor. |
| G21 | ADR: la plantilla no lista "Reemplazado parcialmente" ni "Aceptado con nota" (B7) | B | S | Recomendable | No | Una línea en `_template-adr.md` y en el índice. |
| G22 | CSV de cuentas sin aviso de que es ficticio (B1) | B | S | Recomendable | No | Una línea en `docs/integracion/m1.md`. |
| G23 | Registros muy grandes (`historial.md` 123 KB, `resueltos.md` 50 KB, `QA/04` 203 KB) | B | M | **Sobreingeniería** | No | Son registros por fecha que se leen con búsqueda; partirlos agrega links sin ahorrar mantenimiento. Reevaluar si `docs:check` se vuelve lento. |
| G24 | Backstage, Docusaurus, Vale | — | L | **Sobreingeniería** | — | No se proponen: un TPO con 9 grupos y un repo de Markdown plano no justifica un portal ni un linter de prosa. |

## Resumen por clasificación

- **Imprescindible (4):** G1, G2, G3, G4.
- **Recomendable (15):** G5, G6, G7, G8, G10, G11, G13, G14, G15, G16, G17, G18, G19, G21, G22.
- **Sobreingeniería (5):** G9, G12, G20, G23, G24.
- **Tocan contratos que circulan:** G8 (si se publica hacia afuera), G9 (descartada) y, en parte, G14. Nada de lo propuesto modifica `Acuerdo-Eventos-M6.md`, `Sobres-M6.md` ni los `.schema.json`.
