# 01 · Plan y estrategia de pruebas

> Versión 2.2 · 16/11/2026, cierre de la Entrega 4. Módulo 6 «Ambiente e Higiene», Grupo 04, Desarrollo de Aplicaciones II (estructura de ISO/IEC/IEEE 29119-3). Las cifras están en [`05-informe-ejecucion.md`](05-informe-ejecucion.md); **R09** es la corrida local de medición del 10/11 (`develop` @ `142e1a3`), la **Entrega 4** (16/11) se midió sobre `main` @ `78bf714` y el **cierre** del 16/11 sobre `develop` @ `50cfff7` (05, 5.3). Las herramientas de análisis (SonarCloud, Trivy y ZAP) están en uso desde la Entrega 4: decisión en [ADR-017](../decisiones/adr-017-herramientas-analisis-estatico-y-seguridad.md).

## 1. Objetivo y alcance

**Objetivo.** Demostrar, con evidencia ejecutada, que el módulo cumple las historias de usuario comprometidas (HU-01 a HU-33, ver [`02-historias-y-criterios.md`](02-historias-y-criterios.md)), que integra con el resto de la plataforma por eventos y que respeta los criterios de seguridad de la Clase 11.

**Sistema bajo prueba.** Dos repositorios, un sistema:

| Pieza | Repositorio | Stack | Despliegue |
|---|---|---|---|
| Backend REST + eventos (outbox/inbox) | `hllous/Backend-M6-DAPS2` | NestJS, Prisma, PostgreSQL, RabbitMQ (bus del Core de M9) | Render + Supabase |
| Frontend web + BFF | `hllous/Frontend-M6-DAPS2` | Next.js, React, Tailwind | Vercel |

**Dentro del alcance.** Todas las HU del release R2 y del MVP del tablero «M6 - Product Backlog & Story Map»: catálogos y recursos, programación y ejecución de servicios, inventario urbano (contenedores, arbolado, espacios verdes), control ambiental (denuncia → inspección → acta → sanción), integración por eventos con M1, M2, M3, M4, M7 y M9, seguimiento ciudadano sin login, indicadores, roles y seguridad.

**Fuera del alcance.**

