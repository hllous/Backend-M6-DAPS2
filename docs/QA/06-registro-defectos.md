# 06 · Registro de defectos y limitaciones conocidas

> Backend del Módulo 6 (Grupo 04). Estado al **03/11/2026**, sobre `develop` @ `f288d31`; abiertos y cerrados **recontados el 06/11/2026** sobre `develop` @ `aa540be`. Lo cargó el QA desde GitHub Issues, `docs/bloqueantes.md`, el código y la auditoría del 03/11. Todo lo marcado como abierto se **verificó contra el código actual** antes de listarlo.

El equipo usa **GitHub Issues** (`hllous/Backend-M6-DAPS2`) y Trello en lugar de Jira. El identificador de cada defecto es el número de Issue; si el hallazgo todavía no tiene Issue, figura como **sin issue** y se propone abrirlo.

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
| Issues en el repo | 215 al 03/11 (7 abiertos ese día: #257, #299, #442, #447, #488, #494 y #495). Al 06/11 (`gh issue list`) el único abierto es #500; los demás están cerrados |
| Issues con etiqueta `bug`, `security` o `fix` | 55, **todos cerrados** |
| Defectos y brechas abiertos en este registro | 13 de 19 (el 03/11 eran 19 abiertos). Cerrados: DEF-01, DEF-02, DEF-03 y DEF-12 (issues cerrados entre el 03/11 y el 05/11) y DEF-16 y DEF-17 (corregidos el 06/11) |
| Verificaciones no realizadas (no son defectos) | 7 (ver sección 5) |

| Severidad | Abiertos | Dentro del máximo de la cátedra |
|---|---|---|
| Bloqueante | 0 | Sí |
| Crítica | 0 (eran 3 al 03/11: DEF-01, DEF-02 y DEF-03) | Sí |
| Mayor | **9** (eran 10: DEF-12 se cerró) | **No** (máximo 3) |
| Menor | 4 (DEF-14, DEF-15, DEF-18 y DEF-19) | Sí |
| **Total abierto** | **13** (0 + 9 + 4) | |

**Lectura honesta:** el criterio de salida **sigue sin cumplirse por las Mayores** (9 abiertas contra un máximo de 3); las Críticas están en 0. Las Mayores se cierran con trabajo propio que está en el plan de la sección 6. La severidad de las Mayores es una **propuesta**: el equipo y el PO la validan antes de la entrega.

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
| Evidencia | `src/events/outbox/outbox-dispatcher.service.ts:18` (`MAX_ATTEMPTS`), `:42` (`@Interval(10_000)`), `:85-93` (pasa a `FAILED`) |
| Estado | Abierto |
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

#### DEF-07 · Rate limiting solo en el portal ciudadano

| Campo | Detalle |
|---|---|
| ID | sin issue (decisión documentada en `docs/api/endpoints.md`) |
| Severidad / prioridad | Mayor / Media |
| HU | HU-31 (seguridad de la Clase 11) |
| Pasos | Enviar cientos de pedidos por minuto con un token válido a un endpoint autenticado o a `POST /events/inbox` |
| Esperado | `429 Too Many Requests` a partir de un umbral |
| Obtenido | Sin límite. `ThrottlerGuard` está solo en `citizen-portal.controller.ts:30` (20 por minuto en seguimiento, 60 en consulta) |
| Evidencia | Grep de `Throttle` y `APP_GUARD` en `src`. Sin test de 429 en `test/` |
| Estado | **Cerrado por #568**: `ThrottlerGuard` global, topes propios en `POST /events/inbox` y `POST /evidence`, e2e de 429 (`test/throttler.e2e-spec.ts`) |
| Workaround | El JWT lo emite M1 y vence en 15 minutos; no hay login en M6 que atacar |

#### DEF-08 · Dependencias de producción con vulnerabilidades conocidas

| Campo | Detalle |
|---|---|
| ID | sin issue |
| Severidad / prioridad | Mayor (propuesta) / Alta |
| HU | HU-31 |
| Pasos | `npm audit --omit=dev` el 03/11 |
| Esperado | 0 CVE críticas o altas sin mitigación documentada (criterio de la cátedra) |
| Obtenido | 15 vulnerabilidades: **1 crítica, 6 altas, 8 moderadas**. Crítica: `proxy-addr` (suplantación de IP vía subred de IPv6 mapeada a IPv4, transitiva de Express). Altas: `@nestjs/platform-express`, `body-parser`, `multer`, `js-yaml`, `lodash`, `zod` |
| Evidencia | Salida de `npm audit --omit=dev` (detalle en `07-informe-seguridad.md`) |
| Estado | Abierto. **No se analizó la explotabilidad**: M6 usa `trust proxy 1` (número de saltos), no una lista de subredes, y las rutas con multer exigen rol de Campo |
| Workaround | `npm audit fix` resuelve `proxy-addr`, `qs`, `file-type` y `@nestjs/common` sin cambios mayores (según npm). El resto exige subir a NestJS 12, o documentar la mitigación una por una |
| Nota | El CI del backend no corre `npm audit`, por eso nadie lo vio |

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
| Evidencia | `src/common/filters/http-exception.filter.ts:110-117` |
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

#### DEF-13 · Sin ZAP, SCA ni análisis estático de seguridad en el CI

| Campo | Detalle |
|---|---|
| ID | sin issue |
| Severidad / prioridad | Mayor / Alta |
| HU | HU-31 |
| Pasos | Revisar `.github/workflows/ci.yml` |
| Esperado | Escaneo de dependencias, de secretos y análisis dinámico |
| Obtenido | El CI hace build, lint, `test:cov`, OpenAPI al día y e2e. No hay `npm audit`, Dependabot, CodeQL ni ZAP. El escaneo de secretos con gitleaks se sumó al CI (job `secrets`, #494) |
| Evidencia | `.github/workflows/ci.yml` y `.github/` (solo `workflows/`, `CODEOWNERS`, `scripts/`, `branch-protection-rules.json`) |
| Estado | Abierto |

### Menores

| ID | Hallazgo | Evidencia | HU / estado |
|---|---|---|---|
| DEF-14 (sin issue) | El job `e2e` corre en cada PR (último run: 291 pasados) pero no es check obligatorio de la rama: un rojo no frena el merge | `.github/branch-protection-rules.json:17-19` (exige solo `build` y `test`) | Transversal · abierto |
| DEF-15 (sin issue) | El timeout del cliente al Core es de 10 s; la cátedra prueba 5 s. Es efectivo, pero no cumple el valor pedido. No hay circuit breaker ni test que dispare el timeout real | `src/core/core.client.ts:6` y `:150-151` | HU-24 · abierto |
| DEF-18 (sin issue) | `CORS_ORIGINS` es opcional: si falta, la API acepta cualquier origen (sin `credentials`). Hay que confirmar que esté cargada en Render | `src/main.ts:19-27` | HU-31 · abierto, a verificar en el despliegue |
| DEF-19 (sin issue) | Swagger UI queda publicado en `/api/docs` también en producción; los errores 500 no llevan id de correlación y `path` incluye la query string; la evidencia se sirve por URL pública del bucket (protegida solo por una key UUID aleatoria) y los PDF conservan sus metadatos | `src/main.ts:40`; `src/common/filters/http-exception.filter.ts:116`; `src/modules/attachments/storage/r2-evidence.storage.ts:66`; tarjeta SEC-W06 | HU-31 · abierto |

Un test débil adicional, `services.service.spec.ts:875` (`resolves.toBeDefined()` como única aserción), se registra en `05-informe-ejecucion.md`.

## 4. Defectos cerrados y corregidos

Los 55 issues con etiqueta `bug`, `security` o `fix` están **cerrados** en GitHub (`gh issue list --state all`, 03/11). Los defectos y brechas de este registro que se cerraron desde entonces están en la tabla siguiente, antes de las filas históricas. Esta sección lista los que más enseñan, con su causa raíz y la **evidencia del cierre**: el commit de la corrección en `develop` y el run del workflow `CI` de ese commit.

Cómo leer la evidencia de CI: «CI verde, run N» significa que `gh run list --workflow CI --commit <sha>` devolvió un *push* a `develop` con conclusión `success`. Prueba que el build, el lint y los tests del repo pasaron en ese commit; no prueba por sí sola que el test nombrado cubra la corrección. Los runs se ven en `https://github.com/hllous/Backend-M6-DAPS2/actions/runs/<N>`. Donde no se ubicó el commit, la tabla dice «corregido (cerrado en #n); ejecución pendiente», sin inventar un verde.

| # | Defecto | Causa raíz | Corrección (commit · fecha) | Evidencia de cierre |
|---|---|---|---|---|
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

Las cinco filas DEF de arriba citan el estado del issue, no un run. Cada fila con un run de CI citado se verificó con `gh run list --workflow CI --commit`; no se citó ningún run que no se hubiera consultado. Son 26 filas con run verde (algunas agrupan varios issues) y una sin evidencia de ejecución (#132); el resto de los 55 cerrados no se detalla acá.

## 5. Verificaciones no realizadas (no son defectos)

La regla G9 pide no omitir nada conocido. Estas pruebas **no se hicieron** y no se presentan como hechas.

| Verificación | Motivo |
|---|---|
| Mutation testing (Stryker) | No está configurado |
| Prueba de carga con 50 usuarios (k6) | No hay script ni reporte |
| Quality Gate de SonarCloud | No hay configuración ni cuenta |
| OWASP ZAP baseline y activo autenticado | No se corrió |
| Escaneo de secretos con trufflehog | No se corrió. gitleaks v8.30.1 sí se corrió el 03/11/2026 sobre 270 commits: 0 hallazgos con `.gitleaks.toml` (ver `07-informe-seguridad.md`) |
| Caída real del broker durante la demo | Todos los tests de mensajería usan mocks; falta un ensayo manual |
| Suite corrida 3 veces seguidas para detectar tests inestables | Solo hay una corrida local del 03/11; Jest avisó de un worker que no termina (handles abiertos) |

## 6. Plan de corrección propuesto

| Prioridad | Defectos | Acción | Esfuerzo estimado |
|---|---|---|---|
| 1 | DEF-04 | Subir `MAX_ATTEMPTS` o reencolar `FAILED` por antigüedad, con test | 2 h a medio día |
| 2 | DEF-08, DEF-13 | `npm audit fix` para lo no mayor; documentar la mitigación del resto; sumar `npm audit` y Dependabot al CI | 2 h |
| 3 | DEF-15 | Timeout de 5 s con un test que lo dispare de verdad | 1 a 2 h |
| 4 | DEF-10 | Migrar el filtro a RFC 9457 y avisar al frontend (cambio de contrato) | medio día a 1 día |
| 5 | DEF-05, DEF-06 | `ETag`/`If-Match` en un `PATCH` crítico e `Idempotency-Key` en `POST /services`, con un e2e cada uno | 1 día |
| 6 | DEF-07 | ~~Throttler global con un e2e de 429~~ (hecho, #568) | 2 h |
| 7 | DEF-11, DEF-14 | Versionar los schemas de M2 o hacer que el CI avise; hacer obligatorio el job `e2e` | 2 h |
| 8 | DEF-18, DEF-19 | Corregir los textos, confirmar `CORS_ORIGINS` en Render y decidir qué hacer con `/api/docs` | 1 h |
| 9 | DEF-09 | Interceptor de lectura de datos Tier 2 | 1 día |

Cerrados y fuera del plan: DEF-01, DEF-02, DEF-03, DEF-12, DEF-16 y DEF-17. Lo que sigue abierto con M7, M9 y M2 está en [`bloqueantes.md`](../bloqueantes.md).

Cualquier cambio de código sale en Issues propios, fuera de #494.
