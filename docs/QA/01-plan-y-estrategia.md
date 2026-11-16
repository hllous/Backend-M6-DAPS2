# 01 · Plan y estrategia de pruebas

> Versión 2.2 · 16/11/2026

Módulo 6 «Ambiente e Higiene», Grupo 04, Desarrollo de Aplicaciones II (estructura de ISO/IEC/IEEE 29119-3). Las cifras están en [`05-informe-ejecucion.md`](05-informe-ejecucion.md).

## 1. Objetivo y alcance

**Objetivo.** Demostrar, con evidencia ejecutada, que el módulo cumple las historias de usuario comprometidas (HU-01 a HU-33, ver [`02`](02-historias-y-criterios.md)), que integra con el resto de la plataforma por eventos y que respeta los criterios de seguridad de la Clase 11.

**Sistema bajo prueba.**

| Pieza | Repositorio | Stack | Despliegue |
|---|---|---|---|
| Backend REST + eventos (outbox/inbox) | `hllous/Backend-M6-DAPS2` | NestJS, Prisma, PostgreSQL, RabbitMQ (bus del Core de M9) | Render + Supabase |
| Frontend web + BFF | `hllous/Frontend-M6-DAPS2` | Next.js, React, Tailwind | Vercel |

**Dentro del alcance.** Todas las HU del release R2 y del MVP: catálogos y recursos, programación y ejecución de servicios, inventario urbano (contenedores, arbolado, espacios verdes), control ambiental (denuncia, inspección, acta, sanción), integración por eventos con M1, M2, M3, M4, M7 y M9, seguimiento ciudadano sin login, indicadores, roles y seguridad.

**Fuera del alcance.**

