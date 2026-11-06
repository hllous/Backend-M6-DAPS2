# Declaración y plan de uso de IA

> Entregable 7 de los criterios de testing de la cátedra (Eje E, G8). Módulo 6 «Ambiente e Higiene», Grupo 04. Estado al 03/11/2026.
>
> **Cómo leer este documento.** Los datos que salen del repositorio (conteos de commits, versiones de los trailers, archivos) se pueden comprobar con los comandos indicados. Lo que depende de la memoria del equipo (prompts exactos, quién revisó cada test) está marcado **«A COMPLETAR POR EL EQUIPO»** o **«reconstruido, a confirmar por el equipo»**. No se inventó ninguna firma.

## 1. Resumen

- El equipo usó IA generativa de forma extensa en el desarrollo del backend y del frontend: código, tests, documentación, revisión de código y auditoría contra estos criterios.
- **El sistema no integra ninguna funcionalidad de IA** (no llama a ningún modelo ni expone un asistente). Por eso el punto 8.3 de los criterios (prompt injection, fuga de datos del modelo, proveedor de IA caído) **no aplica**.
- Regla del equipo: un resultado dictaminado por IA sin test ejecutado ni evidencia se toma como **NO VERIFICABLE**. Vale para el informe de seguridad (`07-informe-seguridad.md`).

## 2. IA usada para desarrollar y testear

### 2.1 Herramientas y versiones

La fuente es el trailer `Co-Authored-By` de cada commit. Se contó sobre el historial de la rama `develop` al 03/11/2026 (252 commits, del 18/08 al 02/11):

```bash
git log --format=%H | wc -l                                  # 252 commits
git log --format=%B | grep -i "co-authored-by" \
  | sed 's/^[Cc]o-[Aa]uthored-[Bb]y: *//; s/ *<.*//' | sort | uniq -c | sort -rn   # líneas de trailer
```

Las líneas de trailer sobreestiman los commits: los merges por *squash* copian en el cuerpo los trailers de cada commit que resumen (60 commits repiten alguna línea). La tabla cuenta **commits distintos** por herramienta; un commit puede figurar en más de una fila si tiene trailers de varios modelos. «Tipos» es el prefijo del asunto (Conventional Commits).

| Herramienta (nombre en el trailer) | Commits | Líneas de trailer | Tipos de commit (feat / fix / docs / otros) |
|---|---|---|---|
| Claude Sonnet 5.5 | 96 | 191 | 27 / 19 / 44 / 6 |
| Claude Opus 5 | 41 | 63 | 16 / 10 / 8 / 7 |
| Claude Sonnet 5 | 37 | 52 | 1 / 21 / 7 / 8 |
| Claude Opus 5.5 | 16 | 36 | 6 / 4 / 3 / 3 |
| «Claude» (sin versión) | 6 | 7 | 1 / 0 / 5 / 0 |
| Copilot Autofix powered by AI | 2 | 2 | n/d |

- **191 de los 252 commits (76%)** tienen al menos un trailer de Claude (349 líneas en total).
- Qué hizo cada modelo en cada commit no queda registrado más allá del tipo de commit: para qué se usó cada herramienta en detalle es **A COMPLETAR POR EL EQUIPO**.
- El trailer indica **participación de la IA, no autoría exclusiva ni revisión**: no dice cuánto del código escribió el modelo ni quién lo revisó. Eso se declara en el punto 3.
- Aparecen además coautores humanos en las líneas de trailer: Nicolas Facundo Llousas (10), bcanteli-dev (9), nicof (4) y Benjamin Martinez (3).
- **Claude Code** (CLI y extensión de VS Code) es el arnés con el que se usaron los modelos. La versión del arnés no queda registrada en el repositorio: **A COMPLETAR POR EL EQUIPO**.
- **Claude Fable 5.1** como revisor defensivo: en el tablero de Trello «M6 - Histórico de Sprints», lista «Clase 11: Seguridad», cada tarjeta SEC lleva el campo «Verifica con Fable 5.1». Figura «Sí» en SEC-W01, SEC-W02 y SEC-I01, y «No» en el resto. Esos veredictos son del 13/10 y varios dicen «Cumple por código; falta ejecutar el test», es decir, **NO VERIFICABLE** hasta que se ejecute el test (ver `07-informe-seguridad.md`).

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

