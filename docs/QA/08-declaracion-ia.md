# Declaración y plan de uso de IA

> Entregable 7 de los criterios de testing de la cátedra (Eje E, G8). Módulo 6 «Ambiente e Higiene», Grupo 04. Versión del 03/11/2026, **actualizada el 08/11/2026** (conteos re-medidos sobre `develop` @ `1d600d2`).
>
> **Cómo leer este documento.** Los datos que salen del repositorio (conteos de commits, versiones de los trailers, archivos) se pueden comprobar con los comandos indicados. Lo que depende de la memoria del equipo (prompts exactos, quién revisó cada test) está marcado **«A COMPLETAR POR EL EQUIPO»** o **«reconstruido, a confirmar por el equipo»**. No se inventó ninguna firma. Al 08/11 **siguen pendientes de completar por el equipo** todas las firmas por integrante (sección 3), los prompts reconstruidos, los alias de Git y el uso efectivo de cada skill; este documento **no está validado por el equipo**.

## Pendiente del equipo (lista corta)

Este documento **no está firmado ni validado por el equipo**. Lo que falta, por persona (no se completó por nadie):

| Quién | Qué falta |
|---|---|
| Benjamin Martinez | Firma de los tests que puede explicar (sección 3); confirmar sus prompts «reconstruidos» (2.3); confirmar qué skills usó y la versión de Claude Code (2.1, 2.2); confirmar sus alias de git (dos correos) |
| Nicolas Facundo Llousas | Firma de sus tests; prompt representativo, salida aceptada y corregida de **GPT-6 Luna**, **Orca**, **playwright-cli** y **chrome-devtools CLI** (2.1.1); su alias de git (`Nicolas Facundo Llousas` y/o `nicof`); confirmar cuántos commits del frontend con trailer de GPT-6 Luna |
| Bautista Canteli Castro | Firma de sus tests y artefactos; uso de **OpenCode Go (deepseek pro v4)** y **Google Antigravity** (para qué, prompt, qué se aceptó y qué se descartó; 2.1.1); su alias de git (`Bautista-Canteli` y/o `bcanteli-dev`) |
| Santiago Tomas Peralta | Firma de los tests y casos de prueba que pueda explicar; su alias de git, para esa firma (sección 3) |
| Miqueas Quintieri | Firma de lo que pueda explicar; su alias de git (`Miqueas Quintieri` y/o `MQuintieriFulter`); revisar este documento como responsable de la política |
| Facundo Iriarte | Confirmar que sigue sin usar IA (la Gobernanza dice «No utilizo») y revisar este documento como PO |
| Todo el equipo | Aprobar los complementos de este documento respecto de la declaración entregada el 03/11 (sección 8) y decidir qué se hace con los hallazgos de proceso |

## 1. Resumen

- El equipo usó IA generativa de forma extensa en el desarrollo del backend y del frontend: código, tests, documentación, revisión de código y auditoría contra estos criterios.
- **Regla central del equipo:** «la IA propone, una persona decide y responde»; ningún cambio entra al código principal sin Issue, rama, Pull Request y verificaciones automáticas (Gobernanza de IA, 03/11/2026, sección 1).
- Este documento **complementa** la *Gobernanza de IA* que el equipo entregó a la cátedra el 03/11/2026 (13 páginas, 15 secciones y un anexo). Esa entrega **no se modifica**; lo que este documento agrega o difiere está en las secciones 6 y 8.
- **El sistema no integra ninguna funcionalidad de IA** (no llama a ningún modelo ni expone un asistente). Por eso el punto 8.3 de los criterios (prompt injection, fuga de datos del modelo, proveedor de IA caído) **no aplica**.
- Regla del equipo: un resultado dictaminado por IA sin test ejecutado ni evidencia se toma como **NO VERIFICABLE**. Vale para el informe de seguridad (`07-informe-seguridad.md`).

## 2. IA usada para desarrollar y testear

### 2.1 Herramientas y versiones

La fuente es el trailer `Co-Authored-By` de cada commit. Se contó sobre el historial de la rama `develop` al **08/11/2026** (`1d600d2`: 297 commits, del 18/08 al 08/11; el 03/11 eran 252):

```bash
git log 1d600d2 --format=%H | wc -l                                  # 297 commits
git log 1d600d2 --format=%B | grep -i "^co-authored-by" \
  | sed 's/^[Cc]o-[Aa]uthored-[Bb]y: *//; s/ *<.*//' | sort | uniq -c | sort -rn   # líneas de trailer
```

Las líneas de trailer sobreestiman los commits: los merges por *squash* copian en el cuerpo los trailers de cada commit que resumen. La tabla cuenta **commits distintos** por herramienta (un commit puede figurar en más de una fila si tiene trailers de varios modelos). «Tipos» es el prefijo del asunto (Conventional Commits; «otros» incluye `refactor`, `test`, `tests`, `chore`, `ci`, etc.).

| Herramienta (nombre en el trailer) | Commits | Líneas de trailer | Tipos de commit (feat / fix / docs / otros) |
|---|---|---|---|
| Claude Sonnet 5.5 | 110 | 231 | 30 / 20 / 47 / 13 |
| Claude Opus 5 | 41 | 63 | 16 / 10 / 8 / 7 |
| Claude Sonnet 5 | 37 | 52 | 1 / 21 / 7 / 8 |
| Claude Opus 5.5 | 16 | 36 | 6 / 4 / 3 / 3 |
| «Claude» (sin versión) | 6 | 7 | 1 / 0 / 5 / 0 |
| Copilot Autofix powered by AI | 1 | 2 | 0 / 0 / 0 / 1 |

**Corrección respecto de la versión del 03/11:** esa tabla decía 2 commits para Copilot; son 2 líneas de trailer en 1 commit.

