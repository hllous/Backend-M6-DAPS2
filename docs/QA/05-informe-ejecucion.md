# 05 · Informe de ejecución

> Versión 2.0 · 10/11/2026. Backend del Módulo 6 (Grupo 04), sobre `develop` @ `142e1a3` (merge de [#597](https://github.com/hllous/Backend-M6-DAPS2/pull/597)). Los números salen de corridas reales (locales y de GitHub Actions); lo que no se midió figura como **no realizado**, con el motivo.
>
> **Corrida R09.** Local, Windows, Node 22, máquina sin otras cargas, sobre la rama de integración de #597 (mismo contenido que `develop` @ `142e1a3`). Se midieron build, lint, `docs:check`, `openapi:generate`, unitarios con cobertura, e2e contra Postgres 16 real, Newman, Schemathesis, k6 y `docker compose up` en frío. **R08** es la corrida anterior (sobre `1d600d2`) y queda como referencia.

## 1. Cómo se obtuvieron los números

| Qué | Cómo | Resultado |
|---|---|---|
| Build, lint, docs, OpenAPI | `npm run build`, `lint:check`, `docs:check`, `openapi:generate` + `git diff docs/api` | Build OK; lint **0 errores y 305 warnings**; `docs:check` OK; `openapi:generate` sin diff |
| Unitarios con cobertura | `npm run test:cov` (Prisma mockeado, no toca ninguna base) | Ver 2 y 3 |
| e2e general | `npm run test:e2e` contra Postgres 16 real, base descartable (`docs/testing.md`) | Ver 2 |
| Newman | Colección `test/api/` contra el backend local | 455 requests ejecutados (435 definidos), 763 assertions, 0 fallas |
| Schemathesis 4.33.1 | Solo `GET`, `--max-examples 15`, dos pasos (esquema y errores de servidor; `status_code_conformance`) | Ver 2 |
| Carga (k6) | `test/perf/k6-criticos.js`, 50 usuarios, 5 min | Ver 2.2 |
| Compose en frío | `docker compose up -d --build` con volúmenes nuevos | Ver 2 |
| CI de `develop` | Run de `CI` del commit `142e1a3` | [42632174201](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/42632174201) |
| Newman y Schemathesis en el CI | Workflow `API tests`, job `api (newman + schemathesis)` | [42632174625](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/42632174625) (push) y [42631657018](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/42631657018) (PR) |
| Mutation | Stryker (`npm run test:mutation`); línea base en el CI (2 h 26 min) y remedición local de 5 archivos (44 min), ambas **posteriores a R09** (ver 5.1) | 26 archivos de dominio: 71,22 % de línea base |
| e2e con RabbitMQ real | `rabbitmq-real` en el job `e2e` del CI | En local se saltea sin `RABBITMQ_URL`; última corrida local: R08 (4 de 4) |

Los **e2e se corrieron en local** contra una base descartable. Los logs no incluyen números por caso, solo los totales de Jest.

## 2. Totales por nivel

R09 salvo que se diga otra cosa. «Saltados» son tests que Jest no ejecutó; «no realizado» es un nivel sin ninguna corrida.

| Nivel | Suites | Ejecutados | Pasados | Fallados | Saltados | Tiempo |
|---|---|---|---|---|---|---|
| Unitario | 124 (124 pasan) | 2854 | 2854 | 0 | 0 | — |
| e2e con Postgres 16 real | 24 (23 pasan, 1 salteada) | 343 | 343 | 0 | 4 | 79 s (corrida del 10/11; las anteriores, idénticas, 94 s y 100 s) |
| `rabbitmq-real` | 1 | R08: 4 | R08: 4 | 0 | 4 en R09 (sin broker local) | En el CI corre en el job `e2e` |
| Newman (`test/api/`) | — | 455 requests | 763 assertions | 0 | — | Corre en el CI (job `api`: 2 min 27 s con Schemathesis) |
| Schemathesis: esquema y sin 5xx | — | 4388 casos | 4388 | 0 | — | — |
| Schemathesis: `status_code_conformance` (**bloqueante**) | — | 4384 casos | 3913 | 0 (exit 0) | 471 | — |
| Mutation (Stryker, #617) | — | 26 archivos de dominio (5182 mutantes, 2142 no compilan y no cuentan) | 71,22 % global en el CI (2165 detectados) | — | — | 2 h 26 min en el CI; medición del 10-11/11/2026, **no es R09** (5.1) |
| Carga (k6) | — | 14 850 requests | p(95) 32,84 ms; 0,00 % de error | 0 | — | 5 min; ver 2.2 |
| Seguridad dinámica (ZAP) | — | — | — | — | — | **No realizado** |
| Seguridad estática: Trivy | — | — | — | — | — | **No realizado** |
| Compose en frío | — | 1 | 1 | 0 | — | up en 46 s; `/health/ready` 200 a los 55 s; seed OK; `GET /neighborhoods` 200 |

Notas:

- **Los unitarios no saltan ningún test.** Los 12 que antes se saltaban dependían del paquete de contratos de M2, que no se versiona: `updateTicketStatus` se valida contra nuestro schema y los ejemplos de M2 usados viven como fixtures mínimos en `test/fixtures/m2/`.
- **Los 4 saltados del e2e** son los de `rabbitmq-real`, que se saltea sin `RABBITMQ_URL`.
- **Tests nuevos desde R08:** de 2746 a 2854 unitarios (+108) y de 312 a 343 e2e (+31: 9 de `problem-details`, 12 de `etag-if-match`, 8 de `idempotency` y 2 de `neighborhoods-catalog`).
- **Bloqueados: 0** en todos los niveles. Lo que depende de otros módulos (M1, M9, M7, M2) se probó en el historial de integración, no con un caso automatizado bloqueado.
- **Los e2e** cubren: ciclo de servicios, pertenencia de Campo, inbox e idempotencia, outbox con reintento, flujo ambiental, cortes de calle, cierre de contenedores con rollback, roles por endpoint, auditoría, extracciones, solicitud de información, personas de demo, migración de cuadrillas, guard de la base, límite de tasa (429), seguridad de entrada, errores en Problem Details, ETag e `If-Match`, `Idempotency-Key` y catálogo local de barrios (detalle en `docs/testing.md`).
- **Newman y Schemathesis** tienen caso de éxito en 61 de las 152 operaciones; los 91 restantes están en `test/api/PENDIENTES.md`. Schemathesis recorre solo los `GET`. Los 471 casos salteados son avisos esperables: 404 por datos de prueba y 429 en 3 operaciones del portal público.

### 2.1 Flaky

| Suite | Corrida 1 | Corrida 2 | Corrida 3 | Resultado |
|---|---|---|---|---|
| Unitarios, e2e y `rabbitmq-real` (R08, local) | 2746 / 312 / 4 | 2746 / 312 / 4 | 2746 / 312 / 4 | **Idéntico en 3 corridas** |
| e2e general (R09, local) | 343 pasan, 4 saltados | 343 pasan, 4 saltados | — | **Idéntico en 2 corridas** |

Las 3 corridas se repitieron también en el CI y en local sobre R09, con el mismo resultado. Observaciones: (a) una corrida completa del e2e cayó una vez por un timeout de 30 s en el arranque de una suite con la máquina cargada con otras pruebas; con la máquina libre dio idéntico, y no investigamos la causa (ver la lección 8 de [`08-lecciones-aprendidas.md`](08-lecciones-aprendidas.md)); (b) corridas iguales no prueban que no haya un defecto intermitente: DEF-24 ([#554](https://github.com/hllous/Backend-M6-DAPS2/issues/554)) está cerrado por decisión del equipo con la causa raíz sin confirmar, y si vuelve a aparecer se reabre; (c) no corrimos `--detectOpenHandles`: dato no disponible.

### 2.2 Carga (k6)

`test/perf/k6-criticos.js`: 50 usuarios concurrentes, 5 minutos, `GET /services`, `/containers` y `/zones` autenticados, `pageSize=20`, 1 s de pausa por usuario. Evidencia: `test/perf/resultados/2026-11-09/k6-completa.txt` y `k6-summary-completa.json`; la tabla está en `test/perf/README.md`.

| Métrica | Resultado | Umbral | Cumple |
|---|---|---|---|
| `http_req_duration` p(95) | **32,84 ms** | < 500 ms | **Sí** |
| `http_req_failed` | **0,00 %** (0 de 14 850) | < 1 % | **Sí** |
| Requests | 14 850 (49,1 por segundo) | — | — |
| Promedio / mediana / p(90) / máximo | 14,97 / 11,11 / 23,95 / 441,21 ms | — | — |
| Checks (200 en los tres `GET`) | 100 % | — | — |

**Alcance de esta corrida.** Fue **en local**, con backend, Postgres, RabbitMQ y k6 en la misma máquina de 6 CPUs, solo con lecturas, con `THROTTLE_LIMIT` en 100000 (en el despliegue el límite global sigue en 600 por minuto por IP y endpoint) y sobre la base del seed de demo (673 servicios, 500 contenedores, 48 zonas). También se corrió la carga contra el despliegue (Render y Supabase) y con escrituras; la evidencia vive en `test/perf/`.

## 3. Cobertura (unitarios, `npm run test:cov`)

**Global (R09):** sentencias **98,58 %** · ramas **93,63 %** · funciones **98,07 %** · líneas **99,16 %** (124 suites, 2854 tests). Sale de la fila `All files` del log. Frente a R08 (98,6 / 93,94 / 98,09 / 99,18) bajó unas centésimas porque entró código nuevo (ETag, idempotencia, filtro de errores).

El umbral del repo es 85 % en las cuatro métricas (`package.json`, `coverageThreshold`) y la corrida lo cumplió. Umbrales de la consigna: líneas ≥ 80 %, ramas ≥ 70 % en la capa de negocio: **cumple**; el valor más bajo de `src/modules/*` es 95,77 % de líneas y 82,92 % de ramas, ambos en `green-points`.

Cobertura por carpeta (sentencias, ramas, funciones, líneas; en %):

| Carpeta | Sent. | Ramas | Func. | Líneas |
|---|---|---|---|---|
| `src/auth` | 98,32 | 90 | 96,77 | 100 |
| `src/common` (raíz) | 96,07 | 85 | 92,3 | 95,55 |
| `src/common/audit` | 100 | 100 | 100 | 100 |
| `src/common/decorators` | 99,11 | 90,9 | 100 | 100 |
| `src/common/filters` | 97,82 | 88 | 100 | 100 |
| `src/common/idempotency` | 98,88 | 85,71 | 100 | 98,73 |
| `src/common/middleware` | 100 | 83,33 | 100 | 100 |
| `src/common/utils` | 97,11 | 88,88 | 95 | 98,83 |
| `src/common/guards`, `interceptors`, `pipes` | 100 | 100 | 100 | 100 |
| `src/core` | 98,04 | 98,39 | 91,66 | 100 |
| `src/events` (raíz) | 100 | 97,4 | 100 | 100 |
| `src/events/consumers` | 97,81 | 94,48 | 98,07 | 98,79 |
| `src/events/inbox` | 100 | 95,83 | 100 | 100 |
| `src/events/outbox` | 98,46 | 92,3 | 100 | 99,12 |
| `src/events/publishers` | 95,83 | 100 | 88,88 | 98,36 |
| `src/health`, `src/identity` | 100 | 100 | 100 | 100 |
| `modules/attachments` | 95,78 | 90,14 | 100 | 98,23 |
| `modules/attachments/storage` | 100 | 100 | 100 | 100 |
| `modules/citizen-portal` | 100 | 90,62 | 100 | 100 |
| `modules/containers` | 99,3 | 92,3 | 100 | 99,27 |
| `modules/crews` | 100 | 96,11 | 100 | 100 |
| `modules/environmental-inspections` | 100 | 97,26 | 100 | 100 |
| `modules/environmental-reports` | 99,48 | 91,8 | 100 | 100 |
| `modules/green-points` | 96 | 82,92 | 100 | 95,77 |
| `modules/green-spaces` | 98,57 | 93,33 | 100 | 98,48 |
| `modules/indicators` | 97,51 | 86,9 | 93,4 | 98,41 |
| `modules/outbound-requests` | 98,59 | 95,65 | 98 | 98,46 |
| `modules/role-assignments` | 100 | 95 | 100 | 100 |
| `modules/routes` | 100 | 88 | 100 | 100 |
| `modules/services` | 97,43 | 93,31 | 99 | 97,66 |
| `modules/trees` | 98,68 | 90,9 | 100 | 98,5 |
| `modules/trees/interventions` | 99,21 | 94,87 | 100 | 99,17 |
| `modules/trees/surveys` | 100 | 100 | 100 | 100 |
| `modules/vehicles` | 98,7 | 96 | 100 | 98,63 |
| `modules/zones` | 100 | 97,56 | 100 | 100 |
| `modules/communes`, `disposal-sites`, `neighborhoods`, `service-frequencies`, `service-types` | 100 | 100 | 100 | 100 |

**Qué excluye el cálculo** (`collectCoverageFrom`): los `*.module.ts`, los `dto/`, `index.ts`, `main.ts`, `configure-app.ts`, `config/` y `prisma/` (cableado y configuración; `config/` tiene su propio spec). **Cobertura de los e2e:** dato no disponible. La cobertura de líneas dice qué se ejecutó, no qué se verificó; para eso está el mutation testing (sección 5).

## 4. Tiempos del pipeline

Run de `CI` del commit `142e1a3` ([42632174201](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/42632174201)), `success` de punta a punta en **1 min 44 s**:

| Job | Resultado | Duración |
|---|---|---|
| `build` | success | 54 s |
| `test` | success | 1 min 16 s |
| `e2e` (incluye RabbitMQ real) | success | 1 min 39 s |
| `secrets` (gitleaks sobre todo el historial) | success | 32 s |
| `audit` (`npm audit`, informativo) | success | 10 s |
| `deploy` | skipped (solo corre en push a `main`) | — |

El workflow `API tests` (Newman y Schemathesis, con `status_code_conformance` bloqueante) terminó en `success` en 2 min 27 s ([42632174625](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/42632174625)). `CodeQL Advanced` terminó en `success`. **Límite de 15 minutos: cumple, con mucho margen.**

**Versión entregada (`main`, tag `v1.0-testing`).**

| Repo | Commit de `main` | Cómo llegó | CI | Tag |
|---|---|---|---|---|
| Backend | `6333ecb` (árbol idéntico a `develop` @ `031d3a0`) | PR [#602](https://github.com/hllous/Backend-M6-DAPS2/pull/602) (`develop → test`) y [#603](https://github.com/hllous/Backend-M6-DAPS2/pull/603) (`test → main`) | `CI` [42679401568](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/42679401568), `API tests` [42679401997](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/42679401997) y `CodeQL` [42679402043](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/42679402043): `success` | `v1.0-testing` (anotado) |
| Frontend | `c59e756` (árbol idéntico a su `develop`) | PR [#903](https://github.com/hllous/Frontend-M6-DAPS2/pull/903) y [#904](https://github.com/hllous/Frontend-M6-DAPS2/pull/904) | `CI` [42668828421](https://github.com/hllous/Frontend-M6-DAPS2/actions/runs/42668828421): `success` con 22 jobs, al cuarto intento | `v1.0-testing` (anotado) |

- **Qué cambió respecto de `142e1a3`:** solo documentación, README y `.env.example` (`git diff --stat 142e1a3 6333ecb -- src prisma test package.json docker-compose.yml Dockerfile .github` da vacío). Las cifras de este informe siguen siendo las de ese código.
- **Los intentos fallidos del CI del frontend en `main` no fueron del código:** el primero falló en `unit shard 4/4` por timeouts de 5 s (el shard tardó 1084 s contra ~2 min en un run verde) y los siguientes quedaron con jobs `abandoned` durante una caída parcial de GitHub Actions. El mismo árbol había pasado el CI completo en `develop`, en `test` y en el PR #904. No medimos la causa del runner lento.
- **Render:** `/health/ready` responde 200 con `database: up` y `broker: connected`, y un `GET /services` sin token responde 401 como `application/problem+json` con los headers `x-ratelimit-*` (límite 600): el despliegue sirve el código nuevo.
- **gitleaks sobre el historial del tag (local):** v8.30.1 con el [`.gitleaks.toml`](../../.gitleaks.toml) del repo, sobre un clon completo en `v1.0-testing`: **327 commits escaneados, 0 hallazgos**.

El job `e2e` **no es check obligatorio** de la protección de ramas (`.github/branch-protection-rules.json` exige solo `build` y `test`); ver DEF-14. Cambiarlo pide permisos de administrador: **no hecho**.

## 5. Calidad de los tests

**Tests saltados.** En los unitarios no hay ninguno; en los e2e solo `describe.skip` de `rabbitmq-real` cuando no hay `RABBITMQ_URL` local (`test/rabbitmq-real.e2e-spec.ts:24`; en el CI corre con la variable puesta). No hay `it.todo`, `xit`, `xdescribe`, `test.skip` ni `.only` en `src/` y `test/` (`grep`).

**Aserciones débiles.** `src/modules/services/services.service.spec.ts:875` verifica «se puede cancelar desde %s» solo con `resolves.toBeDefined()`: un `cancel()` que devolviera cualquier cosa pasaría. **No se corrigió.** Hay 25 usos de `toBeDefined()` o `toBeTruthy()` en los specs; solo revisamos el de la línea 875.

**Mutation score (Stryker, #577 y #617).** `stryker.config.json` muta los 26 `*.service.ts`, `*.transitions.ts` y `*.sweeper.ts` de `src/modules`, con umbral `break: 60`. **Línea base en CI: 71,22 % global** (cumple el criterio de 60 %). Se reforzaron 5 archivos y 4 llegaron a 100 %; el detalle, la clasificación de lo que queda y las reglas que protegen los tests nuevos están en 5.1. El workflow `mutation.yml` corre a mano o los lunes.

**Mocks.** No encontramos por muestreo tests que mockeen la clase bajo prueba. Los unitarios mockean Prisma, así que prueban llamadas más que comportamiento de base; el comportamiento real lo cubren los 343 e2e.

### 5.1 Mutation testing del dominio (#617)

**Esta medición es posterior a R09 y no se hizo sobre la misma base:** es del 10 y 11/11/2026, sobre la rama `tests/617-mutation-score` con `develop` @ `8daa52d` o posterior (Vitest, NestJS 12, Node 24). No reemplaza ni reescribe las cifras de R09 de las secciones 2 y 3. Cómo repetirla: [`docs/testing.md`](../testing.md), sección «Mutation testing».

**Alcance y línea base.** Stryker 9 con `@stryker-mutator/vitest-runner`, checker TypeScript y `coverageAnalysis: perTest`, sobre `src/modules/**/*.service.ts`, `*.transitions.ts` y `*.sweeper.ts`: 26 archivos. Corrida en GitHub Actions (Linux, run **42913181516**, `concurrency: 3`, `timeoutMS: 10000`), **2 h 26 min**, sin incremental previo. 5182 mutantes: 2044 Killed, 121 Timeout, **801 Survived**, **74 NoCoverage** y 2142 CompileError (no cuentan). **Score global = (2044 + 121) / (2044 + 121 + 801 + 74) = 71,22 %**; el umbral del issue y el `break` son 60 %. Un mutante *Survived* es un cambio que ningún test notó; *NoCoverage*, un cambio en una línea que ningún test ejecuta.

Score por archivo de la línea base, de menor a mayor («No detectados» = Survived + NoCoverage):

| Archivo (bajo `src/modules/`) | Score | Detectados | Survived | NoCoverage | Total |
|---|---:|---:|---:|---:|---:|
| `environmental-reports/report-deadline.sweeper.ts` | 40,0 % | 6 | 9 | 0 | 15 |
| `green-points/green-points.service.ts` | 52,6 % | 50 | 35 | 10 | 95 |
| `citizen-portal/citizen-portal.service.ts` | 55,0 % | 33 | 27 | 0 | 60 |
| `trees/trees.service.ts` | 60,7 % | 65 | 37 | 5 | 107 |
| `green-spaces/green-spaces.service.ts` | 62,3 % | 48 | 27 | 2 | 77 |
| `containers/containers.service.ts` | 64,6 % | 93 | 47 | 4 | 144 |
| `services/services.service.ts` | 65,8 % | 404 | 198 | 12 | 614 |
| `vehicles/vehicles.service.ts` | 67,6 % | 46 | 21 | 1 | 68 |
| `outbound-requests/outbound-requests.service.ts` | 68,5 % | 63 | 26 | 3 | 92 |
| `trees/interventions/tree-interventions.service.ts` | 68,9 % | 91 | 40 | 1 | 132 |
| `crews/crews.service.ts` | 71,3 % | 149 | 56 | 4 | 209 |
| `environmental-inspections/environmental-inspections.service.ts` | 71,5 % | 103 | 41 | 0 | 144 |
| `zones/zones.service.ts` | 71,6 % | 73 | 28 | 1 | 102 |
| `service-frequencies/service-frequencies.service.ts` | 72,2 % | 65 | 25 | 0 | 90 |
| `service-types/service-types.service.ts` | 72,2 % | 39 | 15 | 0 | 54 |
| `routes/routes.service.ts` | 74,7 % | 74 | 22 | 3 | 99 |
| `attachments/attachments.service.ts` | 75,0 % | 57 | 19 | 0 | 76 |
| `communes/communes.service.ts` | 75,0 % | 6 | 2 | 0 | 8 |
| `disposal-sites/disposal-sites.service.ts` | 77,6 % | 38 | 11 | 0 | 49 |
| `trees/surveys/tree-surveys.service.ts` | 78,4 % | 40 | 11 | 0 | 51 |
| `indicators/indicators.service.ts` | 80,6 % | 295 | 48 | 23 | 366 |
| `role-assignments/role-assignments.service.ts` | 81,2 % | 69 | 15 | 1 | 85 |
| `environmental-reports/environmental-reports.service.ts` | 81,7 % | 196 | 40 | 4 | 240 |
| `neighborhoods/neighborhoods.service.ts` | 83,3 % | 5 | 1 | 0 | 6 |
| `outbound-requests/street-closure-expiry.sweeper.ts` | 100,0 % | 43 | 0 | 0 | 43 |
| `outbound-requests/outbound-requests.transitions.ts` | 100,0 % | 14 | 0 | 0 | 14 |

**Qué se reforzó.** Los cinco archivos con peor score o más sobrevivientes (333 de los 875 no detectados; `services.service.ts` solo, 210). Cada uno se re-midió solo, en local (Windows, Node 24, Vitest, `concurrency: 5`, 44 min 44 s en total, sin incremental). **No es el score del CI:** Linux puede dar *Timeout* donde la máquina local da *Killed*; las cifras de abajo son comparables entre sí, no contra el 71,22 %. El global se confirma con una corrida en el CI tras el merge (pendiente).

| Archivo | Antes (CI) | Después (local) | No detectados antes → después |
|---|---:|---:|---:|
| `environmental-reports/report-deadline.sweeper.ts` | 40,0 % | **100 %** (15 killed) | 9 → 0 |
| `green-points/green-points.service.ts` | 52,6 % | **94,74 %** (90 killed, 5 survived) | 45 → 5 |
| `citizen-portal/citizen-portal.service.ts` | 55,0 % | **100 %** (60 killed) | 27 → 0 |
| `trees/trees.service.ts` | 60,7 % | **95,33 %** (102 killed, 5 survived) | 42 → 5 |
| `services/services.service.ts` | 65,8 % | **74,27 %** (452 killed, 4 timeout, 154 survived, 4 nocoverage) | 210 → 158 |

Los cinco juntos: **81,14 %** (723 de 891). Los cuatro archivos chicos se re-midieron después de recortar sus specs (14 min 7 s): los 10 sobrevivientes de `green-points` y `trees` son 6 textos de log de alta, cambio y baja y 4 `select: { id: true }` de la verificación de existencia, las dos categorías aceptadas de la tabla de abajo; antes del recorte los mataban tests que solo afirmaban esos textos. Los 154 sobrevivientes de `services.service.ts` son, por mutador: `StringLiteral` 66, `ConditionalExpression` 40, `ObjectLiteral` 20, `LogicalOperator` 8, `EqualityOperator` 6, `BlockStatement` 5, `BooleanLiteral` 5, `ArrayDeclaration` 4 y 1 de `ArithmeticOperator`, `ArrowFunction`, `MethodExpression` y `CallExpression`.

**Verificación de validez.** Cada mutante muerto lo mata un test del spec de su propio archivo, nunca uno ajeno. Tests distintos que matan: `green-points` 20, `citizen-portal` 20, `services` 142, sweeper 5, `trees` 19; ningún test mata más de 26 mutantes, así que no hay un test «comodín» que explique el score.

**Qué no se cubrió, y por qué.** Los otros 21 archivos (542 de los 875 no detectados) no se trabajaron: el criterio numérico ya se cumplía y el issue pide cubrir «los relevantes» y justificar el resto. La clasificación se hizo por mutador y línea (script sobre `mutation.json`), no mutante por mutante; las cantidades son aproximadas y son de la línea base completa (875).

| Categoría | Cant. | Ejemplo | Veredicto |
|---|---:|---|---|
| **Texto de log** (`StringLiteral` en `this.logger.*`) | ~70 | `containers.service.ts:96` «Contenedor registrado: …» | **Justificado.** No hay contrato de log. En los cinco archivos trabajados se cubrió solo donde el log lleva un dato útil para operar |
| **Texto de mensaje de error sin contrato** | ~210 | `attachments.service.ts:49` «Falta el archivo (campo "file")» | **Parcialmente justificado.** El código HTTP es contrato y está cubierto; el texto lo lee una persona. Se cubrió donde el frontend o un criterio Gherkin lo citan |
| **Mutantes equivalentes o casi** | ~25 | `containers.service.ts:413` y `tree-interventions.service.ts:352` (`CONTAINER_TRANSITIONS[x] ?? []`, tabla con todas las claves); `indicators.service.ts:159,535` (`+= 1` ↔ `-= 1` sobre un contador no observable) | **Justificado.** No hay comportamiento observable que cambie. Entra la rama inalcanzable de `resolveContainerOutcome` (`services.service.ts` ~914-918): se probó una vez parcheando `CONTAINER_TRANSITIONS`, el test se borró y el mutante queda **aceptado** |
| **`select: { id: true }` → `false` y similares** | ~31 | `crews.service.ts:400`, `disposal-sites.service.ts:117` | **Justificado con reparo.** Con Prisma mockeado la selección no cambia el resultado; el e2e contra Postgres real la cubre indirectamente |
| **Patrón PATCH parcial** (`dto.x !== undefined && {…}`) | ~35 | `containers.service.ts:203-208` | **Pendiente, no justificado.** Mismo hueco que se cerró en `green-points`, `trees` y `services`; la receta (`toStrictEqual` sobre un PATCH vacío, que no debe mandar ninguna clave, y sobre uno parcial con valores falsy válidos) aplica tal cual |
| **`assertTransition` sin test que lo detecte** | 3 | `environmental-inspections.service.ts:72,144,230` | **Pendiente, real.** Borrar la llamada no rompe ningún test: la máquina de estados del expediente queda sin protección en esos tres pasos |
| **Orden y paginación** (`orderBy`, `skip`, `take`) | ~60 | `attachments.service.ts:150`, `communes.service.ts:20` | **Pendiente, bajo riesgo.** Se cerró en los cinco archivos trabajados |

**Los tests nuevos de `services.service.ts`, regla por regla.** El spec `services-rules-mutation.spec.ts` (50 tests) más las tablas `it.each` sumadas a `services.service.spec.ts` y `services-container-close.spec.ts`. Cada regla se explica en una frase y es la que queda sin red si se borra el test:

1. Un rango de fechas de un solo día (desde == hasta) es válido.
2. Volumen y peso salen como número, o `null` si no se midió (nunca un Decimal como texto).
3. No se programa contra un tipo o recorrido inexistente (404) o dado de baja (400); el error nombra cuál.
4. Un servicio es de recorrido o puntual: `ROUTE` descarta el objetivo puntual, `POINT` deja `routeId` en `null`; se guarda quién lo programó.
5. Una franja exige inicio estrictamente anterior al fin, también al editar una sola punta y al confirmar una reprogramación.
6. Solo un ETag concreto convierte el conflicto de versión en 412; sin `If-Match` o con `*` no hay control optimista (ADR-012).
7. Solo el «registro no encontrado» (P2025) se traduce en 409/412; cualquier otro error de base sale tal cual.
8. Un servicio en curso no cambia de cuadrilla (409).
9. Asignar cuadrilla sin mandar vehículo no borra el vehículo que ya tenía.
10. El conflicto de recursos le da al operador recurso, nombre (patente, o id), servicio, estado, tipo, día y franja.
11. Para el encaje cuenta la reubicación de zona vigente el día del servicio, no la de hoy.
12. Toda operación (CREATE, UPDATE, ASSIGN_CREW, START, SUSPEND, RESUME, CANCEL, RESCHEDULE, CONFIRM_RESCHEDULE, COMPLETE) deja auditoría con acción y estados, en la misma transacción.
13. Cada aviso al reclamo de M2 (create/start STARTED, cancel REJECTED con motivo, complete RESOLVED, confirmReschedule STARTED, demora PROGRESS) se encola en el outbox dentro de la transacción, con el tipo correcto.
14. No se reprograma a una fecha anterior a hoy en Argentina; hoy vale, también a las 02:00 UTC.
15. Confirmar la reprogramación no pisa la punta de la franja que no se mandó.
16. Al reubicar un contenedor sin coordenadas nuevas se borran las viejas.
17. La fecha propuesta de vuelta a una zona es un día, sin hora.
18. La recolección en el sitio de disposición se puede registrar con el servicio `COMPLETED` o `PARTIALLY_COMPLETED`.
19. Quien no es de la cuadrilla recibe 403 antes de cualquier regla de estado.

Lo más valioso del spec es el montaje `tx = Object.create(prisma)` con `enqueuedInTx`, que distingue el cliente de la transacción: ningún otro spec detecta un outbox o una auditoría escritos fuera de la transacción (reglas 12 y 13).

**Tests generados con IA: se recortaron.** El primer `services-rules-mutation.spec.ts` salió con 2345 líneas y 139 tests. La revisión (`m6-revisor`) clasificó cada uno: el 80 % repetía otros 7 specs de la carpeta o afirmaba textos de log y formas de `select`. Quedó en **753 líneas y 50 tests** (las 19 reglas). Lo recortado se fusionó en `it.each` de `services-container-close.spec.ts` y `services.service.spec.ts`; de este último además se borraron dos tests no deterministas con `Date.now() - 3 h`; la regla 14 los reemplaza con una fecha fija y fake timers. Con el mismo criterio se recortaron los specs agregados a los otros cuatro archivos (de 112 a 79 tests): se fusionaron los «el 404/409 nombra X» en el test del mismo caso, se borraron los que solo afirmaban textos de log y los `it.each` de «PATCH con solo un campo» (los reemplaza `toStrictEqual` sobre un PATCH vacío), y quedó una sola factory por entidad. Lo que protegen, por archivo:

- **`report-deadline.sweeper`** (5): cierra solo los `NOTICE_ISSUED` vencidos a la hora actual; barre al arrancar; si la base falla al arrancar no tumba la aplicación y deja la causa en el log; informa cuántos cerró y no loguea si no hubo ninguno (en un cron el log es el único efecto observable).
- **`citizen-portal`** (23): la vista pública es una lista blanca (campos de respuesta y `select` de Prisma exactos: nunca denunciante, inspector, hallazgos, cuadrilla, vehículo ni notas); los 11 estados internos del expediente colapsan en 7 etapas y los 7 del servicio en 4, cada etapa con frase propia; el calendario mira 30 días desde «hoy» en Argentina, trunca las fechas al día y excluye cancelados; un reclamo sin expediente da 404 sin revelar si existe en M2.
- **`green-points`** (24) y **`trees`** (27): defaults al crear (`null` y activo) y respeto de los valores dados; 409 y 404 que nombran el código o la zona; solo los errores conocidos de Prisma se traducen a HTTP, el resto se propaga; un PATCH manda solo los campos presentes, incluidos los falsy válidos (`active=false`, `lat=0`, una medida de 0 cm), y uno vacío no manda ninguna clave; la baja es lógica y sobre un id inexistente da 404 sin escribir; los Decimal salen como número o `null`. En `trees`, además, el filtro por riesgo usa el último relevamiento y el relevamiento publicado es un resumen sin inspector ni notas.

**Hallazgos al medir.**

- **Test intermitente, corregido (P-3 de [`06`](06-registro-defectos.md)).** `src/openapi-contract.spec.ts`, «todo campo con @Min/@Max… declara minimum/maximum», importa todos los DTO (~2,3 s solo) y superaba el timeout por defecto de Vitest (5 s) con la suite en paralelo y la máquina cargada: era el «1 fallo en 6 corridas tras `npm ci`». Se le dio un timeout propio de 30 s. No es DEF-24 (ese es un e2e por `e2e_no_active`).
- **Vitest no chequea tipos.** Los specs generados tenían 2 errores de tipo (`it.each` con una columna de descripción no declarada) que ni Vitest ni `nest build` (excluye los specs) ven; los detectó el checker TypeScript de Stryker y el job «Typecheck specs» del CI los habría frenado. Se tiparon las tablas (`it.each<[A, string]>`).
- **Windows.** El `vitest.related` por defecto del runner no encontró los tests relacionados («No tests were executed»); la remedición local se hizo con `vitest.related: false` en una config aparte, fuera del repo. El CI de Linux no lo necesita.
- **Observación de producto, no es defecto confirmado.** `start()` acepta un servicio `SUSPENDED` (`VALID_TRANSITIONS.SUSPENDED` incluye `IN_PROGRESS`) sin limpiar `statusReason` ni `statusNote` como hace `resume`. Ningún test lo fija; decisión de producto.

## 6. Contrato y API

| Qué | Estado |
|---|---|
| `docs/api/openapi.json` | 103 rutas, 152 operaciones, 29 tags. `openapi:generate` no deja diff; el CI regenera el archivo y falla si queda desactualizado |
| `src/openapi-contract.spec.ts` | 7 tests: toda operación 200/201 declara el schema de su respuesta; toda respuesta de error se declara como `application/problem+json` (ADR-011); todo `GET` autenticado declara el 403; todo `GET` con parámetros declara el 400 (DEF-20); `openapi.json` al día; ninguna propiedad como `type: object` sin forma; todo campo con `@Min`, `@Max`, `@IsLatitude` o `@IsLongitude` declara `minimum` y `maximum` |
| Eventos publicados | 6 `.schema.json` más `_shared.schema.json` en `docs/eventos/publicados/`, validados con `ajv` en `src/events/payloads.spec.ts` |
| Colección Newman (#583) | **Realizada:** 455 requests ejecutados, 763 assertions, 0 fallidas; corre en el CI (`api-tests.yml`) |
| Schemathesis (#583) | **Realizado, solo `GET`.** Paso 1: 4388 casos pasan. Paso 2 (`status_code_conformance`, bloqueante desde #593): exit 0, 4384 casos, 3913 pasan, 471 salteados. `/neighborhoods` ya no se excluye (#594) |
| Endpoints con caso de éxito y de error | **Parcial:** éxito en **61 de 152**; error en las 152; los 91 restantes en `test/api/PENDIENTES.md` |
| Transición inválida → 409 | **Hecho** para servicios, reparaciones y cortes, e intervenciones de arbolado (114 tests, #582); contenedores y expedientes tenían `it.each` |
| Problem Details (#590, DEF-10) | **Realizado**, también para JSON mal formado y cuerpo grande. `http-exception.filter.spec.ts` y `test/problem-details.e2e-spec.ts` (9 casos). Sin id de correlación en los 500; `type` siempre `about:blank` |
| ETag e `If-Match` (#591, DEF-05) | **Realizado en el alcance de ADR-012:** transiciones de contenedores, servicios, intervenciones y expedientes, y `PATCH /containers/:id` y `PATCH /services/:id`. `test/etag-if-match.e2e-spec.ts` (12 casos, `[200, 412]` con concurrencia real). No cubre el resto de las acciones |
| `Idempotency-Key` (#592, DEF-06) | **Realizado en 21 `POST` de creación**, opcional. `test/idempotency.e2e-spec.ts` (8 casos). El guardado de la respuesta no es atómico con la transacción de dominio (ADR-013) |

## 7. Criterios de salida: cumple, parcial o no hecho

| Criterio | Umbral | Resultado | Cumple |
|---|---|---|---|
| Cobertura de líneas en dominio | ≥ 80 % | 99,16 % global; mínimo en `src/modules/*`: 95,77 % | **Sí** |
| Cobertura de ramas en dominio | ≥ 70 % | 93,63 % global; mínimo en `src/modules/*`: 82,92 % | **Sí** |
| Mutation score en dominio | ≥ 60 % | 71,22 % global en los 26 archivos de dominio (línea base en CI, #617; ver 5.1) | **Sí** |
| Tests flaky | 0 (3 corridas idénticas) | 3 corridas idénticas en local (R08) y repetidas en el CI (ver 2.1) | **Sí** |
| Pipeline | ≤ 15 min | 1 min 44 s; `API tests` 2 min 27 s | **Sí** |
| Escenarios críticos E2E en el pipeline | ≥ 5 | El job `e2e` corre las suites de `test/` (23 más `rabbitmq-real`); los E2E de navegador viven en el repo del frontend | **Sí** |
| Defectos abiertos | 0 Bloqueantes, 0 Críticos, ≤ 3 Mayores | 0, 0 y **1 Mayor** (DEF-13); [`06`](06-registro-defectos.md). Actualizado con #643 (antes 2 Mayores: DEF-09 cerrado) | **Sí** |
| Casos negativos o de borde | ≥ 40 % | 67,5 % (251 de 372, [`04`](04-especificacion-casos.md)) | **Sí** |
| Quality Gate (SonarCloud) | Gate en verde | **NO HECHO**: no hay cuenta ni `sonar-project.properties`; pide un administrador de `hllous` | **No** |
| Carga: 50 usuarios, 5 min, p95 < 500 ms, error < 1 % | p95 < 500 ms, error < 1 % | p(95) 32,84 ms y 0,00 % en 14 850 requests (local); también corrida contra el despliegue y con escrituras (ver 2.2) | **Sí** |
| Criterios de aceptación pasados / HU ejecutadas | ≥ 95 % y ninguno Must fallado | [`03`](03-matriz-trazabilidad.md): 161 criterios con test del backend sin fallos (actualizado con #643: CA-HU31-10); 9 solo FE y 5 huecos sin ejecutar | **Parcial** |

## 8. Lo que no se realizó

| Criterio | Estado | Motivo |
|---|---|---|
| Quality Gate (SonarCloud) y su captura | **NO HECHO** | Pide administrador del repositorio; no hay configuración |
| OWASP ZAP | **NO HECHO** | No se corrió |
| Trivy | **NO HECHO** | No se corrió |
| Mutation score: reforzar los 21 archivos restantes y confirmar el global en el CI | **Parcial** | Línea base del dominio completo medida y 5 archivos reforzados (5.1); el score global tras el refuerzo se confirma con una corrida en el CI luego del merge |
| Éxito por endpoint en los 91 endpoints restantes | **NO HECHO** | `test/api/PENDIENTES.md` |
| Integración con broker real (Testcontainers) | **Parcial** | Postgres y RabbitMQ reales como contenedores de servicio del CI y en local. El consumer y la publicación del outbox (también con el broker inalcanzable y su reenvío) se prueban contra RabbitMQ real (#618) |
| `--detectOpenHandles` | **NO HECHO** | No se corrió |

## 9. Plan de acciones

| # | Acción | Estado |
|---|---|---|
| 1 | Test de la matriz de transiciones con 409 en los inválidos | **Hecho** (#582, 114 tests) |
| 2 | Script k6 con 50 usuarios, 5 minutos y 3 `GET` críticos | **Hecho** (#585, #574): local, despliegue y escrituras |
| 3 | Schemathesis contra `openapi.json` en el CI | **Hecho** (#583), solo `GET`; bloqueante desde #593 |
| 4 | SonarCloud y Quality Gate | **NO HECHO** (pide admin) |
| 5 | Stryker sobre el dominio completo | **Hecho** (#577, #617): línea base 71,22 %; quedan 21 archivos sin reforzar |
| 6 | Correr la suite 3 veces seguidas | **Hecho** en local y en el CI; falta `--detectOpenHandles` |
| 7 | Reemplazar las aserciones débiles (`services.service.spec.ts:875` y el resto) | **Sin hacer** |
| 8 | Hacer obligatorio el job `e2e` en la protección de ramas | **NO HECHO** (pide admin; DEF-14) |
| 9 | Newman en el CI | **Hecho** (#583) |
| 10 | `npm audit`, Dependabot, gitleaks y CodeQL en el CI | **Hecho** (#578, #564, #494); ZAP y Trivy **NO HECHOS** |
| 11 | Tag `v1.0-testing` en `main` y en el frontend | **Hecho**: ver «Versión entregada» |
| 12 | 400 declarado en los `GET` con entrada y Schemathesis bloqueante (DEF-20) | **Hecho** (#593, PR #597) |
| 13 | Catálogo de barrios local para el compose y el CI (DEF-21) | **Hecho** (#594, PR #597) |
| 14 | Errores en Problem Details RFC 9457 (DEF-10) | **Hecho** (#590, PR #597); falta el id de correlación y que el frontend adapte su parser (Frontend #898) |
| 15 | `ETag` e `If-Match` con 412 (DEF-05) | **Hecho** en el alcance de ADR-012 (#591, PR #597) |
| 16 | `Idempotency-Key` en los `POST` de creación (DEF-06) | **Hecho** en 21 `POST`, con la limitación de ADR-013 (#592, PR #597) |
| 17 | Frontend dentro del compose | **Hecho** (#560) |

Lo que no se haga se declara «no realizado» y no se presenta con números sin evidencia.
