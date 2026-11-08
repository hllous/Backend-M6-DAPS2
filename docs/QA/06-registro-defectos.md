# 06 · Registro de defectos y limitaciones conocidas

> Backend del Módulo 6 (Grupo 04). Versión original del **03/11/2026** (`develop` @ `f288d31`), recontada el 06/11. **Actualizada el 08/11/2026** sobre `develop` @ `1d600d2`: se cerraron DEF-07, DEF-22 y DEF-23, DEF-08 y DEF-13 cambiaron de estado y se sumó DEF-24. Lo cargó el QA desde GitHub Issues, `docs/bloqueantes.md`, el código y la auditoría del 03/11. Todo lo marcado como abierto se **verificó contra el código actual** antes de listarlo.

El equipo usa **GitHub Issues** (`hllous/Backend-M6-DAPS2`) y Trello en lugar de Jira; la cátedra confirmó que esa combinación reemplaza a Jira (G5 resuelta). El identificador de cada defecto es el número de Issue; si el hallazgo todavía no tiene Issue, figura como **sin issue** y se propone abrirlo.

## 1. Criterios

| Severidad | Definición de la cátedra | Máximo admitido abierto |
|---|---|---|
| Bloqueante | Impide usar el flujo principal o hace caer el sistema | 0 |
| Crítica | Pérdida o corrupción de datos, falla de seguridad explotable, HU Must incumplida | 0 |
| Mayor | Funcionalidad afectada con alternativa disponible | 3, con workaround documentado |
| Menor | Impacto bajo, visual o de texto | Sin límite, registrados |

La **prioridad** (orden de corrección) es independiente de la severidad: un hallazgo Menor puede tener prioridad alta si la cátedra lo prueba en vivo.

## 2. Resumen