- **205 de los 297 commits (69,0 %)** tienen al menos un trailer de Claude (389 líneas en total). El 03/11 eran 191 de 252 (76 %); el porcentaje baja porque los commits nuevos incluyen merges y docs sin trailer. De los 42 commits desde el 03/11, 12 llevan trailer de Claude.
- Qué hizo cada modelo en cada commit no queda registrado más allá del tipo de commit: para qué se usó cada herramienta en detalle es **A COMPLETAR POR EL EQUIPO**.
- El trailer indica **participación de la IA, no autoría exclusiva ni revisión**: no dice cuánto del código escribió el modelo ni quién lo revisó. Eso se declara en el punto 3.
- Aparecen además coautores humanos en las líneas de trailer: Nicolas Facundo Llousas (10), bcanteli-dev (9), nicof (4) y Benjamin Martinez (3), y dos líneas de `scratch <scratch@local>` (un alias de git mal configurado, **no es un integrante**; ver `06-registro-defectos.md`, hallazgo P-2).
- **Claude Code** (CLI y extensión de VS Code) es el arnés con el que se usaron los modelos. La versión del arnés no queda registrada en el repositorio: **A COMPLETAR POR EL EQUIPO**.
- **Claude Fable 5.1** como revisor defensivo (el nombre **no aparece como trailer en ningún commit**: `git log --format=%B | grep -ic "claude fable"` da 0): en el tablero de Trello «M6 - Histórico de Sprints», lista «Clase 11: Seguridad», cada tarjeta SEC lleva el campo «Verifica con Fable 5.1». Figura «Sí» en SEC-W01, SEC-W02 y SEC-I01, y «No» en el resto. Esos veredictos son del 13/10 y varios dicen «Cumple por código; falta ejecutar el test», es decir, **NO VERIFICABLE** hasta que se ejecute el test (ver `07-informe-seguridad.md`).

#### 2.1.1 Por herramienta (sección 8.1 de los criterios)

Une el inventario de la Gobernanza de IA (Gobernanza de IA, 03/11/2026, sección 5) con la evidencia del repositorio y de la sesión del 08/11. «A COMPLETAR» = depende de la memoria del integrante o de una herramienta que no se puede verificar desde este repositorio.

