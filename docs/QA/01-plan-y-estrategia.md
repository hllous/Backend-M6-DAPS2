# Plan y estrategia de pruebas

> Entregable 1 de los criterios de testing de la cátedra (estructura de ISO/IEC/IEEE 29119-3). Módulo 6 «Ambiente e Higiene», Grupo 04, Desarrollo de Aplicaciones II, 2.º C 2026. Versión del 03/11/2026, actualizada el 08/11/2026 y **el 09/11/2026** sobre `develop` @ `142e1a3` (cifras en `05-informe-ejecucion.md`; **R09** es la corrida local del 09/11 y **R08** la del 08/11, histórica). Todo lo que aparece como «pendiente», «no hecho» o «sin cobertura» es lo que **hoy** no existe; no se presenta como hecho.

## 1. Objetivo y alcance

**Objetivo.** Demostrar, con evidencia ejecutada, que el módulo cumple las historias de usuario comprometidas (HU-01 a HU-33, ver `02-historias-y-criterios.md`), que integra con el resto de la plataforma por eventos y que respeta los criterios de seguridad de la Clase 11.

**Sistema bajo prueba.** Dos repositorios, un sistema:

| Pieza | Repositorio | Stack | Despliegue |
|---|---|---|---|
| Backend REST + eventos (outbox/inbox) | `hllous/Backend-M6-DAPS2` | NestJS, Prisma, PostgreSQL, RabbitMQ (bus del Core de M9) | Render + Supabase |
| Frontend web + BFF | `hllous/Frontend-M6-DAPS2` | Next.js, React, Tailwind | Vercel |

**Dentro del alcance.** Todas las HU del release R2 y del MVP del tablero «M6 - Product Backlog & Story Map» (Trello): catálogos y recursos, programación y ejecución de servicios, inventario urbano (contenedores, arbolado, espacios verdes), control ambiental (denuncia → inspección → acta → sanción), integración por eventos con M1, M2, M3, M4, M7 y M9, seguimiento ciudadano sin login, indicadores, roles y seguridad.

**Fuera del alcance.**

| Ítem | Motivo |
|---|---|
| Alta del reclamo del vecino dentro de M6 | HU `WON'T`: el reclamo se recibe en M2 |
| Cobro y gestión de multas | HU `WON'T`: la sanción la decide M4 |
| App mobile nativa para cuadrillas | HU `WON'T`: Campo usa la web responsive |
| SOAP / WSDL, XXE en canal SOAP | **No aplica**: el módulo es REST/JSON más RabbitMQ; no expone ni consume SOAP |
| Funcionalidad de IA dentro del sistema | No existe; el punto 8.3 de los criterios no aplica (ver la declaración de IA entregada en la Clase 14) |
| Pruebas internas de M1, M2, M3, M4, M7, M9 | Son de cada grupo; acá se prueba el contrato con ellos |
| Hash de contraseñas, login y fuerza bruta | El JWT lo emite M1 (ADR-004); M6 no guarda contraseñas |

Cualquier reducción de alcance después del 03/11 requiere acuerdo escrito con la cátedra.

## 2. Niveles de prueba