| | Cantidad |
|---|---|
| Issues en el repo | 257 al 08/11 (`gh issue list --state all`), 6 abiertos: #500, #554, #560, #572, #574 y #588. Los PR de #572 y #574 (#583 y #585) ya están mergeados; sus issues siguen abiertos |
| Issues con etiqueta `bug`, `security` o `fix` | 58: 57 cerrados y 1 abierto ([#554](https://github.com/hllous/Backend-M6-DAPS2/issues/554), registrado como DEF-24). El 03/11 eran 55, todos cerrados |
| Defectos y brechas registrados | 24 (DEF-01 a DEF-24). **Abiertos: 15. Cerrados: 9** (DEF-01, DEF-02, DEF-03, DEF-07, DEF-12, DEF-16, DEF-17, DEF-22 y DEF-23) |
| Verificaciones no realizadas (no son defectos) | 15 (ver sección 5) |

| Severidad | Abiertos | Dentro del máximo de la cátedra |
|---|---|---|
| Bloqueante | 0 | Sí |
| Crítica | 0 | Sí |
| Mayor | **8** (DEF-04, DEF-05, DEF-06, DEF-08, DEF-09, DEF-10, DEF-11 y DEF-13) | **No** (máximo 3) |
| Menor | 7 (DEF-14, DEF-15, DEF-18, DEF-19, DEF-20, DEF-21 y DEF-24) | Sí |
| **Total abierto** | **15** (0 + 8 + 7) | |

**Lectura honesta:** el criterio de salida **no se cumple**: hay 8 Mayores abiertas contra un máximo de 3 (el 06/11 eran 9, con DEF-07 todavía contada; DEF-07 se cerró el 08/11). Las Críticas están en 0. Ninguna de las 8 está cerrada; el criterio exige, además, un workaround documentado para cada Mayor abierta, y esa columna está completa solo para algunas (DEF-09 dice «ninguno»). La severidad de las Mayores es una **propuesta**: el equipo y el PO la validan antes de la entrega.

## 3. Defectos y brechas abiertos

### Críticas (HU Must incumplida)

Ninguna abierta. DEF-01, DEF-02 y DEF-03 se cerraron (ver sección 4).

### Mayores

#### DEF-04 · Caída del broker de más de ~50 s deja eventos en FAILED sin recuperación automática

| Campo | Detalle |
|---|---|
| ID | sin issue |
| Severidad / prioridad | Mayor / Alta (la cátedra apaga el broker en vivo) |
| HU | HU-23 (outbox e inbox) |
| Pasos | 1. Apagar RabbitMQ. 2. Provocar una acción que publique un evento (cerrar un servicio). 3. Esperar más de 1 minuto. 4. Volver a levantar RabbitMQ |
| Esperado | El sistema se recupera solo y el evento se envía |
| Obtenido | El dispatcher barre cada 10 s y descarta la fila tras 5 intentos (`MAX_ATTEMPTS = 5`), unos 50 s según el código (no medido). La fila queda en `FAILED` y el barrido ya no la toma |
| Evidencia | `src/events/outbox/outbox-dispatcher.service.ts:18` (`MAX_ATTEMPTS = 5`, sin cambios al 08/11), `:42` (`@Interval(10_000)`), `:85-93` (pasa a `FAILED`) |
| Estado | Abierto. El 08/11 se sumó `test/rabbitmq-real.e2e-spec.ts` (#579), que prueba que el **consumer** reconecta cuando el broker le **cierra las conexiones** (API de management). **No** prueba la publicación del outbox ni el paso a `FAILED` con el broker caído, y el broker **no se apagó** de verdad (solo se haría en la demo en vivo: NO HECHO). El defecto sigue como estaba |
| Workaround | Reencolar a mano con `POST /events/outbox/retry-failed` (solo `M6_ADMIN`, con `confirm: true`; issue #459) |

#### DEF-05 · Sin control de concurrencia optimista (ETag / `If-Match` → 412)

| Campo | Detalle |
|---|---|
| ID | sin issue |
| Severidad / prioridad | Mayor / Alta (la cátedra lo prueba) |
| HU | Transversal a las HU de edición (servicios, contenedores, cuadrillas) |
| Pasos | Editar el mismo recurso con `PATCH` desde dos clientes con los mismos datos de partida |
| Esperado | El segundo recibe `412 Precondition Failed` |
| Obtenido | Gana el último; no hay `ETag`, `If-Match` ni `PreconditionFailedException` en `src` |
| Evidencia | Grep de `etag`, `if-match` y `PreconditionFailed` en `src`: sin resultados |
| Estado | Abierto |
| Workaround | Las transiciones de estado sí usan una condición optimista en la base (`where` con el estado leído), así que dos cierres simultáneos no se pisan; no cubre ediciones de campos |

#### DEF-06 · Idempotency-Key solo existe en `POST /evidence`

| Campo | Detalle |
|---|---|
| ID | sin issue |
| Severidad / prioridad | Mayor / Media |
| HU | HU-05 (programar servicio) y las demás altas |
| Pasos | Enviar dos veces `POST /services` con el mismo cuerpo (doble clic o reintento de red) |
| Esperado | Un único recurso y la misma respuesta |
| Obtenido | Dos servicios. Solo `src/modules/attachments` implementa `Idempotency-Key` |
| Evidencia | Grep de `dempotency` en `src`: solo `attachments` y un spec de payloads |
| Estado | Abierto |
| Workaround | La UI deshabilita el botón mientras el envío está pendiente (según la auditoría del frontend) |

#### DEF-08 · Dependencias de producción con vulnerabilidades conocidas

| Campo | Detalle |
|---|---|
| ID | sin issue (corrección parcial: [#566](https://github.com/hllous/Backend-M6-DAPS2/issues/566), PR #576) |
| Severidad / prioridad | Mayor (propuesta) / Alta |
| HU | HU-31 |
| Pasos | `npm audit --omit=dev` |
| Esperado | 0 CVE críticas o altas sin mitigación documentada (criterio de la cátedra) |
| Obtenido | **03/11:** 15 vulnerabilidades (1 crítica, 6 altas, 8 moderadas). **08/11, tras `npm audit fix`:** **13 en producción: 0 críticas, 6 altas, 7 moderadas**. La crítica (`proxy-addr`) quedó resuelta. Altas restantes: `@nestjs/platform-express`, `body-parser`, `multer`, `js-yaml`, `lodash` y `zod`; todas exigen un salto mayor (NestJS 12, zod 4) |
| Evidencia | Salida de `npm audit --omit=dev` (detalle en [`07-informe-seguridad.md`](07-informe-seguridad.md) sección 5.1); job `audit` de `.github/workflows/ci.yml` |
| Estado | **Riesgo aceptado y abierto.** Las 6 altas están aceptadas **sin análisis de explotabilidad**: no se analizó si el DoS de `multer` o `body-parser` es alcanzable en M6. Sin Trivy no hay segundo SCA |
| Workaround | El job `audit` del CI corre `npm audit --omit=dev --audit-level=high` y es **informativo**: termina en verde con un aviso (`::warning`), no bloquea. Dependabot semanal (sin majors de `@nestjs/*` ni `zod`). El salto a NestJS 12 queda fuera de este corte |

La severidad queda en Mayor hasta confirmar si alguna es explotable en M6; si lo es, pasa a Crítica.

#### DEF-09 · Auditoría de lectura de datos Tier 2 no implementada

| Campo | Detalle |
|---|---|
| ID | sin issue (quedó pendiente al cerrar [#90](https://github.com/hllous/Backend-M6-DAPS2/issues/90)) |
| Severidad / prioridad | Mayor / Media |
| HU | HU-31 (SEC-D02) |
| Pasos | Consultar `GET /environmental-reports/:id` o un acta, y buscar la fila de auditoría |
| Esperado | Se registra quién, cuándo y qué recurso leyó, sin copiar el contenido |
| Obtenido | `src/common/audit` registra solo cambios de estado (#460); no hay interceptor de lecturas |
| Evidencia | `docs/decisiones/adr-005-alineacion-frontend-sesion-y-seguridad.md:22` y `:46` lo exigen para producción. `src/common/audit/` no tiene lecturas |
| Estado | Abierto |
| Workaround | Ninguno; la identidad del denunciante solo la ve personal de M6 con rol |

#### DEF-10 · Errores sin formato Problem Details (RFC 9457)

| Campo | Detalle |
|---|---|
| ID | sin issue (la tarjeta SEC-W05 de Trello lo marcó para decidir) |
| Severidad / prioridad | Mayor / Alta (la cátedra lo prueba) |
| HU | Transversal |
| Pasos | Provocar un 404 o un 400 y mirar el cuerpo y el `Content-Type` |
| Esperado | `application/problem+json` con `type`, `title`, `status`, `detail`, `instance` |
| Obtenido | `{ statusCode, message, error, code?, timestamp, path }` con `application/json`. No hay 422 |
| Evidencia | `src/common/filters/http-exception.filter.ts:111-119` |
| Estado | Abierto. **Cambiar el formato es un cambio de contrato** (OpenAPI, frontend y `docs/api/estandar-swagger.md`) |
| Workaround | Los códigos de estado son correctos (400, 401, 403, 404, 409, 429, 503) |

#### DEF-11 · Los tests contra los contratos de M2 se saltean en el CI

| Campo | Detalle |
|---|---|
| ID | sin issue (documentado en `docs/testing.md`) |
| Severidad / prioridad | Mayor / Media |
| HU | HU-23 y las HU de integración con M2 |
| Pasos | Mirar el job `test` del CI (run [41556929968](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/41556929968)) |
| Esperado | Los 12 tests contra el paquete de M2 v1.78 corren |
| Obtenido | `Tests: 12 skipped`. Hay 4 puntos de salto por `PAQUETE_M2_PRESENTE`: `src/events/consumers/m2-ejemplos.spec.ts:33`, `src/events/payloads.spec.ts:427`, `src/modules/environmental-reports/environmental-reports.service.spec.ts:923` y `src/modules/services/services.service.spec.ts:1376`. El paquete vive en `docs/documentacion/`, que no se versiona |
| Evidencia | Log del run: `console.warn` «Paquete de M2 v1.78 ausente» |
| Estado | Abierto |
| Workaround | En local corren si existe la carpeta. Es un hueco del tipo del #314 (ver `09-lecciones-aprendidas.md`; a validar con el equipo) |

#### DEF-13 · Análisis de seguridad en el CI: parcial, faltan ZAP y Trivy

| Campo | Detalle |
|---|---|
| ID | sin issue |
| Severidad / prioridad | Mayor / Alta |
| HU | HU-31 |
| Pasos | Revisar `.github/workflows/` y `.github/dependabot.yml` |
| Esperado | Escaneo de dependencias, de secretos y análisis dinámico |
| Obtenido | **Hecho:** `npm audit` informativo (job `audit`, #571), Dependabot semanal, CodeQL (`codeql.yml`), gitleaks sobre el historial completo (job `secrets`, #494). **No hecho:** OWASP ZAP y Trivy. El resultado de los hallazgos de CodeQL **no se verificó** (el workflow termina en `success`; no se revisó la pestaña de alertas) |
| Evidencia | `.github/workflows/ci.yml` (jobs `audit` y `secrets`), `.github/workflows/codeql.yml`, `.github/dependabot.yml`; run de `develop` [42508633321](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/42508633321) |
| Estado | Abierto, **parcial** (el 03/11 no había nada de esto salvo gitleaks) |

### Menores

| ID | Hallazgo | Evidencia | HU / estado |
|---|---|---|---|
| DEF-14 (sin issue) | El job `e2e` corre en cada PR y **pasa en el CI de `develop`** (run [42508633321](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/42508633321), `1d600d2`; 312 tests + 4 de RabbitMQ real), pero sigue sin ser check obligatorio de la rama: un rojo no frena el merge. Exigirlo pide permisos de admin sobre `hllous/Backend-M6-DAPS2` (NO HECHO) | `.github/branch-protection-rules.json:17-19` (exige solo `build` y `test`) | Transversal · abierto. Pasos: abrir un PR con un e2e roto y ver que se puede mergear. Esperado: el merge bloqueado. Obtenido: el merge queda habilitado |
| DEF-15 (sin issue) | El timeout del cliente al Core es de 10 s; la cátedra prueba 5 s. Es efectivo, pero no cumple el valor pedido. No hay circuit breaker ni test que dispare el timeout real | `src/core/core.client.ts:6` y `:150-151` | HU-24 · abierto. Pasos: que el Core no responda (fetch colgado). Esperado: corte a los 5 s. Obtenido: corta a los 10 s |
| DEF-18 (sin issue) | `CORS_ORIGINS` es opcional: si falta, la API acepta cualquier origen (sin `credentials`). Hay que confirmar que esté cargada en Render. **Tampoco se verificó `BFF_SHARED_KEY` en Render** (ADR-010 la deja opcional; sin ella el límite de tasa del BFF es un solo balde) | `src/main.ts:19-27` | HU-31 · abierto, **NO VERIFICABLE hasta verlo en Render**. Pasos: pedir con `Origin` ajeno sin `CORS_ORIGINS`. Esperado: rechazo. Obtenido: se acepta cualquier origen, sin `credentials` |
| DEF-19 (sin issue) | Swagger UI queda publicado en `/api/docs` también en producción; los errores 500 no llevan id de correlación y `path` incluye la query string; la evidencia se sirve por URL pública del bucket (protegida solo por una key UUID aleatoria) y los PDF conservan sus metadatos. Desde #581, el `path` del error redacta los parámetros sensibles de la query (`redactUrl`), pero sigue incluyéndola; `/api/docs` es la única ruta sin CSP | `src/main.ts:40`; `src/common/filters/http-exception.filter.ts:118`; `src/modules/attachments/storage/r2-evidence.storage.ts:66`; tarjeta SEC-W06 | HU-31 · abierto. Falta de pasos/esperado/obtenido por cada uno de los cuatro puntos: son hallazgos de revisión de código, sin reproducción en vivo |
| DEF-20 ([#586](https://github.com/hllous/Backend-M6-DAPS2/issues/586)) | **Hallazgo H-1 de Schemathesis.** Los `GET` con parámetro de ruta UUID (`ParseUUIDPipe`) o con `@Query()` DTO devuelven **400** del `ValidationPipe` global, pero el OpenAPI no declara ese 400 (por ejemplo `/containers` documenta 200, 401, 403 y 500). Incumple `docs/api/estandar-swagger.md` (la tabla de códigos pide 400 en endpoints con entrada). Schemathesis lo marca con `status_code_conformance` (ST103) en al menos 40 `GET`; la auditoría de contratos del 08/11 contó **46 de 65 `GET` sin 400 declarado** (quedan fuera `/health`, `/health/ready` y `/me`, que no lo lanzan). Afecta a `/containers`, `/crews/{id}`, `/services/{id}/…`, `/trees/…`, `/public/services`, `/public/green-points` y `/evidence`, entre otros. No es un fallo de funcionamiento: el 400 es correcto, falta declararlo | `src/configure-app.ts:52` (`forbidNonWhitelisted`); `docs/api/openapi.json`; `test/api/PENDIENTES.md` (rama de #572, PR #583); el check corre en `.github/workflows/api-tests.yml` como paso **informativo** | Transversal · abierto. Corrección: un helper `ApiBadRequestParams()` en `src/common/decorators` y un caso en `openapi-contract.spec.ts` que lo exija; al cerrarlo, pasar el paso a bloqueante. Cambia `openapi.json` |
| DEF-21 | **Hallazgo H-2 de Schemathesis.** `GET /neighborhoods` responde **503** («El catálogo de barrios de M9 todavía no está disponible») cuando M6 no tiene acceso al catálogo de M9. El 503 está documentado y es el comportamiento previsto ante una dependencia caída, pero en el CI y en el `docker compose up` local **no existe M9**, así que ese endpoint no se puede usar ni probar fuera del despliegue. Se **excluyó** de Schemathesis (`--exclude-path /neighborhoods`); si no, rompe `not_a_server_error` | `src/modules/neighborhoods/neighborhoods.service.ts:15` y el `@ApiResponse` 503 de su controller; exclusión comentada en `.github/workflows/api-tests.yml` | HU-31 · abierto. Corrección: un seed o mock de barrios para el entorno local y el CI |
| DEF-24 ([#554](https://github.com/hllous/Backend-M6-DAPS2/issues/554)) | **e2e intermitente.** En el CI de un PR de documentación (#551) falló `test/crew-ownership.e2e-spec.ts` › «una inspección ya cerrada: el ajeno ve 403 (no el 409), el asignado ve 409» por una violación del check constraint `e2e_no_active` sobre `container` (Postgres 23514, en `ServicesService.complete`). Reintentar solo el job fallido pasó. `test/containers-close.e2e-spec.ts` agrega ese constraint temporal y lo borra al terminar; no se sabe por qué estaba activo cuando corrió otra suite (con `maxWorkers: 1`). **Aclaración honesta:** el 08/11, 3 corridas seguidas del e2e dieron resultado idéntico, lo que **no prueba que el defecto no exista**; la causa raíz no está investigada | `test/containers-close.e2e-spec.ts:122` y `:128`; `test/jest-e2e.json` (`maxWorkers: 1`); run [42374274615](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/42374274615) | Transversal (HU-33) · abierto, Menor. Pasos: correr `npm run test:e2e` varias veces. Esperado: el mismo resultado siempre. Obtenido: 1 falla en CI no reproducida |

Un test débil adicional, `services.service.spec.ts:875` (`resolves.toBeDefined()` como única aserción), se registra en `05-informe-ejecucion.md`.

## 4. Defectos cerrados y corregidos

De los 58 issues con etiqueta `bug`, `security` o `fix`, 57 están **cerrados** en GitHub y 1 sigue abierto (#554, DEF-24; `gh issue list --state all`, 08/11). El 03/11 eran 55, todos cerrados. Los defectos y brechas de este registro que se cerraron desde entonces están en la tabla siguiente, antes de las filas históricas. Esta sección lista los que más enseñan, con su causa raíz y la **evidencia del cierre**: el commit de la corrección en `develop` y el run del workflow `CI` de ese commit.

Cómo leer la evidencia de CI: «CI verde, run N» significa que `gh run list --workflow CI --commit <sha>` devolvió un *push* a `develop` con conclusión `success`. Prueba que el build, el lint y los tests del repo pasaron en ese commit; no prueba por sí sola que el test nombrado cubra la corrección. Los runs se ven en `https://github.com/hllous/Backend-M6-DAPS2/actions/runs/<N>`. Donde no se ubicó el commit, la tabla dice «corregido (cerrado en #n); ejecución pendiente», sin inventar un verde.

| # | Defecto | Causa raíz | Corrección (commit · fecha) | Evidencia de cierre |
|---|---|---|---|---|
| DEF-07 · [#568](https://github.com/hllous/Backend-M6-DAPS2/issues/568) | Rate limiting solo en el portal ciudadano: sin límite de tasa en el resto de la API (HU-31, era Mayor) | `ThrottlerModule` vivía solo en `citizen-portal`; [ADR-008](../decisiones/adr-008-roles-m6-adaptados-desde-m1.md) había dejado el límite general «para después de la entrega» | `fb62519` (PR #580) · 08/11: `ThrottlerGuard` global (600 por minuto, por IP y por endpoint), topes propios en `POST /events/inbox` (300) y `POST /evidence` (30), `/health` excluido; [ADR-010](../decisiones/adr-010-rate-limit-global.md). Los contadores están **en memoria**: valen para una sola instancia | CI verde, run 42507156312. Test: `test/throttler.e2e-spec.ts` (429 al pasar el límite). Pendiente: que el BFF mande `X-M6-BFF-Key` y sobrescriba `X-Forwarded-For`; si no, sus usuarios comparten un balde de 600 por minuto |
| DEF-22 · [#569](https://github.com/hllous/Backend-M6-DAPS2/issues/569) | Los logs registraban el `access_token` de la query: el `LoggingInterceptor` escribía la URL completa y el `path` de los errores la devolvía al cliente | Se logueaba `request.url` sin filtrar. Los tests de logs cubrían método, URL y estado, pero ninguno usaba una URL con token; por eso SEC-D01 figuraba NO VERIFICABLE para el log HTTP. El fix entró en el mismo PR que los tests de seguridad de #569; no consta un incidente | `a733f44` (PR #581) · 08/11: `redactUrl` (`src/common/utils/redact-url.ts`) aplicado en el interceptor y en el filtro de excepciones | CI verde, run 42507405163. Tests: `src/common/utils/redact-url.spec.ts` (redacta por subcadena y no toca `page`, `status`, etc.) y `logging.interceptor.spec.ts` › «el log no incluye el token de la query ni el header Authorization» |
| DEF-23 · [#567](https://github.com/hllous/Backend-M6-DAPS2/issues/567) | El primer `docker compose up` en frío fallaba: `rabbitmq-setup` salía con `exit 7` y el backend no levantaba. Heredado del compose de [#555](https://github.com/hllous/Backend-M6-DAPS2/issues/555) | El `healthcheck` de RabbitMQ da `healthy` antes de que la consola (puerto 15672) escuche, y `rabbitmq-setup` llamaba a esa API sin reintentos. Nadie había corrido `docker compose up` desde cero con volúmenes nuevos | `c9a8dc7` (PR #584) · 08/11: `curl --retry 30 --retry-delay 2 --retry-connrefused` en `docker-compose.yml` | CI verde, run 42507763344, **que no prueba el arreglo** (el CI no levanta el compose). Evidencia real: `docker compose up -d --build` en frío con volúmenes nuevos, 08/11, local: up en 35 s, `/health/ready` 200 a los 45 s, seed OK. Sin test automatizado |
| DEF-01 · [#488](https://github.com/hllous/Backend-M6-DAPS2/issues/488) | Login real con M1 sin probar de punta a punta: `GET /me` daba 401 (HU-30, era Crítica) | M1 rotó el `JWT_SECRET` y no lo comunicó a M6 | Secreto vigente cargado en Render; login de demo retirado · 03/11 | Issue cerrado el 03/11. Login real + `GET /me` en 200 con cuatro cuentas (informado por el PO). Frontend: FE #800 |
| DEF-02 · [#257](https://github.com/hllous/Backend-M6-DAPS2/issues/257) | Contrato definitivo de M9 sin cerrar (HU Must, era Crítica) | Contrato del Core en definición | Sobre, topología, reintentos y catálogo adaptados · 05/11 | Issue cerrado el 05/11, junto con la prueba AMQP con M9 y M3. Lo que queda es de M9 y M2 y no frena el trabajo: fila «M9 / M2» de [`bloqueantes.md`](../bloqueantes.md) |
| DEF-03 · [#299](https://github.com/hllous/Backend-M6-DAPS2/issues/299) y [#442](https://github.com/hllous/Backend-M6-DAPS2/issues/442) | Integración con el Core real sin probar (HU-24, era Crítica) | Ambiente compartido que exige coordinar con M9 y los destinatarios | Prueba con el Core real · 05/11 | Issues cerrados el 05/11. M6 publicó `infrastructureRepairRequested` y M3 respondió `workOrderScheduled` y `workOrderCompleted` ([historial](../integracion/historial.md)) |
| DEF-12 · [#447](https://github.com/hllous/Backend-M6-DAPS2/issues/447) | `streetClosureRequested` con el contrato final de cortes de M7 (HU-05, era Mayor) | El contrato de M7 cambió el 28/10 | Tramos `{street, from, to, direction}` en el formato final · PR #478, 02/11 | Issue cerrado el 05/11. Falta entre M7 y el Core (`streetClosureEnded`) y la prueba E2E, en la fila M7 de [`bloqueantes.md`](../bloqueantes.md) |
| DEF-16 y DEF-17 | `AGENTS.md` decía que `RolesGuard` no se usa; `bloqueantes.md` decía que `actorId` no se leía | Documentos desactualizados respecto del código | Textos corregidos · 06/11 | Revisión contra `src/app.module.ts` y `src/auth/jwt.strategy.ts` |
| [#466](https://github.com/hllous/Backend-M6-DAPS2/issues/466) | `GET /evidence` sin rol ni pertenencia: cualquier token válido leía la evidencia de cualquier dueño | La pertenencia (`assertOwnerAccess`) se aplicó solo al alta; el GET quedó sin `@Roles` ni chequeo. Lo encontró la revisión del frontend | `c2d12a8` (PR #468) · 30/10 | CI verde, run 41047597104. Test: `attachments.service.spec.ts:543` (Campo ajeno: 403 `NOT_ASSIGNED`) |
| [#314](https://github.com/hllous/Backend-M6-DAPS2/issues/314) | `updateTicketStatus` mandaba `updatedBy.id` que no era UUID y M2 v1.78 lo rechazaba | Se enviaba el `sub` numérico del JWT donde el contrato pide UUID o `null` | `a5f4153` (PR #318) · 20/10 | CI verde, run 39474682821. Test: `payloads.spec.ts:393-408` (UUID o `null`) |
| [#485](https://github.com/hllous/Backend-M6-DAPS2/issues/485) | `updatedBy.id` seguía en `null` aunque M1 ya emite `actorId` | M1 confirmó el 02/11 que el token trae `actorId` (UUID) además del `sub` numérico | `a108b56` (PR #489) · 02/11 | CI verde, run 41539493018. Test: `jwt.strategy.spec.ts:78-83` |
| [#470](https://github.com/hllous/Backend-M6-DAPS2/issues/470) | El límite de tasa del portal contaba la IP del BFF: toda la ciudad compartía 20 consultas por minuto | `@nestjs/throttler` cuenta por `req.ip`; detrás de Vercel y Render llega siempre la misma IP | `65dde9f` (PR #480) · 02/11 | CI verde, run 41476302943. Test: `client-tracker.spec.ts` |
| [#448](https://github.com/hllous/Backend-M6-DAPS2/issues/448) | La validación del JWT aceptaba solo HS256 y habría rechazado HS384 o HS512 | M1 usa JJWT, que elige el algoritmo por el largo de la clave | `bd61e3a` (PR #450) · 28/10 | CI verde, run 40767759833. Test: `jwt.strategy.spec.ts:152` (acepta con cada algoritmo) |
| [#161](https://github.com/hllous/Backend-M6-DAPS2/issues/161) / [#235](https://github.com/hllous/Backend-M6-DAPS2/issues/235) | Sin autorización por rol: cualquier JWT válido podía programar, cancelar y completar servicios (SEC-W02) | `RolesGuard` y `@Roles` existían pero no estaban registrados ni aplicados | `e6153f9` (PR #366) y `f1e1ff6` (PR #369) · 21/10 | CI verde, runs 39651981646 y 39673886235. Tests: `route-roles.spec.ts`, `test/auth-roles.e2e-spec.ts` |
| [#354](https://github.com/hllous/Backend-M6-DAPS2/issues/354) | El JWT de M1 no se validaba con su secreto, `iss`, `typ` ni claim `rol` | El guard anterior era provisorio (ADR-002) | `b9511a7` (PR #358) · 21/10 | CI verde, run 39636009746. Test: `jwt.strategy.spec.ts:167-187` |
| [#158](https://github.com/hllous/Backend-M6-DAPS2/issues/158) | Agujeros de la auditoría del 18/09: sobre de M2 rechazado, alerta sin ventana, `multer` con CVE de DoS, límite de tasa compartido | Varias causas chicas: ver el issue | `f73c6c5` (PR #164) · 19/09 | CI verde, run 35455614310 |
| [#264](https://github.com/hllous/Backend-M6-DAPS2/issues/264) · [#270](https://github.com/hllous/Backend-M6-DAPS2/issues/270) · [#275](https://github.com/hllous/Backend-M6-DAPS2/issues/275) | `nack` con reencolado; handlers que pisaban estado más nuevo o perdían eventos atrasados | Política de reintentos propia en lugar de delegar en el backoff del Core; el Core no garantiza orden | `3ca3625` (#271) · 07/10; `c4be580` (#277) y `a971be7` (#278) · 08/10 | CI verde, runs 37710896602, 37802072503 y 37805497912. Test: `rabbitmq.consumer.spec.ts:63`, `:94`, `:129`, `:134` |
| [#189](https://github.com/hllous/Backend-M6-DAPS2/issues/189) | Eventos entrantes con `data` inválida quedaban `processed` sin efecto | Faltaba validar el payload antes de aplicarlo (según el título del issue) | `6048655` (PR #215) · 20/09 | CI verde, run 35519143213. Test: `inbox.e2e-spec.ts:131` |
| [#338](https://github.com/hllous/Backend-M6-DAPS2/issues/338) | `cancelled()` dejaba pegada la solicitud de información y `close()` daba 409 para siempre | Una revisión independiente llegó después del merge y encontró el cierre incompleto | `6ecfac8` (#339) · 20/10 y `0998ac4` (#343) · 21/10 | CI verde, runs 39516861686 y 39608328923 |
| [#451](https://github.com/hllous/Backend-M6-DAPS2/issues/451) | La reparación se podía derivar desde cualquier inspección, también por olores | No se validaba tipo ni resultado de la inspección. Surgió del documento de QA externo (QA-CA-002 y QA-CA-006) | `605085f` · 28/10 | CI verde, run 40801821968 |
| [#107](https://github.com/hllous/Backend-M6-DAPS2/issues/107) | Un servicio `RESCHEDULED` no se podía cancelar por la API, pero sí por un evento de M2 | Los consumidores del inbox escriben con `updateMany` y no pasan por las tablas de transición: nadie había decidido la regla | `3aca0a4` (#108) · 04/09 | CI verde, run 33887729255 |
| [#142](https://github.com/hllous/Backend-M6-DAPS2/issues/142) | `ticketUpdated` no filtraba por responsable: un ticket ajeno abría expediente | `ticketUpdated` es un broadcast y el handler no revisaba el área responsable | `2a800b2` (#143) · 10/09 | CI verde, run 34501794046 |
| [#144](https://github.com/hllous/Backend-M6-DAPS2/issues/144) | `ESCALATION_CHANGED` nunca desmarcaba el escalado e `INFORMATION_PROVIDED` guardaba el texto equivocado | Ruta del campo incorrecta y valor por defecto `true` en `tickets.consumer.ts` | `cd3e068` · 11/09 | CI verde, run 34642534310 |
| [#166](https://github.com/hllous/Backend-M6-DAPS2/issues/166) | Reparaciones y cortes de calle cambiaban de estado sin tabla de transiciones | `outbound-requests` no usaba `assertTransition` como los demás servicios | `ee76801` · 19/09 | CI verde, run 35461784055 |
| [#168](https://github.com/hllous/Backend-M6-DAPS2/issues/168) | El inbox guardaba el contenido completo de tickets que no eran de M6 | `ingest()` insertaba el payload antes de que el handler decidiera si el evento era propio | `8a56f64` (#173) · 19/09 | CI verde, run 35461976173 |
| [#176](https://github.com/hllous/Backend-M6-DAPS2/issues/176) | `?active=false` listaba los activos y `"false"` en un body se guardaba como `true` | `enableImplicitConversion` sin `@Transform`: `Boolean("false") === true` | `d39f123` (#191) · 19/09 | CI verde, run 35481080988 |
| [#177](https://github.com/hllous/Backend-M6-DAPS2/issues/177) | `resume`, `empty`, `complete-repair` y `confirm-relocation` no validaban el estado de origen | Cada acción validaba que el destino fuera alcanzable, no que el origen fuera el propio | `d720da3` · 19/09 | CI verde, run 35484815763 |
| [#178](https://github.com/hllous/Backend-M6-DAPS2/issues/178) | Números fuera de rango y caracteres nulos daban un 500 opaco | Valores que la columna no soporta llegaban a Prisma sin validar | `9344f35` (#197) · 19/09 | CI verde, run 35483516357 |
| [#179](https://github.com/hllous/Backend-M6-DAPS2/issues/179) / [#203](https://github.com/hllous/Backend-M6-DAPS2/issues/203) | `POST /services` y `PATCH /services/:id` saltaban el chequeo de solapamiento de `assign-crew` | El mismo criterio se aplicó en una sola vía de entrada; la segunda apareció al cerrar la primera | `09fde0c` · 19/09 y `97faf54` · 20/09 | CI verde, runs 35485402129 y 35486283189 |
| [#230](https://github.com/hllous/Backend-M6-DAPS2/issues/230) | El cumplimiento marcaba como tarde todo cierre posterior a las 21 h | Se comparaba el día en UTC; un cierre a las 23:30 de Argentina caía en el día siguiente | `8bb746c` (#233) · 23/09 | CI verde, run 35882216639 |
| [#317](https://github.com/hllous/Backend-M6-DAPS2/issues/317) | El consumidor podía volcar al log el detalle del error del Core | Falta de límite y saneo del `x-core-last-error` (según el commit y su test) | `d3b9d08` · 20/10 | CI verde, run 39458179963. Test: `rabbitmq.consumer.spec.ts:328` |
| [#459](https://github.com/hllous/Backend-M6-DAPS2/issues/459) | Los eventos salientes en `FAILED` no se podían consultar ni reencolar | No había endpoint de administración del outbox | `3bf5b46` (#463) · 28/10 | CI verde, run 40802458996. Es el workaround de DEF-04 |
| [#460](https://github.com/hllous/Backend-M6-DAPS2/issues/460) | No se registraba quién hizo cada cambio de estado | No existía el historial de auditoría | `39069dc` (#483) · 02/11 | CI verde, run 41531138310. Test: `test/audit.e2e-spec.ts` |
| [#132](https://github.com/hllous/Backend-M6-DAPS2/issues/132) | Todos los deploys a Render fallaban desde #126 y nadie lo notó | `scripts/generate-openapi.ts` quedó dentro del build, movió la salida a `dist/src/` y el `Dockerfile` buscaba `dist/main.js`. Render mantenía viva la última build buena | **Corregido (cerrado en #132); ejecución pendiente**: el commit de la corrección no se ubicó por el título | — |

Las filas DEF-01, DEF-02, DEF-03, DEF-12, DEF-16 y DEF-17 citan el estado del issue, no un run. Cada fila con un run de CI citado se verificó con `gh run list --workflow CI --commit`; no se citó ningún run que no se hubiera consultado. Son 26 filas con run verde del 03/11 (algunas agrupan varios issues), 3 más del 08/11 (DEF-07, DEF-22 y DEF-23) y una sin evidencia de ejecución (#132); el resto de los cerrados no se detalla acá.

### Hallazgos de proceso (no son defectos del producto)

| ID | Hallazgo | Qué pasó | Estado |
|---|---|---|---|
| P-1 | Secreto de juguete literal en el workflow `api-tests.yml` de #572 | El workflow nuevo tenía un secreto de juguete escrito en el archivo. El job `secrets` (gitleaks sobre todo el historial) lo detectó en el CI: run [42505473347](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/42505473347), commit `e07ad42`, job `secrets` en rojo. No era una credencial real. Se corrigió **reescribiendo la rama** antes de mergear (el workflow genera ahora un secreto efímero) y el job `secrets` volvió a verde en `develop` | Cerrado. Nunca llegó a `develop` |
| P-2 | Dos commits publicados con autor `scratch <scratch@local>` | Los commits `5c8c78b` (rama de #583) y `a06b33b` (rama de #584) se hicieron con una configuración de git local mal puesta. Ambos PR se mergearon con squash: en `develop` el autor es Benjamin Martinez y `scratch <scratch@local>` aparece solo como `Co-authored-by` en `1d600d2` (#583) y `c9a8dc7` (#584). Los commits originales figuran en los PR #583 y #584 | **Abierto, sin reescribir.** El alias `scratch` no corresponde a ningún integrante. Pendiente de decisión del equipo; no se reescribió historial |

## 5. Verificaciones no realizadas (no son defectos)

La regla G9 pide no omitir nada conocido. Estas pruebas **no se hicieron** (estado al 08/11) y no se presentan como hechas.

| Verificación | Estado | Motivo |
|---|---|---|
| Tag `v1.0-testing` en `main` | NO HECHO | Pendiente del equipo (antes de las 13:30 del 10/11, backend y frontend) |
| Quality Gate de SonarCloud | NO HECHO | Pide un administrador de `hllous`; no hay cuenta ni `sonar-project.properties` |
| Job `e2e` obligatorio en la protección de ramas | NO HECHO | Idem: pide admin. El e2e corre y pasa en el CI, pero la regla exige solo `build` y `test` (DEF-14) |
| Prueba de carga con 50 usuarios | NO HECHO | Hay script (`test/perf/k6-criticos.js`, #585) pero **cero resultados**: no se corrió, no hay p95 ni tasa de error |
| OWASP ZAP baseline y activo autenticado | NO HECHO | No se corrió |
| Trivy | NO HECHO | No se corrió |
| Frontend dentro del compose | NO HECHO | Issue [#560](https://github.com/hllous/Backend-M6-DAPS2/issues/560) abierto |
| Verificar `CORS_ORIGINS` y `BFF_SHARED_KEY` en Render | NO HECHO | Hay que mirar el panel de Render (DEF-18) |
| Contrato del BFF con el frontend (`X-M6-BFF-Key` y `X-Forwarded-For` en llamadas autenticadas, sobrescribiendo XFF) | NO HECHO | Falta abrir el issue al repo del frontend |
| Éxito por endpoint en los 92 endpoints restantes | NO HECHO | Hay caso de éxito en 60 de 152 operaciones; el resto está en `test/api/PENDIENTES.md` |
| Apagar el broker de verdad | NO HECHO | Solo en la demo en vivo. El e2e de recuperación corta conexiones, no apaga el broker |
| Mutation score global | NO HECHO | Medido solo en `outbound-requests` (84,21 %); no hay medición del dominio completo |
| Firmas de tests por integrante y datos «A COMPLETAR» de `08-declaracion-ia.md` | NO HECHO | Solo el equipo puede completarlos |
| Resultado de las alertas de CodeQL | NO VERIFICADO | El workflow corre y termina en `success`; no se revisó la pestaña de alertas |
| Escaneo de secretos con trufflehog | NO HECHO | gitleaks sí se corre (03/11 y en cada PR) |

Hechas desde el 03/11 y que antes figuraban en esta lista: Stryker acotado a `outbound-requests` (#577), suite corrida 3 veces seguidas (08/11, local), RabbitMQ real en el e2e (#579), Schemathesis y Newman (#583).

## 6. Plan de corrección propuesto

| Prioridad | Defectos | Acción | Estado al 08/11 |
|---|---|---|---|
| 1 | DEF-04 | Subir `MAX_ATTEMPTS` o reencolar `FAILED` por antigüedad, con test | Sin hacer (`MAX_ATTEMPTS = 5`) |
| 2 | DEF-08, DEF-13 | `npm audit fix`, documentar la mitigación del resto, sumar `npm audit` y Dependabot al CI | **Hecho en parte**: `npm audit fix` (#576), job `audit` informativo y Dependabot (#578). Falta el análisis de explotabilidad, ZAP y Trivy |
| 3 | DEF-15 | Timeout de 5 s con un test que lo dispare de verdad | Sin hacer |
| 4 | DEF-10 | Migrar el filtro a RFC 9457 y avisar al frontend (cambio de contrato) | Sin hacer |
| 5 | DEF-05, DEF-06 | `ETag`/`If-Match` en un `PATCH` crítico e `Idempotency-Key` en `POST /services`, con un e2e cada uno | Sin hacer |
| 6 | DEF-07 | ~~Throttler global con un e2e de 429~~ | **Hecho** (#568, PR #580) |
| 7 | DEF-11, DEF-14 | Versionar los schemas de M2 o hacer que el CI avise; hacer obligatorio el job `e2e` | Sin hacer (DEF-14 pide admin) |
| 8 | DEF-18, DEF-19 | Corregir los textos, confirmar `CORS_ORIGINS` en Render y decidir qué hacer con `/api/docs` | Sin hacer |
| 9 | DEF-09 | Interceptor de lectura de datos Tier 2 | Sin hacer |
| 10 | DEF-20, DEF-21 | Declarar el 400 en los `GET` con parámetro UUID o query (helper + caso en `openapi-contract.spec.ts`, regenerar `openapi.json` y la colección) y volver bloqueante el paso `status_code_conformance`; seed o mock de barrios para local y CI | Sin hacer |
| 11 | DEF-24 | Investigar por qué `e2e_no_active` quedaba activo con `maxWorkers: 1` y reemplazar el `ALTER TABLE` temporal | Sin hacer |

Cerrados y fuera del plan: DEF-01, DEF-02, DEF-03, DEF-07, DEF-12, DEF-16, DEF-17, DEF-22 y DEF-23. Lo que sigue abierto con M7, M9 y M2 está en [`bloqueantes.md`](../bloqueantes.md).

Cualquier cambio de código sale en Issues propios, fuera de #494.
