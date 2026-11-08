# 05 · Informe de ejecución

> Backend del Módulo 6 (Grupo 04). Corte del **08/11/2026**, sobre `develop` @ `1d600d2`. Los números de este informe salen de corridas reales (locales y de GitHub Actions); lo que no se midió figura como **no realizado** o **dato no disponible**, con el motivo. Los datos del 03/11 y del 06/11 se conservan rotulados como históricos.
>
> **Corrida R08 (08/11/2026).** Local, Windows, Node 22.14.0, sobre `develop` @ `1d600d2`. Log en el scratchpad de la sesión de medición (`qa/measure-summary.log` y un log por corrida); **no está versionado**. Se midieron: `npm ci`, build, lint, `docs:check`, `openapi:generate`, unitarios con cobertura (1 vez) y sin cobertura (2 veces más), e2e general contra Postgres 16 real (3 veces), e2e con RabbitMQ real (3 veces) y `docker compose up` en frío.

## 1. Cómo se obtuvieron los números

| Qué | Cómo | Cuándo | Dónde |
|---|---|---|---|
| Instalación, build, lint, docs, OpenAPI | `npm ci` (76 s), `npm run build` (11 s), `npm run lint:check`, `npm run docs:check`, `npm run openapi:generate` + `git diff docs/api` | 08/11/2026, local | R08. Build OK; lint **0 errores y 298 warnings**; `docs:check` OK (105 archivos, 793 enlaces, 103 rutas, 152 operaciones, 29 tags, 43 modelos, 22 módulos, 36 variables); `openapi:generate` sin diff |
| Unitarios con cobertura | `npm run test:cov` (Prisma mockeado, no toca ninguna base) | 08/11/2026, local | R08 |
| Unitarios, corridas 2 y 3 | `npm test` | 08/11/2026, local | R08 |
| e2e general | `npm run test:e2e` contra Postgres 16 real, base descartable (`docs/testing.md`) | 08/11/2026, local, 3 corridas | R08 |
| e2e con RabbitMQ real | `npm run test:e2e -- rabbitmq-real` | 08/11/2026, local, 3 corridas | R08 |
| Compose en frío | `docker compose up -d --build` con volúmenes nuevos (imágenes en caché) | 08/11/2026, local | R08 |
| CI de `develop` | Run de `CI` del commit `1d600d2` | 08/11/2026, 18:10 UTC | [42508633321](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/42508633321) |
| Newman y Schemathesis | Workflow `API tests` (`.github/workflows/api-tests.yml`) | 08/11/2026 | [42508633216](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/42508633216) y medición del equipo (454 requests, 760 assertions, 4346 casos) |
| Mutation | Stryker (`npm run test:mutation`), medición completa local de 14 min 26 s | 08/11/2026, local | Módulo `outbound-requests` |
| Históricos | Corrida original del 03/11 sobre `f288d31` y re-medición del 06/11 | 03/11 y 06/11 | Tablas rotuladas |

Los **e2e se corrieron en local** esta vez, contra una base descartable. La salida de los logs no incluye números por caso, solo los totales de Jest; no se capturó la salida por archivo.

## 2. Totales por nivel

Estado al 08/11 (R08 salvo que se diga otra cosa). «Saltados» son tests que Jest no ejecutó; «no realizado» es un nivel sin ninguna corrida.

