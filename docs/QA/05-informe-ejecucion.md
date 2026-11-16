# 05 · Informe de ejecución

> Versión 2.2 · 16/11/2026

Backend del Módulo 6 (Grupo 04), medido sobre `develop` @ `53cde64`. Local: Windows, Node 24. CI: último run de `develop` ([CI 43927922346](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/43927922346), [API tests 43927922082](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/43927922082), [CodeQL 43927922293](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/43927922293)).

## 1. Cómo se obtuvieron los números

| Qué | Cómo | Resultado |
|---|---|---|
| Build, tipos, lint, docs | `npm run build`, `typecheck`, `lint:check`, `docs:check` | Build OK; typecheck OK; lint 0 errores y 345 warnings; `docs:check` OK |
| Unitarios y cobertura | `npm run test:cov` (Prisma mockeado, sin base) | Secciones 2 y 3 |
| e2e | Job `e2e` del CI (Postgres 16 y RabbitMQ reales, `docs/testing.md`) | Sección 2 |
| API (Newman y Schemathesis 4.33.1) | Workflow `API tests` | Sección 6 |
| Mutation | Stryker, workflow `mutation.yml` sobre `50cfff7` ([run 43910859083](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/43910859083)) | Sección 5 |
| Carga | k6, `test/perf/k6-criticos.js` | Sección 2.1 |
| Seguridad y calidad estática | Jobs `trivy`, `secrets`, `secrets-default`, `audit`, workflow `dast`, SonarCloud | Sección 7 |

## 2. Totales por nivel

| Nivel | Suites | Ejecutados | Pasados | Fallados | Saltados | Tiempo |
|---|---|---|---|---|---|---|
| Unitario | 131 | **3056** | 3056 | 0 | 0 | 26 s en el CI; 80 s con cobertura en local |
| e2e con Postgres 16 | 25 | **410** | 410 | 0 | 0 | 36 s |
| e2e con RabbitMQ real | 2 | **8** | 8 | 0 | 0 | 11 s |
| Newman (`test/api/`) | 1 colección | 570 requests, 1015 assertions | 1015 | 0 | — | 6,8 s |
| Schemathesis: esquema y errores de servidor | 65 de 152 operaciones (`GET`) | 4681 casos | 4681 | 0 | 0 | 14 s |
| Schemathesis: `status_code_conformance` (bloqueante) | 65 de 152 operaciones (`GET`) | 4674 casos | 4203 | 0 | 471 | 12 s |
| Mutation (Stryker) | 26 archivos de dominio | 3068 mutantes evaluados | **76,11 %** | — | — | 4 min 39 s |
| Carga (k6) | — | 14 850 requests | p(95) 32,84 ms; 0,00 % de error | 0 | — | 5 min |

Total automatizado de tests: **3474** (3056 unitarios + 410 e2e + 8 de RabbitMQ real). Bloqueados: 0. Los 471 casos salteados de Schemathesis son 404 por datos de prueba y 429 en 3 operaciones del portal público.

Los e2e cubren: ciclo de servicios, pertenencia de Campo, inbox e idempotencia, outbox con reintento (también contra RabbitMQ real), flujo ambiental, cortes de calle, cierre de contenedores con rollback, roles por endpoint, auditoría, extracciones, solicitud de información, personas de demo, migración de cuadrillas, guard de la base, límite de tasa (429), seguridad de entrada, seguridad en vivo, errores en Problem Details, ETag e `If-Match`, `Idempotency-Key` y catálogo local de barrios (detalle en `docs/testing.md`).

**Flaky.** Tres corridas locales idénticas (`npm run test:cov` y dos `npm test`): 131 archivos y 3056 tests pasan en las tres, y los mismos números en el CI.

### 2.1 Carga (k6)

`test/perf/k6-criticos.js`: 50 usuarios, 5 minutos, `GET /services`, `/containers` y `/zones` autenticados, `pageSize=20`. Evidencia: `test/perf/resultados/2026-11-09/`.

