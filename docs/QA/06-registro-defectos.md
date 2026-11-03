# 06 · Registro de defectos y limitaciones conocidas

> Backend del Módulo 6 (Grupo 04). Estado al **03/11/2026**, sobre `develop` @ `f288d31`. Lo cargó el QA desde GitHub Issues, `docs/bloqueantes.md`, el código y la auditoría del 03/11. Todo lo marcado como abierto se **verificó contra el código actual** antes de listarlo.

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
| Issues en el repo | 215 (7 abiertos al 03/11: #257, #299, #442, #447, #488, #494 y #495) |
| Issues con etiqueta `bug`, `security` o `fix` | 55, **todos cerrados** |
| Defectos y brechas abiertos en este registro | 19 |
| Verificaciones no realizadas (no son defectos) | 7 (ver sección 5) |

| Severidad | Abiertos | Dentro del máximo de la cátedra |
|---|---|---|
| Bloqueante | 0 | Sí |
| Crítica | **3** (HU Must en curso, ver DEF-01 a DEF-03) | **No** (máximo 0) |
| Mayor | **10** | **No** (máximo 3) |
| Menor | 6 | Sí |

**Lectura honesta:** hoy no se cumple el criterio de salida. Las tres Críticas son HU Must que dependen de otros módulos (M1 y M9) y se cierran con acciones de ellos más pruebas nuestras; las Mayores se cierran con trabajo propio que está en el plan de la sección 6. Las Mayores y Críticas son **propuestas de severidad**: el equipo y el PO las validan antes de la entrega.

## 3. Defectos y brechas abiertos

### Críticas (HU Must incumplida)

#### DEF-01 · Login real con M1 sin probar de punta a punta en el despliegue

| Campo | Detalle |
|---|---|
| ID | [#488](https://github.com/hllous/Backend-M6-DAPS2/issues/488) (backend), FE #800 |
| Severidad / prioridad | Crítica / Alta |
| HU | HU-30 (autenticación real de M1), Must |
| Pasos | 1. Hacer `POST /auth/usuario/login` en M1 con una cuenta de empleado. 2. Llamar `GET /me` en el backend desplegado con ese token. |
| Esperado | 200 con los roles de M6 |
| Obtenido | 401: el `JWT_SECRET` cargado en Render (el del 22/10) no coincide con el que firma M1 hoy (según el issue, probado el 02/11) |
| Evidencia | Texto del issue #488. Comentarios del 02/11 y 03/11 con el pedido del secreto y de 12 cuentas de empleado a M1. Los claims del token pasan `jwt.strategy.ts`; falla solo la firma |
| Estado | **Abierto, esperando a M1.** La demo usa la excepción `M6_AUTH_MODE=backend-development` con un JWT de demo (ADR-004) |
| Causa raíz | Dependencia externa: M1 rotó el secreto y no lo comunicó a M6 |
| Workaround | JWT de demo firmado con `scripts/generate-demo-jwt.mjs` |

#### DEF-02 · Contrato definitivo de M9 sin cerrar

| Campo | Detalle |
|---|---|
| ID | [#257](https://github.com/hllous/Backend-M6-DAPS2/issues/257) |
| Severidad / prioridad | Crítica / Alta |
| HU | HU «Adaptar M6 al contrato de integración definitivo de M9» (ver `02-historias-y-criterios.md`), Must |
| Pasos | Revisar `docs/bloqueantes.md`: el tablero lista decisiones del Core que rompen algo y no están tomadas (validación de `format` en `data`, control de identidad por AMQP, clave de barrio) |
| Esperado | Payloads y routing keys alineados al contrato, y probados contra el Core real |
| Obtenido | Parte implementada (consumidor RabbitMQ, registro de suscripciones, `nack` sin reencolar) y parte pendiente de decisiones de M9 |
| Evidencia | [#257](https://github.com/hllous/Backend-M6-DAPS2/issues/257), [`docs/bloqueantes.md`](../bloqueantes.md), [`docs/integracion/m9.md`](../integracion/m9.md) |
| Estado | **Abierto** |
| Causa raíz | Contrato del Core todavía en definición |

#### DEF-03 · Integración con el Core real sin probar

| Campo | Detalle |
|---|---|
| ID | [#299](https://github.com/hllous/Backend-M6-DAPS2/issues/299) y [#442](https://github.com/hllous/Backend-M6-DAPS2/issues/442) |
| Severidad / prioridad | Crítica / Alta |
| HU | HU-24 (probar M6 contra el Core real), Must |
| Pasos | Publicar en `muni.inbox` y consumir de `q.ambiente` contra el Core real, desde Render |
| Esperado | Eventos de ida y vuelta visibles, con el `eventId` documentado |
| Obtenido | Sin evidencia de la prueba. Hoy todos los tests de mensajería usan mocks o Postgres; ninguno usa un RabbitMQ real |
| Evidencia | Grep de `amqp` en `test/`: sin resultados. Estado de #299 y #442 en GitHub |
| Estado | **Abierto.** M9 habilitó el puerto 5671 para Render el 28/10; la primera prueba es pasiva y se coordina con M9 |
| Causa raíz | Ambiente compartido y único, que exige coordinar con M9 y con los módulos destinatarios |

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
| Estado | Abierto |
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
| Obtenido | `Tests: 12 skipped`. Hay 4 puntos de salto por `PAQUETE_M2_PRESENTE`: `src/events/consumers/m2-ejemplos.spec.ts:32`, `src/events/payloads.spec.ts:427`, `src/modules/environmental-reports/environmental-reports.service.spec.ts:862` y `src/modules/services/services.service.spec.ts:1376`. El paquete vive en `docs/documentacion/`, que no se versiona |
| Evidencia | Log del run: `console.warn` «Paquete de M2 v1.78 ausente» |
| Estado | Abierto |
| Workaround | En local corren si existe la carpeta. Es un hueco del tipo del #314 (ver `09-lecciones-aprendidas.md`; a validar con el equipo) |

#### DEF-12 · Cortes de calle: contrato final de M7 pendiente de la prueba E2E

| Campo | Detalle |
|---|---|
| ID | [#447](https://github.com/hllous/Backend-M6-DAPS2/issues/447) |
| Severidad / prioridad | Mayor / Media |
| HU | HU-05 (derivar un corte de calle) |
| Pasos | Pedir un corte desde un servicio y observar la respuesta de M7 |
| Esperado | `streetClosureRequested` aceptado por M7 y procesado de punta a punta |
| Obtenido | Los tramos `{street, from, to, direction}` ya salen en el formato final (`docs/bloqueantes.md`, fila M7); falta validar las dos suscripciones (`streetClosureEnded` y la histórica) y la prueba E2E |
| Evidencia | `docs/bloqueantes.md`, `docs/integracion/m7.md` |
| Estado | Abierto, esperando a M7 |
| Causa raíz | Contrato de M7 cambió el 28/10 |

#### DEF-13 · Sin ZAP, SCA ni análisis estático de seguridad en el CI

| Campo | Detalle |
|---|---|
| ID | sin issue |
| Severidad / prioridad | Mayor / Alta |
| HU | HU-31 |
| Pasos | Revisar `.github/workflows/ci.yml` |
| Esperado | Escaneo de dependencias, de secretos y análisis dinámico |
| Obtenido | El CI hace build, lint, `test:cov`, OpenAPI al día y e2e. No hay `npm audit`, Dependabot, CodeQL, gitleaks ni ZAP |
| Evidencia | `.github/workflows/ci.yml` y `.github/` (solo `workflows/`, `CODEOWNERS`, `scripts/`, `branch-protection-rules.json`) |
| Estado | Abierto |

### Menores

| ID | Hallazgo | Evidencia | HU / estado |
|---|---|---|---|
| DEF-14 (sin issue) | El job `e2e` corre en cada PR (último run: 291 pasados) pero no es check obligatorio de la rama: un rojo no frena el merge | `.github/branch-protection-rules.json:17-19` (exige solo `build` y `test`) | Transversal · abierto |
| DEF-15 (sin issue) | El timeout del cliente al Core es de 10 s; la cátedra prueba 5 s. Es efectivo, pero no cumple el valor pedido. No hay circuit breaker ni test que dispare el timeout real | `src/core/core.client.ts:6` y `:150-151` | HU-24 · abierto |
| DEF-16 (sin issue) | `AGENTS.md` dice que `@Roles` y `RolesGuard` no se usan; `RolesGuard` es global desde #161 y el spec `route-roles.spec.ts` lo garantiza | `AGENTS.md:36` vs `src/app.module.ts:82-83` | HU-29 · abierto (documentación) |
| DEF-17 (sin issue) | `docs/bloqueantes.md` (revisión del 28/10) dice que `actorId` no se lee; se lee desde #485 | `docs/bloqueantes.md`, fila M1, vs `src/auth/jwt.strategy.ts` | HU-30 · abierto (documentación) |
| DEF-18 (sin issue) | `CORS_ORIGINS` es opcional: si falta, la API acepta cualquier origen (sin `credentials`). Hay que confirmar que esté cargada en Render | `src/main.ts:19-27` | HU-31 · abierto, a verificar en el despliegue |
| DEF-19 (sin issue) | Swagger UI queda publicado en `/api/docs` también en producción; los errores 500 no llevan id de correlación y `path` incluye la query string; la evidencia se sirve por URL pública del bucket (protegida solo por una key UUID aleatoria) y los PDF conservan sus metadatos | `src/main.ts:40`; `src/common/filters/http-exception.filter.ts:116`; `src/modules/attachments/storage/r2-evidence.storage.ts:66`; tarjeta SEC-W06 | HU-31 · abierto |

Un test débil adicional, `services.service.spec.ts:875` (`resolves.toBeDefined()` como única aserción), se registra en `05-informe-ejecucion.md`.

## 4. Defectos cerrados relevantes

Los 55 issues con etiqueta `bug`, `security` o `fix` están cerrados. Se listan los que más enseñan. La causa raíz sale del texto del issue.

| # | Defecto | Cuándo | Causa raíz |
|---|---|---|---|
| [#466](https://github.com/hllous/Backend-M6-DAPS2/issues/466) | `GET /evidence` sin rol ni pertenencia: cualquier token válido leía la evidencia de cualquier dueño | 29/10, cerrado 30/10 (PR #468) | La pertenencia (`assertOwnerAccess`) se aplicó solo al alta; el GET quedó sin `@Roles` y sin chequeo. Lo encontró la revisión del frontend, no un test del backend |
| [#314](https://github.com/hllous/Backend-M6-DAPS2/issues/314) → [#485](https://github.com/hllous/Backend-M6-DAPS2/issues/485) | `updateTicketStatus` mandaba `updatedBy.id` que no era UUID y M2 v1.78 lo rechazaba | 20/10 (#314), 02/11 (#485) | Se enviaba el `sub` numérico del JWT donde el contrato pide UUID o `null`. Los tests contra el paquete de M2 se saltean en el CI (DEF-11) |
| [#470](https://github.com/hllous/Backend-M6-DAPS2/issues/470) | El límite de tasa del portal contaba la IP del BFF: toda la ciudad compartía 20 consultas por minuto | 30/10 | `@nestjs/throttler` cuenta por `req.ip`; detrás de Vercel y Render todas las consultas llegan con la misma IP. Se encontró al integrar el portal en el frontend |
| [#107](https://github.com/hllous/Backend-M6-DAPS2/issues/107) | Un servicio `RESCHEDULED` no se podía cancelar por la API, pero sí por un evento de M2 | 04/09 | Los consumidores del inbox escriben con `updateMany` y no pasan por las tablas de transición: nadie había decidido la regla |
| [#177](https://github.com/hllous/Backend-M6-DAPS2/issues/177) | `resume`, `empty`, `complete-repair` y `confirm-relocation` no validaban el estado de origen | 20/09 | Cada acción validaba que el destino fuera alcanzable, no que el origen fuera el propio de la acción |
| [#166](https://github.com/hllous/Backend-M6-DAPS2/issues/166) | Reparaciones y cortes de calle cambiaban de estado sin tabla de transiciones | 19/09 | `outbound-requests` no usaba `assertTransition` como los demás servicios; lo detectó la revisión del PR de cobertura |
| [#176](https://github.com/hllous/Backend-M6-DAPS2/issues/176) | `?active=false` listaba los activos y `"false"` en un body se guardaba como `true` | 20/09 | `enableImplicitConversion` sin `@Transform`: `Boolean("false") === true` |
| [#178](https://github.com/hllous/Backend-M6-DAPS2/issues/178) | Números fuera de rango y caracteres nulos daban un 500 opaco | 20/09 | Valores que la columna no soporta llegaban a Prisma sin validar |
| [#179](https://github.com/hllous/Backend-M6-DAPS2/issues/179) / [#203](https://github.com/hllous/Backend-M6-DAPS2/issues/203) | `POST /services` y `PATCH /services/:id` saltaban el chequeo de solapamiento de `assign-crew` | 20/09 | El mismo criterio se aplicó en una sola vía de entrada; la segunda apareció al cerrar la primera |
| [#230](https://github.com/hllous/Backend-M6-DAPS2/issues/230) | El cumplimiento marcaba como tarde todo cierre posterior a las 21 h | 22/09 | Se comparaba el día en UTC; un cierre a las 23:30 de Argentina caía en el día siguiente |
| [#168](https://github.com/hllous/Backend-M6-DAPS2/issues/168) | El inbox guardaba el contenido completo de tickets que no eran de M6 | 19/09 | `ingest()` insertaba el payload antes de que el handler decidiera si el evento era propio |
| [#142](https://github.com/hllous/Backend-M6-DAPS2/issues/142) | `ticketUpdated` no filtraba por responsable: un ticket ajeno abría expediente | 10/09 | `ticketUpdated` es un broadcast y el handler no revisaba el área responsable |
| [#264](https://github.com/hllous/Backend-M6-DAPS2/issues/264), [#270](https://github.com/hllous/Backend-M6-DAPS2/issues/270), [#275](https://github.com/hllous/Backend-M6-DAPS2/issues/275) | `nack` con reencolado, y handlers que pisaban estado más nuevo o perdían eventos atrasados | 08/10 | Política de reintentos propia en lugar de delegar en el backoff del Core; el Core no garantiza orden |
| [#338](https://github.com/hllous/Backend-M6-DAPS2/issues/338) | `cancelled()` dejaba pegada la solicitud de información y `close()` daba 409 para siempre | 20/10 | Una revisión independiente de la lógica de cierre llegó después del merge |
| [#451](https://github.com/hllous/Backend-M6-DAPS2/issues/451) | La reparación se podía derivar desde cualquier inspección, también por olores | 29/10 | No se validaba tipo ni resultado de la inspección. Surgió del documento de QA externo (QA-CA-002 y QA-CA-006) |
| [#132](https://github.com/hllous/Backend-M6-DAPS2/issues/132) | Todos los deploys a Render fallaban desde #126 y nadie lo notó | 08/09 | `scripts/generate-openapi.ts` quedó dentro del build y movió la salida a `dist/src/`, pero el `Dockerfile` buscaba `dist/main.js`. Render mantenía viva la última build buena |
| [#158](https://github.com/hllous/Backend-M6-DAPS2/issues/158) | Agujeros de la auditoría del 18/09: sobre de M2 rechazado, alerta sin ventana, `multer` con CVE de DoS, límite de tasa compartido | 18/09 | Varias causas chicas: ver el issue |
| [#448](https://github.com/hllous/Backend-M6-DAPS2/issues/448) | La validación del JWT aceptaba solo HS256 y habría rechazado HS384 o HS512 | 28/10 | M1 usa JJWT, que elige el algoritmo por el largo de la clave |

## 5. Verificaciones no realizadas (no son defectos)

La regla G9 pide no omitir nada conocido. Estas pruebas **no se hicieron** y no se presentan como hechas.

| Verificación | Motivo |
|---|---|
| Mutation testing (Stryker) | No está configurado |
| Prueba de carga con 50 usuarios (k6) | No hay script ni reporte |
| Quality Gate de SonarCloud | No hay configuración ni cuenta |
| OWASP ZAP baseline y activo autenticado | No se corrió |
| Escaneo de secretos con gitleaks o trufflehog | No están instalados; solo se usó una búsqueda por expresiones regulares en el historial (ver `07-informe-seguridad.md`) |
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
| 6 | DEF-07 | Throttler global con un e2e de 429 | 2 h |
| 7 | DEF-11, DEF-14 | Versionar los schemas de M2 o hacer que el CI avise; hacer obligatorio el job `e2e` | 2 h |
| 8 | DEF-16, DEF-17, DEF-18, DEF-19 | Corregir los textos, confirmar `CORS_ORIGINS` en Render y decidir qué hacer con `/api/docs` | 1 h |
| 9 | DEF-01, DEF-02, DEF-03, DEF-12 | Dependen de M1, M9 y M7: seguir los pedidos y probar apenas respondan | no estimable |
| 10 | DEF-09 | Interceptor de lectura de datos Tier 2 | 1 día |

Cualquier cambio de código sale en Issues propios, fuera de #494.