| Ítem | Motivo |
|---|---|
| Alta del reclamo del vecino dentro de M6 | HU `WON'T`: el reclamo se recibe en M2 |
| Cobro y gestión de multas | HU `WON'T`: la sanción la decide M4 |
| App mobile nativa para cuadrillas | HU `WON'T`: Campo usa la web responsive |
| SOAP / WSDL | No aplica: el módulo es REST/JSON más RabbitMQ |
| XXE | No aplica: M6 no recibe ni procesa XML |
| IA integrada | No aplica: el sistema no incluye funcionalidad de IA |
| Pruebas internas de M1, M2, M3, M4, M7 y M9 | Son de cada grupo; acá se prueba el contrato con ellos |
| Login y hash de contraseñas en el backend | El JWT lo emite M1 (ADR-004); M6 no guarda contraseñas. La fuerza bruta sobre el login del BFF sí se prueba (FE #977, ver [`07`](07-informe-seguridad.md)) |

## 2. Niveles de prueba

| Nivel | Qué existe |
|---|---|
| **Unitario** (backend) | 131 suites, 3056 tests; cobertura de 98,71 % de líneas y 95,28 % de ramas; umbral de 90 % global y por archivo en 7 servicios críticos. Incluye 114 tests de transiciones inválidas |
| **Mutation testing** | Stryker sobre los 26 `*.service.ts`, `*.transitions.ts` y `*.sweeper.ts` de `src/modules`: score 76,11 %; workflow `mutation.yml` |
| **Unitario** (frontend) | Vitest en el CI; cobertura de 90,20 % de sentencias y 93,03 % de líneas con umbral exigido en el CI (FE #985). Mutation del frontend: **PENDIENTE** (en curso) |
| **Integración / e2e** (backend) | 25 suites y 410 tests en `test/` contra `postgres:16`, más 2 suites y 8 tests de RabbitMQ real; job `e2e` del CI; guard que impide apuntar a una base no local |
| **E2E de usuario** (frontend) | Playwright en shards en el CI, con `retries: 0` (FE #980); los 10 criterios solo-FE tienen test ejecutado (FE #979) |
| **Contrato** | `openapi-contract.spec.ts` (7 tests), `payloads.spec.ts` (ajv contra los `.schema.json`), `openapi.json` al día en el CI; Schemathesis solo `GET`: 4681 casos de esquema y `status_code_conformance` bloqueante |
| **API** | Colección Newman (`test/api/`): 570 requests y 1015 assertions en el CI; éxito en 151 de 152 operaciones y error en 149 de 152, con excepciones en `test/api/PENDIENTES.md`; `npm run api:coverage` falla si una operación queda sin caso ni excepción |
| **Estado** | `assertTransition` con tablas por entidad; 114 tests parametrizados; e2e `services-lifecycle`; `etag-if-match` (concurrencia real `[200, 412]`) |
| **Idempotencia** | `idempotency.interceptor.spec.ts` y `test/idempotency.e2e-spec.ts` (21 `POST`) |
| **Resiliencia** | `inbox`, `outbox-retry` y `containers-close` (rollback) e2e; `rabbitmq-real` (duplicado, inválido, reconexión y publicación del outbox) |
| **Seguridad** | `auth-roles`, `crew-ownership`, `security-input`, `security-live` y `throttler` e2e; `route-roles`, `jwt.strategy` y `security-headers` unitarios; `npm audit`, Dependabot, gitleaks, CodeQL, Trivy, ZAP baseline y activo, SonarCloud |
| **Carga** (50 usuarios, 5 min, p95 < 500 ms) | k6 `test/perf/k6-criticos.js`: p(95) 32,84 ms, 0,00 % de error |
| **Arranque local** | `docker compose up --build` sin `.env`: base, broker, backend, seed, M1 falso y frontend; workflow `g1-arranque.yml` falla si del comando al login pasan más de 15 minutos |
| **Accesibilidad y responsive** (frontend) | `accessibility.spec.ts` con axe en el CI: 21 pantallas a 360, 768 y 1280 px con 0 violaciones y sin scroll horizontal; Lighthouse accesibilidad 100 en 7 pantallas ([`05`](05-informe-ejecucion.md), sección 9.1) |

## 3. Entornos

| Entorno | Para qué | Notas |
|---|---|---|
| **Local** | Desarrollo, unitarios y e2e | `npm run prisma:seed` para demo; los e2e truncan las tablas: base descartable (`docs/testing.md`) |
| **Local con `docker compose`** | Sistema completo con un comando | El seed corre solo; sin `.env` usa valores de ejemplo. Postgres y RabbitMQ solo en `127.0.0.1` |
| **CI (GitHub Actions)** | `build`, `test`, `sonar`, `e2e`, `secrets`, `secrets-default`, `audit`, `trivy` y `deploy`; workflows `API tests`, `CodeQL Advanced`, `Mutation testing`, `dast`, `g1-arranque` y `Cerrar issues al integrar` | Son checks obligatorios `build`, `test`, `e2e`, `sonar` y `secrets`. `audit` y `trivy` frenan el deploy; `sonar` falla el job si el gate da rojo |
| **Entorno efímero de ZAP** | `docker compose` dentro del job `dast` (base y broker descartables, seed de demo), solo para el escaneo activo | Nunca contra Render: escribe datos y publicaría al bus del Core |
| **Render + Supabase** | Backend desplegado de la demo | El plan gratuito se duerme (R7) |
| **Vercel** | Frontend desplegado de la demo | Contra el backend de Render |
| **Core de M9** | Bus real (`muni.inbox`, cola `q.ambiente`) | Compartido por todos los grupos: avisar antes de publicar |
| **M1 (Identidad)** | Login real y JWT | El secreto de firma en Render debe coincidir con el de M1 |

## 4. Datos de prueba

- **Unitarios:** objetos construidos en cada spec, sin base.
- **e2e:** `test/helpers.ts` levanta la app con `configureApp()`, firma tokens con un secreto de juguete, trunca la base y arma los datos mínimos de cada caso.
- **Demo y ensayo:** `prisma/seed.ts` (ver `docs/seed.md`) con las cuentas de M1 (ids 10000 a 10011) y cuadrillas desde 10100.
- **Eventos:** ejemplos de `docs/eventos/` y fixtures de M2 en `test/fixtures/m2/`.
- Sin datos personales reales en ninguna prueba.

## 5. Criterios de entrada y de salida

**Entrada:** (1) la rama compila y pasa `npm run lint:check`; (2) CI en verde sobre el commit a etiquetar; (3) backend y frontend desplegados o levantados con el README; (4) seed aplicado y credenciales de prueba entregadas; (5) HU con criterios Dado/Cuando/Entonces revisados por el PO.

**Salida.**

| Criterio | Umbral | Resultado | Cumple |
|---|---|---|---|
| Cobertura de líneas en dominio | ≥ 80 % | 98,71 % global; 99,24 % en `src/modules` | Sí |
| Cobertura de ramas en dominio | ≥ 70 % | 95,28 % global; 95,93 % en `src/modules` | Sí |
| Mutation score en dominio | ≥ 60 % | 76,11 % | Sí |
| HU del alcance ejecutadas | 100 % | Las 33 HU tienen criterios ejecutados; quedan 4 criterios sin test automatizado ([`03`](03-matriz-trazabilidad.md)) | Sí |
| Criterios de aceptación pasados | ≥ 95 %, sin fallos en `MUST` | 177 de 181 ejecutados y pasados (97,8 %): 167 del backend y 10 del frontend; 0 fallados | Sí |
| Casos negativos o de borde | ≥ 40 % | 67,8 % (267 de 394) | Sí |
| Defectos abiertos | 0 Bloqueantes, 0 Críticos, ≤ 3 Mayores | 0, 0 y 0 Mayores; 3 Menores | Sí |
| Tests flaky | 0 (3 corridas idénticas) | Backend: 3 corridas locales y el CI idénticos. Frontend: 3 corridas locales idénticas y `retries: 0` (FE #980) | Sí |
| Pipeline | ≤ 15 min | 2 min 23 s | Sí |
| Escenarios críticos E2E en el pipeline | ≥ 5 | Job `e2e`: 25 suites y 410 tests | Sí |
| Quality Gate (SonarCloud) | Verde, 0 bugs, 0 vulnerabilidades, duplicación ≤ 3 %, ratings A, 100 % hotspots | Gate OK; 0 / 0; 1,2 %; A/A/A; 100 % | Sí |
| ZAP: baseline y activo | 0 High, cada Medium justificada | 0 High; 1 Medium en cada uno, justificadas en [`07`](07-informe-seguridad.md) | Sí |
| Dependencias (Trivy y `npm audit`) | 0 críticas o altas sin mitigación | 0 HIGH/CRITICAL; `npm audit` en 0 | Sí |
| Carga: 50 usuarios, 5 min | p95 < 500 ms, error < 1 % | p95 32,84 ms; 0,00 % | Sí |

## 6. Riesgos priorizados

Probabilidad (P) e impacto (I) de 1 a 3; prioridad = P × I. Se listan los de prioridad 4 o más. La numeración no se reutiliza.

| ID | Riesgo | P | I | Prio. | Cobertura |
|---|---|---|---|---|---|
| R2 | El Core o un externo no responde: el cliente al Core espera 5 s y no hay circuit breaker | 2 | 2 | 4 | Parcial: `core.client.spec.ts` (error de red y timeout) |
| R3 | M1 devuelve 401: el secreto de firma de Render no coincide con el de M1 o el token no trae los claims esperados | 3 | 3 | 9 | Parcial: `jwt.strategy.spec.ts` y `auth-roles.e2e-spec`; el secreto en Render se verifica con login real y `GET /me` |
| R4 | Una transición de estado inválida acepta una acción que debería dar 409 | 2 | 3 | 6 | Cubierto: 114 tests parametrizados y mutation en `outbound-requests` |
| R5 | BOLA/BFLA: un rol o una cuadrilla ajena ejecuta lo que no le corresponde | 2 | 3 | 6 | Cubierto: `route-roles.spec.ts`, `auth-roles`, `crew-ownership` y `security-live` |
| R6 | Un mensaje duplicado se aplica dos veces | 2 | 3 | 6 | Cubierto: `inbox.e2e-spec`, `inbox.service.spec`, `rabbitmq-real` |
| R7 | Cold start de Render o de M1 durante la demo | 3 | 3 | 9 | Sin prueba automática; mitigación: despertar `/health` antes, ensayar y plan B local (`docs/testing.md`) |
| R8 | Regresión de contrato con otros módulos (payload o routing key) | 2 | 3 | 6 | Cubierto: `openapi-contract.spec`, `payloads.spec` y `openapi.json` al día |
| R10 | Archivo malicioso o con metadatos personales en la evidencia | 2 | 2 | 4 | Cubierto: `attachments.service.spec` (firma de bytes, tamaño, EXIF) |
| R13 | Tests flaky o que no detectan una mutación | 2 | 2 | 4 | Parcial: 3 corridas idénticas y mutation 76,11 % en el backend; en el frontend DEF-29 a DEF-31 cerrados (FE #980) y mutation pendiente (DEF-35) |
| R14 | Dependencia con vulnerabilidad conocida | 2 | 2 | 4 | Cubierto: `npm audit` en 0, job `audit` gate, Dependabot y Trivy |
| R17 | El primer `docker compose up` en frío falla | 2 | 2 | 4 | Cubierto: `g1-arranque.yml` en el CI |
| R21 | Un cliente sin `If-Match` o sin parser de `application/problem+json` pierde la protección o rompe al leer errores | 2 | 2 | 4 | Cubierto: backend (`etag-if-match`, `problem-details`); frontend propaga `ETag` e `If-Match` (FE #973) |

R3 y R7 son los de mayor prioridad y se mitigan principalmente con ensayo previo.

## 7. Roles

| Persona | Rol Scrum | Responsabilidad en la prueba |
|---|---|---|
| Santiago Tomas Peralta | QA y UX/UI | QA responsable: dueño de la matriz y el informe |
| Facundo Iriarte | Product Owner | Valida HU, criterios de aceptación y prioridad MoSCoW |
| Miqueas Quintieri | Scrum Master | Ceremonias, impedimentos y calendario |
| Benjamin Martinez | Dev Backend | Pruebas del backend, correcciones, seguridad |
| Nicolas Facundo Llousas | Dev Frontend | Pruebas del frontend, E2E, accesibilidad |
| Bautista Castro | DevOps | CI, despliegues, build reproducible, escaneos |

## 8. Herramientas

| Uso | Herramienta |
|---|---|
| Unitarios, cobertura y e2e de API (backend) | Vitest, supertest, Postgres 16 |
| Unitarios (frontend) | Vitest |
| E2E de navegador y accesibilidad | Playwright + axe |
| Análisis estático | ESLint (0 errores, 344 warnings), `tsc`, SonarCloud |
| Contrato OpenAPI | `openapi:generate` + `git diff` en CI, Schemathesis |
| API | Newman (`test/api/`) |
| Contrato de eventos | ajv contra `.schema.json` |
| Mutation testing | Stryker + `@stryker-mutator/vitest-runner` |
| Carga | k6 |
| Seguridad | `npm audit`, Dependabot, CodeQL, gitleaks y trufflehog, Trivy, OWASP ZAP |
| Casos y defectos | GitHub Issues y tablero de Trello (reemplazan a Jira) |
| Documentos | Markdown + `md-to-pdf` (`npm run qa:pdf`) |

## 9. Documentos relacionados

[`02`](02-historias-y-criterios.md), [`03`](03-matriz-trazabilidad.md), [`04`](04-especificacion-casos.md), [`05`](05-informe-ejecucion.md), [`06`](06-registro-defectos.md), [`07`](07-informe-seguridad.md) y [`08`](08-lecciones-aprendidas.md). Fuentes técnicas: `docs/testing.md`, `docs/gestion/definition-of-done.md`, `.github/workflows/ci.yml`.
