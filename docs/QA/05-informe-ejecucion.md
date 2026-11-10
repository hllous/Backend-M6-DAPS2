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
| Mutation | Stryker (`npm run test:mutation`), 14 min 26 s | Módulo `outbound-requests`; **no se re-midió** |
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
| Mutation (Stryker) | — | `outbound-requests` solamente | 84,21 % total | — | — | 14 min 26 s (**sin re-medir**) |
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

**Mutation score (Stryker, #577).** `stryker.config.json` cubre `outbound-requests.transitions.ts` y `street-closure-expiry.sweeper.ts`, con umbral `break: 60`. Medición completa local (14 min 26 s): **84,21 % total**, **transiciones 100 %**; el sweeper llegó a **100 % tras sumar 2 aserciones** (re-medido solo el sweeper; el total no se re-midió). El workflow `mutation.yml` corre a mano o los lunes. **Cumple el umbral de 60 % solo en este módulo;** el dominio completo no se midió.

**Mocks.** No encontramos por muestreo tests que mockeen la clase bajo prueba. Los unitarios mockean Prisma, así que prueban llamadas más que comportamiento de base; el comportamiento real lo cubren los 343 e2e.

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
| Mutation score en dominio | ≥ 60 % | 84,21 % solo en `outbound-requests` | **Parcial** |
| Tests flaky | 0 (3 corridas idénticas) | 3 corridas idénticas en local (R08) y repetidas en el CI (ver 2.1) | **Sí** |
| Pipeline | ≤ 15 min | 1 min 44 s; `API tests` 2 min 27 s | **Sí** |
| Escenarios críticos E2E en el pipeline | ≥ 5 | El job `e2e` corre las suites de `test/` (23 más `rabbitmq-real`); los E2E de navegador viven en el repo del frontend | **Sí** |
| Defectos abiertos | 0 Bloqueantes, 0 Críticos, ≤ 3 Mayores | 0, 0 y **2 Mayores** (DEF-09 y DEF-13); [`06`](06-registro-defectos.md) | **Sí** (DEF-09 sin workaround) |
| Casos negativos o de borde | ≥ 40 % | 67,5 % (251 de 372, [`04`](04-especificacion-casos.md)) | **Sí** |
| Quality Gate (SonarCloud) | Gate en verde | **NO HECHO**: no hay cuenta ni `sonar-project.properties`; pide un administrador de `hllous` | **No** |
| Carga: 50 usuarios, 5 min, p95 < 500 ms, error < 1 % | p95 < 500 ms, error < 1 % | p(95) 32,84 ms y 0,00 % en 14 850 requests (local); también corrida contra el despliegue y con escrituras (ver 2.2) | **Sí** |
| Criterios de aceptación pasados / HU ejecutadas | ≥ 95 % y ninguno Must fallado | [`03`](03-matriz-trazabilidad.md): 160 criterios con test del backend sin fallos; 9 solo FE y 6 huecos sin ejecutar | **Parcial** |

## 8. Lo que no se realizó

| Criterio | Estado | Motivo |
|---|---|---|
| Quality Gate (SonarCloud) y su captura | **NO HECHO** | Pide administrador del repositorio; no hay configuración |
| OWASP ZAP | **NO HECHO** | No se corrió |
| Trivy | **NO HECHO** | No se corrió |
| Mutation score del dominio completo (y actualizado) | **NO HECHO** | Solo `outbound-requests`, sin re-medir |
| Éxito por endpoint en los 91 endpoints restantes | **NO HECHO** | `test/api/PENDIENTES.md` |
| Integración con broker real (Testcontainers) | **Parcial** | Postgres y RabbitMQ reales como contenedores de servicio del CI y en local. El consumer se prueba contra RabbitMQ real; la publicación del outbox contra un broker real no tiene test |
| `--detectOpenHandles` | **NO HECHO** | No se corrió |

## 9. Plan de acciones

| # | Acción | Estado |
|---|---|---|
| 1 | Test de la matriz de transiciones con 409 en los inválidos | **Hecho** (#582, 114 tests) |
| 2 | Script k6 con 50 usuarios, 5 minutos y 3 `GET` críticos | **Hecho** (#585, #574): local, despliegue y escrituras |
| 3 | Schemathesis contra `openapi.json` en el CI | **Hecho** (#583), solo `GET`; bloqueante desde #593 |
| 4 | SonarCloud y Quality Gate | **NO HECHO** (pide admin) |
| 5 | Stryker acotado a transiciones y sweeper | **Hecho** (#577); medición global **NO HECHA** |
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