Qué se aceptó y qué se descartó en cada caso concreto: **A COMPLETAR POR EL EQUIPO** (con enlaces a PR o Issue). El único caso documentado de descarte en esta declaración es el del punto 2.5.

### 2.5 Un caso donde la IA se equivocó

**AGENTS.md afirma algo que el código desmiente, y esa afirmación se propagó.**

- **Qué dice el archivo.** `AGENTS.md`, línea 36: «Hoy no hay autorización por rol: `@Roles()` y `RolesGuard` existen pero ningún endpoint los usa».
- **Qué hace el código.** `src/app.module.ts:84-85` (82-83 al 03/11) registra `JwtAuthGuard` **y `RolesGuard`** como `APP_GUARD` globales. El `RolesGuard` falla cerrado: una escritura sin `@Roles` da 403 para todos (`src/common/guards/roles.guard.ts`), y `src/auth/route-roles.spec.ts` garantiza que toda escritura no pública declara su rol. El Issue #471 (cerrado el 02/11) ya había detectado el mismo desfasaje en `docs/api/endpoints.md` y `docs/deploy.md`; `AGENTS.md` quedó sin corregir.
- **Cómo se propagó.** `AGENTS.md` es el archivo que leen los agentes de IA al empezar. En la auditoría del 03/11, el auditor del frontend citó «hoy no hay autorización por rol» como una brecha conocida del backend, y el auditor de documentación anotó que «hoy no hay `@Roles` en endpoints según AGENTS.md» (aunque pidió contrastarlo con el ADR-008).
- **Cómo se detectó.** El auditor de seguridad no se fio del texto: leyó `app.module.ts`, `roles.guard.ts` y `route-roles.spec.ts`, y lo señaló como la corrección más importante de su informe. La comprobación manual (los números de línea citados) se puede repetir con `grep -n "RolesGuard" AGENTS.md src/app.module.ts`.
- **Estado.** Corregido el 06/11: la línea de `AGENTS.md` ahora dice que `RolesGuard` es global, falla cerrado y que `route-roles.spec.ts` garantiza el rol de toda escritura (cambio en el árbol de trabajo de la rama `feature/521-validar-cuadrilla-contra-m1`, sin commit al escribir esto). Al 03/11 estaba sin corregir y figuraba en la lista de acciones del Issue #494.
- **Lección.** Un diagnóstico de IA basado en documentación puede ser incorrecto aunque cite el repositorio; por eso la regla es «sin test o evidencia ejecutada, NO VERIFICABLE». Un test que habría atrapado el error: un spec que falle si el texto de `AGENTS.md` y el registro de `APP_GUARD` se contradicen, o simplemente `route-roles.spec.ts` citado como evidencia en lugar de la prosa.

## 3. Firma de tests y artefactos generados con IA

La cátedra exige que todo test generado con IA esté **revisado y firmado (autor en Git) por un integrante que pueda explicarlo en la defensa**. El historial muestra que la mayor parte de los commits tiene trailer de IA y que el autor Git de casi todos es una persona (`git shortlog -sne`, sobre todas las ramas: Benjamin Martinez 228, Nicolas Facundo Llousas 31, nicof 13, Bautista-Canteli 11, Miqueas Quintieri 6). El autor del commit es la persona que lo firma. Falta que cada integrante confirme qué tests puede explicar.