| Nivel | Suites | Ejecutados | Pasados | Fallados | Bloqueados | Saltados | Tiempo |
|---|---|---|---|---|---|---|---|
| Unitario (incluye 114 tests de transiciones inválidas de #582) | 121 (120 pasan, 1 salteada) | 2746 | 2746 | 0 | 0 | 12 | 106 s con cobertura; 40 s y 33 s las corridas 2 y 3 |
| Integración / e2e con Postgres 16 real (incluye 18 tests de `security-input` y el e2e del 429) | 19 | 312 | 312 | 0 | 0 | 0 | 79 s, 72 s y 60 s (3 corridas idénticas) |
| Integración con RabbitMQ real (`rabbitmq-real`) | 1 | 4 | 4 | 0 | 0 | 0 | 12 s, 6 s y 6 s (3 corridas idénticas) |
| Contrato y API: colección Newman (`test/api/`) | — | 454 requests | 760 assertions | 0 assertions | 0 | — | Corre también en el CI; tiempo: dato no disponible |
| Contrato REST contra OpenAPI: Schemathesis (solo `GET`) | — | 4346 casos | `response_schema_conformance` y `not_a_server_error`: pasan | `status_code_conformance` (informativo): falla en al menos 40 `GET`, ver DEF-20 | 0 | — | Casos fallados exactos: dato no disponible |
| Mutation testing (Stryker) | — | Módulo `outbound-requests` solamente | 84,21 % total | — | — | — | 14 min 26 s (medición local) |
| Carga (k6) | — | — | — | — | — | — | **No realizado**: hay script (`test/perf/k6-criticos.js`, #585) y **cero resultados** |
| Seguridad dinámica (ZAP) | — | — | — | — | — | — | **No realizado** |
| Seguridad estática: Trivy | — | — | — | — | — | — | **No realizado** |
| Compose en frío | — | 1 | 1 | 0 | 0 | — | up en 35 s; `/health/ready` 200 a los 45 s; seed OK |

Históricos (se conservan para ver la evolución):

| Nivel | Suites | Ejecutados | Pasados | Fallados | Saltados | Tiempo |
|---|---|---|---|---|---|---|
| Unitario, local, 06/11 | 115 | 2650 | 2650 | 0 | 0 | 100,2 s |
| Unitario, local, 03/11 | 112 | 2533 | 2533 | 0 | 0 | 897,9 s (máquina ocupada) |
| Unitario, CI de `main`, 03/11 | 112 | 2469 | 2469 | 0 | 12 (1 suite entera) | 43,6 s |
| e2e con Postgres 16, CI de `main`, 03/11 | 16 | 291 | 291 | 0 | 0 | 12,1 s |

Notas:

- **Los 12 tests saltados** son los mismos del 03/11: dependen del paquete de contratos de M2, que no se versiona (`docs/documentacion/` está en `.gitignore`). En esta máquina el paquete tampoco estaba, así que R08 los salteó (121 suites con 1 salteada; 2758 tests con 12 saltados). Ver la sección 5 y DEF-11.
- **Cuántos tests nuevos entraron desde el 03/11:** de 2533 a 2746 unitarios y de 291 a 312 e2e (más 4 de RabbitMQ real). Los 114 tests de transiciones inválidas están en `services-transitions.spec.ts` (53), `outbound-requests-transitions.spec.ts` (46) y `tree-interventions-transitions.spec.ts` (15). No se contó test por test el resto de la diferencia.
- **Bloqueados: 0** en todos los niveles. Lo que depende de otros módulos (M1, M9, M7, M2) se probó en el historial de integración, no con un caso automatizado bloqueado.
- **Los e2e** cubren: ciclo de servicios, pertenencia de Campo, inbox e idempotencia, outbox con reintento, flujo ambiental, cortes de calle, cierre de contenedores con rollback, roles por endpoint, auditoría, autorización de extracciones, solicitud de información, personas de demo, migración de cuadrillas, el guard de la base, el límite de tasa (429) y la seguridad de entrada (SQL, XSS, mass assignment, 413, CSP). Detalle en `docs/testing.md`.
- **Newman y Schemathesis** tienen caso de éxito en 60 de las 152 operaciones; los 92 restantes están en `test/api/PENDIENTES.md`. Schemathesis recorre solo los `GET`.

### 2.1 Flaky: tres corridas seguidas

| Suite | Corrida 1 | Corrida 2 | Corrida 3 | Resultado |
|---|---|---|---|---|
| Unitarios (`npm test`) | 2746 pasan, 12 saltados (106 s, con cobertura) | 2746 pasan, 12 saltados (40 s) | 2746 pasan, 12 saltados (33 s) | **Idéntico** |
| e2e general | 19 suites, 312 pasan (79 s) | 19 suites, 312 pasan (72 s) | 19 suites, 312 pasan (60 s) | **Idéntico** |
| `rabbitmq-real` | 4 de 4 (12 s) | 4 de 4 (6 s) | 4 de 4 (6 s) | **Idéntico** |

El criterio «0 tests inestables, suite corrida 3 veces con el mismo resultado» **se cumple en local para los tres niveles**. Límites honestos: (a) es una medición local, no una repetición en el CI; (b) tres corridas iguales no prueban que no haya un defecto intermitente: el issue [#554](https://github.com/hllous/Backend-M6-DAPS2/issues/554) (e2e intermitente por `e2e_no_active`, DEF-24) sigue abierto; (c) el aviso de Jest «A worker process has failed to exit gracefully» del 03/11 **no apareció** en ninguna de las corridas del 08/11 (se buscó en los logs), pero no se corrió `--detectOpenHandles`: dato no disponible. Las últimas 12 corridas del workflow `CI` en `develop` terminaron en `success` (`gh run list --workflow CI --branch develop`, 08/11).

## 3. Cobertura (unitarios, `npm run test:cov`)

**Global, R08 (08/11):** sentencias **98,6 %** · ramas **93,94 %** · funciones **98,09 %** · líneas **99,18 %** (121 suites, 2746 tests pasados). Sale de la fila `All files` del log (`% Stmts | % Branch | % Funcs | % Lines`).

| Fecha | Sentencias | Ramas | Funciones | Líneas |
|---|---|---|---|---|
| 08/11 (R08) | 98,6 | 93,94 | 98,09 | 99,18 |
| 06/11 | 98,59 | 93,87 | 98,09 | 99,18 |
| 03/11 | 98,51 | 93,98 | 97,98 | 99,12 |

El umbral global del repo es 85 % en las cuatro métricas (`package.json`, `coverageThreshold`) y la corrida lo cumplió (`exit=0`). Umbrales de la cátedra: líneas ≥ 80 %, ramas ≥ 70 % en la capa de negocio. **Cumple** (08/11): el valor más bajo de `src/modules/*` es 95,71 % de líneas y 82,92 % de ramas, ambos en `green-points`.

Cobertura por carpeta de la corrida **R08** (sentencias, ramas, funciones, líneas; en %):

| Carpeta | Sentencias | Ramas | Funciones | Líneas |
|---|---|---|---|---|
| `src/auth` | 98,32 | 90 | 96,77 | 100 |
| `src/common/audit` | 100 | 100 | 100 | 100 |
| `src/common/decorators` | 99,07 | 90,9 | 100 | 100 |
| `src/common/filters` | 94,87 | 77,77 | 100 | 97,14 |
| `src/common/middleware` | 100 | 83,33 | 100 | 100 |
| `src/common/utils` | 97,11 | 88,88 | 95 | 98,83 |
| `src/common` (raíz), `guards`, `interceptors`, `pipes` | 100 | 100 | 100 | 100 |
| `src/core` | 97,98 | 98,9 | 91,56 | 100 |
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
| `src/modules/containers` | 99,24 | 93,22 | 100 | 99,21 |
| `src/modules/crews` | 100 | 96,11 | 100 | 100 |
| `src/modules/environmental-inspections` | 100 | 97,26 | 100 | 100 |
| `src/modules/environmental-reports` | 99,46 | 91,52 | 100 | 100 |
| `src/modules/green-points` | 95,94 | 82,92 | 100 | 95,71 |
| `src/modules/green-spaces` | 98,55 | 93,33 | 100 | 98,46 |
| `src/modules/indicators` | 97,51 | 86,9 | 93,4 | 98,41 |
| `src/modules/outbound-requests` | 98,59 | 95,65 | 98 | 98,45 |
| `src/modules/role-assignments` | 100 | 95 | 100 | 100 |
| `src/modules/routes` | 100 | 88 | 100 | 100 |
| `src/modules/services` | 97,79 | 93,8 | 98,98 | 97,84 |
| `src/modules/trees` | 98,66 | 90,9 | 100 | 98,48 |
| `src/modules/trees/interventions` | 99,16 | 97,14 | 100 | 99,12 |
| `src/modules/trees/surveys` | 100 | 100 | 100 | 100 |
| `src/modules/vehicles` | 98,68 | 96 | 100 | 98,61 |
| `src/modules/zones` | 100 | 97,56 | 100 | 100 |
| `src/modules/communes`, `disposal-sites`, `neighborhoods`, `service-frequencies`, `service-types` | 100 | 100 | 100 | 100 |

**Qué excluye el cálculo** (`collectCoverageFrom`): los `*.module.ts`, los `dto/`, `index.ts`, `main.ts`, `configure-app.ts`, `config/`, `prisma/` y el helper `events/m2-contract.testing.ts`. Son código de cableado o de configuración, y `config/` tiene su propio spec (`configuration.spec.ts`) que corre aunque no cuente.

**Cobertura de los e2e:** dato no disponible (no se midió).

**Qué no mide la cobertura.** La cobertura de líneas dice qué se ejecutó, no qué se verificó. Por eso la cátedra pide mutation testing; ver la sección 7.

## 4. Tiempos del pipeline

**Estado de `develop` al 08/11.** Run de `CI` del commit `1d600d2` ([42508633321](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/42508633321)), `success` de punta a punta en **1 min 32 s** (creado 18:10:25, actualizado 18:11:57 UTC):

| Job | Resultado | Duración |
|---|---|---|
| `build` | success | 55 s |
| `test` | success | 59 s |
| `e2e` (incluye el paso de RabbitMQ real) | success | 1 min 29 s |
| `secrets` (gitleaks sobre todo el historial) | success | 53 s |
| `audit` (`npm audit`, informativo) | success | 10 s |
| `deploy` | skipped (solo corre en push a `main`) | — |

El workflow `API tests` (Newman y Schemathesis) del mismo commit terminó en `success` en 2 min 1 s ([42508633216](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/42508633216)). El workflow `CodeQL Advanced` terminó en `success` (el contenido de sus alertas no se revisó).

Las 12 corridas más recientes del workflow `CI` en `develop` (08/11 y 07/11) terminaron en `success`, con duraciones de entre 1 min 10 s y 1 min 50 s.

**Límite de la cátedra: 15 minutos. Cumple, con mucho margen.** Datos del 03/11 (históricos): 1 min 45 s a 1 min 57 s por run; `main` 1 min 52 s con `deploy` incluido.

El job `e2e` **no es check obligatorio** de la protección de ramas (`.github/branch-protection-rules.json` exige solo `build` y `test`); ver DEF-14. Cambiarlo pide permisos de administrador sobre el repositorio: **no hecho**.

## 5. Calidad de los tests

**Tests anulados o saltados.** Las únicas anulaciones condicionales por el paquete de M2 (`PAQUETE_M2_PRESENTE`) son las mismas del 03/11; la única anulación nueva es `describe.skip` de `rabbitmq-real` cuando no hay `RABBITMQ_URL` local (en el CI corre en un paso aparte con la variable puesta):

| Punto | Archivo |
|---|---|
| `describe.skip` de toda la suite | `src/events/consumers/m2-ejemplos.spec.ts:33` |
| `it.skip` | `src/events/payloads.spec.ts:427` |
| `it.skip` | `src/modules/environmental-reports/environmental-reports.service.spec.ts:923` |
| `it.skip.each` (`ROUTED`, `IN_PROGRESS`) | `src/modules/services/services.service.spec.ts:1376` |
| `describe.skip` (sin broker local) | `test/rabbitmq-real.e2e-spec.ts:24` |

Son 4 puntos de M2, 12 tests saltados y 1 suite saltada. Están **justificados por escrito** en `docs/testing.md`, pero **el CI no avisa más que con un `console.warn`**: si el paquete falta, nadie se entera de que se dejó de validar el contrato de M2 (DEF-11). Recuento del 08/11 con `grep` de `it.skip`, `xit`, `xdescribe`, `describe.skip`, `test.skip`, `it.todo` y `.only(` en `src/` y `test/`: exactamente esos 5 puntos; **0** `it.todo`, `xit`, `xdescribe`, `test.skip` y `.only`.

**Aserciones débiles.** `src/modules/services/services.service.spec.ts:875` sigue verificando «se puede cancelar desde %s» solo con `resolves.toBeDefined()`: un `cancel()` que devolviera cualquier cosa pasaría. **No se corrigió** desde el 03/11. Hay 25 usos de `toBeDefined()` o `toBeTruthy()` en los specs; solo se revisó el de la línea 875.

**Mutation score (Stryker, #577).** Configurado en `stryker.config.json` sobre dos archivos: `outbound-requests.transitions.ts` y `street-closure-expiry.sweeper.ts`, con umbral `break: 60`. Medición completa local del 08/11 (14 min 26 s): **84,21 % total**, **transiciones 100 %**; el sweeper terminó en **100 % tras sumar 2 aserciones** (re-medido solo el sweeper; **el total no se re-midió**). El workflow `mutation.yml` corre a mano o los lunes; no corre en cada PR. **Cumple el umbral de 60 % solo en este módulo.** Mutation score del dominio completo: **no realizado**. Que `outbound-requests` sea el único medido es una limitación, no una garantía para el resto.

**Tests que mockean la clase bajo prueba:** no se encontró ninguno por muestreo. No se revisaron los specs uno por uno.

**Los unitarios mockean Prisma**, así que prueban llamadas más que comportamiento de base; el comportamiento real contra Postgres lo cubren los 312 e2e (19 suites).

## 6. Contrato y API

| Qué | Estado |
|---|---|
| `docs/api/openapi.json` | 103 rutas y 152 operaciones, 29 tags. `openapi:generate` no deja diff (08/11). El CI regenera el archivo y falla si queda desactualizado (`git diff --exit-code`) |
| `src/openapi-contract.spec.ts` | 5 tests: toda operación 200/201 declara el schema de su respuesta; todo `GET` autenticado declara el 403; el `openapi.json` está al día con el código; ninguna propiedad queda como `type: object` sin forma; todo campo con `@Min`, `@Max`, `@IsLatitude` o `@IsLongitude` declara `minimum` y `maximum` |
| Eventos publicados | 6 `.schema.json` (uno por evento) más `_shared.schema.json` en `docs/eventos/publicados/`, validados con `ajv` en `src/events/payloads.spec.ts` |
| Colección Newman (#583) | **Realizada.** `test/api/m6.postman_collection.json`: 454 requests (éxito y error), 760 assertions, 0 fallidas. Corre en el CI (`api-tests.yml`) |
| Respuestas reales contra OpenAPI (Schemathesis, #583) | **Realizado, solo `GET`**: 4346 casos; `response_schema_conformance` y `not_a_server_error` pasan; `status_code_conformance` es **informativo** y marca los `GET` con entrada que devuelven 400 sin declararlo (DEF-20). `/neighborhoods` se excluye porque da 503 sin M9 (DEF-21) |
| Todos los endpoints con un caso de éxito y uno de error | **Parcial**: caso de éxito en **60 de 152** operaciones; error en las 152. Los 92 restantes están listados en `test/api/PENDIENTES.md` |
| Entidad central, toda transición inválida → 409 | **Hecho para servicios, reparaciones y cortes, e intervenciones de arbolado** (114 tests, #582): los pares salen del complemento de las tablas `*_TRANSITIONS`. Contenedores y expedientes ya tenían `it.each` |

## 7. Criterios de salida: cumple, parcial o no hecho

| Criterio de la cátedra | Umbral | Resultado | Cumple |
|---|---|---|---|
| Cobertura de líneas en dominio | ≥ 80 % | 99,18 % global; mínimo en `src/modules/*`: 95,71 % | **Sí** |
| Cobertura de ramas en dominio | ≥ 70 % | 93,94 % global; mínimo en `src/modules/*`: 82,92 % | **Sí** |
| Mutation score en dominio | ≥ 60 % | 84,21 % solo en `outbound-requests`; dominio completo sin medir | **Parcial** |
| Tests flaky | 0 (3 corridas idénticas) | Idénticas en local para unitarios, e2e y RabbitMQ real; falta repetirlo en el CI; #554 abierto | **Sí en local**, a mostrar en el CI |
| Pipeline | ≤ 15 min | 1 min 32 s (run 42508633321) | **Sí** |
| Escenarios críticos E2E en el pipeline | ≥ 5 | El job `e2e` del CI corre las suites de `test/` (19 sin RabbitMQ real y `rabbitmq-real` en un paso aparte); los E2E de navegador viven en el repo del frontend | **Sí**, a confirmar qué cuenta la cátedra como «escenario crítico» (el conteo como tal: dato no disponible) |
| Defectos abiertos | 0 Bloqueantes, 0 Críticos, ≤ 3 Mayores | 0 Bloqueantes, 0 Críticos, **8 Mayores** ([`06-registro-defectos.md`](06-registro-defectos.md)) | **No** |
| Casos negativos o de borde | ≥ 40 % | 66,7 % (232 de 348, ver [`04-especificacion-casos.md`](04-especificacion-casos.md)) | **Sí** |
| Quality Gate (SonarCloud): 0 bugs Blocker o Critical, 0 vulnerabilidades, duplicación ≤ 3 % | Gate en verde | **NO HECHO**: no hay cuenta ni `sonar-project.properties`; pide un administrador de `hllous` | **No** |
| Carga: 50 usuarios, 5 min, 3 endpoints, p95 < 500 ms, error < 1 % | p95 < 500 ms, error < 1 % | **NO HECHO**: hay script, **no hay ninguna corrida**; p95 y tasa de error: dato no disponible | **No** |
| Criterios de aceptación pasados / HU del alcance ejecutadas | ≥ 95 % y ninguno Must fallado | Ver [`03-matriz-trazabilidad.md`](03-matriz-trazabilidad.md): 160 criterios con test del backend pasan en R08; 9 solo FE y 6 huecos sin ejecutar | **Parcial** |

## 8. Lo que no se realizó

| Criterio de la cátedra | Estado | Motivo |
|---|---|---|
| Quality Gate (SonarCloud) y su captura | **NO HECHO** | Pide administrador del repositorio; no hay configuración |
| Prueba de carga y resultados de performance | **NO HECHO** | Hay script (#585), ninguna corrida |
| OWASP ZAP | **NO HECHO** | No se corrió |
| Trivy | **NO HECHO** | No se corrió |
| Mutation score del dominio completo | **NO HECHO** | Solo `outbound-requests` |
| Éxito por endpoint en los 92 endpoints restantes | **NO HECHO** | `test/api/PENDIENTES.md` |
| Integración con broker real (Testcontainers) | **Parcial** | Postgres y RabbitMQ reales como contenedores de servicio del CI y en local. El consumer se prueba contra RabbitMQ real; **la publicación del outbox contra un broker real no tiene test**, y el Core de M9 no se simula |
| Apagar el broker de verdad | **NO HECHO** | Solo en la demo en vivo. La recuperación se probó **cortando conexiones** con la API de management, no apagando el broker |
| Frontend dentro del compose | **NO HECHO** | Issue [#560](https://github.com/hllous/Backend-M6-DAPS2/issues/560) |
| Repetir las 3 corridas en el CI | **NO HECHO** | Las 3 corridas son locales |
| `--detectOpenHandles` | **NO HECHO** | No se corrió |
| Resultado de las alertas de CodeQL | **NO VERIFICADO** | El workflow corre y termina en `success` |

## 9. Plan de acciones

Estado de las acciones que figuraban el 03/11 y de las que quedan.

| # | Acción | Estado al 08/11 |
|---|---|---|
| 1 | Test de la matriz de transiciones (servicios, reparaciones y cortes, intervenciones) con 409 en los inválidos | **Hecho** (#582, 114 tests) |
| 2 | Script k6 con 50 usuarios, 5 minutos y 3 `GET` críticos, umbrales `p(95)<500` y `rate<0.01` | **Script hecho** (#585). **Corrida NO HECHA**: sin resultados |
| 3 | Schemathesis contra `openapi.json` en el CI | **Hecho** (#583), solo `GET` y con `status_code_conformance` informativo |
| 4 | SonarCloud y Quality Gate | **NO HECHO** (pide admin) |
| 5 | Stryker acotado a transiciones y sweeper | **Hecho** (#577) en `outbound-requests`; medición global **NO HECHA** |
| 6 | Correr la suite 3 veces seguidas | **Hecho en local** (08/11). Falta el CI y `--detectOpenHandles` |
| 7 | Que el CI falle o avise si falta el paquete de M2, o versionar los schemas | **Sin hacer** (DEF-11) |
| 8 | Reemplazar las aserciones débiles (`services.service.spec.ts:875` y el resto) | **Sin hacer** |
| 9 | Hacer obligatorio el job `e2e` en la protección de ramas | **NO HECHO** (pide admin; DEF-14) |
| 10 | Ensayo de caída y vuelta del broker con RabbitMQ real | **Hecho a medias**: e2e que corta conexiones (#579); apagar el broker queda para la demo |
| 11 | Newman en el CI | **Hecho** (#583) |
| 12 | `npm audit`, Dependabot, gitleaks y CodeQL en el CI | **Hecho** (#578, #564, #494); ZAP y Trivy **NO HECHOS** |
| 13 | Tag `v1.0-testing` en `main` y en el frontend, antes de las 13:30 del 10/11 | **Pendiente del equipo** |

Si no alcanza el tiempo, lo que no se haga se declara «no realizado» en el informe final (regla G9) y no se presenta con números sin evidencia.
