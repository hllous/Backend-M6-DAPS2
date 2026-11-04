# Plan y estrategia de pruebas

> Entregable 1 de los criterios de testing de la cátedra (estructura de ISO/IEC/IEEE 29119-3). Módulo 6 «Ambiente e Higiene», Grupo 04, Desarrollo de Aplicaciones II, 2.º C 2026. Estado al 03/11/2026. Todo lo que aparece como «pendiente» o «sin cobertura» es lo que **hoy** no existe; no se presenta como hecho.

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
| Funcionalidad de IA dentro del sistema | No existe; el punto 8.3 de los criterios no aplica (ver `08-declaracion-ia.md`) |
| Pruebas internas de M1, M2, M3, M4, M7, M9 | Son de cada grupo; acá se prueba el contrato con ellos |
| Hash de contraseñas, login y fuerza bruta | El JWT lo emite M1 (ADR-004); M6 no guarda contraseñas |

Cualquier reducción de alcance después del 03/11 requiere acuerdo escrito con la cátedra.

## 2. Niveles de prueba

| Nivel | Qué cubre | Qué existe hoy | Qué falta |
|---|---|---|---|
| **Unitario** (backend) | Reglas de negocio de cada service con Prisma mockeado | 108 archivos `*.spec.ts` en `src/`; `npm run test:cov`; umbral global y por archivo de 85% en `jest.coverageThreshold`; corre en el job `test` del CI | Mutation testing (Stryker); algunos tests prueban llamadas a mocks más que comportamiento |
| **Unitario** (frontend) | Componentes y lógica de `src/lib` | Vitest en el job de lint y tests del CI | Sin configuración de cobertura ni umbral |
| **Integración / e2e** (backend) | App completa contra Postgres real: auth, `ValidationPipe`, máquinas de estado, outbox e inbox, rollback | 16 suites `test/*.e2e-spec.ts` contra `postgres:16` (job `e2e` del CI, **no** es check obligatorio de rama); guard que impide apuntar a una base no local | RabbitMQ real (ninguna prueba usa el broker); Testcontainers |
| **E2E de usuario** (frontend) | Flujos de punta a punta en navegador | 53 specs Playwright en 3 shards en el CI | Viewports 360 y 768 px (hoy 390 y 1280) |
| **Contrato** | Respuestas contra OpenAPI; payloads de eventos contra sus `.schema.json` | `openapi-contract.spec.ts`, `payloads.spec.ts` (ajv), CI exige `docs/api/openapi.json` al día | Validación de respuestas reales contra el OpenAPI (Schemathesis); specs contra el paquete de M2 se saltean en CI |
| **API** | Cada endpoint con un caso de éxito y uno de error | Los e2e con supertest cubren los flujos principales (unos 150 handlers HTTP) | Colección versionada (Postman/Newman o Karate) y mapa endpoint → caso |
| **Estado (transiciones)** | Toda transición inválida devuelve 409 | `assertTransition` con tablas por entidad; `it.each` en contenedores, expedientes y outbound-requests; e2e `services-lifecycle` | Test que recorra todos los pares origen × destino de `ServiceStatus` |
| **Resiliencia** | Duplicados, reintentos, rollback, caída de broker | `inbox.e2e-spec`, `outbox-retry.e2e-spec`, `containers-close.e2e-spec` (rollback) | Caída real del broker; timeout del Core contra un fetch colgado |
| **Seguridad** | BOLA/BFLA, JWT, mass assignment, adjuntos | `auth-roles`, `crew-ownership` e2e; `route-roles.spec`; `jwt.strategy.spec`; `security-headers.middleware.spec` | ZAP, SCA (`npm audit`, Dependabot), escaneo de secretos en CI |
| **No funcional** (carga) | 50 usuarios, 5 min, p95 < 500 ms | Nada | Script k6 sobre 3 endpoints críticos y reporte |
| **Accesibilidad** (frontend) | WCAG 2.2 AA | `accessibility.spec.ts` con axe en el CI | Lighthouse, confirmar la etiqueta `wcag22aa` |

## 3. Entornos