| Integrante | Rol | Tests y archivos que firma y puede explicar | Revisado a mano (sí/no) |
|---|---|---|---|
| Benjamin Martinez | Dev Backend | **A COMPLETAR POR EL EQUIPO** | **A COMPLETAR POR EL EQUIPO** |
| Nicolas Facundo Llousas | Dev Frontend | **A COMPLETAR POR EL EQUIPO** | **A COMPLETAR POR EL EQUIPO** |
| Bautista Castro | DevOps | **A COMPLETAR POR EL EQUIPO** | **A COMPLETAR POR EL EQUIPO** |
| Santiago Tomas Peralta | QA y UX/UI | **A COMPLETAR POR EL EQUIPO** | **A COMPLETAR POR EL EQUIPO** |
| Miqueas Quintieri | Scrum Master | **A COMPLETAR POR EL EQUIPO** | **A COMPLETAR POR EL EQUIPO** |

Alias de Git observados: `Benjamin Martinez` (dos correos), `Nicolas Facundo Llousas`, `nicof`, `Bautista-Canteli` (y `bcanteli-dev` como coautor), `Miqueas Quintieri` y `MQuintieriFulter`. A qué integrante corresponde cada alias: **A COMPLETAR POR EL EQUIPO**.

## 4. Riesgos del uso de IA y cómo se controlan

| Riesgo | Control |
|---|---|
| Tests triviales o que pasan aunque se borre el código | Cobertura con umbral por archivo; revisión humana; **mutation testing pendiente** (Stryker) como control objetivo |
| Documentación de apoyo desactualizada que engaña al agente (caso 2.5) | `npm run docs:check` en el CI; revisión periódica de `AGENTS.md`; tablero único de bloqueantes |
| Secretos copiados a un prompt o a un commit | Regla de `AGENTS.md` («nunca hardcodear secretos»); escaneo del historial con gitleaks v8.30.1 el 03/11 (0 hallazgos con `.gitleaks.toml`) y job `secrets` en el CI (ver `07-informe-seguridad.md`) |
| «CUMPLE» dictaminado por IA sin evidencia | Se trata como NO VERIFICABLE hasta tener test ejecutado |
| Código que el integrante no puede explicar | Firma por integrante (punto 3) y ensayo de defensa previo a la prueba |

## 5. Plan de IA por usar (4.ª entrega, 17/11, y presentación final)

| # | Herramienta o uso | Objetivo medible | Riesgo que controla |
|---|---|---|---|
| 1 | Generación de casos de prueba a partir de las HU en Gherkin (Claude), con revisión del QA | 100% de las HU con 3 o más casos y matriz de trazabilidad sin huecos; ≥ 40% de casos negativos o de borde, medido con un script sobre `04-especificacion-casos.md` | Casos genéricos que no verifican nada: se revisa cada uno contra el criterio |
| 2 | Mutation testing guiado: Stryker para encontrar mutantes sobrevivientes y la IA para proponer los tests que los matan | Mutation score ≥ 60% en servicios y transiciones de estado | Suite en verde pero sin pruebas efectivas (verificación en vivo de la cátedra) |
| 3 | Revisión defensiva de los criterios SEC con Claude Fable 5.1 **más test ejecutado** para cada veredicto | 100% de los «CUMPLE» respaldados por un test o una evidencia ejecutada; 0 veredictos «por código» | Falsos «CUMPLE» por inspección superficial |
| 4 | Triage de defectos: sugerir severidad y causa raíz a partir del Issue y del diff | Cada defecto cerrado con causa raíz documentada; severidad confirmada por el QA | Severidad mal asignada que oculta un defecto crítico (G9) |
| 5 | Pruebas visuales automáticas (capturas de Playwright comparadas) en 360, 768 y 1280 px | Capturas en los tres anchos sin regresiones visuales en las pantallas del manual | Regresiones de maquetación que no detecta axe |

## 6. Declaración

El equipo declara que el uso de IA descripto arriba es completo según el historial del repositorio al 03/11/2026, y que los puntos marcados **A COMPLETAR POR EL EQUIPO** se completarán antes de la entrega del 10/11.