| Ítem | Motivo |
|---|---|
| Alta del reclamo del vecino dentro de M6 | HU `WON'T`: el reclamo se recibe en M2 |
| Cobro y gestión de multas | HU `WON'T`: la sanción la decide M4 |
| App mobile nativa para cuadrillas | HU `WON'T`: Campo usa la web responsive |
| SOAP / WSDL, XXE | **No aplica:** el módulo es REST/JSON más mensajes JSON por RabbitMQ; no expone ni consume SOAP, no publica WSDL y no parsea XML, así que no hay superficie de XXE ([`07`](07-informe-seguridad.md), sección 2) |
| Funcionalidad de IA dentro del sistema (Clase 14, punto 8.3) | **No aplica:** el sistema no incorpora ninguna funcionalidad de IA, así que no hay pruebas de IA integrada. La IA se usó solo como herramienta del equipo (8.1, declarada en la Clase 14) |
| Pruebas internas de M1, M2, M3, M4, M7, M9 | Son de cada grupo; acá se prueba el contrato con ellos |
| Hash de contraseñas y login propio del backend | El JWT lo emite M1 (ADR-004); M6 no guarda contraseñas. La fuerza bruta sobre el login del BFF del frontend **sí** se prueba (429, FE #977; [`07`](07-informe-seguridad.md)) |

## 2. Niveles de prueba

| Nivel | Qué existe | Qué falta |
|---|---|---|
| **Unitario** (backend) | 129 archivos; cierre del 16/11: 3010 tests pasan, 0 fallan (R09: 2854). Cobertura 97,98 % sentencias, 95,28 % ramas, 98,71 % líneas; **umbral de 90 %** (antes 85 %, #700) global y por archivo en 7 archivos críticos, bloqueante en el CI. SonarCloud la mide igual (97,3 % con su denominador, las mismas líneas sin cubrir). Incluye 114 tests de transiciones inválidas (#582) | Algunos tests prueban llamadas a mocks más que comportamiento; aserción débil en `services.service.spec.ts:875` |
| **Mutation testing** | Stryker sobre los 26 `*.service.ts`, `*.transitions.ts` y `*.sweeper.ts` de `src/modules` (#577, #617): score global en CI **75,39 %** (era 71,22 % antes del refuerzo); 5 archivos reforzados con tests; workflow `mutation.yml` manual o semanal. Detalle en [`05`](05-informe-ejecucion.md) §5.1 | 21 archivos sin reforzar |
| **Unitario** (frontend) | Vitest en el CI; cobertura medida en SonarCloud (85,4 %) | Cobertura ≥ 90 % con umbral y mutation: **PENDIENTES**, en curso (Frontend #975, DEF-35) |
| **Integración / e2e** (backend) | 24 suites en `test/` contra `postgres:16` (CI del 16/11: 404 pasan; R09: 343) y 2 suites contra RabbitMQ real en el CI (8 tests); job `e2e` del CI, **check obligatorio** desde el 16/11; guard que impide apuntar a una base no local | Testcontainers; publicación del outbox contra un broker real |
| **E2E de usuario** (frontend) | Specs Playwright en 10 shards en el CI; los 10 criterios que solo tenía el frontend tienen test ejecutado (Eje A, FE #979) | El recorrido a 360, 768 y 1280 px se hizo con axe y capturas (FE #979); `retries: 0` llega con FE #980 |
| **Contrato** | `openapi-contract.spec.ts` (7 tests), `payloads.spec.ts` (ajv contra los `.schema.json`), el CI exige `openapi.json` al día; Schemathesis (#583, solo `GET`): 4388 casos de esquema pasan y `status_code_conformance` es bloqueante (#593) | Schemathesis sobre las escrituras |
| **API** | Colección Newman (`test/api/`, #583 y #702): 570 requests, 1015 assertions, 0 fallidas, en el CI. **Éxito en 151 de 152 operaciones y error en 149 de 152**; `npm run api:coverage` lo controla | Las 4 excepciones justificadas en `test/api/PENDIENTES.md` (`POST /evidence` sin R2 en el CI; `/health`, `/health/ready` y `/public/zones` sin error provocable) |
| **Estado (transiciones)** | `assertTransition` con tablas por entidad; 114 tests parametrizados (#582); e2e `services-lifecycle`; `etag-if-match` (12 tests, concurrencia real `[200, 412]`); en el frontend, `e2e/optimistic-concurrency.spec.ts` (FE #978) | `If-Match` solo en 4 recursos y 2 `PATCH` (ADR-012) |
| **Idempotencia de altas** | `idempotency.interceptor.spec.ts` y `test/idempotency.e2e-spec.ts` (8 tests; 21 `POST`) | Test de caída entre crear el recurso y guardar la respuesta (ADR-013) |
| **Resiliencia** | `inbox.e2e-spec`, `outbox-retry.e2e-spec`, `containers-close.e2e-spec` (rollback); `rabbitmq-real` (duplicado, inválido y reconexión del consumer, #579) | Timeout del Core contra un fetch colgado |
| **Seguridad** | **Desde el 16/11:** `security-live` e2e (58 tests, #701: JWT, BFLA, BOLA, mass assignment, inyección, cabeceras, CORS, errores y logs) y su guion contra cualquier URL (`scripts/security-live.mjs`); gitleaks por defecto y trufflehog (job `secrets-default`); límite de intentos del login del BFF (FE #977). `auth-roles` y `crew-ownership` e2e; `route-roles.spec`; `jwt.strategy.spec`; `security-headers.middleware.spec`; `security-input` (SQL/XSS, mass assignment, 413, CSP; #581); `throttler` (429, #580); `redact-url.spec`; `npm audit`, Dependabot, gitleaks y CodeQL en el CI. **Desde la Entrega 4:** Trivy (`fs`, `image` y `config`, #658), ZAP baseline contra Render y activo autenticado contra un entorno efímero (#659) y SonarCloud (#657) | Alertas de CodeQL sin revisar; ZAP activo con ejemplos del OpenAPI (cobertura baja de escrituras exitosas); re-correr ZAP y el guion contra Render con #701 en `main` |
| **Carga** (50 usuarios, 5 min, p95 < 500 ms) | k6 `test/perf/k6-criticos.js` (#585). En local: p(95) 32,84 ms y 0,00 % de error en 14 850 requests (`test/perf/resultados/2026-11-09/`). También se corrió contra el despliegue (Render y Supabase) y con escrituras | — |
| **Arranque local** | `docker compose up --build` en frío con `.env` obligatorio, stack `modulo-6-ambiente` (#584). Última corrida 11/11/2026, Windows, Node 24.22.2 en la imagen y RabbitMQ 4.4, sin imágenes, volúmenes ni caché de build (#640): build y descargas ≈ 343 s; de que arranca Postgres a `/health/ready` 200 (`database: up`, `broker: connected`), 28 s; 34 migraciones aplicadas; `rabbitmq-setup` crea exchange y cola al primer intento; seed con `--profile seed` en 126 s (incluye construir su imagen); `GET /neighborhoods` 200 con token. La corrida anterior (Node 22, con imágenes en caché) daba up en 46 s y `/health/ready` a los 55 s | **Desde el 16/11 (G1, #699):** sistema completo con un solo `docker compose up --build`, sin `.env`, con seed automático, M1 falso y frontend; corre en el CI (`g1-arranque.yml`): login de punta a punta a los 149 s |
| **Accesibilidad** (frontend) | `accessibility.spec.ts` con axe en el CI (63 tests); recorrido de 21 pantallas a 360, 768 y 1280 px con 0 violaciones; Lighthouse accesibilidad 100 en 7 pantallas (FE #979) | Lighthouse no corre en el CI |

## 3. Entornos

| Entorno | Para qué | Notas |
|---|---|---|
| **Local** | Desarrollo, unitarios y e2e | `npm run prisma:seed` para demo; los e2e **truncan** las tablas: usar una base descartable (`docs/testing.md`) |
| **Local con `docker compose`** | Sistema completo con un comando (`docker compose up --build`, G1): base, broker, backend con migraciones, seed automático e idempotente, M1 falso y frontend | Funciona sin `.env` con valores de desarrollo; el frontend corre con `next dev` y la primera carga de cada pantalla es lenta (`README.md`). Postgres y RabbitMQ solo en `127.0.0.1` |
| **CI (GitHub Actions)** | `build` (docs:check, build, lint, OpenAPI al día), `test` (con `lcov`), `sonar` (SonarCloud), `e2e`, `secrets` (gitleaks), `audit` (gate de altas y críticas), `trivy` (`fs`, `image`, `config`; gate sobre HIGH/CRITICAL con fix) y `deploy`; workflows `API tests`, `CodeQL Advanced`, `Mutation testing` y `dast` (ZAP, a demanda y los lunes) | Checks obligatorios (16/11): `build`, `test`, `e2e`, `secrets` y `sonar` en `develop`, `test` y `main`; `sonar` espera el Quality Gate y falla si no pasa (#700). Corre también `secrets-default` (gitleaks por defecto y trufflehog). `audit` y `trivy` frenan el deploy |
| **Entorno efímero de ZAP** | `docker compose` levantado dentro del job `dast` (base y broker descartables, `JWT_SECRET` de prueba, seed de demo), solo para el escaneo activo | El activo **nunca** va contra Render: escribe datos, choca con el límite de 600 req/min y publicaría al bus del Core |
| **Render + Supabase** | Backend desplegado de la demo | El plan gratuito se duerme (riesgo R7) |
| **Vercel** | Frontend desplegado de la demo | Contra el backend de Render |
| **Core de M9** | Bus real (`muni.inbox`, cola `q.ambiente`) | Compartido por todos los grupos: avisar antes de publicar |
| **M1 (Identidad)** | Login real y JWT | El secreto de firma en Render debe coincidir con el de M1 |

## 4. Datos de prueba

- **Unitarios:** objetos construidos en cada spec, sin base.
- **e2e:** `test/helpers.ts` levanta la app con `configureApp()` (la misma configuración que `main.ts`), firma tokens con un secreto de juguete, trunca la base y arma los datos mínimos de cada caso; no usa `prisma/seed.ts`.
- **Demo y ensayo:** `prisma/seed.ts` (ver `docs/seed.md`) con las cuentas de M1 (ids 10000 a 10011) y cuadrillas desde 10100.
- **Eventos:** ejemplos de `docs/eventos/` y fixtures mínimos de M2 en `test/fixtures/m2/`.
- **Sin datos personales reales** en ninguna prueba.

## 5. Criterios de entrada y de salida

**Entrada:** (1) la rama compila y pasa `npm run lint:check`; (2) CI en verde sobre el commit a etiquetar; (3) backend y frontend desplegados o levantados con el procedimiento del README; (4) seed aplicado y credenciales de prueba entregadas; (5) HU con criterios Dado/Cuando/Entonces revisados por el PO.

**Salida.** Umbrales mínimos; detalle en [`05-informe-ejecucion.md`](05-informe-ejecucion.md).

| Criterio | Umbral | Resultado | Cumple |
|---|---|---|---|
| Cobertura de líneas en dominio | ≥ 80 % | 98,71 % global (cierre 16/11; R09: 99,16 %); mínimo en `src/modules/*`: 97,82 % (`attachments` y `green-spaces`, medición anterior del 16/11) | **Sí** |
| Cobertura de ramas en dominio | ≥ 70 % | 95,28 % global (cierre 16/11; R09: 93,63 %); mínimo en `src/modules/*`: 81,57 % (`green-spaces`, medición anterior del 16/11) | **Sí** |
| Cobertura del frontend con umbral | ≥ 90 % | **PENDIENTE** (Frontend #975) | **PENDIENTE** |
| Mutation score en dominio | ≥ 60 % | 75,39 % global en los 26 archivos de dominio (CI tras el refuerzo, #617, #647; antes 71,22 %) | **Sí** |
| HU del alcance ejecutadas | 100 % | Las 33 HU tienen criterios ejecutados; quedan 4 criterios sin test automatizado, declarados con su motivo ([`03`](03-matriz-trazabilidad.md)) | **Sí**, con 4 huecos declarados |
| Criterios de aceptación pasados | ≥ 95 %, sin fallos en HU `MUST` | **171 de 175 (97,7 %)**: 161 con test del backend y 10 con test del frontend ejecutado; 0 fallados; 4 huecos (CA-HU10-2, CA-HU24-2, CA-HU33-1, CA-HU33-4). 6 de los 10 del frontend dependen del merge de FE #979 | **Sí** (con la salvedad de merge) |
| Casos negativos o de borde | ≥ 40 % | 68,1 % (261 de 383) | **Sí** |
| Defectos abiertos | 0 Bloqueantes, 0 Críticos, ≤ 3 Mayores con workaround | 0, 0 y **0 Mayores** (DEF-32 se cerró con FE #978, mergeado el 16/11); 10 Menores (DEF-29 a DEF-31 y DEF-34 a DEF-40) | **Sí** |
| Tests flaky | 0 (3 corridas idénticas) | Backend: 3 corridas idénticas en local y en el CI. Frontend: 3 corridas locales idénticas con FE #980; 3 corridas en el CI **PENDIENTES** | **Sí** en el Backend; **Parcial** en el Frontend |
| Pipeline | ≤ 15 min | 3 min 7 s (CI de `develop` @ `50cfff7` del 16/11, [run 43908234945](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/43908234945)); 3 min 5 s en `main` con `sonar` y `trivy` | **Sí** |
| Arranque con un comando (G1) | Sistema usable con un `docker compose up` | Login de punta a punta a los 149 s (`g1-arranque.yml`) | **Sí** |
| Secretos en el historial (G6) | 0 | gitleaks por defecto 0 y trufflehog 0 verificadas, en los dos repos | **Sí** |
| Escenarios críticos E2E en el pipeline | ≥ 5 | El job `e2e` corre las 24 suites de `test/` en cada PR y es check obligatorio | **Sí** |
| Quality Gate (SonarCloud) | 0 bugs Blocker o Critical, 0 vulnerabilidades, duplicación ≤ 3 %, ratings A, 100 % de hotspots | Gate **OK** sobre `main` (16/11): 0 bugs, 0 vulnerabilidades, duplicación 1,2 %, ratings A/A/A, hotspots 100 %. **Bloqueante y requerido** desde #700 | **Sí** |
| ZAP: baseline y activo autenticado | 0 alertas High, cada Medium justificada | 0 High en los dos; 1 Medium en cada uno, justificadas en [`07`](07-informe-seguridad.md) 5.2 ([run 43788946357](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/43788946357)) | **Sí** |
| Dependencias (Trivy y `npm audit`) | 0 CVE críticas o altas sin mitigación documentada | 0 HIGH/CRITICAL en `fs`, `image` y `config`; `npm audit --omit=dev` en 0; `.trivyignore` vacío | **Sí** |
| Carga: 50 usuarios, 5 min | p95 < 500 ms, error < 1 % | p95 32,84 ms y 0,00 % en local; también corrida contra el despliegue y con escrituras | **Sí** |

Si un criterio no se cumple al cierre, se declara en `05-informe-ejecucion.md` con el motivo; no se omite.

## 6. Riesgos priorizados

Escala: probabilidad (P) e impacto (I) de 1 a 3; prioridad = P × I. Se listan los de prioridad 4 o más. La numeración no se reutiliza.

| ID | Riesgo | P | I | Prio. | Cobertura por pruebas |
|---|---|---|---|---|---|
| R2 | El Core o un externo no responde: el cliente al Core espera 5 s (antes 10 s) y no hay circuit breaker | 2 | 2 | 4 | **Parcial.** `core.client.spec.ts` (error de red y timeout sin filtrar el secreto); ningún test dispara un timeout real. DEF-15 se corrigió con [#642](https://github.com/hllous/Backend-M6-DAPS2/issues/642): el corte al Core pasó a 5 s. Lo espera un usuario solo al dar de alta o editar una cuadrilla, o al sumarle integrantes, sin token de módulo en caché |
| R3 | M1 devuelve 401: el secreto de firma de Render no coincide con el de M1, o el token no trae los claims esperados | 3 | 3 | 9 | **Parcial.** `jwt.strategy.spec.ts` y `auth-roles.e2e-spec`; la coincidencia del secreto en Render se verifica a mano con login real y `GET /me` |
| R4 | Una transición de estado inválida acepta una acción que debería dar 409 | 2 | 3 | 6 | **Cubierto.** 114 tests parametrizados (#582), `containers.service.spec.ts` (`it.each`), Stryker en `outbound-requests` |
| R5 | BOLA/BFLA: un rol o una cuadrilla ajena ejecuta lo que no le corresponde | 2 | 3 | 6 | **Cubierto.** `route-roles.spec.ts`, `auth-roles.e2e-spec`, `crew-ownership.e2e-spec`. Las lecturas por id son compartidas por diseño |
| R6 | Un mensaje duplicado se aplica dos veces | 2 | 3 | 6 | **Cubierto.** `inbox.e2e-spec`, `inbox.service.spec`, `sobre-reserializado.spec` |
| R7 | Cold start de Render o de M1 durante la demo en vivo | 3 | 3 | 9 | **Sin cobertura automática.** Mitigación: despertar `/health` antes, ensayar, plan B local con un solo `docker compose up` (G1). Con el timeout de 5 s del BFF (FE #978), Render dormido da 503 en los primeros pedidos hasta que despierta |
| R8 | Regresión de contrato con otros módulos (payload o routing key) | 2 | 3 | 6 | **Cubierto.** `openapi-contract.spec`, `payloads.spec` (ajv), el CI exige `openapi.json` al día |
| R10 | Archivo malicioso o con metadatos personales en la evidencia | 2 | 2 | 4 | **Cubierto.** `attachments.service.spec` (firma de bytes, tamaño, EXIF), `crew-ownership.e2e-spec` |
| R13 | Tests flaky o que no detectan una mutación | 2 | 2 | 4 | **Parcial.** 3 corridas idénticas en el backend; los tests inestables del frontend (DEF-29 a DEF-31) se corrigen en FE #980 (3 corridas en el CI pendientes); Stryker en los 26 archivos de dominio (75,39 % en CI), 21 sin reforzar; un test intermitente de `openapi-contract.spec.ts` corregido (P-3); DEF-24 cerrado sin causa confirmada |
| R14 | Dependencia con vulnerabilidad conocida | 2 | 2 | 4 | **Cubierto.** `npm audit fix` (#566), `overrides` (#619) y NestJS 12 (#628): 0 vulnerabilidades en producción; job `audit` gate y Dependabot (#578); Trivy `fs`, `image` y `config` (#658) con 0 HIGH/CRITICAL; la imagen traía 6 HIGH del `npm` embebido y corría como root (DEF-26, corregido en #670) |
| R17 | El primer `docker compose up` en frío falla | 2 | 2 | 4 | **Cubierto.** Falló una vez (DEF-23) y se corrigió en #584; desde el 16/11 el CI levanta el sistema completo desde cero en los PR que tocan el arranque, en cada push a `main` y a demanda (`g1-arranque.yml`, #699) |
| R21 | Un cliente sin `If-Match` o sin parser de `application/problem+json` pierde la protección o rompe al leer errores | 2 | 2 | 4 | **Cubierto.** Backend cubierto (`etag-if-match`, `problem-details`); el parser del frontend se adaptó en [Frontend #898](https://github.com/hllous/Frontend-M6-DAPS2/issues/898) y el `If-Match` con FE #978 (DEF-32, cerrado el 16/11) |

R3 y R7 son los de mayor prioridad y se mitigan principalmente con ensayo previo, no con pruebas automáticas.

## 7. Roles

| Persona | Rol Scrum | Responsabilidad en la prueba |
|---|---|---|
| Santiago Tomas Peralta | QA y UX/UI | QA responsable: conduce la presentación y es dueño de la matriz y el informe |
| Facundo Iriarte | Product Owner | Valida HU, criterios de aceptación y prioridad MoSCoW |
| Miqueas Quintieri | Scrum Master | Ceremonias, impedimentos y seguimiento del calendario |
| Benjamin Martinez | Dev Backend | Pruebas del backend, correcciones, seguridad |
| Nicolas Facundo Llousas | Dev Frontend | Pruebas del frontend, E2E, accesibilidad |
| Bautista Castro | DevOps | CI, despliegues, build reproducible, escaneos |

Cualquier integrante puede responder sobre cualquier test o defecto.

## 8. Herramientas

| Uso | Herramienta | Estado |
|---|---|---|
| Unitarios y cobertura (backend) | Vitest (Jest hasta #628) | En uso |
| e2e de API | Vitest + supertest + Postgres 16 | En uso |
| Unitarios (frontend) | Vitest | En uso |
| E2E de navegador y accesibilidad | Playwright + axe | En uso |
| Análisis estático | ESLint, `tsc`, **SonarCloud** (job `sonar`, #657) | En uso: ESLint 0 errores y 343 warnings (`npm run lint:check`, 16/11); SonarCloud con gate OK y ratings A/A/A, **bloqueante y requerido** desde #700 |
| Contrato OpenAPI | `openapi:generate` + `git diff` en CI, Schemathesis | En uso (solo `GET`; pasos bloqueantes desde #593) |
| API | Newman (colección en `test/api/`) y `npm run api:coverage` | En uso, en el CI (#583, #702) |
| Contrato de eventos | ajv contra `.schema.json` | En uso |
| Mutation testing | Stryker + `@stryker-mutator/vitest-runner` | En uso sobre los servicios, transiciones y sweepers de `src/modules` (#577, #617) |
| Carga | k6 | En uso (#585) |
| Seguridad | `npm audit`, Dependabot, CodeQL, gitleaks (con nuestra configuración y **por defecto**), **trufflehog**, **Trivy** (job `trivy`, #658), **OWASP ZAP** (workflow `dast`, #659), `security-live` (#701) | En uso. Trivy frena el deploy sobre HIGH/CRITICAL con fix; ZAP falla ante un High; el activo corre solo contra el entorno efímero |
| Gestión de casos y defectos | GitHub Issues y tablero de Trello (reemplazan a Jira) | En uso |
| Generación de documentos | Markdown + `md-to-pdf` (`npm run qa:pdf`) | En uso |

## 9. Hitos

| Fecha | Hito |
|---|---|
| Mar 10/11 antes de 13:30 | Entrega en Teams: PDF de QA y enlaces (tag `v1.0-testing` ya creado en backend y frontend) |
| Mar 10/11 | Prueba del sistema (Clase 15) |
| Lun 16/11 | Cierre de la documentación de QA de la Entrega 4 (este documento) |
| Mar 17/11 | 4.ª Entrega Parcial Obligatoria (prueba en vivo sobre un tag de `main`) |
| Mar 24/11 | Recuperatorio |

## 10. Documentos relacionados

[`02`](02-historias-y-criterios.md) (HU), [`03`](03-matriz-trazabilidad.md), [`04`](04-especificacion-casos.md), [`05`](05-informe-ejecucion.md), [`06`](06-registro-defectos.md), [`07`](07-informe-seguridad.md) y [`08`](08-lecciones-aprendidas.md). Fuentes técnicas: `docs/testing.md`, `docs/gestion/definition-of-done.md`, `.github/workflows/ci.yml`.
