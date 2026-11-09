# 05 · Informe de ejecución

> Backend del Módulo 6 (Grupo 04). Corte del **09/11/2026**, sobre `develop` @ `142e1a3` (merge de [#597](https://github.com/hllous/Backend-M6-DAPS2/pull/597)). Los números de este informe salen de corridas reales (locales y de GitHub Actions); lo que no se midió figura como **no realizado** o **dato no disponible**, con el motivo. Los datos del 03/11, 06/11 y 08/11 se conservan rotulados como históricos.
>
> **Corrida R09 (09/11/2026).** Local, Windows, Node 22, máquina sin otras cargas, sobre la rama de integración de #597, que tiene el mismo contenido que `develop` @ `142e1a3` tras el squash. Log de cobertura en el scratchpad de la sesión de medición (`int/cov.log`); **no está versionado**. Se midieron: build, lint, `docs:check`, `openapi:generate`, unitarios con cobertura (1 vez), e2e general contra Postgres 16 real (2 corridas seguidas), Newman, Schemathesis, k6 y `docker compose up` en frío. **Corrida R08 (08/11)** sobre `1d600d2`: queda como histórica.

## 1. Cómo se obtuvieron los números

| Qué | Cómo | Cuándo | Dónde |
|---|---|---|---|
| Build, lint, docs, OpenAPI | `npm run build`, `npm run lint:check`, `npm run docs:check`, `npm run openapi:generate` + `git diff docs/api` | 09/11/2026, local | R09. Build OK; lint **0 errores y 305 warnings**; `docs:check` OK (107 archivos, 814 enlaces, 103 rutas, 152 operaciones, 29 tags, 44 modelos, 22 módulos, 37 variables); `openapi:generate` sin diff |
| Unitarios con cobertura | `npm run test:cov` (Prisma mockeado, no toca ninguna base) | 09/11/2026, local, **1 corrida** | R09 |
| e2e general | `npm run test:e2e` contra Postgres 16 real, base descartable (`docs/testing.md`) | 09/11/2026, local, **2 corridas seguidas** | R09 |
| Newman | Colección `test/api/` contra el backend local | 09/11/2026, local | R09. 455 requests ejecutados (435 definidos), 763 assertions, 0 fallas |
| Schemathesis 4.33.1 | Solo `GET`, `--max-examples 15`, dos pasos (esquema y errores de servidor; `status_code_conformance`) | 09/11/2026, local | R09 |
| Carga (k6) | `test/perf/k6-criticos.js`, 50 usuarios, 5 min | 09/11/2026, local | `test/perf/resultados/2026-11-09/` y `test/perf/README.md` |
| Compose en frío | `docker compose up -d --build` con volúmenes nuevos (imágenes en caché) | 09/11/2026, local | R09 |
| CI de `develop` | Run de `CI` del commit `142e1a3` | 09/11/2026, 14:11 UTC | [42632174201](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/42632174201) |
| Newman y Schemathesis en el CI | Workflow `API tests` (`.github/workflows/api-tests.yml`), job `api (newman + schemathesis)` | 09/11/2026 | [42632174625](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/42632174625) (push a `develop`) y [42631657018](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/42631657018) (PR) |
| Mutation | Stryker (`npm run test:mutation`), medición completa local de 14 min 26 s | 08/11/2026, local; **no se re-midió el 09/11** | Módulo `outbound-requests` |
| e2e con RabbitMQ real | `rabbitmq-real` en el job `e2e` del CI | CI del 09/11 | **No se corrió en local el 09/11** (sin `RABBITMQ_URL`, la suite se saltea); última corrida local: R08 (08/11), 3 corridas idénticas |
| Históricos | Corrida original del 03/11 sobre `f288d31`, re-medición del 06/11 y R08 del 08/11 sobre `1d600d2` | 03/11, 06/11 y 08/11 | Tablas rotuladas |

Los **e2e se corrieron en local** contra una base descartable. La salida de los logs no incluye números por caso, solo los totales de Jest.

## 2. Totales por nivel

Estado al 09/11 (R09 salvo que se diga otra cosa). «Saltados» son tests que Jest no ejecutó; «no realizado» es un nivel sin ninguna corrida.

| Nivel | Suites | Ejecutados | Pasados | Fallados | Bloqueados | Saltados | Tiempo |
|---|---|---|---|---|---|---|---|
| Unitario | 124 (123 pasan, 1 salteada) | 2808 | 2808 | 0 | 0 | 12 (2820 en total) | 117,7 s con cobertura (1 corrida) |
| Integración / e2e con Postgres 16 real (suma 31 tests de #597: problem-details, etag-if-match, idempotency y neighborhoods-catalog) | 24 (23 pasan, 1 salteada) | 343 | 343 | 0 | 0 | 4 | 94 s y 100 s (2 corridas idénticas) |
| Integración con RabbitMQ real (`rabbitmq-real`) | 1 | — | — | — | — | los 4 tests se saltearon en R09 (sin broker local) | Última corrida local: R08 (4 de 4). En el CI corre en el job `e2e` |
| Contrato y API: colección Newman (`test/api/`) | — | 455 requests (435 definidos) | 763 assertions | 0 | 0 | — | Corre también en el CI (job `api (newman + schemathesis)`: 2 min 27 s en el push a `develop`, que incluye Schemathesis); tiempo de Newman solo: dato no disponible |
| Contrato REST contra OpenAPI: Schemathesis (solo `GET`) — esquema y sin 5xx | — | 4388 casos | 4388 | 0 | 0 | — | Dato no disponible por paso |
| Contrato REST contra OpenAPI: Schemathesis — `status_code_conformance` (**ahora bloqueante**) | — | 4384 casos | 3913 | 0 (exit 0) | 0 | 471 | Dato no disponible por paso |
| Mutation testing (Stryker) | — | Módulo `outbound-requests` solamente | 84,21 % total | — | — | — | 14 min 26 s (medición local del 08/11, **sin re-medir**) |
| Carga (k6) | — | 14 850 requests | p(95) 32,84 ms; 0,00 % de error | 0 | — | — | 5 min. **Hecho en local, no en el despliegue**; ver la sección 2.2 |
| Seguridad dinámica (ZAP) | — | — | — | — | — | — | **No realizado** |
| Seguridad estática: Trivy | — | — | — | — | — | — | **No realizado** |
| Compose en frío | — | 1 | 1 | 0 | 0 | — | up en 46 s; `/health/ready` 200 a los 55 s; seed OK; `GET /neighborhoods` 200 dentro del compose |

Históricos (se conservan para ver la evolución):

| Nivel | Suites | Ejecutados | Pasados | Fallados | Saltados | Tiempo |
|---|---|---|---|---|---|---|
| Unitario, local, R08 (08/11) | 121 (120 pasan, 1 salteada) | 2746 | 2746 | 0 | 12 | 106 s con cobertura |
| e2e con Postgres 16, local, R08 (08/11) | 19 | 312 | 312 | 0 | 0 | 79 s, 72 s y 60 s (3 corridas idénticas) |
| `rabbitmq-real`, local, R08 (08/11) | 1 | 4 | 4 | 0 | 0 | 12 s, 6 s y 6 s |
| Newman y Schemathesis, 08/11 | — | 454 requests y 4346 casos | 760 assertions | 0 | — | `status_code_conformance` informativo, fallaba en al menos 40 `GET` (DEF-20) |
| Unitario, local, 06/11 | 115 | 2650 | 2650 | 0 | 0 | 100,2 s |
| Unitario, local, 03/11 | 112 | 2533 | 2533 | 0 | 0 | 897,9 s (máquina ocupada) |
| Unitario, CI de `main`, 03/11 | 112 | 2469 | 2469 | 0 | 12 (1 suite entera) | 43,6 s |
| e2e con Postgres 16, CI de `main`, 03/11 | 16 | 291 | 291 | 0 | 0 | 12,1 s |

Notas:

- **Los 12 tests saltados** son los mismos del 03/11: dependen del paquete de contratos de M2, que no se versiona (`docs/documentacion/` está en `.gitignore`). En esta máquina el paquete tampoco estaba (el log de cobertura lo avisa con un `console.warn`). Ver la sección 5 y DEF-11.
- **Los 4 saltados del e2e** son, por deducción, los de `rabbitmq-real`, que se saltea sin `RABBITMQ_URL`; no se abrió el log por archivo para confirmarlo.
- **Cuántos tests nuevos entraron desde el 08/11:** de 2746 a 2808 unitarios (+62) y de 312 a 343 e2e (+31: 9 de `problem-details`, 12 de `etag-if-match`, 8 de `idempotency` y 2 de `neighborhoods-catalog`). Los specs unitarios nuevos son `src/common/etag.spec.ts`, `src/modules/services/services-if-match.spec.ts` y `src/common/idempotency/idempotency.interceptor.spec.ts`, más casos en `http-exception.filter.spec.ts`, `openapi-contract.spec.ts`, `configuration.spec.ts` y los specs de contenedores, expedientes ambientales e intervenciones de arbolado. No se contó test por test el resto de la diferencia.
- **Bloqueados: 0** en todos los niveles. Lo que depende de otros módulos (M1, M9, M7, M2) se probó en el historial de integración, no con un caso automatizado bloqueado.
- **Los e2e** cubren: ciclo de servicios, pertenencia de Campo, inbox e idempotencia, outbox con reintento, flujo ambiental, cortes de calle, cierre de contenedores con rollback, roles por endpoint, auditoría, autorización de extracciones, solicitud de información, personas de demo, migración de cuadrillas, el guard de la base, el límite de tasa (429), la seguridad de entrada (SQL, XSS, mass assignment, 413, CSP) y, desde el 09/11, errores en Problem Details, ETag e `If-Match` (412, con concurrencia real), `Idempotency-Key` y el catálogo local de barrios. Detalle en `docs/testing.md`.
- **Newman y Schemathesis** tienen caso de éxito en 61 de las 152 operaciones (`GET /neighborhoods` entró); los 91 restantes están en `test/api/PENDIENTES.md`. Schemathesis recorre solo los `GET`. Los 471 casos salteados de `status_code_conformance` son avisos esperables: 404 por datos de prueba y 429 en las 3 operaciones del portal público que conservan su límite local.

### 2.1 Flaky

| Suite | Corrida 1 | Corrida 2 | Corrida 3 | Resultado |
|---|---|---|---|---|
| e2e general, 09/11 (24 suites) | 343 pasan, 4 saltados (94 s) | 343 pasan, 4 saltados (100 s) | no se hizo | **Idéntico en 2 corridas** |
| Unitarios, 09/11 | 2808 pasan, 12 saltados (117,7 s, con cobertura) | no se repitió | no se repitió | Sin repetición |
| Unitarios, e2e y `rabbitmq-real`, 08/11 (histórico, `1d600d2`) | 2746 / 312 / 4 | 2746 / 312 / 4 | 2746 / 312 / 4 | **Idéntico en 3 corridas** |

El criterio «0 tests inestables, suite corrida 3 veces con el mismo resultado» **se cumplió el 08/11 en local** sobre `1d600d2`; el 09/11, sobre `142e1a3` (con 31 e2e nuevos), se repitió solo el e2e y **2 veces**, no 3. Observación honesta: **una corrida completa del e2e cayó una vez por un timeout de 30 s (`testTimeout`) en el arranque de una suite, con la máquina cargada con otras pruebas**; con la máquina libre las dos corridas dieron idéntico. Es un síntoma de sensibilidad a la carga de la máquina, no se investigó la causa y no se guardó su log. Otros límites: (a) es una medición local, no una repetición en el CI; (b) corridas iguales no prueban que no haya un defecto intermitente: DEF-24 ([#554](https://github.com/hllous/Backend-M6-DAPS2/issues/554), e2e intermitente por `e2e_no_active`) está cerrado por decisión del equipo el 09/11/2026 (el issue [#554](https://github.com/hllous/Backend-M6-DAPS2/issues/554) ya figuraba cerrado desde el 08/11 18:59 UTC sin PR ni comentario): la causa raíz no está confirmada, el código del test no cambió y no se reprodujo, así que si vuelve a aparecer se reabre; (c) el aviso de Jest «A worker process has failed to exit gracefully» del 03/11 no apareció el 08/11, pero no se corrió `--detectOpenHandles`: dato no disponible. El workflow `CI` en `develop` terminó en `success` en las 3 últimas corridas (`gh run list --workflow ci.yml --branch develop`, 09/11).

### 2.2 Carga (k6)

Hecha el 09/11/2026 con `test/perf/k6-criticos.js`: 50 usuarios concurrentes, 5 minutos, `GET /services`, `/containers` y `/zones` autenticados, `pageSize=20`, 1 s de pausa por usuario. Evidencia: `test/perf/resultados/2026-11-09/k6-completa.txt` y `k6-summary-completa.json`; la tabla está en `test/perf/README.md`.

| Métrica | Resultado | Umbral de la cátedra | Cumple |
|---|---|---|---|
| `http_req_duration` p(95) | **32,84 ms** | < 500 ms | **Sí** |
| `http_req_failed` | **0,00 %** (0 de 14 850) | < 1 % | **Sí** |
| Requests | 14 850 (49,1 por segundo) | — | — |
| Promedio / mediana / p(90) / máximo | 14,97 / 11,11 / 23,95 / 441,21 ms | — | — |
| Checks (200 en los tres `GET`) | 100 % | — | — |

**Límites (no se esconden).** (1) Se midió **en local**, con el backend, Postgres, RabbitMQ y k6 en la **misma máquina** de 6 CPUs; **no se midió el despliegue en Render y Supabase**, donde hay red de por medio y la latencia va a ser mayor. (2) Solo **lecturas**: no se midió ninguna escritura. (3) Se subió `THROTTLE_LIMIT` a 100000 para que el límite global (600 por minuto por IP y endpoint) no devolviera 429; en el despliegue ese límite sigue vigente. (4) Base del seed de demo (673 servicios, 500 contenedores, 48 zonas), no un volumen de producción. (5) Una sola corrida de 5 min. Por eso el criterio de carga se declara **cumplido en local, no verificado en el despliegue**.

## 3. Cobertura (unitarios, `npm run test:cov`)

**Global, R09 (09/11):** sentencias **98,58 %** · ramas **93,63 %** · funciones **98,07 %** · líneas **99,16 %** (124 suites, 2808 tests pasados). Sale de la fila `All files` del log (`% Stmts | % Branch | % Funcs | % Lines`). Bajaron unas centésimas respecto de R08: entró código nuevo (ETag, idempotencia, filtro de errores) con cobertura menor al promedio previo.

| Fecha | Sentencias | Ramas | Funciones | Líneas |
|---|---|---|---|---|
| 09/11 (R09) | 98,58 | 93,63 | 98,07 | 99,16 |
| 08/11 (R08) | 98,6 | 93,94 | 98,09 | 99,18 |
| 06/11 | 98,59 | 93,87 | 98,09 | 99,18 |
| 03/11 | 98,51 | 93,98 | 97,98 | 99,12 |

El umbral global del repo es 85 % en las cuatro métricas (`package.json`, `coverageThreshold`) y la corrida lo cumplió (el log termina con los umbrales sin error). Umbrales de la cátedra: líneas ≥ 80 %, ramas ≥ 70 % en la capa de negocio. **Cumple** (09/11): el valor más bajo de `src/modules/*` es 95,77 % de líneas y 82,92 % de ramas, ambos en `green-points`.

Cobertura por carpeta de la corrida **R09** (sentencias, ramas, funciones, líneas; en %):

| Carpeta | Sentencias | Ramas | Funciones | Líneas |
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
| `src/health` | 100 | 100 | 100 | 100 |
| `src/identity` | 100 | 100 | 100 | 100 |
| `src/modules/attachments` | 95,78 | 90,14 | 100 | 98,23 |
| `src/modules/attachments/storage` | 100 | 100 | 100 | 100 |
| `src/modules/citizen-portal` | 100 | 90,62 | 100 | 100 |
| `src/modules/containers` | 99,3 | 92,3 | 100 | 99,27 |
| `src/modules/crews` | 100 | 96,11 | 100 | 100 |
| `src/modules/environmental-inspections` | 100 | 97,26 | 100 | 100 |
| `src/modules/environmental-reports` | 99,48 | 91,8 | 100 | 100 |
| `src/modules/green-points` | 96 | 82,92 | 100 | 95,77 |
| `src/modules/green-spaces` | 98,57 | 93,33 | 100 | 98,48 |
| `src/modules/indicators` | 97,51 | 86,9 | 93,4 | 98,41 |
| `src/modules/outbound-requests` | 98,59 | 95,65 | 98 | 98,46 |
| `src/modules/role-assignments` | 100 | 95 | 100 | 100 |
| `src/modules/routes` | 100 | 88 | 100 | 100 |
| `src/modules/services` | 97,43 | 93,31 | 99 | 97,66 |
| `src/modules/trees` | 98,68 | 90,9 | 100 | 98,5 |
| `src/modules/trees/interventions` | 99,21 | 94,87 | 100 | 99,17 |
| `src/modules/trees/surveys` | 100 | 100 | 100 | 100 |
| `src/modules/vehicles` | 98,7 | 96 | 100 | 98,63 |
| `src/modules/zones` | 100 | 97,56 | 100 | 100 |
| `src/modules/communes`, `disposal-sites`, `neighborhoods`, `service-frequencies`, `service-types` | 100 | 100 | 100 | 100 |

**Qué excluye el cálculo** (`collectCoverageFrom`): los `*.module.ts`, los `dto/`, `index.ts`, `main.ts`, `configure-app.ts`, `config/`, `prisma/` y el helper `events/m2-contract.testing.ts`. Son código de cableado o de configuración, y `config/` tiene su propio spec (`configuration.spec.ts`) que corre aunque no cuente.

**Cobertura de los e2e:** dato no disponible (no se midió).

**Qué no mide la cobertura.** La cobertura de líneas dice qué se ejecutó, no qué se verificó. Por eso la cátedra pide mutation testing; ver la sección 7.

## 4. Tiempos del pipeline

**Estado de `develop` al 09/11.** Run de `CI` del commit `142e1a3` ([42632174201](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/42632174201)), `success` de punta a punta en **1 min 44 s** (creado 14:11:04, actualizado 14:12:48 UTC; `gh run view --json`):

| Job | Resultado | Duración |
|---|---|---|
| `build` | success | 54 s |
| `test` | success | 1 min 16 s |
| `e2e` (incluye el paso de RabbitMQ real) | success | 1 min 39 s |
| `secrets` (gitleaks sobre todo el historial) | success | 32 s |
| `audit` (`npm audit`, informativo) | success | 10 s |
| `deploy` | skipped (solo corre en push a `main`) | — |

El workflow `API tests` (Newman y Schemathesis, con `status_code_conformance` bloqueante) del mismo commit terminó en `success` en 2 min 27 s ([42632174625](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/42632174625)). El workflow `CodeQL Advanced` terminó en `success` (el contenido de sus alertas no se revisó). En el PR #597 pasaron `build`, `test`, `e2e`, `audit`, `secrets`, CodeQL y `api (newman + schemathesis)` (`gh pr checks 597`).

Las 3 corridas más recientes del workflow `CI` en `develop` (09/11 14:11, 09/11 12:52 y 08/11 19:01 UTC) terminaron en `success`. Del 08/11 (`1d600d2`, run 42508633321): 1 min 32 s.

**Estado de `main` al 09/11 (versión entregada).**

| Repo | Commit de `main` | Cómo llegó | CI | Tag |
|---|---|---|---|---|
| Backend | `6333ecb` (árbol idéntico a `develop` @ `031d3a0`) | PR [#602](https://github.com/hllous/Backend-M6-DAPS2/pull/602) (`develop → test`, 19:00 UTC) y [#603](https://github.com/hllous/Backend-M6-DAPS2/pull/603) (`test → main`, 19:01 UTC) | `CI` [42679401568](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/42679401568), `API tests` [42679401997](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/42679401997) y `CodeQL` [42679402043](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/42679402043): `success` | `v1.0-testing` (anotado) |
| Frontend | `c59e756` (árbol idéntico a su `develop`) | PR [#903](https://github.com/hllous/Frontend-M6-DAPS2/pull/903) y [#904](https://github.com/hllous/Frontend-M6-DAPS2/pull/904) | `CI` [42668828421](https://github.com/hllous/Frontend-M6-DAPS2/actions/runs/42668828421): `success` con 22 jobs, **al cuarto intento** | `v1.0-testing` (anotado) |

- **Qué cambió respecto de `142e1a3`:** solo documentación, README y `.env.example` (`git diff --stat 142e1a3 6333ecb -- src prisma test package.json docker-compose.yml Dockerfile .github` da vacío). Las cifras de este informe siguen siendo las de ese código.
- **Los intentos fallidos del CI del frontend en `main` no fueron del código.** El primero falló en `unit shard 4/4` por timeouts de 5 s (el shard tardó 1084 s contra ~2 min en el run verde del 06/11) y los siguientes quedaron con jobs `abandoned` mientras GitHub Actions informaba una caída parcial (`major`, githubstatus.com, 09/11 18:30 UTC). El mismo árbol había pasado el CI completo en `develop`, en `test` y en el PR #904. Es una observación; no se midió la causa del runner lento.
- **Render, 09/11 ~19:06 UTC:** `/health/ready` responde 200 con `database: up` y `broker: connected`, y un `GET /services` sin token responde 401 como `application/problem+json` con los headers `x-ratelimit-*` (límite 600): el despliegue sirve el código nuevo. **No se verificó** que la migración `20261109120000_idempotency_record` quedara aplicada (haría falta una escritura con `Idempotency-Key` contra esa base).
- **gitleaks sobre el historial del tag (09/11, local):** v8.30.1 (`zricethezav/gitleaks`), con el [`.gitleaks.toml`](../../.gitleaks.toml) del repo, sobre un clon completo en `v1.0-testing`: **327 commits escaneados, 0 hallazgos**. Un primer intento sobre un `git worktree` escaneó 0 commits (el `.git` quedaba fuera del contenedor) y se descartó.

**Límite de la cátedra: 15 minutos. Cumple, con mucho margen.** Datos del 03/11 (históricos): 1 min 45 s a 1 min 57 s por run; `main` 1 min 52 s con `deploy` incluido.

El job `e2e` **no es check obligatorio** de la protección de ramas (`.github/branch-protection-rules.json` exige solo `build` y `test`); ver DEF-14. Cambiarlo pide permisos de administrador sobre el repositorio: **no hecho**.

## 5. Calidad de los tests

**Tests anulados o saltados.** Las únicas anulaciones condicionales por el paquete de M2 (`PAQUETE_M2_PRESENTE`) son las mismas del 03/11; la única anulación nueva es `describe.skip` de `rabbitmq-real` cuando no hay `RABBITMQ_URL` local (en el CI corre en un paso aparte con la variable puesta):

| Punto | Archivo |
|---|---|
| `describe.skip` de toda la suite | `src/events/consumers/m2-ejemplos.spec.ts:33` |
| `it.skip` | `src/events/payloads.spec.ts:427` |
| `it.skip` | `src/modules/environmental-reports/environmental-reports.service.spec.ts:929` |
| `it.skip.each` (`ROUTED`, `IN_PROGRESS`) | `src/modules/services/services.service.spec.ts:1376` |
| `describe.skip` (sin broker local) | `test/rabbitmq-real.e2e-spec.ts:24` |

Son 4 puntos de M2, 12 tests saltados y 1 suite saltada. Están **justificados por escrito** en `docs/testing.md`, pero **el CI no avisa más que con un `console.warn`**: si el paquete falta, nadie se entera de que se dejó de validar el contrato de M2 (DEF-11). Recuento del 09/11 con `grep` de `it.skip`, `xit`, `xdescribe`, `describe.skip`, `test.skip`, `it.todo` y `.only(` en `src/` y `test/`: exactamente esos 5 puntos; **0** `it.todo`, `xit`, `xdescribe`, `test.skip` y `.only`.

**Aserciones débiles.** `src/modules/services/services.service.spec.ts:875` sigue verificando «se puede cancelar desde %s» solo con `resolves.toBeDefined()`: un `cancel()` que devolviera cualquier cosa pasaría. **No se corrigió** desde el 03/11. Hay 25 usos de `toBeDefined()` o `toBeTruthy()` en los specs (`grep` en `src/`, 09/11); solo se revisó el de la línea 875.

**Mutation score (Stryker, #577).** Configurado en `stryker.config.json` sobre dos archivos: `outbound-requests.transitions.ts` y `street-closure-expiry.sweeper.ts`, con umbral `break: 60`. Medición completa local del 08/11 (14 min 26 s): **84,21 % total**, **transiciones 100 %**; el sweeper terminó en **100 % tras sumar 2 aserciones** (re-medido solo el sweeper; **el total no se re-midió**). El workflow `mutation.yml` corre a mano o los lunes; no corre en cada PR. **Cumple el umbral de 60 % solo en este módulo.** Mutation score del dominio completo: **no realizado**. Que `outbound-requests` sea el único medido es una limitación, no una garantía para el resto.

**Tests que mockean la clase bajo prueba:** no se encontró ninguno por muestreo. No se revisaron los specs uno por uno.

**Los unitarios mockean Prisma**, así que prueban llamadas más que comportamiento de base; el comportamiento real contra Postgres lo cubren los 343 e2e (23 suites que corren).

## 6. Contrato y API

| Qué | Estado |
|---|---|
| `docs/api/openapi.json` | 103 rutas y 152 operaciones, 29 tags. `openapi:generate` no deja diff (09/11). El CI regenera el archivo y falla si queda desactualizado (`git diff --exit-code`) |
| `src/openapi-contract.spec.ts` | 7 tests: toda operación 200/201 declara el schema de su respuesta; **toda respuesta de error se declara como `application/problem+json` (ADR-011)**; todo `GET` autenticado declara el 403; **todo `GET` con parámetros declara el 400 (DEF-20)**; el `openapi.json` está al día con el código; ninguna propiedad queda como `type: object` sin forma; todo campo con `@Min`, `@Max`, `@IsLatitude` o `@IsLongitude` declara `minimum` y `maximum` |
| Eventos publicados | 6 `.schema.json` (uno por evento) más `_shared.schema.json` en `docs/eventos/publicados/`, validados con `ajv` en `src/events/payloads.spec.ts` |
| Colección Newman (#583) | **Realizada.** `test/api/m6.postman_collection.json`: 455 requests ejecutados (435 definidos; éxito y error), 763 assertions, 0 fallidas (R09, local). Corre en el CI (`api-tests.yml`) |
| Respuestas reales contra OpenAPI (Schemathesis, #583) | **Realizado, solo `GET`**, 4.33.1, `--max-examples 15`. Paso 1 (`response_schema_conformance` y `not_a_server_error`): 4388 casos, 4388 pasan. Paso 2 (`status_code_conformance`, **bloqueante desde #593**): exit 0, 4384 casos, 3913 pasan, 471 salteados (avisos esperables: 404 por datos de prueba y 429 en las 3 operaciones del portal público con límite propio). `/neighborhoods` ya no se excluye (#594). Las escrituras no se recorren |
| Todos los endpoints con un caso de éxito y uno de error | **Parcial**: caso de éxito en **61 de 152** operaciones; error en las 152. Los 91 restantes están listados en `test/api/PENDIENTES.md` |
| Entidad central, toda transición inválida → 409 | **Hecho para servicios, reparaciones y cortes, e intervenciones de arbolado** (114 tests, #582): los pares salen del complemento de las tablas `*_TRANSITIONS`. Contenedores y expedientes ya tenían `it.each` |
| Errores en Problem Details (#590, DEF-10) | **Realizado.** `application/problem+json` con los campos RFC 9457 y los históricos; también JSON mal formado y cuerpo grande. `http-exception.filter.spec.ts` y `test/problem-details.e2e-spec.ts` (9 casos). Limitación: sin id de correlación en los 500; `type` siempre `about:blank` |
| ETag e `If-Match` con 412 (#591, DEF-05) | **Realizado en el alcance acordado**: transiciones de contenedores, servicios, intervenciones de arbolado y expedientes ambientales, y `PATCH /containers/:id` y `PATCH /services/:id`. `src/common/etag.spec.ts`, `services-if-match.spec.ts` y `test/etag-if-match.e2e-spec.ts` (12 casos, con concurrencia real `[200, 412]`). **No cubre** el resto de las acciones ni los demás recursos (ADR-012) |
| `Idempotency-Key` (#592, DEF-06) | **Realizado en 21 `POST` de creación**, opcional. `idempotency.interceptor.spec.ts` y `test/idempotency.e2e-spec.ts` (8 casos). **Limitación conocida:** guardar la respuesta no es atómico con la transacción de dominio (ADR-013) |

## 7. Criterios de salida: cumple, parcial o no hecho

| Criterio de la cátedra | Umbral | Resultado | Cumple |
|---|---|---|---|
| Cobertura de líneas en dominio | ≥ 80 % | 99,16 % global; mínimo en `src/modules/*`: 95,77 % | **Sí** |
| Cobertura de ramas en dominio | ≥ 70 % | 93,63 % global; mínimo en `src/modules/*`: 82,92 % | **Sí** |
| Mutation score en dominio | ≥ 60 % | 84,21 % solo en `outbound-requests`; dominio completo sin medir | **Parcial** |
| Tests flaky | 0 (3 corridas idénticas) | 3 corridas idénticas el 08/11 en local (unitarios, e2e y RabbitMQ real, sobre `1d600d2`); el 09/11 el e2e dio idéntico en **2** corridas y una corrida completa bajo carga cayó por un timeout de 30 s en el arranque de una suite; falta repetirlo en el CI; DEF-24 cerrado por decisión del equipo, sin causa confirmada | **Parcial**: sí en local el 08/11, no repetido en 3 el 09/11 |
| Pipeline | ≤ 15 min | 1 min 44 s (CI de `develop`, run 42632174201); `API tests` 2 min 27 s | **Sí** |
| Escenarios críticos E2E en el pipeline | ≥ 5 | El job `e2e` del CI corre las suites de `test/` (23 sin RabbitMQ real y `rabbitmq-real` en un paso aparte); los E2E de navegador viven en el repo del frontend | **Sí**, a confirmar qué cuenta la cátedra como «escenario crítico» (el conteo como tal: dato no disponible) |
| Defectos abiertos | 0 Bloqueantes, 0 Críticos, ≤ 3 Mayores | 0 Bloqueantes, 0 Críticos, **5 Mayores** (DEF-04, DEF-08, DEF-09, DEF-11 y DEF-13; eran 8 el 08/11) ([`06-registro-defectos.md`](06-registro-defectos.md)) | **No** (5 contra un máximo de 3) |
| Casos negativos o de borde | ≥ 40 % | 67,5 % (251 de 372, ver [`04-especificacion-casos.md`](04-especificacion-casos.md)) | **Sí** |
| Quality Gate (SonarCloud): 0 bugs Blocker o Critical, 0 vulnerabilidades, duplicación ≤ 3 % | Gate en verde | **NO HECHO**: no hay cuenta ni `sonar-project.properties`; pide un administrador de `hllous` | **No** |
| Carga: 50 usuarios, 5 min, 3 endpoints, p95 < 500 ms, error < 1 % | p95 < 500 ms, error < 1 % | **Hecho en local, no en el despliegue** (09/11): p(95) 32,84 ms y 0,00 % de error en 14 850 requests, solo lecturas, en una máquina con backend, base, broker y k6 juntos, con el límite global subido; ver 2.2 | **Sí en local**; no verificado en Render y Supabase |
| Criterios de aceptación pasados / HU del alcance ejecutadas | ≥ 95 % y ninguno Must fallado | Ver [`03-matriz-trazabilidad.md`](03-matriz-trazabilidad.md): 160 criterios con test del backend sin fallos (R08 y suite completa sin fallos en R09); 9 solo FE y 6 huecos sin ejecutar | **Parcial** |

## 8. Lo que no se realizó

| Criterio de la cátedra | Estado | Motivo |
|---|---|---|
| Quality Gate (SonarCloud) y su captura | **NO HECHO** | Pide administrador del repositorio; no hay configuración |
| Carga contra el despliegue (Render y Supabase) y con escrituras | **NO HECHO** | k6 se corrió solo en local y solo con lecturas (09/11) |
| OWASP ZAP | **NO HECHO** | No se corrió |
| Trivy | **NO HECHO** | No se corrió |
| Mutation score del dominio completo | **NO HECHO** | Solo `outbound-requests` |
| Éxito por endpoint en los 91 endpoints restantes | **NO HECHO** | `test/api/PENDIENTES.md` |
| Integración con broker real (Testcontainers) | **Parcial** | Postgres y RabbitMQ reales como contenedores de servicio del CI y en local. El consumer se prueba contra RabbitMQ real; **la publicación del outbox contra un broker real no tiene test**, y el Core de M9 no se simula |
| Apagar el broker de verdad | **NO HECHO** | Solo en la demo en vivo. La recuperación se probó **cortando conexiones** con la API de management, no apagando el broker |
| Frontend dentro del compose | **NO HECHO** | Issue [#560](https://github.com/hllous/Backend-M6-DAPS2/issues/560) |
| Repetir las 3 corridas en el CI (y las 3 del 09/11 en local) | **NO HECHO** | Las corridas son locales; el 09/11 el e2e se corrió 2 veces |
| `--detectOpenHandles` | **NO HECHO** | No se corrió |
| Mutation score actualizado | **NO HECHO** | No se re-midió el 09/11 |
| `rabbitmq-real` en local el 09/11 | **NO HECHO** | Se saltea sin `RABBITMQ_URL`; solo corrió en el CI |
| Resultado de las alertas de CodeQL | **NO VERIFICADO** | El workflow corre y termina en `success` |

## 9. Plan de acciones

Estado de las acciones que figuraban el 03/11 y de las que quedan, al 09/11.

| # | Acción | Estado al 09/11 |
|---|---|---|
| 1 | Test de la matriz de transiciones (servicios, reparaciones y cortes, intervenciones) con 409 en los inválidos | **Hecho** (#582, 114 tests) |
| 2 | Script k6 con 50 usuarios, 5 minutos y 3 `GET` críticos, umbrales `p(95)<500` y `rate<0.01` | **Hecho en local** (#585 el script, #574 la corrida del 09/11): p(95) 32,84 ms, 0,00 % de error. **NO HECHO en el despliegue ni con escrituras** |
| 3 | Schemathesis contra `openapi.json` en el CI | **Hecho** (#583), solo `GET`; `status_code_conformance` **bloqueante** desde #593 |
| 4 | SonarCloud y Quality Gate | **NO HECHO** (pide admin) |
| 5 | Stryker acotado a transiciones y sweeper | **Hecho** (#577) en `outbound-requests`; medición global **NO HECHA** |
| 6 | Correr la suite 3 veces seguidas | **Hecho en local el 08/11**; el 09/11 el e2e se corrió 2 veces. Falta el CI y `--detectOpenHandles` |
| 7 | Que el CI falle o avise si falta el paquete de M2, o versionar los schemas | **Sin hacer** (DEF-11) |
| 8 | Reemplazar las aserciones débiles (`services.service.spec.ts:875` y el resto) | **Sin hacer** |
| 9 | Hacer obligatorio el job `e2e` en la protección de ramas | **NO HECHO** (pide admin; DEF-14) |
| 10 | Ensayo de caída y vuelta del broker con RabbitMQ real | **Hecho a medias**: e2e que corta conexiones (#579); apagar el broker queda para la demo |
| 11 | Newman en el CI | **Hecho** (#583) |
| 12 | `npm audit`, Dependabot, gitleaks y CodeQL en el CI | **Hecho** (#578, #564, #494); ZAP y Trivy **NO HECHOS** |
| 13 | Tag `v1.0-testing` en `main` y en el frontend, antes de las 13:30 del 10/11 | **Hecho** (09/11, ~19:06 UTC): ver «Estado de `main` al 09/11» |
| 14 | Declarar el 400 en los `GET` con entrada y volver bloqueante el paso de Schemathesis (DEF-20) | **Hecho** (#593, PR #597) |
| 15 | Catálogo de barrios local para el compose y el CI (DEF-21) | **Hecho** (#594, PR #597) |
| 16 | Errores en Problem Details RFC 9457 (DEF-10) | **Hecho** (#590, PR #597); falta el id de correlación y que el frontend adapte su parser (Frontend #898) |
| 17 | `ETag` e `If-Match` con 412 (DEF-05) | **Hecho** en el alcance de ADR-012 (#591, PR #597) |
| 18 | `Idempotency-Key` en los `POST` de creación (DEF-06) | **Hecho** en 21 `POST`, con la limitación de ADR-013 (#592, PR #597) |

Si no alcanza el tiempo, lo que no se haga se declara «no realizado» en el informe final (regla G9) y no se presenta con números sin evidencia.