| Métrica | Resultado | Umbral | Cumple |
|---|---|---|---|
| `http_req_duration` p(95) | **32,84 ms** | < 500 ms | Sí |
| `http_req_failed` | **0,00 %** (0 de 14 850) | < 1 % | Sí |
| Requests | 14 850 (49,1 por segundo) | — | — |
| Promedio / mediana / p(90) / máximo | 14,97 / 11,11 / 23,95 / 441,21 ms | — | — |

Corrida local con backend, Postgres, RabbitMQ y k6 en la misma máquina, solo lecturas, `THROTTLE_LIMIT` en 100000 y el seed de demo (673 servicios, 500 contenedores, 48 zonas). Contra el despliegue el límite sigue en 600 por minuto por IP y endpoint.

## 3. Cobertura (`npm run test:cov`)

| Métrica | Global | Umbral del repo | Consigna |
|---|---|---|---|
| Sentencias | **97,98 %** | 90 % | — |
| Ramas | **95,28 %** | 90 % | ≥ 70 % en negocio |
| Funciones | **97,82 %** | 90 % | — |
| Líneas | **98,71 %** | 90 % | ≥ 80 % en negocio |

Por capa (líneas, ramas y funciones; suma de los archivos de cada carpeta):

| Capa | Archivos | Líneas | Ramas | Funciones |
|---|---|---|---|---|
| `src/modules` (negocio y dominio) | 62 | 99,24 % | 95,93 % | 98,84 % |
| `src/events` (outbox, inbox, consumers, publishers) | 31 | 99,00 % | 95,14 % | 98,18 % |
| `src/common` | 34 | 98,92 % | 91,71 % | 98,02 % |
| `src/core` | 5 | 100 % | 97,61 % | 91,67 % |
| `src/auth` | 7 | 100 % | 92,65 % | 96,55 % |

Dentro de `src/modules`, el archivo más bajo es `attachments/evidence-file.ts` en líneas (96 %) y `green-spaces/green-spaces.service.ts` en ramas (81,57 %): ambos cumplen la consigna. Excluye el cálculo: `*.module.ts`, `dto/`, `index.ts`, `main.ts`, `configure-app.ts`, `config/` y `prisma/`. Detalle en `vitest.config.ts` y [ADR-017](../decisiones/adr-017-herramientas-analisis-estatico-y-seguridad.md).

## 4. Tiempos del pipeline

Run de `CI` de `develop` @ `53cde64`, `success` de punta a punta en **2 min 23 s** (de 18:21:16 a 18:23:39 UTC). El camino crítico es `trivy` (2 min 20 s), del que depende `deploy`.

| Job | Resultado | Duración |
|---|---|---|
| `build` (docs:check, build, lint, OpenAPI al día) | success | 40 s |
| `test` (typecheck de specs, unitarios, `lcov`) | success | 1 min 11 s |
| `e2e` (Postgres y RabbitMQ reales) | success | 1 min 27 s |
| `audit` (`npm audit`, gate de altas y críticas) | success | 18 s |
| `secrets` (gitleaks con `.gitleaks.toml`, historial completo) | success | 1 min |
| `secrets-default` (gitleaks por defecto y trufflehog) | success | 1 min 13 s |
| `trivy` (`fs`, `image`, `config`) | success | 2 min 20 s |
| `sonar` | skipped (el plan Free analiza solo `main` y los PR) | — |
| `deploy` | skipped (solo corre en push a `main`) | — |

| Workflow | Job | Resultado | Duración |
|---|---|---|---|
| `API tests` | `api (newman + schemathesis)` | success | 2 min 8 s (workflow: 2 min 11 s) |
| `CodeQL Advanced` | `Analyze (javascript-typescript)` | success | 1 min 27 s (workflow: 1 min 30 s) |
| `CodeQL Advanced` | `Analyze (actions)` | success | 47 s |

Los tres workflows corren en paralelo: el pipeline completo termina con `CI` a los 2 min 23 s. **Límite de 15 minutos: cumple.**

