# 01 · Plan y estrategia de pruebas

> Versión 2.0 · 10/11/2026. Módulo 6 «Ambiente e Higiene», Grupo 04, Desarrollo de Aplicaciones II, sobre `develop` @ `142e1a3` (estructura de ISO/IEC/IEEE 29119-3). Las cifras están en [`05-informe-ejecucion.md`](05-informe-ejecucion.md); **R09** es la corrida local de medición.

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
| SOAP / WSDL, XXE | No aplica: el módulo es REST/JSON más RabbitMQ |
| Funcionalidad de IA dentro del sistema | No existe (ver la declaración de IA de la Clase 14) |
| Pruebas internas de M1, M2, M3, M4, M7, M9 | Son de cada grupo; acá se prueba el contrato con ellos |
| Hash de contraseñas, login y fuerza bruta | El JWT lo emite M1 (ADR-004); M6 no guarda contraseñas |

## 2. Niveles de prueba

| Nivel | Qué existe | Qué falta |
|---|---|---|
| **Unitario** (backend) | 124 suites; R09: 2854 tests pasan, 0 saltados, 0 fallan. Cobertura 98,58 % sentencias, 93,63 % ramas, 99,16 % líneas; umbral de 85 % global y por archivo en 7 servicios críticos. Incluye 114 tests de transiciones inválidas (#582) | Algunos tests prueban llamadas a mocks más que comportamiento; aserción débil en `services.service.spec.ts:875` |
| **Mutation testing** | Stryker sobre los 26 `*.service.ts`, `*.transitions.ts` y `*.sweeper.ts` de `src/modules` (#577, #617): score global en CI **75,39 %** (era 71,22 % antes del refuerzo); 5 archivos reforzados con tests; workflow `mutation.yml` manual o semanal. Detalle en [`05`](05-informe-ejecucion.md) §5.1 | 21 archivos sin reforzar |
| **Unitario** (frontend) | Vitest en el CI | Sin cobertura ni umbral |
| **Integración / e2e** (backend) | 24 suites en `test/` contra `postgres:16` (R09: 343 pasan, 4 saltados) y `rabbitmq-real` contra RabbitMQ real en el CI; job `e2e` del CI (**no** es check obligatorio); guard que impide apuntar a una base no local | Testcontainers; publicación del outbox contra un broker real |
| **E2E de usuario** (frontend) | 58 specs Playwright en 10 shards en el CI | Viewports 360 y 768 px (hoy 390 y 1280) |
| **Contrato** | `openapi-contract.spec.ts` (7 tests), `payloads.spec.ts` (ajv contra los `.schema.json`), el CI exige `openapi.json` al día; Schemathesis (#583, solo `GET`): 4388 casos de esquema pasan y `status_code_conformance` es bloqueante (#593) | Schemathesis sobre las escrituras |
| **API** | Colección Newman (`test/api/`, #583): 455 requests, 763 assertions, 0 fallidas, en el CI. Éxito en 61 de 152 operaciones; error en las 152 | Éxito en los 91 restantes (`test/api/PENDIENTES.md`) |
| **Estado (transiciones)** | `assertTransition` con tablas por entidad; 114 tests parametrizados (#582); e2e `services-lifecycle`; `etag-if-match` (12 tests, concurrencia real `[200, 412]`) | `If-Match` solo en 4 recursos y 2 `PATCH` (ADR-012) |
| **Idempotencia de altas** | `idempotency.interceptor.spec.ts` y `test/idempotency.e2e-spec.ts` (8 tests; 21 `POST`) | Test de caída entre crear el recurso y guardar la respuesta (ADR-013) |
| **Resiliencia** | `inbox.e2e-spec`, `outbox-retry.e2e-spec`, `containers-close.e2e-spec` (rollback); `rabbitmq-real` (duplicado, inválido y reconexión del consumer, #579) | Timeout del Core contra un fetch colgado |
| **Seguridad** | `auth-roles` y `crew-ownership` e2e; `route-roles.spec`; `jwt.strategy.spec`; `security-headers.middleware.spec`; `security-input` (SQL/XSS, mass assignment, 413, CSP; #581); `throttler` (429, #580); `redact-url.spec`; `npm audit`, Dependabot, gitleaks y CodeQL en el CI | **ZAP y Trivy**; alertas de CodeQL sin revisar |
| **Carga** (50 usuarios, 5 min, p95 < 500 ms) | k6 `test/perf/k6-criticos.js` (#585). En local: p(95) 32,84 ms y 0,00 % de error en 14 850 requests (`test/perf/resultados/2026-11-09/`). También se corrió contra el despliegue (Render y Supabase) y con escrituras | — |
| **Arranque local** | `docker compose up --build` en frío con `.env` obligatorio, stack `modulo-6-ambiente` (#584). Última corrida 11/11/2026, Windows, Node 24.22.2 en la imagen y RabbitMQ 4.4, sin imágenes, volúmenes ni caché de build (#640): build y descargas ≈ 343 s; de que arranca Postgres a `/health/ready` 200 (`database: up`, `broker: connected`), 28 s; 34 migraciones aplicadas; `rabbitmq-setup` crea exchange y cola al primer intento; seed con `--profile seed` en 126 s (incluye construir su imagen); `GET /neighborhoods` 200 con token. La corrida anterior (Node 22, con imágenes en caché) daba up en 46 s y `/health/ready` a los 55 s | No corre en el CI; el frontend no es un servicio del compose (#560) |
| **Accesibilidad** (frontend) | `accessibility.spec.ts` con axe en el CI | Lighthouse |

## 3. Entornos

| Entorno | Para qué | Notas |
|---|---|---|
| **Local** | Desarrollo, unitarios y e2e | `npm run prisma:seed` para demo; los e2e **truncan** las tablas: usar una base descartable (`docs/testing.md`) |
| **Local con `docker compose`** | Base, broker y backend con un comando (`docker compose up -d --build`) | `docker compose --profile seed run --rm seed` para el seed; credenciales en `.env` (`cp .env.example .env`; el arranque corta si faltan). Postgres y RabbitMQ solo en `127.0.0.1` |
| **CI (GitHub Actions)** | `build` (docs:check, build, lint, OpenAPI al día), `test`, `e2e`, `secrets` (gitleaks), `audit` (gate de altas y críticas); workflows `API tests`, `CodeQL Advanced` y `Mutation testing` | Solo `build` y `test` son checks obligatorios de la protección de ramas; `e2e` corre y pasa pero no bloquea (DEF-14) |
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
| Cobertura de líneas en dominio | ≥ 80 % | 99,16 % global; mínimo en `src/modules/*`: 95,77 % | **Sí** |
| Cobertura de ramas en dominio | ≥ 70 % | 93,63 % global; mínimo en `src/modules/*`: 82,92 % | **Sí** |
| Mutation score en dominio | ≥ 60 % | 75,39 % global en los 26 archivos de dominio (CI tras el refuerzo, #617, #647; antes 71,22 %) | **Sí** |
| HU del alcance ejecutadas | 100 % | Las HU con test del backend sí; 9 criterios solo-FE y 5 huecos no ([`03`](03-matriz-trazabilidad.md)) | **Parcial** |
| Criterios de aceptación pasados | ≥ 95 %, sin fallos en HU `MUST` | 161 de 175 con test del backend pasan; 0 fallados; 14 sin ejecutar | **Parcial** |
| Casos negativos o de borde | ≥ 40 % | 67,5 % (251 de 372) | **Sí** |
| Defectos abiertos | 0 Bloqueantes, 0 Críticos, ≤ 3 Mayores con workaround | 0, 0 y **1 Mayor** (DEF-13, parcial: ZAP y Trivy sin hacer) | **Sí** |
| Tests flaky | 0 (3 corridas idénticas) | 3 corridas idénticas en local y repetidas en el CI | **Sí** |
| Pipeline | ≤ 15 min | 1 min 44 s (CI de `develop`) | **Sí** |
| Escenarios críticos E2E en el pipeline | ≥ 5 | El job `e2e` corre las suites de `test/` en cada PR | **Cumple** |
| Quality Gate (SonarCloud) | 0 bugs Blocker o Critical, 0 vulnerabilidades, duplicación ≤ 3 % | **NO HECHO** (pide un administrador de `hllous`) | **No** |
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
| R7 | Cold start de Render o de M1 durante la demo en vivo | 3 | 3 | 9 | **Sin cobertura automática.** Mitigación: despertar `/health` antes, ensayar, plan B local (`docs/testing.md`) |
| R8 | Regresión de contrato con otros módulos (payload o routing key) | 2 | 3 | 6 | **Cubierto.** `openapi-contract.spec`, `payloads.spec` (ajv), el CI exige `openapi.json` al día |
| R10 | Archivo malicioso o con metadatos personales en la evidencia | 2 | 2 | 4 | **Cubierto.** `attachments.service.spec` (firma de bytes, tamaño, EXIF), `crew-ownership.e2e-spec` |
| R13 | Tests flaky o que no detectan una mutación | 2 | 2 | 4 | **Parcial.** 3 corridas idénticas; Stryker en los 26 archivos de dominio (75,39 % en CI), 21 sin reforzar; un test intermitente de `openapi-contract.spec.ts` corregido (P-3); DEF-24 cerrado sin causa confirmada |
| R14 | Dependencia con vulnerabilidad conocida | 2 | 2 | 4 | **Parcial.** `npm audit fix` (#566), `overrides` (#619) y NestJS 12 (#628): 0 vulnerabilidades en producción; job `audit` gate, Dependabot (#578); sin Trivy (DEF-13) |
| R17 | El primer `docker compose up` en frío falla | 2 | 2 | 4 | **Cubierto a mano.** Falló una vez (DEF-23) y se corrigió en #584; el CI no levanta el compose |
| R21 | Un cliente sin `If-Match` o sin parser de `application/problem+json` pierde la protección o rompe al leer errores | 2 | 2 | 4 | **Parcial.** Backend cubierto (`etag-if-match`, `problem-details`); el frontend va en [Frontend #898](https://github.com/hllous/Frontend-M6-DAPS2/issues/898) |

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
| Análisis estático | ESLint, `tsc` | En uso (0 errores, 305 warnings). **SonarCloud: NO HECHO** |
| Contrato OpenAPI | `openapi:generate` + `git diff` en CI, Schemathesis | En uso (solo `GET`; pasos bloqueantes desde #593) |
| API | Newman (colección en `test/api/`) | En uso, en el CI (#583) |
| Contrato de eventos | ajv contra `.schema.json` | En uso |
| Mutation testing | Stryker + `@stryker-mutator/vitest-runner` | En uso sobre los servicios, transiciones y sweepers de `src/modules` (#577, #617) |
| Carga | k6 | En uso (#585) |
| Seguridad | `npm audit`, Dependabot, CodeQL, gitleaks | En el CI; **ZAP y Trivy: NO HECHOS** |
| Gestión de casos y defectos | GitHub Issues y tablero de Trello (reemplazan a Jira) | En uso |
| Generación de documentos | Markdown + `md-to-pdf` (`npm run qa:pdf`) | En uso |

## 9. Hitos

| Fecha | Hito |
|---|---|
| Mar 10/11 antes de 13:30 | Entrega en Teams: PDF de QA y enlaces (tag `v1.0-testing` ya creado en backend y frontend) |
| Mar 10/11 | Prueba del sistema (Clase 15) |
| Mar 17/11 | 4.ª Entrega Parcial Obligatoria |
| Mar 24/11 | Recuperatorio |

## 10. Documentos relacionados

[`02`](02-historias-y-criterios.md) (HU), [`03`](03-matriz-trazabilidad.md), [`04`](04-especificacion-casos.md), [`05`](05-informe-ejecucion.md), [`06`](06-registro-defectos.md), [`07`](07-informe-seguridad.md) y [`08`](08-lecciones-aprendidas.md). Fuentes técnicas: `docs/testing.md`, `docs/gestion/definition-of-done.md`, `.github/workflows/ci.yml`.