| Entorno | Para qué | Datos | Notas |
|---|---|---|---|
| **Local** | Desarrollo y corrida de unitarios y e2e | `npm run prisma:seed` para demo; los e2e arman datos por caso con `test/helpers.ts` | Los e2e **truncan** las tablas: usar una base descartable (`docs/testing.md`) |
| **CI (GitHub Actions)** | `build` (docs:check, build, lint, OpenAPI al día), `test` (cobertura), `e2e` | Postgres 16 como `services:` | Los jobs `build` y `test` son checks obligatorios de la protección de ramas (`.github/branch-protection-rules.json`) |
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

**Salida (para dar la campaña por cerrada).** Se usan los umbrales de la cátedra; son mínimos:

| Criterio | Umbral |
|---|---|
| Cobertura de líneas en dominio | ≥ 80% (el proyecto exige 85% por archivo y global) |
| Cobertura de ramas en dominio | ≥ 70% (el proyecto exige 85%) |
| Mutation score en dominio | ≥ 60% (hoy no medido: ver riesgo R13) |
| HU del alcance ejecutadas | 100% |
| Criterios de aceptación pasados | ≥ 95%, y **ninguno** de una HU `MUST` puede fallar |
| Casos negativos o de borde | ≥ 40% del total de casos |
| Defectos abiertos | 0 Bloqueantes, 0 Críticos, ≤ 3 Mayores con workaround documentado |
| Tests flaky | 0 (la suite se corre 3 veces y debe dar el mismo resultado) |
| Pipeline | ≤ 15 minutos |
| Escenarios críticos E2E en el pipeline | ≥ 5 |

Si un criterio no se cumple al cierre, se declara en `05-informe-ejecucion.md` con el motivo; no se omite.

## 6. Riesgos priorizados

Escala: probabilidad (P) y impacto (I) de 1 a 3 (1 baja, 3 alta); prioridad = P × I.