## 5. Calidad de los tests

**Mutation score (Stryker).** `stryker.config.json` muta los 26 `*.service.ts`, `*.transitions.ts` y `*.sweeper.ts` de `src/modules`, con `break: 60`. Resultado: **76,11 %** global (77,16 % sobre mutantes cubiertos): 2334 killed, 1 timeout, 691 survived y 42 sin cobertura. Umbral: 60 %. Cumple. Cómo repetirlo: [`docs/testing.md`](../testing.md), sección «Mutation testing».

**Tests saltados.** Ninguno. No hay `it.todo`, `xit`, `xdescribe`, `test.skip` ni `.only` en `src/` y `test/`.

**Aserciones débiles.** `src/modules/services/services.service.spec.ts:875` verifica «se puede cancelar desde %s» solo con `resolves.toBeDefined()`.

**Mocks.** Los unitarios mockean Prisma: prueban llamadas más que comportamiento de base; el comportamiento real lo cubren los 410 e2e.

## 6. Contrato y API

| Qué | Estado |
|---|---|
| `docs/api/openapi.json` | 103 rutas, 152 operaciones, 29 tags; el CI regenera el archivo y falla si queda desactualizado |
| `src/openapi-contract.spec.ts` | 7 tests: schema de toda respuesta 200/201; errores como `application/problem+json`; 403 en todo `GET` autenticado; 400 en todo `GET` con parámetros; `openapi.json` al día; sin `type: object` sin forma; `minimum`/`maximum` en `@Min`, `@Max`, `@IsLatitude` y `@IsLongitude` |
| Eventos publicados | 6 `.schema.json` más `_shared.schema.json`, validados con `ajv` en `src/events/payloads.spec.ts` |
| Newman (`npm run api:coverage`) | Éxito en **151 de 152** operaciones y error en **149 de 152**; las 4 excepciones están en `test/api/PENDIENTES.md`. El script falla si una operación queda sin caso ni excepción |
| Schemathesis | Solo `GET` (65 de 152 operaciones); cobertura de esquema: parámetros 55,1 %, respuestas 20,8 % |
| Transición inválida → 409 | 114 tests parametrizados para servicios, reparaciones, cortes e intervenciones; `it.each` en contenedores y expedientes |
| Problem Details (ADR-011) | `traceId` igual al header `X-Request-Id` y al log del 500; `path` e `instance` sin query; `test/problem-details.e2e-spec.ts` |
| ETag e `If-Match` (ADR-012) | `test/etag-if-match.e2e-spec.ts` (concurrencia real `[200, 412]`) |
| `Idempotency-Key` (ADR-013) | 21 `POST` de creación; `test/idempotency.e2e-spec.ts` |

## 7. Análisis estático y de seguridad

Decisiones y exclusiones: [ADR-017](../decisiones/adr-017-herramientas-analisis-estatico-y-seguridad.md). Hallazgos: [`07`](07-informe-seguridad.md).