| Herramienta y versión | Para qué se usó | Prompt representativo | Qué se aceptó | Qué se corrigió o descartó | Cómo se verificó |
|---|---|---|---|---|---|
| **Claude Code** (CLI y sesiones en la nube (Gobernanza de IA, 03/11/2026, sección 5)). Versión del arnés: **A COMPLETAR POR EL EQUIPO** (Benjamin Martinez) | Agente principal: implementación, tests, documentación, revisión y auditoría en backend y frontend (Gobernanza de IA, 03/11/2026, sección 5) | Sección 2.3: #1 (real, 03/11), #1b (real, 08/11); #2 y #3 reconstruidos | Ejemplos con evidencia: `redactUrl` (#581, `a733f44`), fix de `rabbitmq-setup` (#584, `c9a8dc7`), tests de transiciones (#582) | Ver 2.4.1 y 2.5: el `AGENTS.md` desactualizado, el secreto literal del workflow de #572 y la caché `.schemathesis/` | Build, lint, tests, cobertura y CI antes del merge (sección 2.4); R08 |
| **Modelos Claude** (trailers del backend, 18/08 al 08/11): Sonnet 5.5 (110 commits), Opus 5 (41), Sonnet 5 (37), Opus 5.5 (16), «Claude» sin versión (6). **Haiku 5.5: 0 commits en el backend** (la Gobernanza lo cita como «uso menor») | Elección del modelo según la tarea (Sonnet 5.5 por defecto; Opus 5.5 si es ambigua o toca contratos) (Gobernanza de IA, 03/11/2026, sección 5). Qué modelo hizo qué en cada commit: no queda registrado | — | — | — | Trailers `Co-authored-by` (sección 2.1) |
| **Subagentes de Claude Code** de la sesión del 08/11: implementador, revisores, auditores (contratos, seguridad, entrega), curador de docs, tests y cobertura | Cambios de código y tests, revisión del diff, auditorías y actualización de `docs/QA/` (2.4.2) | #1b | Cifras recalculadas con scripts; nombres de tests comprobados contra el código | Se declaró «no hecho» lo que no tiene evidencia (k6, ZAP, Trivy, SonarCloud) | R08 y CI de `develop` |
| **GPT-6 Luna** (OpenAI) | Uso puntual en el frontend, 7 commits del tramo analizado (Gobernanza de IA, 03/11/2026, sección 5). En el backend: **0** trailers (`git log | grep -ci "luna\|gpt"`) | **A COMPLETAR POR EL EQUIPO** (Nicolas Facundo Llousas) | **A COMPLETAR** (Nicolas Facundo Llousas) | **A COMPLETAR** (Nicolas Facundo Llousas) | No verificable desde este repositorio |
| **Orca** | Worktrees aislados por ticket (Gobernanza de IA, 03/11/2026, sección 5). La guía citada (`docs/agents/orca-worktree-setup.md`) **no existe en el backend** (`docs/agents/` tiene `README`, `domain`, `issue-tracker` y `triage-labels`); sería del frontend | **A COMPLETAR** (Nicolas Facundo Llousas) | **A COMPLETAR** | **A COMPLETAR** | No verificable desde este repositorio |
| **playwright-cli y chrome-devtools CLI** | Verificación visual y diagnóstico de navegador en el frontend (Gobernanza de IA, 03/11/2026, sección 5) | **A COMPLETAR** (Nicolas Facundo Llousas) | **A COMPLETAR** | **A COMPLETAR** | No aplica al backend; no verificable acá |
| **GitHub (`gh` o conector MCP)** | Issues, PRs, labels de triage (Gobernanza de IA, 03/11/2026, sección 5). En la sesión del 08/11: consulta de issues, runs y jobs del CI | Consultas `gh issue`, `gh run` | Los datos (257 issues, runs 42508633321 y 42505473347, etc.) | — | Los enlaces de run se abren en GitHub |
| **OpenCode Go (deepseek pro v4)** y **Google Antigravity** (Bautista Canteli Castro (Gobernanza de IA, 03/11/2026, sección 13)) | Asistencia en despliegues, pipeline y diagnóstico de fallos de deploy (Gobernanza de IA, 03/11/2026, sección 13) | **A COMPLETAR POR EL EQUIPO** (Bautista Canteli Castro) | **A COMPLETAR** (Bautista Canteli Castro) | **A COMPLETAR** (Bautista Canteli Castro) | No verificable: no dejan trailer en el historial |
| **Copilot Autofix powered by AI** (detalle adicional a la Gobernanza) | Una corrección automática: commit `1039cdd` (#19) | — | Se mergeó | **A COMPLETAR** (quien aceptó el commit) | CI de ese commit |
| **Claude Fable 5.1** (detalle adicional a la Gobernanza) | Revisor defensivo de las tarjetas SEC de Trello (campo «Verifica con Fable 5.1») | — | Veredictos del 13/10 | Quedaron viejos (ver `07-informe-seguridad.md`) | Sin commits ni trailer |
| **MCP de Trello y Google Workspace; skills de `mattpocock/skills`** (Nicolas Facundo Llousas (Gobernanza de IA, 03/11/2026, sección 13.1)) | Lectura y edición de tickets y documentación; guía de tareas | **A COMPLETAR** | **A COMPLETAR** | **A COMPLETAR** | Las skills están fijadas en `skills-lock.json` (27 en el backend) |

### 2.2 Archivos y herramientas de apoyo en el repositorio

| Archivo | Qué es |
|---|---|
| `AGENTS.md`, `CLAUDE.md` | Instrucciones para los agentes de IA que programan el módulo. `CLAUDE.md` importa a `AGENTS.md` |
| `skills-lock.json` | Registro de 27 skills instaladas desde `mattpocock/skills`: `ask-matt`, `claude-handoff`, `code-review`, `codebase-design`, `diagnosing-bugs`, `domain-modeling`, `grill-me`, `grill-with-docs`, `grilling`, `handoff`, `implement`, `implement-spec`, `improve-codebase-architecture`, `prototype`, `research`, `resolving-merge-conflicts`, `setup-matt-pocock-skills`, `tdd`, `teach`, `to-questionnaire`, `to-spec`, `to-tickets`, `triage`, `wait-what`, `wayfinder`, `wizard`, `writing-for-agents` |
| `docs/agents/` | Configuración de esas skills: tracker de Issues y etiquetas de triage |
| Etiqueta `ready-for-agent` | Issues «completamente especificados, listos para un agente»: se usa, por ejemplo, en los Issues #473 y #475 del backend y en el #800 y el #815 del frontend (este último, con la etiqueta `code-review`) |
| `docs/superpowers/plans/2026-10-28-preparar-prueba-backend.md` | Plan de trabajo generado con el plugin *superpowers* para preparar la prueba contra el Core. **No está versionado**: `docs/superpowers/` está en `.gitignore`, así que el archivo existe solo en la máquina de quien lo generó |

De las 27 skills instaladas, **cuáles se usaron efectivamente: A COMPLETAR POR EL EQUIPO.** La evidencia indirecta en el repositorio es el uso de `ready-for-agent`, `code-review` y las etiquetas de `triage`.

### 2.3 Prompts representativos

| # | Estado | Prompt |
|---|---|---|
| 1 | **Real** (sesión del 03/11) | «Querés revisar estos criterios de testing y de entrega del proyecto. Lanzá los auditores correspondientes para ver qué cumplimos, qué falta y qué debemos hacer. No modifiques nada, solo lectura y análisis. Tanto en el backend como en el frontend.» |
| 1b | **Real** (sesión del 08/11) | «Actualizá docs/QA/ del backend M6 al estado REAL de develop del 08/11/2026. […] Regla G9 de la cátedra: honestidad total; lo no hecho se declara NO HECHO, no se maquilla ni se inventa un número.» (Resumido por el QA a partir del encargo recibido; el texto completo no está versionado) |
| 2 | Reconstruido, a confirmar por el equipo | «Implementá el Issue #485: leer el `actorId` del JWT de M1 como claim opcional en `jwt.strategy.ts` y usarlo como `updatedBy.id` de `updateTicketStatus`. Escribí primero el test que falla, después el código. Mantené la cobertura ≥ 85% y corré build, lint y tests.» |
| 3 | Reconstruido, a confirmar por el equipo | «Revisá el código de los PRs de la ola #144 del frontend (#802, #806, #807, #814). Para cada uno, dejá un comentario de revisión en el Issue #815 con los hallazgos y su severidad.» |

### 2.4 Qué se aceptó, qué se corrigió o descartó, y cómo se verificó

Los controles son los que impone el proceso del equipo; no dependen de la herramienta:

| Control | Dónde está |
|---|---|
| Compila | `npm run build` en el job `build` del CI |
| Lint sin autofix | `npm run lint:check` en el job `build` |
| Tests unitarios con cobertura ≥ 85% | `npm run test:cov` en el job `test` (umbrales en `jest.coverageThreshold`) |
| e2e contra Postgres real | job `e2e` |
| Contrato OpenAPI al día | `git diff --exit-code docs/api/openapi.json` en el CI |
| Revisión de código | Definition of Done y PR a `develop` (`docs/gestion/definition-of-done.md`); en el frontend, la revisión de código pasó a ser obligatoria y se revisaron a posteriori los PRs de la ola del 02/11 (Issue FE #815) |
| Documentación de integración consistente | `npm run docs:check` en el CI |

### 2.4.1 Casos concretos de la sesión de testing del 08/11

Estos cuatro casos se reconstruyen con evidencia del repositorio y de GitHub Actions. Lo que figura como «relato» sale del desarrollador y no tiene otra fuente.

| Caso | Qué pasó | Qué se verificó ejecutando | Qué se hizo |
|---|---|---|---|
| **Secreto de juguete literal en `api-tests.yml`** (#572) | El workflow nuevo traía un secreto de juguete escrito en el archivo. El commit original ya no está en `develop` y no se puede decir por trailer si el texto lo generó un modelo (el squash `1d600d2` no lleva trailer de Claude) | **El job `secrets` (gitleaks) lo detectó en el CI**: run [42505473347](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/42505473347), commit `e07ad42`, `secrets` en rojo. No lo vio una revisión humana ni de IA antes del push | Se **descartó** la versión con el secreto literal: se reescribió la rama antes de mergear y el workflow genera un secreto efímero. Nunca llegó a `develop` |
| **`access_token` de la query en los logs** (#569, DEF-22) | El `LoggingInterceptor` registraba la URL completa y el filtro de errores devolvía el `path` con la query. Los tests de logs existentes no usaban una URL con token. El fix entró en el mismo PR que los tests de seguridad (#569); cómo se detectó exactamente: dato no disponible | El fix pasa `redact-url.spec.ts` y `logging.interceptor.spec.ts` en R08. Commit `a733f44` con trailer de Claude Sonnet 5.5 | Se **aceptó** el fix. Una segunda iteración del mismo PR cambió la redacción por subcadena y la extendió al `path` del error (dos commits en el PR #581) |
| **`rabbitmq-setup` en frío** (#567, DEF-23) | Nadie había corrido `docker compose up` desde cero con volúmenes nuevos. El primer arranque fallaba con `exit 7` porque el `healthcheck` de RabbitMQ da `healthy` antes de que escuche la consola | **Se encontró ejecutando** el compose en frío, no leyendo código. Tras el fix: up en 35 s, `/health/ready` 200 a los 45 s, seed OK (08/11, local). Commit `c9a8dc7` con trailer de Claude Sonnet 5.5 | Se **aceptó** el fix (`curl --retry 30 --retry-delay 2 --retry-connrefused`). El CI no levanta el compose, así que ningún test automático lo cubre |
| **Autor `scratch <scratch@local>`** | Dos commits (`5c8c78b`, `a06b33b`) se publicaron con un autor de git que no es de nadie. Es un error de configuración local del desarrollador, **no del modelo** | Se vio al revisar `git log`; los PR se mergearon con squash y en `develop` queda solo como `Co-authored-by` | **Abierto, sin reescribir** (hallazgo P-2 en `06-registro-defectos.md`) |

Qué más se aceptó y qué más se descartó en el resto del repositorio, con enlaces a PR o Issue: **A COMPLETAR POR EL EQUIPO** (cada integrante, para los PR que firmó). No hay un registro de sugerencias de la IA que se hayan descartado: **dato no disponible**.

### 2.4.2 IA usada en esta sesión de testing y documentación (08/11)

- **Herramienta:** Claude Code (CLI) con subagentes del proyecto: **implementador** (código y tests), **revisores** (revisión del diff), **auditores** (de contratos, de seguridad y de entrega), **curador de docs** y un subagente de **tests y cobertura**. Modelo: el que consta en los trailers de los commits de la sesión (Claude Sonnet 5.5). La versión de Claude Code: **dato no disponible**.
- **Qué se verificó ejecutando (R08, 08/11, local):** `npm ci`, build, lint (0 errores, 298 warnings), `docs:check`, `openapi:generate` sin diff, unitarios con cobertura y dos veces más (2746 pasan), e2e contra Postgres 16 real tres veces (312 pasan), RabbitMQ real tres veces (4 de 4) y `docker compose up` en frío. Newman, Schemathesis, gitleaks y `npm audit` corrieron además en el CI.
- **Qué NO se verificó ejecutando:** la corrida real de k6, ZAP, Trivy, el resultado de las alertas de CodeQL, `CORS_ORIGINS` y `BFF_SHARED_KEY` en Render, la recuperación con el broker **apagado**, y el éxito de 92 de las 152 operaciones. La actualización de `docs/QA/` de esta fecha la hizo un subagente: los totales de la matriz y de los casos se recalcularon con scripts sobre los archivos, y los nombres de los tests citados se comprobaron contra el código; el «Pasó» de la matriz se deriva de que la corrida completa no tuvo fallos, no de leer el resultado de cada test.
- **Regla vigente:** un resultado dictaminado por IA sin test ejecutado ni evidencia se toma como NO VERIFICABLE.

### 2.5 Un caso donde la IA se equivocó

**AGENTS.md afirma algo que el código desmiente, y esa afirmación se propagó.**

- **Qué dice el archivo.** `AGENTS.md`, línea 36: «Hoy no hay autorización por rol: `@Roles()` y `RolesGuard` existen pero ningún endpoint los usa».
- **Qué hace el código.** `src/app.module.ts:84-85` (82-83 al 03/11) registra `JwtAuthGuard` **y `RolesGuard`** como `APP_GUARD` globales. El `RolesGuard` falla cerrado: una escritura sin `@Roles` da 403 para todos (`src/common/guards/roles.guard.ts`), y `src/auth/route-roles.spec.ts` garantiza que toda escritura no pública declara su rol. El Issue #471 (cerrado el 02/11) ya había detectado el mismo desfasaje en `docs/api/endpoints.md` y `docs/deploy.md`; `AGENTS.md` quedó sin corregir.
- **Cómo se propagó.** `AGENTS.md` es el archivo que leen los agentes de IA al empezar. En la auditoría del 03/11, el auditor del frontend citó «hoy no hay autorización por rol» como una brecha conocida del backend, y el auditor de documentación anotó que «hoy no hay `@Roles` en endpoints según AGENTS.md» (aunque pidió contrastarlo con el ADR-008).
- **Cómo se detectó.** El auditor de seguridad no se fio del texto: leyó `app.module.ts`, `roles.guard.ts` y `route-roles.spec.ts`, y lo señaló como la corrección más importante de su informe. La comprobación manual (los números de línea citados) se puede repetir con `grep -n "RolesGuard" AGENTS.md src/app.module.ts`.
- **Estado.** Corregido el 06/11: la línea de `AGENTS.md` ahora dice que `RolesGuard` es global, falla cerrado y que `route-roles.spec.ts` garantiza el rol de toda escritura. Verificado el 08/11 con `grep -n "RolesGuard" AGENTS.md src/app.module.ts`. Al 03/11 estaba sin corregir y figuraba en la lista de acciones del Issue #494.
- **Lección.** Un diagnóstico de IA basado en documentación puede ser incorrecto aunque cite el repositorio; por eso la regla es «sin test o evidencia ejecutada, NO VERIFICABLE». Un test que habría atrapado el error: un spec que falle si el texto de `AGENTS.md` y el registro de `APP_GUARD` se contradicen, o simplemente `route-roles.spec.ts` citado como evidencia en lugar de la prosa.

### 2.6 Otros casos de la sesión del 08/11 donde lo generado necesitó corrección

Según el relato del desarrollador; los dos fueron detectados por una revisión o por el CI, **no por la IA que los generó**:

| Caso | Qué quedó mal | Quién lo detectó | Evidencia |
|---|---|---|---|
| `JWT_SECRET` literal en el workflow `api-tests.yml` (#572) | El agente que armó el workflow dejó un secreto de juguete escrito en el archivo | **gitleaks en el CI** | Run [42505473347](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/42505473347), job `secrets` en rojo; hoy `api-tests.yml` genera un secreto efímero (líneas 47-51) |
| Caché `.schemathesis/` versionada | Un `.gitignore` incompleto dejó entrar la caché de la herramienta | Una revisión (según el relato) | Hoy `.gitignore:71` ignora `.schemathesis/` y `git ls-files` no lista nada de esa carpeta; la corrección entró en el PR #583 |

## 3. Firma de tests y artefactos generados con IA

La cátedra exige que todo test generado con IA esté **revisado y firmado (autor en Git) por un integrante que pueda explicarlo en la defensa**. El historial muestra que la mayor parte de los commits tiene trailer de IA y que el autor Git de casi todos es una persona (`git shortlog -sne --all`, 08/11: Benjamin Martinez 278 entre dos correos, Nicolas Facundo Llousas 31, nicof 13, Bautista-Canteli 11, Miqueas Quintieri 3 y MQuintieriFulter 3). El autor del commit es la persona que lo firma. Falta que cada integrante confirme qué tests puede explicar. **Nadie del equipo completó esta tabla al 08/11**; no se completa por ellos.

| Integrante | Rol | Tests y archivos que firma y puede explicar | Revisado a mano (sí/no) |
|---|---|---|---|
| Benjamin Martinez | Dev Backend | **A COMPLETAR POR EL EQUIPO** (lo completa Benjamin Martinez) | **A COMPLETAR POR EL EQUIPO** (Benjamin Martinez) |
| Nicolas Facundo Llousas | Dev Frontend | **A COMPLETAR POR EL EQUIPO** (lo completa Nicolas Facundo Llousas) | **A COMPLETAR POR EL EQUIPO** (Nicolas Facundo Llousas) |
| Bautista Castro | DevOps | **A COMPLETAR POR EL EQUIPO** (lo completa Bautista Castro) | **A COMPLETAR POR EL EQUIPO** (Bautista Castro) |
| Santiago Tomas Peralta | QA y UX/UI | **A COMPLETAR POR EL EQUIPO** (lo completa Santiago Tomas Peralta) | **A COMPLETAR POR EL EQUIPO** (Santiago Tomas Peralta) |
| Miqueas Quintieri | Scrum Master | **A COMPLETAR POR EL EQUIPO** (lo completa Miqueas Quintieri) | **A COMPLETAR POR EL EQUIPO** (Miqueas Quintieri) |

Alias de Git observados: `Benjamin Martinez` (dos correos), `Nicolas Facundo Llousas`, `nicof`, `Bautista-Canteli` (y `bcanteli-dev` como coautor), `Miqueas Quintieri` y `MQuintieriFulter`. A qué integrante corresponde cada alias: **A COMPLETAR POR EL EQUIPO** (cada integrante confirma el suyo). Además aparece `scratch <scratch@local>` en dos commits publicados: no corresponde a ningún integrante (hallazgo P-2).

## 4. Riesgos del uso de IA y cómo se controlan

| Riesgo | Control |
|---|---|
| Tests triviales o que pasan aunque se borre el código | Cobertura con umbral global (y por archivo en 7 servicios críticos); revisión humana; **mutation testing** (Stryker, #577): medido solo en `outbound-requests` (84,21 %); el dominio completo queda sin medir |
| Documentación de apoyo desactualizada que engaña al agente (caso 2.5) | `npm run docs:check` en el CI; revisión periódica de `AGENTS.md`; tablero único de bloqueantes |
| Secretos copiados a un prompt o a un commit | Regla de `AGENTS.md` («nunca hardcodear secretos»); escaneo del historial con gitleaks v8.30.1 el 03/11 (0 hallazgos con `.gitleaks.toml`) y job `secrets` en el CI, que el 08/11 **atrapó un secreto de juguete literal** en un workflow antes de llegar a `develop` (ver `07-informe-seguridad.md` y `06-registro-defectos.md`, P-1) |
| «CUMPLE» dictaminado por IA sin evidencia | Se trata como NO VERIFICABLE hasta tener test ejecutado |
| Código que el integrante no puede explicar | Firma por integrante (punto 3) y ensayo de defensa previo a la prueba |

## 5. Plan de IA por usar (4.ª entrega, 17/11, y presentación final)

Estado al 08/11 en la última columna.

| # | Herramienta o uso | Objetivo medible | Riesgo que controla | Estado al 08/11 |
|---|---|---|---|---|
| 1 | Generación de casos de prueba a partir de las HU en Gherkin (Claude), con revisión del QA | 100% de las HU con 3 o más casos y matriz de trazabilidad sin huecos; ≥ 40% de casos negativos o de borde, medido con un script sobre `04-especificacion-casos.md` | Casos genéricos que no verifican nada: se revisa cada uno contra el criterio | Hecho: 348 casos, 66,7 % negativos o de borde (`04-especificacion-casos.md`). La revisión del QA sigue pendiente |
| 2 | Mutation testing guiado: Stryker para encontrar mutantes sobrevivientes y la IA para proponer los tests que los matan | Mutation score ≥ 60% en servicios y transiciones de estado | Suite en verde pero sin pruebas efectivas (verificación en vivo de la cátedra) | Parcial: Stryker corre en `outbound-requests` (84,21 %); sin medición del dominio completo |
| 3 | Revisión defensiva de los criterios SEC con Claude Fable 5.1 **más test ejecutado** para cada veredicto | 100% de los «CUMPLE» respaldados por un test o una evidencia ejecutada; 0 veredictos «por código» | Falsos «CUMPLE» por inspección superficial | Parcial: `07-informe-seguridad.md` sin ningún CUMPLE «por código»; ZAP y Trivy sin hacer |
| 4 | Triage de defectos: sugerir severidad y causa raíz a partir del Issue y del diff | Cada defecto cerrado con causa raíz documentada; severidad confirmada por el QA | Severidad mal asignada que oculta un defecto crítico (G9) | Parcial: causa raíz documentada en los cerrados; las severidades de las Mayores siguen siendo una propuesta |
| 5 | Pruebas visuales automáticas (capturas de Playwright comparadas) en 360, 768 y 1280 px | Capturas en los tres anchos sin regresiones visuales en las pantallas del manual | Regresiones de maquetación que no detecta axe | No hecho |

## 6. Marco de gobernanza entregado el 03/11

Resumen de lo que la *Gobernanza de IA* declara y que este documento no repetía. Es la **declaración oficial** y no se modifica; acá se cita para que quien lea este documento tenga el marco completo.

### 6.1 Principios y roles

- **Regla central:** la IA propone, una persona decide y responde (Gobernanza de IA, 03/11/2026, sección 1). Ocho principios: responsabilidad humana, supervisión humana, transparencia (trailer `Co-authored-by`), verificabilidad (evidencia ejecutada, no la afirmación del modelo), minimización de datos, contexto sobre memoria (si doc y código no coinciden, gana el código), trazabilidad de decisiones y proporcionalidad (Gobernanza de IA, 03/11/2026, sección 3).
- **Roles** (Gobernanza de IA, 03/11/2026, sección 4):

| Rol | Persona |
|---|---|
| Integrante / autor del PR (define la tarea, revisa el resultado, ejecuta las verificaciones y firma el PR) | Todos los integrantes |
| Product Owner (ambigüedades de requisitos, copy visible, componentes de UI) | Facundo Iriarte |
| Responsable de contexto de agentes (`AGENTS.md`, `docs/agents/`, manifiesto de skills) | Nicolas Facundo Llousas (frontend) · Benjamin Martinez (backend) |
| Responsable de integración (`docs/bloqueantes.md`, Acuerdo de Eventos, comunicación con otros módulos) | Benjamin Martinez |
| Responsable de despliegue y pipeline (deploys, CI/CD, que ningún log con secretos entre a una herramienta de IA) | Bautista Canteli Castro |
| Responsable de la política (revisa y actualiza el documento) | Miqueas Quintieri |

La matriz de decisión (Gobernanza de IA, 03/11/2026, sección 4) deja al integrante como responsable de implementar, mergear y cambiar contratos; el PO aprueba el copy y los componentes de UI personalizados; el equipo aprueba el merge (vía PR y CI), los cambios de contrato, los ADR y las herramientas nuevas.

### 6.2 Casos de uso y nivel de riesgo (Gobernanza de IA, 03/11/2026, sección 6)

Riesgo **Alto** (seguridad, datos o integración con otros grupos): features de API del backend (auth JWT, roles, registro en el Core, estados), publicar y consumir eventos (outbox/inbox), cambios de CI y despliegue, y modificar el pipeline o ejecutar deploys. **Medio**: corregir bugs de integración, documentar integración, migrar UI, textos de interfaz, actualizar dependencias, sincronizar el espejo del backend en el frontend, mensajes a otros grupos y diagnosticar fallos de deploy. **Bajo**: generar tests y OpenAPI, especificar y dividir Issues. Controles principales: tests, cobertura ≥ 85 %, lectura del diff, ADR si cambia un contrato, `docs:check`, prueba en el entorno desplegado.

**Usos prohibidos o restringidos** (Gobernanza de IA, 03/11/2026, sección 6): secretos, tokens y credenciales (prohibido ingresarlos en prompts o commitearlos; solo `.env.example`); datos personales reales de ciudadanos (prohibido; datos ficticios); decisiones de arquitectura y contrato (la IA propone, el equipo acepta; un ADR aceptado no se reescribe); mensajes a otros grupos (los envía una persona); merge a `develop`, `test` o `main` (una persona, siempre por PR); **desactivar tests o bajar umbrales para que el CI pase: prohibido**; componentes de UI personalizados (solo si shadcn no tiene equivalente y el PO aprueba).

### 6.3 Política de datos (Gobernanza de IA, 03/11/2026, sección 7)

| Clase de dato | ¿Se puede ingresar en la IA? |
|---|---|
| Público (código, documentación, ADRs) | Sí |
| Interno (respuestas de otros módulos sin credenciales, diseños de eventos) | Sí, sin datos sensibles |
| Sensible (tokens, secretos de firma, claves, IPs privadas, credenciales) | No |
| Personal (datos reales de personas) | No |
| Logs de despliegue y de CI | Solo después de revisar y tapar tokens, cadenas de conexión, claves y URLs privadas |

Medidas (Gobernanza de IA, 03/11/2026, sección 7): `.gitignore` para la configuración local, `.env.example` como único archivo de variables versionado, variables validadas en `src/config/env.validation.ts`, checklist del DoD contra secretos hardcodeados; las herramientas se usan con cuentas del propio integrante, con la opción de entrenamiento desactivada en las cuentas del equipo. **Esa desactivación no se puede verificar desde el repositorio.**

### 6.4 Flujo de trabajo y verificaciones previas al PR (Gobernanza de IA, 03/11/2026, sección 9)

Issue → triage → especificación → tickets → rama y worktree → implementación asistida → verificación local → PR → CI → revisión → merge a `develop`. El autor lee el diff completo; una revisión asistida (`code-review`) es segunda lectura, nunca reemplazo. Verificaciones del backend antes de pedir integración: `npm run build`, `npm run lint:check`, `npm test` y `npm run test:cov` (umbral 85 %), `npm run test:e2e` si corresponde, `npm run openapi:generate` y `npm run docs:check`.

### 6.5 Controles de calidad y riesgos (Gobernanza de IA, 03/11/2026, sección 11)

| Riesgo (P / I según la Gobernanza) | Control declarado | Estado al 08/11 |
|---|---|---|
| Código incorrecto o inventado (Media / Alto) | Tests, cobertura ≥ 85 %, CI obligatorio, lectura del diff | Cobertura 98,6 % / 93,94 %; el CI exigido es solo `build` y `test` (el e2e no es obligatorio, DEF-14) |
| Contratos de eventos inventados o desactualizados (Media / Alto) | JSON Schema, `bloqueantes.md`, `docs:check`, el código gana | `docs:check` verde (105 archivos, 793 enlaces); tests contra el paquete de M2 se saltean en el CI (DEF-11) |
| Filtración de secretos (Baja / Alto) | Solo `.env.example`, `.gitignore`, reglas en `AGENTS.md` | gitleaks en el CI; **un secreto de juguete literal llegó a una rama el 08/11 y lo atrapó el CI** (sección 8) |
| Dependencias vulnerables o desactualizadas (Media / Medio) | Actualización por avisos, lockfiles, revisión en PR | **6 altas aceptadas como riesgo en `develop`** (sección 8) |
| Documentación desactualizada (Alta / Medio) | Checklist del DoD y plantilla de PR | Caso 2.5 (`AGENTS.md`); `docs:check` en el CI |
| Sobreconfianza en la IA (Media / Alto) | La IA no aprueba ni mergea | Se mantiene; los PR los abre y firma una persona |
| Pérdida de aprendizaje del equipo (Media / Medio) | Cada integrante explica el código que firma | **Las firmas por integrante siguen sin completar** (sección 3) |

Los demás riesgos de la Gobernanza (textos de UI, contexto excesivo, dependencia de un proveedor, propiedad intelectual y licencias) son del frontend o transversales y no se re-evaluaron acá.

### 6.6 Transparencia y atribución (Gobernanza de IA, 03/11/2026, sección 12)

Todo commit asistido lleva `Co-authored-by: <modelo>`; la persona que abre el PR responde por el contenido, el DoD y haber leído el diff. En el tramo analizado por la Gobernanza, el backend tiene 50 commits con trailer de Claude (46 de Benjamin Martinez y 4 de Nicolas Facundo Llousas) y el frontend 40 de 50. Esos números del backend se reprodujeron con `git log` (sección 8).

### 6.7 Uso de IA por integrante (Gobernanza de IA, 03/11/2026, sección 13)

| Integrante | Rol de la IA en su trabajo | Herramientas declaradas |
|---|---|---|
| Benjamin Martinez | Backend y documentación de integración con los módulos 1 a 9; correcciones de contratos en el frontend | Claude Code (Sonnet 5.5) |
| Nicolas Facundo Llousas | Frontend (shadcn, mapa, textos de UI); infraestructura de agentes y worktrees; algunas features de backend (detalle en la sección 13.1 de la Gobernanza: skills, MCP de Trello y Google Workspace, 335 de 393 commits del frontend) | Claude Code (Sonnet 5.5, Opus 5.5, Haiku 5.5), GPT-6 Luna, Orca, skills, MCP, playwright-cli, chrome-devtools |
| Santiago Tomas Peralta | QA: generar casos de prueba desde las HU y revisar la cobertura de los tests; plan de pruebas y matriz de trazabilidad (**uso declarado por el equipo; no deja commits propios**, ver 8.1) | Claude Code (Sonnet 5.5, Opus 5.5) |
| Bautista Canteli Castro | Despliegues (Render con Supabase, Vercel), CI/CD y diagnóstico de fallos de deploy | OpenCode Go (deepseek pro v4), Google Antigravity, Claude Code (Sonnet 5.5) |
| Miqueas Quintieri | Trazabilidad de historias de usuario y estados en Trello y sprints | Claude Code (Sonnet 5) |
| Facundo Iriarte | Product Owner; «No utilizo» | — |

### 6.8 Gestión de incidentes (Gobernanza de IA, 03/11/2026, sección 14)

Definición: toda situación en la que el uso de IA causó o pudo causar un daño (secreto expuesto, contrato roto, bug en rama compartida, código sin revisar). Pasos: detectar y avisar, contener (revocar y rotar, revertir o PR de corrección), registrar en un Issue con causa raíz, mejorar (`AGENTS.md`, la política o el CI) y comunicar a otros grupos si afecta un contrato. La Gobernanza declara **cero incidentes al 02/11/2026**. Lo ocurrido después está en la sección 8 y en `06-registro-defectos.md` (P-1, P-2, DEF-22 y DEF-23).

## 7. Indicadores de seguimiento (Gobernanza de IA, 03/11/2026, sección 15)

La Gobernanza propone seis indicadores. Al 08/11: **porcentaje de commits con trailer de IA** (69,0 % en `develop`, sección 2.1); **cobertura** (98,6 % / 93,94 %, `05-informe-ejecucion.md`); **fallos de CI por PR asistido**, **bugs de regresión atribuibles a cambios asistidos** y **tiempo por ticket**: **dato no disponible** (no se midieron); **incidentes de seguridad**: ver sección 8.

## 8. Complementos y novedades posteriores a la declaración entregada el 03/11

La *Gobernanza de IA* ya está en manos de la cátedra y no se modifica. Esta sección agrega detalle que la complementa y declara lo ocurrido después de su fecha, para que nada quede sin informar.

### 8.1 Uso de IA fuera del repositorio

El documento de IA no trata solo del código: también declara usos que **no dejan commits**. Esa evidencia **no sale de git sino de la declaración del equipo** (Gobernanza de IA, 03/11/2026, sección 13) y de los casos de uso (Gobernanza de IA, 03/11/2026, sección 6); este documento no la puede verificar con `git log`.

| Integrante | Uso de IA declarado fuera del repositorio | Fuente |
|---|---|---|
| Santiago Tomas Peralta | QA: generar casos de prueba desde las HU y revisar la cobertura de los tests; plan de pruebas y matriz de trazabilidad | (Gobernanza de IA, 03/11/2026, sección 13) |
| Miqueas Quintieri | Trazabilidad de historias de usuario y actualización de estados en Trello y de los sprints, tomando como referencia los issues resueltos en GitHub | (Gobernanza de IA, 03/11/2026, sección 13) |
| Bautista Canteli Castro | Diagnóstico de logs de despliegue (Render, Vercel): lectura, causa probable y propuesta de corrección, con los logs saneados antes de pegarlos | (Gobernanza de IA, 03/11/2026, sección 13) y (Gobernanza de IA, 03/11/2026, sección 6) |
| Facundo Iriarte (PO) | Resuelve las ambigüedades de requisitos que la IA plantea en la especificación; declara «No utilizo» IA | (Gobernanza de IA, 03/11/2026, sección 13) y (Gobernanza de IA, 03/11/2026, sección 4) |
| Nicolas Facundo Llousas | Conectores MCP de Trello y de Google Docs, Sheets y Drive para leer y editar tickets y documentación | (Gobernanza de IA, 03/11/2026, sección 13.1) |

El alias de git de cada persona sigue **A COMPLETAR POR EL EQUIPO**: sirve para la firma de tests (sección 3), que sí es del repositorio.

### 8.2 Notas de método

- **Ventana de commits.** La Gobernanza se elaboró sin acceso al historial completo de git, por lo que analizó los últimos 50 commits de cada repo hasta el 27/10/2026 (Gobernanza de IA, 03/11/2026, sección 1 y 12). Este documento cuenta todo el historial de `develop`: 297 commits al 08/11 (252 al 03/11), con 205 (69,0 %) con trailer de Claude. Se reproduce con los comandos de la sección 2.1. Además se reprodujo la ventana de la Gobernanza (`git log 1d600d2 --until=2026-10-28 | head -50`): 50 de 50 con trailer de Claude, 46 de Benjamin Martinez y 4 de Nicolas Facundo Llousas, igual que el PDF.
- **Detalle de modelos (información adicional).** La Gobernanza describe las herramientas en general. Del trailer `Co-Authored-By` de los commits del backend sale este detalle: Claude Sonnet 5.5 (110 commits, 02/10 a 08/11), Claude Opus 5.5 (16, 23/09 a 23/10), Claude Opus 5 (41, 02/09 a 22/09), Claude Sonnet 5 (37, 25/08 a 20/09) y «Claude» sin versión (6). En la ventana de los últimos 50 commits solo figuran Sonnet 5.5 y Opus 5.5. **Haiku 5.5**, que la Gobernanza menciona para tareas de triage y para el frontend, **no deja trailer en el backend** (0 commits); no se afirma ni se descarta su uso fuera de esos trailers: dato no disponible.
- **Evidencia de las guías.** Las guías `docs/agents/orca-worktree-setup.md`, `visual-verification.md` y `browser-diagnostics.md` (Gobernanza de IA, 03/11/2026, sección 5) corresponden al repositorio del frontend; el `docs/agents/` del backend tiene `README`, `domain`, `issue-tracker` y `triage-labels`. Las skills y `.claude/` no se versionan, como declara la Gobernanza (`.gitignore`), y `skills-lock.json` fija 27 skills.
- **CI obligatorio.** Los checks exigidos de la rama son `build` y `test`; `e2e` corre en cada PR pero no es obligatorio (DEF-14).

### 8.3 Herramientas con detalle adicional

Además de las del inventario (Gobernanza de IA, 03/11/2026, sección 5), el historial y el tablero muestran: **Copilot Autofix powered by AI** (1 commit, `1039cdd`, #19; 2 líneas de trailer; la versión del 03/11 de este documento decía «2 commits», eran 2 líneas en 1 commit) y **Claude Fable 5.1** como revisor defensivo de las tarjetas SEC de Trello (campo «Verifica con Fable 5.1»). Quién aceptó el commit de Copilot: **A COMPLETAR POR EL EQUIPO**.

### 8.4 Novedades posteriores a la declaración entregada

Hechos nuevos desde el 02/11/2026, fecha de la auditoría que sustenta (Gobernanza de IA, 03/11/2026, sección 14). Se declaran porque son posteriores y la regla G9 pide no omitirlos; el detalle está en `06-registro-defectos.md`.

1. **Logs que registraban el `access_token` de la query** (DEF-22): corregido en #581 (`a733f44`) con `redactUrl` y tests; cerrado.
2. **`docker compose up` en frío fallaba** (DEF-23): `rabbitmq-setup` salía con `exit 7`; corregido en #584 (`c9a8dc7`); cerrado.
3. **Secreto de juguete literal en el workflow `api-tests.yml` de #572** (P-1): lo detectó gitleaks en el CI (run 42505473347); se corrigió reescribiendo la rama antes de mergear; nunca llegó a `develop`.
4. **Dos commits publicados con autor `scratch <scratch@local>`** (P-2): `5c8c78b` y `a06b33b`, por una configuración de git errónea; mergeados con squash; **abierto, sin reescribir**.
5. **Dependencias de `develop`:** la Gobernanza (Gobernanza de IA, 03/11/2026, sección 14) dice que las vulnerabilidades de dependencias se resolvieron antes de llegar a ramas compartidas. Al 08/11, `develop` tiene **6 altas aceptadas como riesgo** (13 vulnerabilidades en producción, 0 críticas), sin análisis de explotabilidad (`07-informe-seguridad.md` 5.1, DEF-08). Es la situación actual, posterior a esa declaración.

## 9. Declaración

El uso de IA descripto arriba es completo según el historial del repositorio al 08/11/2026 y **complementa la Gobernanza de IA entregada el 03/11/2026** sin modificarla; los complementos y las novedades posteriores están en la sección 8 (`develop` @ `1d600d2`), con las limitaciones indicadas. Los puntos marcados **A COMPLETAR POR EL EQUIPO** (firmas por integrante, prompts reconstruidos, alias de Git, skills efectivamente usadas, sugerencias descartadas) **siguen sin completar**; solo el equipo puede hacerlo y esta declaración no está firmada por nadie.