| Nivel | Qué cubre | Qué existe hoy | Qué falta |
|---|---|---|---|
| **Unitario** (backend) | Reglas de negocio de cada service con Prisma mockeado | 124 suites (123 corren y 1 se saltea); R09: 2808 tests pasan, 12 saltados (paquete de M2), 0 fallan; cobertura 98,58 % sentencias, 93,63 % ramas, 98,07 % funciones y 99,16 % líneas; umbral de 85 % global y, además, por archivo en 7 servicios críticos (`jest.coverageThreshold`); corre en el job `test` del CI. Incluye 114 tests de transiciones inválidas (#582) y los specs de ETag, `If-Match`, `Idempotency-Key` y Problem Details (#597) | Algunos tests prueban llamadas a mocks más que comportamiento; aserción débil en `services.service.spec.ts:875` sin corregir |
| **Mutation testing** | Que los tests detecten un cambio en el código | Stryker (#577) sobre `outbound-requests.transitions.ts` y `street-closure-expiry.sweeper.ts`: **84,21 % total** (transiciones 100 %; sweeper 100 % tras 2 aserciones, re-medido solo el sweeper); workflow `mutation.yml` manual o semanal | Medición del dominio completo: **no hecha** |
| **Unitario** (frontend) | Componentes y lógica de `src/lib` | Vitest en el job de lint y tests del CI | Sin configuración de cobertura ni umbral |
| **Integración / e2e** (backend) | App completa contra Postgres real: auth, `ValidationPipe`, máquinas de estado, outbox e inbox, rollback, rate limiting, seguridad de entrada, errores, ETag e idempotencia | 24 suites en `test/` contra `postgres:16` (R09: 343 tests pasan y 4 se saltean, 2 corridas idénticas; incluye `rabbitmq-real`, que se saltea en local sin broker) y `rabbitmq-real` contra **RabbitMQ real** en el CI (R08, local: 4 tests, 3 corridas idénticas); ambos en el job `e2e` del CI (**no** es check obligatorio de rama); guard que impide apuntar a una base no local | Testcontainers; publicación del outbox contra un broker real; el broker apagado de verdad; repetir la suite 3 veces en el CI |
| **E2E de usuario** (frontend) | Flujos de punta a punta en navegador | 58 specs Playwright en 10 shards en el CI (al 07/11, contra el `develop` del frontend; el 03/11 eran 53 en 3 shards) | Viewports 360 y 768 px (hoy 390 y 1280) |
| **Contrato** | Respuestas contra OpenAPI; payloads de eventos contra sus `.schema.json` | `openapi-contract.spec.ts` (7 tests, incluidos «toda respuesta de error es `application/problem+json`» y «todo `GET` con parámetros declara el 400»), `payloads.spec.ts` (ajv), CI exige `docs/api/openapi.json` al día; **Schemathesis** (#583, solo `GET`): R09 local, 4388 casos de esquema y errores de servidor pasan, y `status_code_conformance` (**bloqueante desde #593**) sale con exit 0 (4384 casos, 3913 pasan, 471 salteados) | Specs contra el paquete de M2 se saltean en CI (DEF-11); Schemathesis sobre las escrituras |
| **API** | Cada endpoint con un caso de éxito y uno de error | **Colección Newman** versionada (`test/api/`, #583): R09 local, 455 requests ejecutados (435 definidos), 763 assertions, 0 fallidas, en el CI. Éxito en 61 de 152 operaciones; error en las 152 | Éxito en los 91 restantes (`test/api/PENDIENTES.md`) |
| **Estado (transiciones)** | Toda transición inválida devuelve 409; un ETag desactualizado devuelve 412 | `assertTransition` con tablas por entidad; 114 tests parametrizados (#582) en servicios, reparaciones y cortes e intervenciones de arbolado; `it.each` en contenedores y expedientes; e2e `services-lifecycle`; `test/etag-if-match.e2e-spec.ts` (12 tests, con concurrencia real `[200, 412]`) | `If-Match` solo en transiciones de 4 recursos y en 2 `PATCH` (ADR-012) |
| **Idempotencia de altas** | Reintento de un `POST` de creación con la misma `Idempotency-Key` | `idempotency.interceptor.spec.ts` y `test/idempotency.e2e-spec.ts` (8 tests; 21 `POST`) | El guardado de la respuesta no es atómico con la transacción de dominio (ADR-013): sin test de caída entre ambos pasos |
| **Resiliencia** | Duplicados, reintentos, rollback, caída de broker | `inbox.e2e-spec`, `outbox-retry.e2e-spec`, `containers-close.e2e-spec` (rollback); `rabbitmq-real` (duplicado, inválido y **reconexión cortando conexiones del broker**, #579) | Apagar el broker de verdad (solo demo en vivo); timeout del Core contra un fetch colgado |
| **Seguridad** | BOLA/BFLA, JWT, mass assignment, adjuntos, SQL/XSS, límites | `auth-roles`, `crew-ownership` e2e; `route-roles.spec`; `jwt.strategy.spec`; `security-headers.middleware.spec`; `security-input.e2e-spec` (SQL/XSS, mass assignment, 413, CSP: 18 tests, #581); `throttler.e2e-spec` (429, #580); `redact-url.spec` (logs sin token); SCA `npm audit` informativo y Dependabot (#578); gitleaks en el CI sobre todo el historial; CodeQL | **ZAP y Trivy: no hechos**; resultado de las alertas de CodeQL no revisado |
| **No funcional** (carga) | 50 usuarios, 5 min, p95 < 500 ms | Script k6 `test/perf/k6-criticos.js` (#585) y **corrida del 09/11 (#574)**: p(95) 32,84 ms y 0,00 % de error en 14 850 requests (`test/perf/resultados/2026-11-09/`) | **Solo local** (backend, base, broker y k6 en la misma máquina, con `THROTTLE_LIMIT` subido) y solo lecturas: no se midió el despliegue en Render y Supabase ni las escrituras |
| **Arranque local** | `docker compose up` en frío | Compose con `.env` obligatorio y stack `modulo-6-ambiente` (#584); R09: up en 46 s, `/health/ready` 200 a los 55 s, seed OK, `GET /neighborhoods` 200 con el catálogo local (R08: 35 s y 45 s) | No corre en el CI; frontend fuera del compose (#560) |
| **Accesibilidad** (frontend) | WCAG 2.2 AA | `accessibility.spec.ts` con axe en el CI | Lighthouse (la etiqueta `wcag22aa` ya está en los specs de axe) |

## 3. Entornos

| Entorno | Para qué | Datos | Notas |
|---|---|---|---|
| **Local** | Desarrollo y corrida de unitarios y e2e | `npm run prisma:seed` para demo; los e2e arman datos por caso con `test/helpers.ts` | Los e2e **truncan** las tablas: usar una base descartable (`docs/testing.md`) |
| **Local con `docker compose`** | Levantar base, broker y backend con un comando (`docker compose up -d --build`); stack **`modulo-6-ambiente`** | `docker compose --profile seed run --rm seed` para los datos de demo; credenciales en `.env` (`cp .env.example .env`; el arranque corta si faltan) | Postgres y RabbitMQ publicados solo en `127.0.0.1`; el backend publica `3000:3000`. El frontend **no** está en el compose (#560) |
| **CI (GitHub Actions)** | `build` (docs:check, build, lint, OpenAPI al día), `test` (cobertura), `e2e` (Postgres 16 y RabbitMQ como `services:`), `secrets` (gitleaks), `audit` (`npm audit`, informativo); workflows `API tests` (Newman y Schemathesis), `CodeQL Advanced` y `Mutation testing` (manual o semanal) | Postgres 16 y RabbitMQ 3 como `services:` | Los jobs `build` y `test` son los únicos checks obligatorios de la protección de ramas (`.github/branch-protection-rules.json`); `e2e` corre y pasa pero no bloquea (DEF-14). Los jobs de `ci.yml` tienen `timeout-minutes` |
| **Render + Supabase** (backend) | Entorno desplegado de la demo | Seed de demo | El plan gratuito se duerme: ver riesgo R7 |
| **Vercel** (frontend) | Entorno desplegado de la demo | Contra el backend de Render | |
| **Core de M9** | Bus real (`muni.inbox`, cola `q.ambiente`) | Eventos ficticios con `eventId` nuevos | Compartido por todos los grupos: avisar antes de publicar |
| **M1 (Identidad)** | Login real y JWT | Cuentas de empleado de M1 | El secreto de firma en Render debe coincidir con el de M1 |

## 4. Datos de prueba

- **Unitarios:** objetos construidos en cada spec, sin base.
- **e2e:** `test/helpers.ts` levanta la app con `configureApp()` (la misma configuración que `main.ts`), firma tokens con un secreto de juguete, trunca la base y arma los datos mínimos de cada caso. No se usa `prisma/seed.ts` para no atar los tests a un escenario de demo.
- **Demo y ensayo:** `prisma/seed.ts` (documentado en `docs/seed.md`) con las cuentas de M1 (ids 10000 a 10011) y cuadrillas desde 10100.
- **Eventos:** ejemplos de `docs/eventos/` y, en local, el paquete de M2 v1.78 (no versionado).
- **Sin datos personales reales** en ninguna prueba.

## 5. Criterios de entrada y de salida

**Entrada (para ejecutar la campaña de la prueba):**

1. La rama a probar compila (`npm run build`) y pasa `npm run lint:check`.
2. El CI en verde sobre el commit a etiquetar.
3. Backend y frontend desplegados, o levantados localmente con el procedimiento del README.
4. Seed aplicado y credenciales de prueba entregadas por el equipo.
5. HU con criterios Dado/Cuando/Entonces revisados por el PO.

**Salida (para dar la campaña por cerrada).** Se usan los umbrales de la cátedra; son mínimos. Estado medido el 09/11 (detalle en [`05-informe-ejecucion.md`](05-informe-ejecucion.md)):

| Criterio | Umbral | Resultado al 09/11 | Cumple |
|---|---|---|---|
| Cobertura de líneas en dominio | ≥ 80 % (el proyecto exige 85 % global y por archivo en 7 servicios críticos) | 99,16 % global; mínimo en `src/modules/*`: 95,77 % | **Sí** |
| Cobertura de ramas en dominio | ≥ 70 % (el proyecto exige 85 %) | 93,63 % global; mínimo en `src/modules/*`: 82,92 % | **Sí** |
| Mutation score en dominio | ≥ 60 % | 84,21 % medido solo en `outbound-requests`; el dominio completo no se midió | **Parcial** |
| HU del alcance ejecutadas | 100 % | Las HU con test del backend se ejecutaron en R08; los 9 criterios solo-FE y los 6 huecos no (ver `03-matriz-trazabilidad.md`) | **Parcial** |
| Criterios de aceptación pasados | ≥ 95 %, y ninguno de una HU `MUST` puede fallar | 160 de 175 criterios con test del backend pasan; 0 fallados; los 15 restantes no se ejecutaron | **Parcial** (ninguno falló; no todos se ejecutaron) |
| Casos negativos o de borde | ≥ 40 % del total | 67,5 % (251 de 372) | **Sí** |
| Defectos abiertos | 0 Bloqueantes, 0 Críticos, ≤ 3 Mayores con workaround documentado | 0 Bloqueantes, 0 Críticos, **5 Mayores** (DEF-04, DEF-08, DEF-09, DEF-11 y DEF-13; eran 8 el 08/11) | **No** |
| Tests flaky | 0 (la suite se corre 3 veces y debe dar el mismo resultado) | 3 corridas idénticas el 08/11 en local (unitarios, e2e y RabbitMQ real); el 09/11 el e2e dio idéntico en 2 corridas y una corrida bajo carga cayó por un timeout de arranque. Falta mostrarlo en el CI; #554 figura cerrado sin PR | **Parcial** |
| Pipeline | ≤ 15 minutos | 1 min 44 s (CI de `develop`, run 42632174201) | **Sí** |
| Escenarios críticos E2E en el pipeline | ≥ 5 | El job `e2e` corre las suites de `test/` en cada PR; el conteo de «escenarios críticos» como tales: dato no disponible | **A confirmar** |
| Quality Gate (SonarCloud) | 0 bugs Blocker o Critical, 0 vulnerabilidades, duplicación ≤ 3 % | **NO HECHO** (pide un administrador de `hllous`) | **No** |
| Carga: 50 usuarios, 5 min | p95 < 500 ms, error < 1 % | p95 32,84 ms y 0,00 % de error, **medido en local y solo lecturas**; el despliegue no se midió | **Sí en local**, no verificado en el despliegue |

Si un criterio no se cumple al cierre, se declara en `05-informe-ejecucion.md` con el motivo; no se omite.

## 6. Riesgos priorizados

Escala: probabilidad (P) y impacto (I) de 1 a 3 (1 baja, 3 alta); prioridad = P × I.

| ID | Riesgo | P | I | Prio. | Cobertura por pruebas |
|---|---|---|---|---|---|
| R1 | Caída del broker de más de unos 50 s: el outbox agota `MAX_ATTEMPTS=5` y deja filas en `FAILED` sin recuperación automática | 2 | 3 | 6 | **Parcial.** `outbox-dispatcher.service.spec.ts`, `rabbitmq.publisher.spec.ts` y `test/outbox-retry.e2e-spec.ts` (FAILED → retry → SENT), con mocks. Desde el 08/11, `test/rabbitmq-real.e2e-spec.ts` prueba que el **consumer** reconecta cuando el broker corta sus conexiones; **la publicación del outbox contra un broker real y el broker apagado no tienen prueba** y `MAX_ATTEMPTS` sigue en 5 (DEF-04, abierto) |
| R2 | El Core o un externo no responde: el cliente espera 10 s (la cátedra pide 5 s) y no hay circuit breaker | 2 | 2 | 4 | **Parcial.** `core.client.spec.ts` (error de red y timeout sin filtrar el secreto); ningún test dispara un timeout real |
| R3 | M1 devuelve 401: el secreto de firma de Render no coincide con el que firma M1, o el token no trae los claims esperados | 3 | 3 | 9 | **Parcial.** `jwt.strategy.spec.ts` (firma, vencimiento, `alg`, emisor, `typ`) y `auth-roles.e2e-spec`. La coincidencia del secreto en Render **no** tiene test automático: se verifica a mano con login real y `GET /me` |
| R4 | Transición de estado inválida acepta una acción que debería dar 409 | 2 | 3 | 6 | **Cubierto.** 114 tests parametrizados (#582) sobre el complemento de las tablas de transición de servicios, reparaciones y cortes e intervenciones; `containers.service.spec.ts` (`it.each`); Stryker: transiciones de `outbound-requests` al 100 %. Las transiciones de otras entidades no se midieron con mutation |
| R5 | BOLA/BFLA: un rol o una cuadrilla ajena ejecuta lo que no le corresponde | 2 | 3 | 6 | **Cubierto.** `route-roles.spec.ts` (toda escritura declara `@Roles`), `auth-roles.e2e-spec`, `crew-ownership.e2e-spec` (propio/ajeno/sin cuadrilla, `403 NOT_ASSIGNED`). Las lecturas por id son compartidas por diseño |
| R6 | Mensaje duplicado se aplica dos veces | 2 | 3 | 6 | **Cubierto.** `inbox.e2e-spec` («descarta el mismo eventId»), `inbox.service.spec`, `sobre-reserializado.spec` |
| R7 | Cold start de Render o de M1 durante la demo en vivo | 3 | 3 | 9 | **Sin cobertura automática.** Mitigación operativa: despertar `/health` antes de empezar, ensayar, plan B local (ver `docs/testing.md`). El login muestra «El servicio de ingreso está iniciando, puede tardar hasta un minuto y medio» |
| R8 | Regresión de contrato con otros módulos (payload o routing key) | 2 | 3 | 6 | **Parcial.** `openapi-contract.spec`, `payloads.spec` (ajv), CI exige `openapi.json` al día. Los specs contra el paquete de M2 se **saltean** en CI porque el paquete no se versiona |
| R9 | Falla a mitad de una operación deja datos inconsistentes o un evento huérfano | 1 | 3 | 3 | **Cubierto en un flujo.** `containers-close.e2e-spec` (rollback, sin fila en el outbox). Los demás flujos no lo prueban |
| R10 | Archivo malicioso o con metadatos personales en la evidencia | 2 | 2 | 4 | **Cubierto.** `attachments.service.spec` (firma de bytes, tamaño, EXIF), `crew-ownership.e2e-spec` |
| R11 | Inyección o XSS almacenado en campos de texto | 1 | 3 | 3 | **Cubierto en el backend.** Prisma parametrizado, `ValidationPipe`, `NoNullCharsPipe` y `test/security-input.e2e-spec.ts` (3 payloads SQL y `<script>` en 3 recursos: se guardan como texto y la tabla sigue viva). La API **no los escapa ni los rechaza**: la defensa contra XSS en pantalla depende del frontend y no se verificó acá |
| R12 | Un e2e trunca una base real | 1 | 3 | 3 | **Cubierto.** `guard-database-url.e2e-spec` |
| R13 | Tests flaky o que no detectan una mutación | 2 | 2 | 4 | **Parcial.** Tres corridas seguidas idénticas en local el 08/11 (unitarios, e2e y RabbitMQ real); el 09/11 el e2e dio idéntico en 2 corridas, y una corrida completa bajo carga de la máquina cayó por un timeout de 30 s en el arranque de una suite. Stryker solo en `outbound-requests` (84,21 %, sin re-medir el 09/11). [#554](https://github.com/hllous/Backend-M6-DAPS2/issues/554) (e2e intermitente) figura cerrado sin PR y el código no cambió |
| R14 | Dependencia con vulnerabilidad conocida | 2 | 2 | 4 | **Parcial.** `npm audit fix` (0 críticas, 6 altas aceptadas como riesgo, 13 vulnerabilidades en producción), job `audit` informativo (no bloquea) y Dependabot (#578). Sin análisis de explotabilidad ni Trivy (DEF-08, DEF-13) |
| R15 | Degradación bajo carga | 1 | 2 | 2 | **Parcial.** Corrida k6 del 09/11 (#574): 50 usuarios, 5 min, p(95) 32,84 ms y 0,00 % de error en `GET /services`, `/containers` y `/zones`. **Solo local y solo lecturas**: el despliegue y las escrituras no se midieron; con `THROTTLE_LIMIT` subido para la prueba |
| R16 | Secreto o clave en el historial de Git | 1 | 3 | 3 | **Cubierto, con un incidente.** gitleaks v8.30.1 sobre 270 commits el 03/11: 0 hallazgos con `.gitleaks.toml`; el job `secrets` del CI lo repite sobre todo el historial en cada PR y push. El 08/11 **atrapó un secreto de juguete literal** en `api-tests.yml` (#572) antes del merge (P-1). Sin hook `pre-commit` |
| R17 | El primer `docker compose up` en frío falla y la cátedra o un compañero no puede levantar el módulo | 2 | 2 | 4 | **Cubierto a mano.** Falló el 08/11 (`rabbitmq-setup`, DEF-23) y se corrigió en #584; R08 lo probó en frío (up en 35 s, `/health/ready` 200 a los 45 s). **No hay prueba automática**: el CI no levanta el compose |
| R18 | Logs o respuestas de error con tokens o datos personales | 1 | 3 | 3 | **Cubierto.** DEF-22 (el `access_token` de la query en los logs) se corrigió en #581 con `redactUrl`; `redact-url.spec.ts` y `logging.interceptor.spec.ts` |
| R19 | Autor de git incorrecto en commits publicados (la firma de tests por integrante pierde valor) | 2 | 1 | 2 | **Sin cobertura.** Dos commits con autor `scratch <scratch@local>` (P-2), abiertos y sin reescribir. Control posible: revisar `git log --format=%an` antes del PR |
| R20 | Reintento de un alta con `Idempotency-Key` duplica el recurso si el proceso cae entre crearlo y guardar la respuesta (guardado no atómico, ADR-013) | 1 | 2 | 2 | **Parcial.** `test/idempotency.e2e-spec.ts` y `idempotency.interceptor.spec.ts` cubren replay, otro cuerpo, concurrencia y registro en curso; **no hay test de la caída entre los dos pasos**. Lo frena un `unique` de negocio donde existe (DEF-06, cerrado con esta limitación) |
| R21 | Un cliente que no manda `If-Match` o que no adapta su parser a `application/problem+json` pierde la protección o rompe al leer errores | 2 | 2 | 4 | **Parcial.** El backend está cubierto (`etag-if-match`, `problem-details`); el lado del frontend queda en el issue [Frontend #898](https://github.com/hllous/Frontend-M6-DAPS2/issues/898), abierto. `If-Match` solo cubre 4 recursos y 2 `PATCH` (DEF-05, cerrado con ese alcance) |

Propuesta del QA para R17 a R21 (P e I estimadas; el equipo las valida).

Los riesgos R3 y R7 son los de mayor prioridad y se mitigan principalmente con ensayo previo, no con pruebas automáticas.

## 7. Roles

| Persona | Rol Scrum | Responsabilidad en la prueba |
|---|---|---|
| Santiago Tomas Peralta | QA y UX/UI | QA responsable: conduce la presentación y es dueño de la matriz y el informe |
| Facundo Iriarte | Product Owner | Valida HU, criterios de aceptación y prioridad MoSCoW |
| Miqueas Quintieri | Scrum Master | Ceremonias, impedimentos y seguimiento del calendario |
| Benjamin Martinez | Dev Backend | Pruebas del backend, correcciones, seguridad |
| Nicolas Facundo Llousas | Dev Frontend | Pruebas del frontend, E2E, accesibilidad |
| Bautista Castro | DevOps | CI, despliegues, build reproducible, escaneos |

La cátedra puede interrogar a cualquier integrante sobre cualquier test o defecto.

## 8. Herramientas

| Uso | Herramienta | Estado |
|---|---|---|
| Unitarios y cobertura (backend) | Jest | En uso |
| e2e de API | Jest + supertest + Postgres 16 | En uso |
| Unitarios (frontend) | Vitest | En uso |
| E2E de navegador y accesibilidad | Playwright + axe | En uso |
| Análisis estático | ESLint, `tsc` | En uso (lint: 0 errores, 305 warnings al 09/11). **SonarCloud: NO HECHO** |
| Contrato OpenAPI | `openapi:generate` + `git diff` en CI, Schemathesis | En uso. Schemathesis solo `GET`, con los dos pasos bloqueantes desde #593 (#583, #593) |
| API | Newman (colección Postman versionada en `test/api/`) | En uso, en el CI (#583); 455 requests y 763 assertions el 09/11 |
| Contrato de eventos | ajv contra `.schema.json` | En uso |
| Mutation testing | Stryker | En uso, acotado a `outbound-requests` (#577) |
| Carga | k6 | Script (#585) y corrida del 09/11 en local (#574); **sin corrida contra el despliegue** |
| Seguridad | `npm audit` (informativo), Dependabot, CodeQL, gitleaks, ZAP baseline, Trivy | `npm audit`, Dependabot, CodeQL y gitleaks en el CI (el resultado de CodeQL no se revisó); **ZAP y Trivy: NO HECHOS** |
| Gestión de casos y defectos | GitHub Issues y tablero de Trello | En uso; la cátedra confirmó que reemplazan a Jira (G5 resuelta, ver `README.md`) |
| Generación de documentos | Markdown + `md-to-pdf` (`npm run qa:pdf`) | En uso |

## 9. Calendario hasta la prueba

| Fecha | Hito |
|---|---|
| Mar 03/11 | Auditoría contra los criterios; apertura del Issue #494; arranca Sprint 10 |
| 04/11 a 05/11 | HU con Gherkin completo, matriz de trazabilidad y especificación de casos |
| 05/11 a 06/11 | Corrida real de unitarios, e2e y cobertura; informe de ejecución y registro de defectos |
| 06/11 a 08/11 | Correcciones técnicas priorizadas (timeout, outbox, carga, transiciones, headers). **Hecho el 08/11:** transiciones, rate limiting, SQL/XSS/413/CSP, Stryker, Newman y Schemathesis, RabbitMQ real, npm audit y Dependabot, compose, script k6. **Hecho el 09/11 (PR #597):** Problem Details, ETag e `If-Match`, `Idempotency-Key`, 400 declarado, catálogo de barrios local y la corrida de k6 en local. **No hecho:** timeout de 5 s, `MAX_ATTEMPTS`, SonarCloud, ZAP, Trivy |
| Sáb 08/11 | Congelamiento de código propuesto. Corrida de medición R08 y actualización de `docs/QA/` |
| Dom 09/11 | **Parcial.** Merge de #597 a `develop` hecho (09/11 14:11 UTC) y actualización de QA en curso (#598). **Pendiente:** merge `develop → test → main`, tag `v1.0-testing` en ambos repos (**NO HECHO** al 09/11), consulta a la cátedra por Teams (cierran el 09/11) |
| **Mar 10/11 antes de 13:30** | Entrega en Teams: PDF de QA y enlaces; **tag `v1.0-testing` ya creado** |
| Mar 10/11 | Prueba del sistema (Clase 15) |
| Mar 17/11 | 4.ª Entrega Parcial Obligatoria |
| Mar 24/11 | Recuperatorio |

## 10. Documentos relacionados

`02-historias-y-criterios.md` (HU), `03-matriz-trazabilidad.md`, `04-especificacion-casos.md`, `05-informe-ejecucion.md`, `06-registro-defectos.md`, `07-informe-seguridad.md`, `09-lecciones-aprendidas.md`. Fuentes técnicas: `docs/testing.md`, `docs/gestion/definition-of-done.md`, `.github/workflows/ci.yml`.