**SonarCloud** ([dashboard](https://sonarcloud.io/summary/overall?id=hllous_Backend-M6-DAPS2)): último análisis, de `main` (16/11/2026, 57 877 líneas).

| Métrica | Exigido | Resultado |
|---|---|---|
| Quality Gate | Aprobado | **OK** |
| Bugs / vulnerabilidades | 0 | **0 / 0** |
| Confiabilidad / seguridad / mantenibilidad | A | **A / A / A** |
| Duplicación | ≤ 3 % | **1,2 %** (código nuevo: 0,3 %) |
| Hotspots revisados | 100 % | **100 %** (0 abiertos) |
| Cobertura | — | **97,3 %** (líneas 98,8 %; código nuevo: 94,3 %) |

El gate es bloqueante en el CI (`sonar.qualitygate.wait=true`).

**Trivy** (job `trivy`, 2 min 20 s): `fs`, `image` y `config` con **0 HIGH/CRITICAL**; `.trivyignore` vacío.

**OWASP ZAP** (workflow `dast`, último run: [43895156093](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/43895156093), 4 min 48 s; baseline 1 min 26 s y activo 4 min 45 s en paralelo):

| Escaneo | High | Medium | Resto | Qué es la Medium |
|---|---:|---:|---|---|
| Baseline contra Render | **0** | 1 | 8 avisos Low o informativos | CSP ausente en `/api/docs` |
| Activo autenticado, entorno efímero | **0** | 1 | 122 reglas sin hallazgo | CORS `*` del entorno efímero |

**Secretos:** `secrets` (gitleaks con `.gitleaks.toml`, 1 min) y `secrets-default` (gitleaks por defecto y trufflehog, 1 min 13 s) en `success`. **Dependencias:** `npm audit --omit=dev` con 0 vulnerabilidades (job `audit`, 18 s). **CodeQL:** `success` en `javascript-typescript` y `actions`.

## 8. Criterios de salida

| Criterio | Umbral | Resultado | Cumple |
|---|---|---|---|
| Cobertura de líneas en dominio | ≥ 80 % | 98,71 % global; 99,24 % en `src/modules` | Sí |
| Cobertura de ramas en dominio | ≥ 70 % | 95,28 % global; 95,93 % en `src/modules` | Sí |
| Mutation score en dominio | ≥ 60 % | 76,11 % | Sí |
| Tests flaky | 0 (3 corridas idénticas) | Backend: 3 corridas locales y el CI con el mismo resultado. Frontend: 3 corridas locales idénticas y `retries: 0` en Playwright (sección 9.2) | Sí |
| Pipeline | ≤ 15 min | 2 min 23 s (camino crítico: `trivy`) | Sí |
| Escenarios críticos E2E en el pipeline | ≥ 5 | Job `e2e`: 25 suites y 410 tests, más 2 suites de RabbitMQ real | Sí |
| Defectos abiertos | 0 Bloqueantes, 0 Críticos, ≤ 3 Mayores | 0, 0 y 0 Mayores; 2 Menores ([`06`](06-registro-defectos.md)) | Sí |
| Casos negativos o de borde | ≥ 40 % | 67,8 % (267 de 394, [`04`](04-especificacion-casos.md)) | Sí |
| Quality Gate (SonarCloud) | Verde, 0 bugs, 0 vulnerabilidades, duplicación ≤ 3 %, ratings A, 100 % hotspots | Gate OK; 0 / 0; 1,2 %; A/A/A; 100 % | Sí |
| ZAP baseline y activo | 0 High, cada Medium justificada | 0 High; 1 Medium en cada uno, justificadas en [`07`](07-informe-seguridad.md) | Sí |
| Dependencias (Trivy y `npm audit`) | 0 críticas o altas sin mitigación | 0 HIGH/CRITICAL; `npm audit` en 0 | Sí |
| Carga: 50 usuarios, 5 min | p95 < 500 ms, error < 1 % | p(95) 32,84 ms; 0,00 % | Sí |
| Criterios de aceptación con test / HU ejecutadas | ≥ 95 % y ninguno Must fallado | [`03`](03-matriz-trazabilidad.md): **177 de 181 ejecutados y pasados (97,8 %)**: 167 con test del backend y 10 con test del frontend (Eje A, sección 9); 0 fallados; 4 huecos | Sí |

## 9. Frontend

Medido sobre `develop` del repo Frontend @ `0519d95` (16/11/2026), después de FE #977, #978, #979, #980, #982 y #985. Las cifras de cobertura y de tests salen de las descripciones de esos PR y de la evidencia versionada en el repo Frontend; los runs citados son del CI de GitHub Actions del Frontend. La configuración (umbrales, shards, Stryker, gate de Sonar) se recontrastó el 16/11 contra `develop` del Frontend @ `93c4cc7` (tras FE #972 y #986).

### 9.1 Eje A: criterios solo-FE, responsive y accesibilidad

Los 10 criterios que solo cubría el frontend tienen un test leído contra el texto del criterio y ejecutado (FE #979, [run 43906206165](https://github.com/hllous/Frontend-M6-DAPS2/actions/runs/43906206165), todos los jobs en verde). Detalle por criterio en [`03`](03-matriz-trazabilidad.md).

| Criterio | Test del Frontend |
|---|---|
| CA-HU01-1, CA-HU01-2, CA-HU01-4 | `e2e/qa-criterios-fe.spec.ts` (orden y filtro, esqueleto, 500 y timeout del BFF → `role=alert`). CA-HU01-1 parcial: [Frontend #983](https://github.com/hllous/Frontend-M6-DAPS2/issues/983) |
| CA-HU01-3 | `src/components/ui/shadcn-guard.test.ts` |
| CA-HU26-1, CA-HU26-3 | `e2e/qa-criterios-fe.spec.ts` y `src/lib/argentina-date.test.ts` |
| CA-HU26-2 | `e2e/service-vehicle-labels.spec.ts` |
| CA-HU30-3 | `src/lib/m1-refresh.test.ts` y `e2e/failure-journeys.spec.ts` |
| CA-HU30-4 | `src/app/api/session/login/route.test.ts` |
| CA-HU32-1 | `e2e/accessibility.spec.ts` (63 tests) |

**Responsive y accesibilidad.** 21 pantallas (`e2e/support/screens.ts`) a 360, 768 y 1280 px: **0 violaciones de axe** (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`; el test falla ante cualquier violación) y **ninguna pantalla con scroll horizontal** (`e2e/responsive-and-keyboard.spec.ts`). Se corrigieron tres violaciones para llegar ahí: `aria-valid-attr-value` en las pestañas del mapa (critical), contraste de `TabsTrigger` y `scrollable-region-focusable` en los tableros.

**Lighthouse** (modo navegación, escritorio y móvil, servidor de desarrollo en modo mock; sin puntaje de rendimiento): accesibilidad **100** en escritorio y móvil en Ingreso, Inicio de Oficina, Contenedores, Servicios, Expedientes, Mapa y Portal público; buenas prácticas 100, salvo 96 en móvil en Servicios y Mapa (teselas de OpenStreetMap a menor resolución). Evidencia: `Frontend-M6-DAPS2/docs/evidencia/eje-a-2026-11-16/` (capturas, reportes HTML de Lighthouse y README con el método).

### 9.2 Eje B: tests inestables, cobertura, mutation y tiempos

| Qué | Resultado | Cumple |
|---|---|---|
| Tests inestables (FE #980) | Causa raíz: timeout de 5 s por test en local bajo carga, `findBy`/`waitFor` con tope de 1 s y compuertas `delay(ms)` de MSW. Ahora `testTimeout` de 30 s igual al CI, compuertas liberadas tras las aserciones y `retries: 0` en Playwright también en el CI. 3 corridas locales idénticas (3229 tests pasan). Desde entonces, los 3 runs del CI de `develop` ([43932396277](https://github.com/hllous/Frontend-M6-DAPS2/actions/runs/43932396277), [43933683135](https://github.com/hllous/Frontend-M6-DAPS2/actions/runs/43933683135), [43934913604](https://github.com/hllous/Frontend-M6-DAPS2/actions/runs/43934913604)) están en verde sin reintentos, aunque cada uno sobre un commit distinto. Cierra DEF-29 a DEF-31 | Sí |
| Cobertura unitaria con umbral (FE #985) | Sentencias **90,20 %**, líneas **93,03 %**, funciones **88,05 %**, ramas **83,58 %** (antes 87,97 % y 90,85 %, sin umbral). Umbrales en `vitest.config.ts`: 90 / 92 / 87 / 83, exigidos por el job `unit-coverage` sobre el informe fusionado de los shards. 329 archivos y 4134 tests | Sí |
| Mutation testing (Stryker) | Configurado sobre `src/lib` y las rutas BFF con `break: 60` ([Frontend #986](https://github.com/hllous/Frontend-M6-DAPS2/pull/986)); primera medición completa en curso ([run 43952775688](https://github.com/hllous/Frontend-M6-DAPS2/actions/runs/43952775688)), cifra no incluida en esta versión. Una medición previa y parcial (7 de 8 shards del primer reparto, sin las rutas dinámicas `[id]`) dio 56,2 % (3885 de 6916 mutantes válidos), por debajo del `break` de 60, y el equipo está trabajando para subirla; no es el resultado del run (ADR-0011 del Frontend, sección «Resultado») | Parcial (DEF-35) |
| Tiempo del CI de PR (FE #982) | 4,5 a 5,5 min de pared con runners libres; los 10 shards de e2e (y 4 de unitarios) se reparten por duración medida (LPT) y cada job tiene `timeout-minutes`. Los picos de 15 min venían de reintentos y de la cola compartida de 20 jobs concurrentes | Sí (≤ 15 min) |

Los tests de cobertura encontraron un defecto real: `src/app/api/vehicles/[id]/route.ts` devolvía 500 en vez de 503 con el backend caído (DEF-40, corregido en FE #985).

### 9.3 Eje C: concurrencia optimista y timeout del BFF

FE #978 (ADR 0010 del Frontend): el BFF propaga `ETag` e `If-Match` en las transiciones versionadas (ADR-012 del Backend) y en `PATCH /containers/:id`; un 412 muestra «Otra persona modificó este registro. Recargue para ver los cambios.» con la acción Recargar y sin perder lo escrito. El timeout del BFF al backend bajó de 15 s a **5 s** con `AbortController` y responde 503; solo los `GET` se reintentan una vez ante una falla de red inmediata. Test: `e2e/optimistic-concurrency.spec.ts`. Cierra DEF-32 y DEF-33.

Con Render dormido, los primeros pedidos dan 503 hasta que despierta: antes de la demo hay que abrir `/health`.

### 9.4 Eje D: límite de intentos de login

FE #977: el login del BFF responde **429 con `Retry-After`** tras 5 fallos por cuenta o 20 por IP en 15 minutos, reinicia el contador con el login correcto y no revela si la cuenta existe. Test: `e2e/login-rate-limit.spec.ts`, más `src/lib/login-rate-limit.test.ts` y `src/app/api/session/login/rate-limit.test.ts`. El contador vive en memoria por instancia (ADR 0009 del Frontend). Tabla completa de controles del Frontend: `Frontend-M6-DAPS2/docs/security/eje-d-evidencia.md`; resumen en [`07`](07-informe-seguridad.md).

### 9.5 Análisis estático y de seguridad del Frontend

Fuente: ADR-0008 del Frontend, `docs/agents/quality-security-ci.md` y `docs/security/zap.md` del repo Frontend. El backend no espeja estos análisis: se miran allá.

| Qué | Resultado |
|---|---|
| SonarCloud | Quality Gate **bloqueante** desde FE #972 (ticket #926): el job `sonar` usa `sonar.qualitygate.wait=true`, se saltea sin `SONAR_TOKEN` y corre con la cobertura fusionada de los 4 shards. Que `sonar` figure como check requerido en la protección de `develop` del Frontend no se verificó |
| Trivy | 0 HIGH/CRITICAL en dependencias, imagen y configuración (ADR-0008, medido sobre `main` @ `06bab02`, 16/11/2026). No frena el merge, solo el check |
| OWASP ZAP | Baseline contra Vercel: 0 High, 3 Medium, 7 Low, 15 informativas. Activo (sin autenticar) contra la app construida en el CI: 0 High, 2 Medium, 8 Low, 14 informativas. Run [43763194531](https://github.com/hllous/Frontend-M6-DAPS2/actions/runs/43763194531) del 15/11, archivado en `docs/security/zap-2026-11-15/`. Los Medium de CSP y anti-clickjacking se cerraron en FE #958 (`next.config.mjs` y `src/proxy.ts`); el reporte archivado es anterior y no se volvió a escanear. El activo autenticado del Frontend no existe (el login pasa por M1 real); la superficie autenticada la cubre el activo del backend |
