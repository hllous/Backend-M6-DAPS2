# 06 · Registro de defectos y limitaciones conocidas

> Backend del Módulo 6 (Grupo 04). Versión original del **03/11/2026** (`develop` @ `f288d31`), recontada el 06/11. Actualizada el 08/11/2026 sobre `develop` @ `1d600d2` (se cerraron DEF-07, DEF-22 y DEF-23; se sumó DEF-24). **Actualizada el 09/11/2026** sobre `develop` @ `142e1a3` (merge de [#597](https://github.com/hllous/Backend-M6-DAPS2/pull/597)): se cerraron DEF-05, DEF-06, DEF-10, DEF-20 y DEF-21. Lo cargó el QA desde GitHub Issues, `docs/bloqueantes.md`, el código y la auditoría del 03/11. Todo lo marcado como abierto se **verificó contra el código actual** antes de listarlo.

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
| Issues en el repo | 264 al 09/11 (`gh issue list --state all --limit 1000`), 4 abiertos: #500, #560, #572 y #598. #572 sigue abierto por el éxito en los endpoints restantes; #598 es esta actualización |
| Issues con etiqueta `bug`, `security` o `fix` | 58, todos cerrados en GitHub (`gh issue list`, 09/11). **Ojo con [#554](https://github.com/hllous/Backend-M6-DAPS2/issues/554) (DEF-24):** figura cerrado desde el 08/11 18:59 UTC, sin PR ni comentario, y el código que lo causa no cambió (`test/containers-close.e2e-spec.ts:122`); el defecto se mantiene **abierto** acá hasta que el equipo confirme el cierre |
| Defectos y brechas registrados | 24 (DEF-01 a DEF-24). **Abiertos: 10. Cerrados: 14** (DEF-01, DEF-02, DEF-03, DEF-05, DEF-06, DEF-07, DEF-10, DEF-12, DEF-16, DEF-17, DEF-20, DEF-21, DEF-22 y DEF-23) |
| Verificaciones no realizadas (no son defectos) | 14 filas en la sección 5; 13 sin hacer o sin verificar y 1 hecha a medias (carga, solo en local). El 08/11 decía 15 y la lista tenía 14 filas |

| Severidad | Abiertos | Dentro del máximo de la cátedra |
|---|---|---|
| Bloqueante | 0 | Sí |
| Crítica | 0 | Sí |
| Mayor | **5** (DEF-04, DEF-08, DEF-09, DEF-11 y DEF-13) | **No** (máximo 3) |
| Menor | 5 (DEF-14, DEF-15, DEF-18, DEF-19 y DEF-24) | Sí |
| **Total abierto** | **10** (0 + 5 + 5) | |

**Lectura honesta:** el criterio de salida **sigue sin cumplirse**: hay **5 Mayores abiertas contra un máximo de 3** (DEF-04, DEF-08, DEF-09, DEF-11 y DEF-13). Bajaron de 9 el 06/11 a 8 el 08/11 (DEF-07) y a 5 el 09/11 (DEF-05, DEF-06 y DEF-10 cerrados por #597). Las Críticas están en 0. Faltan al menos 2 cierres o reclasificaciones fundamentadas para llegar a 3; ninguna de las 5 se cerró. El criterio exige, además, un workaround documentado para cada Mayor abierta, y esa columna está completa solo para algunas (DEF-09 dice «ninguno»). La severidad de las Mayores es una **propuesta**: el equipo y el PO la validan antes de la entrega.

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

#### DEF-11 · Los tests contra los contratos de M2 se saltean en el CI

| Campo | Detalle |
|---|---|
| ID | sin issue (documentado en `docs/testing.md`) |
| Severidad / prioridad | Mayor / Media |
| HU | HU-23 y las HU de integración con M2 |
| Pasos | Mirar el job `test` del CI (run [41556929968](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/41556929968)) |
| Esperado | Los 12 tests contra el paquete de M2 v1.78 corren |
| Obtenido | `Tests: 12 skipped`. Hay 4 puntos de salto por `PAQUETE_M2_PRESENTE`: `src/events/consumers/m2-ejemplos.spec.ts:33`, `src/events/payloads.spec.ts:427`, `src/modules/environmental-reports/environmental-reports.service.spec.ts:929` y `src/modules/services/services.service.spec.ts:1376`. El paquete vive en `docs/documentacion/`, que no se versiona |
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
| DEF-14 (sin issue) | El job `e2e` corre en cada PR y **pasa en el CI de `develop`** (run [42508633321](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/42508633321), `1d600d2`, el 08/11; el 09/11 también en el run [42632174201](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/42632174201) de `142e1a3`), pero sigue sin ser check obligatorio de la rama: un rojo no frena el merge. Exigirlo pide permisos de admin sobre `hllous/Backend-M6-DAPS2` (NO HECHO) | `.github/branch-protection-rules.json:17-19` (exige solo `build` y `test`) | Transversal · abierto. Pasos: abrir un PR con un e2e roto y ver que se puede mergear. Esperado: el merge bloqueado. Obtenido: el merge queda habilitado |
| DEF-15 (sin issue) | El timeout del cliente al Core es de 10 s; la cátedra prueba 5 s. Es efectivo, pero no cumple el valor pedido. No hay circuit breaker ni test que dispare el timeout real | `src/core/core.client.ts:6` y `:150-151` | HU-24 · abierto. Pasos: que el Core no responda (fetch colgado). Esperado: corte a los 5 s. Obtenido: corta a los 10 s |
| DEF-18 (sin issue) | `CORS_ORIGINS` es opcional: si falta, la API acepta cualquier origen (sin `credentials`). Hay que confirmar que esté cargada en Render. **`BFF_SHARED_KEY`:** el equipo informó el 09/11 que ya está configurada en Render y en Vercel; **no lo verificó el QA** (ADR-010 la deja opcional; sin ella el límite de tasa del BFF es un solo balde, y que la variable exista no prueba que el BFF mande `X-M6-BFF-Key` ni sobrescriba `X-Forwarded-For`) | `src/main.ts:18-34` | HU-31 · abierto, **`CORS_ORIGINS` NO VERIFICABLE hasta verlo en Render**. Pasos: pedir con `Origin` ajeno sin `CORS_ORIGINS`. Esperado: rechazo. Obtenido: se acepta cualquier origen, sin `credentials` |
| DEF-19 (sin issue) | Swagger UI queda publicado en `/api/docs` también en producción; los errores 500 no llevan id de correlación y `path` incluye la query string; la evidencia se sirve por URL pública del bucket (protegida solo por una key UUID aleatoria) y los PDF conservan sus metadatos. Desde #581, el `path` del error redacta los parámetros sensibles de la query (`redactUrl`), pero sigue incluyéndola; `/api/docs` es la única ruta sin CSP | `src/main.ts:41`; `src/common/filters/http-exception.filter.ts:131-141`; `src/modules/attachments/storage/r2-evidence.storage.ts:66`; tarjeta SEC-W06 | HU-31 · abierto. Falta de pasos/esperado/obtenido por cada uno de los cuatro puntos: son hallazgos de revisión de código, sin reproducción en vivo |
| DEF-24 ([#554](https://github.com/hllous/Backend-M6-DAPS2/issues/554)) | **e2e intermitente.** En el CI de un PR de documentación (#551) falló `test/crew-ownership.e2e-spec.ts` › «una inspección ya cerrada: el ajeno ve 403 (no el 409), el asignado ve 409» por una violación del check constraint `e2e_no_active` sobre `container` (Postgres 23514, en `ServicesService.complete`). Reintentar solo el job fallido pasó. `test/containers-close.e2e-spec.ts` agrega ese constraint temporal y lo borra al terminar; no se sabe por qué estaba activo cuando corrió otra suite (con `maxWorkers: 1`). **Aclaración honesta:** el 08/11, 3 corridas seguidas del e2e dieron resultado idéntico y el 09/11 otras 2 (23 suites y 343 tests, ambas iguales), lo que **no prueba que el defecto no exista**; la causa raíz no está investigada. Además, el 09/11 un e2e completo con la máquina cargada con otras pruebas cayó una vez por un timeout de 30 s en el arranque de una suite: es otro síntoma de inestabilidad (no el mismo constraint), sin investigar. **Contradicción a resolver:** el issue #554 figura cerrado en GitHub desde el 08/11 18:59 UTC sin PR ni comentario, y `test/containers-close.e2e-spec.ts` sigue agregando el constraint temporal | `test/containers-close.e2e-spec.ts:122` y `:128`; `test/jest-e2e.json` (`maxWorkers: 1`); run [42374274615](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/42374274615) | Transversal (HU-33) · abierto en este registro, Menor. Pasos: correr `npm run test:e2e` varias veces. Esperado: el mismo resultado siempre. Obtenido: 1 falla en CI no reproducida |

Un test débil adicional, `services.service.spec.ts:875` (`resolves.toBeDefined()` como única aserción), se registra en `05-informe-ejecucion.md`.

## 4. Defectos cerrados y corregidos

Los 58 issues con etiqueta `bug`, `security` o `fix` están **cerrados** en GitHub (`gh issue list --state all`, 09/11; el 03/11 eran 55). Excepción de criterio: #554 (DEF-24) figura cerrado pero se mantiene abierto en este registro (ver sección 2). Los defectos y brechas de este registro que se cerraron desde entonces están en la tabla siguiente, antes de las filas históricas. Esta sección lista los que más enseñan, con su causa raíz y la **evidencia del cierre**: el commit de la corrección en `develop` y el run del workflow `CI` de ese commit.

Cómo leer la evidencia de CI: «CI verde, run N» significa que `gh run list --workflow CI --commit <sha>` devolvió un *push* a `develop` con conclusión `success`. Prueba que el build, el lint y los tests del repo pasaron en ese commit; no prueba por sí sola que el test nombrado cubra la corrección. Los runs se ven en `https://github.com/hllous/Backend-M6-DAPS2/actions/runs/<N>`. Donde no se ubicó el commit, la tabla dice «corregido (cerrado en #n); ejecución pendiente», sin inventar un verde.

| # | Defecto | Causa raíz | Corrección (commit · fecha) | Evidencia de cierre |
|---|---|---|---|---|
| DEF-05 · [#591](https://github.com/hllous/Backend-M6-DAPS2/issues/591) | Sin control de concurrencia optimista: dos `PATCH` o dos transiciones con los mismos datos de partida, gana el último; no había `ETag`, `If-Match` ni 412 (era Mayor) | Las transiciones tenían un `where` con el estado leído (409), pero nada detectaba que el recurso había cambiado por otra vía; no había versión del recurso en la API | `142e1a3` (PR #597) · 09/11: ETag débil derivado de `updatedAt` (`W/"<epoch ms>"`), `If-Match` opcional, 412 si no coincide; la condición va en el `where` del UPDATE, dentro de la misma transacción que el outbox ([ADR-012](../decisiones/adr-012-concurrencia-optimista-etag.md)). **Limitación conocida:** solo en `containers`, `services`, `tree-interventions` y `environmental-reports`, en sus transiciones y en `PATCH /containers/:id` y `PATCH /services/:id`; no cubre `assign-service`, `assign-crew`, `request-information`, `delay-notices`, `zone-results`, `collection-records` ni las inspecciones. `If-Match` es opcional: un cliente que no lo manda sigue como antes | CI verde, run 42631657048 (PR) y 42632174201 (`develop`). Tests: `src/common/etag.spec.ts`, `src/modules/services/services-if-match.spec.ts` y `test/etag-if-match.e2e-spec.ts` (12 casos, con concurrencia real: dos pedidos con el mismo ETag dan `[200, 412]`). R09 (09/11): pasan |
| DEF-06 · [#592](https://github.com/hllous/Backend-M6-DAPS2/issues/592) | `Idempotency-Key` solo existía en `POST /evidence`: dos `POST /services` iguales creaban dos servicios (era Mayor) | Cada alta se resolvía sola; no había un mecanismo común de reintento seguro | `142e1a3` (PR #597) · 09/11: `Idempotency-Key` opcional en **21** `POST` de creación (`@Idempotent()`); misma clave y mismo cuerpo devuelven la misma respuesta con `Idempotency-Replayed`, otro cuerpo da 422 y uno en curso da 409; tabla `idempotency_record` (migración aditiva) y limpieza diaria a las 3 AM ([ADR-013](../decisiones/adr-013-idempotency-key.md)). **Limitación conocida:** guardar la respuesta **no es atómico** con la transacción de dominio; si el proceso cae entre crear el recurso y guardar la respuesta, un reintento posterior a los 60 s ejecuta de nuevo y el duplicado solo lo frena un `unique` de negocio. Sin la clave, el alta sigue siendo no idempotente | CI verde, run 42631657048 (PR) y 42632174201 (`develop`). Tests: `src/common/idempotency/idempotency.interceptor.spec.ts` y `test/idempotency.e2e-spec.ts` (8 casos). R09: pasan |
| DEF-10 · [#590](https://github.com/hllous/Backend-M6-DAPS2/issues/590) | Errores sin formato Problem Details (RFC 9457): `application/json` con `{ statusCode, message, error, code?, timestamp, path }` (era Mayor) | El filtro global se escribió antes de que la cátedra pidiera el estándar; el contrato histórico lo usan el frontend y los tests | `142e1a3` (PR #597) · 09/11: todo error sale como `application/problem+json` con `type`, `title`, `status`, `detail` e `instance` y, como extensión, los campos históricos; también los errores previos al router (JSON mal formado, cuerpo demasiado grande) y el OpenAPI declara el media type ([ADR-011](../decisiones/adr-011-errores-problem-details-rfc-9457.md)). **Limitaciones conocidas:** `type` es siempre `about:blank` (no hay catálogo de tipos; el `code` cumple ese rol); los campos históricos conviven con los del RFC; **sigue sin id de correlación en los 500** (SEC-W05); el frontend tiene que revisar su parser (issue [Frontend #898](https://github.com/hllous/Frontend-M6-DAPS2/issues/898), abierto) | CI verde, run 42631657048 (PR) y 42632174201 (`develop`). Tests: `src/common/filters/http-exception.filter.spec.ts` y `test/problem-details.e2e-spec.ts` (9 casos: 400, 401, 403, 404, 409, 413, 429, JSON mal formado y token redactado en `instance`). R09: pasan |
| DEF-20 · [#586](https://github.com/hllous/Backend-M6-DAPS2/issues/586) (H-1 de Schemathesis) | Los `GET` con parámetro de ruta UUID o `@Query()` DTO devolvían 400 sin declararlo en el OpenAPI (46 de 65 `GET` el 08/11; era Menor) | El `ValidationPipe` global lanza el 400 pero cada controller tenía que declararlo a mano y nada lo exigía | `142e1a3` (PR #597, issue #593) · 09/11: helper `@ApiBadRequestParams()` en **41** `GET`, caso nuevo en `src/openapi-contract.spec.ts` y `openapi.json` regenerado; el paso `status_code_conformance` de Schemathesis pasó a **bloqueante** | CI verde, run 42631657048 y 42631657018 (`api (newman + schemathesis)`). Test: `src/openapi-contract.spec.ts` › «todo GET con parámetros declara el 400 (DEF-20)». Schemathesis local (09/11): `status_code_conformance` exit 0, 4384 casos, 3913 pasan, 471 salteados (404 por datos de prueba y 429 en 3 operaciones del portal público) |
| DEF-21 (H-2 de Schemathesis) | `GET /neighborhoods` daba 503 sin M9, en el CI y en el `docker compose up`, y se excluía de Schemathesis (era Menor) | No existía el catálogo de barrios de M9 fuera del despliegue | `142e1a3` (PR #597, issue #594) · 09/11: `NEIGHBORHOODS_CATALOG_FILE` carga el snapshot versionado `prisma/data/m9-barrios.json` en local, en el compose y en el CI; la configuración lo **rechaza en producción**. Sin catálogo real sigue dando 503. Schemathesis ya no excluye `/neighborhoods` | CI verde, run 42631657048. Tests: `test/neighborhoods-catalog.e2e-spec.ts` (200 con el catálogo local, 503 sin catálogo) y `src/config/configuration.spec.ts`. Compose en frío (09/11, local): `GET /neighborhoods` 200 |
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

Las filas DEF-05, DEF-06, DEF-10, DEF-20 y DEF-21 (09/11) citan el run de CI del PR #597 y, para DEF-05, DEF-06 y DEF-10, también el del push a `develop` (consultados con `gh run view`). Las filas DEF-01, DEF-02, DEF-03, DEF-12, DEF-16 y DEF-17 citan el estado del issue, no un run. Cada fila con un run de CI citado se verificó con `gh run list --workflow CI --commit`; no se citó ningún run que no se hubiera consultado. Son 26 filas con run verde del 03/11 (algunas agrupan varios issues), 3 más del 08/11 (DEF-07, DEF-22 y DEF-23), 5 del 09/11 (DEF-05, DEF-06, DEF-10, DEF-20 y DEF-21) y una sin evidencia de ejecución (#132); el resto de los cerrados no se detalla acá.

### Hallazgos de proceso (no son defectos del producto)

| ID | Hallazgo | Qué pasó | Estado |
|---|---|---|---|
| P-1 | Secreto de juguete literal en el workflow `api-tests.yml` de #572 | El workflow nuevo tenía un secreto de juguete escrito en el archivo. El job `secrets` (gitleaks sobre todo el historial) lo detectó en el CI: run [42505473347](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/42505473347), commit `e07ad42`, job `secrets` en rojo. No era una credencial real. Se corrigió **reescribiendo la rama** antes de mergear (el workflow genera ahora un secreto efímero) y el job `secrets` volvió a verde en `develop` | Cerrado. Nunca llegó a `develop` |
| P-2 | Dos commits publicados con autor `scratch <scratch@local>` | Los commits `5c8c78b` (rama de #583) y `a06b33b` (rama de #584) se hicieron con una configuración de git local mal puesta. Ambos PR se mergearon con squash: en `develop` el autor es Benjamin Martinez y `scratch <scratch@local>` aparece solo como `Co-authored-by` en `1d600d2` (#583) y `c9a8dc7` (#584). Los commits originales figuran en los PR #583 y #584 | **Abierto, sin reescribir.** El alias `scratch` no corresponde a ningún integrante. Pendiente de decisión del equipo; no se reescribió historial |

## 5. Verificaciones no realizadas (no son defectos)

La regla G9 pide no omitir nada conocido. Estas pruebas **no se hicieron** (estado al 09/11) y no se presentan como hechas.

| Verificación | Estado | Motivo |
|---|---|---|
| Tag `v1.0-testing` en `main` | NO HECHO | Pendiente del equipo (antes de las 13:30 del 10/11, backend y frontend) |
| Quality Gate de SonarCloud | NO HECHO | Pide un administrador de `hllous`; no hay cuenta ni `sonar-project.properties` |
| Job `e2e` obligatorio en la protección de ramas | NO HECHO | Idem: pide admin. El e2e corre y pasa en el CI, pero la regla exige solo `build` y `test` (DEF-14) |
| Prueba de carga con 50 usuarios | **HECHO en local, NO en el despliegue** (09/11) | k6, 50 usuarios, 5 min, solo lecturas: p(95) 32,84 ms, 0,00 % de error. No se midió Render ni Supabase ni ninguna escritura (detalle en `05-informe-ejecucion.md`) |
| OWASP ZAP baseline y activo autenticado | NO HECHO | No se corrió |
| Trivy | NO HECHO | No se corrió |
| Frontend dentro del compose | NO HECHO | Issue [#560](https://github.com/hllous/Backend-M6-DAPS2/issues/560) abierto |
| Verificar `CORS_ORIGINS` y `BFF_SHARED_KEY` en Render | `CORS_ORIGINS`: NO HECHO. `BFF_SHARED_KEY`: **informado por el equipo el 09/11 como configurada en Render y en Vercel; no verificado** | Hay que mirar el panel de Render (DEF-18) |
| Contrato del BFF con el frontend (`X-M6-BFF-Key` y `X-Forwarded-For` en llamadas autenticadas, sobrescribiendo XFF) | NO VERIFICADO | El issue [Frontend #898](https://github.com/hllous/Frontend-M6-DAPS2/issues/898) (abierto) cubre el formato de error, ETag e Idempotency-Key; si pide también la clave del BFF, no se verificó. Que la variable esté cargada no prueba que el BFF la mande |
| Éxito por endpoint en los 91 endpoints restantes | NO HECHO | Hay caso de éxito en 61 de 152 operaciones; el resto está en `test/api/PENDIENTES.md` |
| Apagar el broker de verdad | NO HECHO | Solo en la demo en vivo. El e2e de recuperación corta conexiones, no apaga el broker |
| Mutation score global | NO HECHO | Medido solo en `outbound-requests` (84,21 %); no hay medición del dominio completo |
| Resultado de las alertas de CodeQL | NO VERIFICADO | El workflow corre y termina en `success`; no se revisó la pestaña de alertas |
| Escaneo de secretos con trufflehog | NO HECHO | gitleaks sí se corre (03/11 y en cada PR) |

Hechas desde el 03/11 y que antes figuraban en esta lista: Stryker acotado a `outbound-requests` (#577), suite corrida 3 veces seguidas (08/11, local), RabbitMQ real en el e2e (#579), Schemathesis y Newman (#583), k6 en local (#574, 09/11).

## 6. Plan de corrección propuesto

| Prioridad | Defectos | Acción | Estado al 09/11 |
|---|---|---|---|
| 1 | DEF-04 | Subir `MAX_ATTEMPTS` o reencolar `FAILED` por antigüedad, con test | Sin hacer (`MAX_ATTEMPTS = 5`) |
| 2 | DEF-08, DEF-13 | `npm audit fix`, documentar la mitigación del resto, sumar `npm audit` y Dependabot al CI | **Hecho en parte**: `npm audit fix` (#576), job `audit` informativo y Dependabot (#578). Falta el análisis de explotabilidad, ZAP y Trivy |
| 3 | DEF-15 | Timeout de 5 s con un test que lo dispare de verdad | Sin hacer |
| 4 | DEF-10 | Migrar el filtro a RFC 9457 y avisar al frontend (cambio de contrato) | **Hecho** (#590, PR #597); falta el id de correlación y que el frontend adapte su parser (Frontend #898) |
| 5 | DEF-05, DEF-06 | `ETag`/`If-Match` en un `PATCH` crítico e `Idempotency-Key` en `POST /services`, con un e2e cada uno | **Hecho** (#591 y #592, PR #597), con un e2e cada uno; ver las limitaciones conocidas en la sección 4 |
| 6 | DEF-07 | ~~Throttler global con un e2e de 429~~ | **Hecho** (#568, PR #580) |
| 7 | DEF-11, DEF-14 | Versionar los schemas de M2 o hacer que el CI avise; hacer obligatorio el job `e2e` | Sin hacer (DEF-14 pide admin) |
| 8 | DEF-18, DEF-19 | Corregir los textos, confirmar `CORS_ORIGINS` en Render y decidir qué hacer con `/api/docs` | Sin hacer |
| 9 | DEF-09 | Interceptor de lectura de datos Tier 2 | Sin hacer |
| 10 | DEF-20, DEF-21 | Declarar el 400 en los `GET` con parámetro UUID o query (helper + caso en `openapi-contract.spec.ts`, regenerar `openapi.json` y la colección) y volver bloqueante el paso `status_code_conformance`; seed o mock de barrios para local y CI | **Hecho** (#593 y #594, PR #597) |
| 11 | DEF-24 | Investigar por qué `e2e_no_active` quedaba activo con `maxWorkers: 1` y reemplazar el `ALTER TABLE` temporal | Sin hacer en el código (el issue #554 figura cerrado sin PR) |

Cerrados y fuera del plan: DEF-01, DEF-02, DEF-03, DEF-05, DEF-06, DEF-07, DEF-10, DEF-12, DEF-16, DEF-17, DEF-20, DEF-21, DEF-22 y DEF-23. Lo que sigue abierto con M7, M9 y M2 está en [`bloqueantes.md`](../bloqueantes.md).

Cualquier cambio de código sale en Issues propios, fuera de #494.