| ID | Riesgo | P | I | Prio. | Cobertura por pruebas |
|---|---|---|---|---|---|
| R1 | Caída del broker de más de unos 50 s: el outbox agota `MAX_ATTEMPTS=5` y deja filas en `FAILED` sin recuperación automática | 2 | 3 | 6 | **Parcial.** `outbox-dispatcher.service.spec.ts`, `rabbitmq.publisher.spec.ts` y `test/outbox-retry.e2e-spec.ts` (FAILED → retry → SENT), todo con mocks. Sin prueba contra un RabbitMQ real |
| R2 | El Core o un externo no responde: el cliente espera 10 s (la cátedra pide 5 s) y no hay circuit breaker | 2 | 2 | 4 | **Parcial.** `core.client.spec.ts` (error de red y timeout sin filtrar el secreto); ningún test dispara un timeout real |
| R3 | M1 devuelve 401: el secreto de firma de Render no coincide con el que firma M1, o el token no trae los claims esperados | 3 | 3 | 9 | **Parcial.** `jwt.strategy.spec.ts` (firma, vencimiento, `alg`, emisor, `typ`) y `auth-roles.e2e-spec`. La coincidencia del secreto en Render **no** tiene test automático: se verifica a mano con login real y `GET /me` |
| R4 | Transición de estado inválida acepta una acción que debería dar 409 | 2 | 3 | 6 | **Parcial.** `services.service.spec.ts`, `containers.service.spec.ts` (`it.each`), `outbound-requests.service.spec.ts`, e2e `services-lifecycle`. Sin test de la matriz completa de `ServiceStatus` |
| R5 | BOLA/BFLA: un rol o una cuadrilla ajena ejecuta lo que no le corresponde | 2 | 3 | 6 | **Cubierto.** `route-roles.spec.ts` (toda escritura declara `@Roles`), `auth-roles.e2e-spec`, `crew-ownership.e2e-spec` (propio/ajeno/sin cuadrilla, `403 NOT_ASSIGNED`). Las lecturas por id son compartidas por diseño |
| R6 | Mensaje duplicado se aplica dos veces | 2 | 3 | 6 | **Cubierto.** `inbox.e2e-spec` («descarta el mismo eventId»), `inbox.service.spec`, `sobre-reserializado.spec` |
| R7 | Cold start de Render o de M1 durante la demo en vivo | 3 | 3 | 9 | **Sin cobertura automática.** Mitigación operativa: despertar `/health` antes de empezar, ensayar, plan B local (ver `docs/testing.md`). El login muestra «El servicio de ingreso está iniciando, puede tardar hasta un minuto y medio» |
| R8 | Regresión de contrato con otros módulos (payload o routing key) | 2 | 3 | 6 | **Parcial.** `openapi-contract.spec`, `payloads.spec` (ajv), CI exige `openapi.json` al día. Los specs contra el paquete de M2 se **saltean** en CI porque el paquete no se versiona |
| R9 | Falla a mitad de una operación deja datos inconsistentes o un evento huérfano | 1 | 3 | 3 | **Cubierto en un flujo.** `containers-close.e2e-spec` (rollback, sin fila en el outbox). Los demás flujos no lo prueban |
| R10 | Archivo malicioso o con metadatos personales en la evidencia | 2 | 2 | 4 | **Cubierto.** `attachments.service.spec` (firma de bytes, tamaño, EXIF), `crew-ownership.e2e-spec` |
| R11 | Inyección o XSS almacenado en campos de texto | 1 | 3 | 3 | **Parcial.** Prisma parametrizado, `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`), `NoNullCharsPipe`; sin test con payloads `<script>` o SQL |
| R12 | Un e2e trunca una base real | 1 | 3 | 3 | **Cubierto.** `guard-database-url.e2e-spec` |
| R13 | Tests flaky o que no detectan una mutación | 2 | 2 | 4 | **Sin cobertura.** Jest avisó de un worker que no sale; no se corrió la suite tres veces ni Stryker |
| R14 | Dependencia con vulnerabilidad conocida | 2 | 2 | 4 | **Parcial.** `pnpm audit` en el CI del frontend; el backend no tiene SCA en CI |
| R15 | Degradación bajo carga | 1 | 2 | 2 | **Sin cobertura.** Sin script de carga |
| R16 | Secreto o clave en el historial de Git | 1 | 3 | 3 | **Cubierto.** gitleaks v8.30.1 sobre 270 commits el 03/11: 0 hallazgos con `.gitleaks.toml`; el job `secrets` del CI lo repite en cada PR y push |

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
| Análisis estático | ESLint, `tsc` | En uso. SonarCloud: pendiente |
| Contrato OpenAPI | `openapi:generate` + `git diff` en CI | En uso. Schemathesis: pendiente |
| Contrato de eventos | ajv contra `.schema.json` | En uso |
| Mutation testing | Stryker | Pendiente |
| Carga | k6 | Pendiente |
| Seguridad | `npm audit`, ZAP baseline, gitleaks | gitleaks realizado y en el CI; `npm audit` y ZAP pendientes en el CI |
| Gestión de casos y defectos | GitHub Issues y tablero de Trello | En uso (G5: ver `README.md`) |
| Generación de documentos | Markdown + `md-to-pdf` (`npm run qa:pdf`) | En uso |

## 9. Calendario hasta la prueba

| Fecha | Hito |
|---|---|
| Mar 03/11 | Auditoría contra los criterios; apertura del Issue #494; arranca Sprint 10 |
| 04/11 a 05/11 | HU con Gherkin completo, matriz de trazabilidad y especificación de casos |
| 05/11 a 06/11 | Corrida real de unitarios, e2e y cobertura; informe de ejecución y registro de defectos |
| 06/11 a 08/11 | Correcciones técnicas priorizadas (timeout, outbox, carga, transiciones, headers) |
| Sáb 08/11 | Congelamiento de código propuesto |
| Dom 09/11 | Merge `develop → test → main`, tag `v1.0-testing` en ambos repos, escaneo de secretos, consulta a la cátedra por Teams (cierran el 09/11) |
| **Mar 10/11 antes de 13:30** | Entrega en Teams: PDF de QA y enlaces; **tag `v1.0-testing` ya creado** |
| Mar 10/11 | Prueba del sistema (Clase 15) |
| Mar 17/11 | 4.ª Entrega Parcial Obligatoria |
| Mar 24/11 | Recuperatorio |

## 10. Documentos relacionados

`02-historias-y-criterios.md` (HU), `03-matriz-trazabilidad.md`, `04-especificacion-casos.md`, `05-informe-ejecucion.md`, `06-registro-defectos.md`, `07-informe-seguridad.md`, `08-declaracion-ia.md`, `09-lecciones-aprendidas.md`. Fuentes técnicas: `docs/testing.md`, `docs/gestion/definition-of-done.md`, `.github/workflows/ci.yml`.
