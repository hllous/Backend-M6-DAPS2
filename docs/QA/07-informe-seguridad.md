# 07 · Informe de seguridad

> Versión 2.2 · 16/11/2026, cierre de la Entrega 4. Backend del Módulo 6 (Grupo 04), más las pruebas de seguridad del BFF del Frontend que la cátedra prueba en vivo. Los controles de las secciones 3 y 4 se midieron el 10/11/2026 sobre `develop` @ `142e1a3` y se actualizaron el 16/11 sobre `develop` @ `50cfff7` con las pruebas en vivo de #701 (CI [run 43908234945](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/43908234945): 404 e2e, 0 fallos); SonarCloud, Trivy y ZAP se verificaron el 16/11/2026 sobre `main` @ `78bf714`. Base: criterios SEC de la Clase 11 (OWASP ASVS 5.0, OWASP API Security Top 10, Ley 25.326) y las pruebas de seguridad de la consigna.

## 1. Método y regla de evidencia

- Cada control se **reverificó contra el código y los tests actuales**. Los veredictos originales de las tarjetas SEC de Trello quedaron viejos: se citan solo para mostrar qué cambió.
- **Regla de evidencia:** un CUMPLE sin test ejecutado ni evidencia se toma como NO VERIFICABLE. Por eso un CUMPLE acá siempre cita un test que corrió (**R08**: 2746 unitarios y 312 e2e pasan, 4 de 4 en RabbitMQ real, 0 fallos; **R09**: 2854 unitarios y 343 e2e pasan, 0 fallos; sobre `main` @ `78bf714`, 2992 unitarios pasan y el CI está en verde, run [43786978363](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/43786978363); CI de `develop` en verde, run [42632174201](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/42632174201)) o una prueba observable. No repetimos el cotejo test por test de cada CUMPLE en R09: siguen citando la evidencia de R08.
- La revisión de código sola, sin test, deja el control en NO VERIFICABLE.
- Las pruebas de entrada (SQL, NoSQL, XSS, mass assignment, 413, CSP) y las de JWT, BFLA, BOLA, cabeceras, CORS, errores y logs se ejecutan **contra la aplicación levantada en el e2e** (local y CI; `test/security-input.e2e-spec.ts` y, desde el 16/11, `test/security-live.e2e-spec.ts`, 58 tests). El guion `scripts/security-live.mjs` corre los mismos casos contra cualquier URL, incluido Render (sección 7). **Corrida contra Render del 16/11** (Render sirve `main` de la Entrega 4, todavía **sin** #701, y se corrió sin el secreto de Render, así que los 18 casos con token válido quedaron salteados): 9 OK y 3 FALLA, justo los tres que corrige #701 (CSP en `/api/docs`, `path` con la query, `traceId` ausente). Re-correrla contra Render después de promover #701 a `main` queda **PENDIENTE**. El escaneo activo de ZAP corre contra un entorno efímero y contra Render solo el baseline pasivo (5.2).
- Estados: **CUMPLE**, **NO CUMPLE**, **NO VERIFICABLE**, **N/A** (no aplica a este módulo). **Mixto** agrupa los controles con una parte en cada estado.

## 2. Resumen

| Estado | Controles de la Clase 11 (10) | Pruebas de seguridad generales (21 filas) |
|---|---|---|
| CUMPLE | 8 (W01, W02, W04, W05, W06, D01, D02, I01) | 16 (BOLA, BFLA, JWT, mass assignment, inyección SQL, NoSQL, fuerza bruta en el login, rate limiting, SonarCloud, ZAP, dependencias, cabeceras y CSP, CORS, errores sin stack, logs, datos minimizados) |
| Mixto: CUMPLE en una parte, NO VERIFICABLE en otra | 2 (W03, I02) | 2 (XSS, TLS del broker y del HTTP) |
| NO CUMPLE | 0 | 0 |
| NO VERIFICABLE | 0 | 0 |
| N/A | 0 | 3 (XXE, cookies en el backend, hash de contraseñas) |

**Cambios del 16/11/2026** (Eje D, #701 en el Backend; FE #977 en el Frontend): SEC-W05 pasa a **CUMPLE** (los errores llevan `traceId`, igual al header `X-Request-Id` y al log); las cabeceras pasan a **CUMPLE** sin salvedad (`/api/docs` tiene CSP propia y se suma `Permissions-Policy`); la fuerza bruta sobre el login pasa de N/A a **CUMPLE** (el BFF responde 429 desde FE #977; contador por instancia); NoSQL pasa de N/A a **CUMPLE** (los operadores en el body dan 400). Todo eso lo prueba `test/security-live.e2e-spec.ts` (58 tests) y se puede correr en vivo contra cualquier URL con `scripts/security-live.mjs` (sección 7). El escaneo de secretos suma gitleaks con la configuración por defecto y trufflehog (5.4) y el gate de SonarCloud es **bloqueante y requerido** (5.5).

**Hallazgos abiertos:** ninguno Mayor de seguridad. Quedan Menores: Swagger UI público en producción y evidencia servida por URL pública (DEF-38, lo que quedaba de DEF-19), el XSS almacenado que la API guarda literal (la defensa está en el render del frontend) y la DLQ delegada al Core (DEF-37). Cerrados antes: SonarCloud, Trivy y ZAP (DEF-13, #656) con sus hallazgos reales (DEF-25 a DEF-28), auditoría de lecturas Tier 2 (DEF-09, #643), dependencias (DEF-08, #619 y #628), rate limiting (DEF-07, #580), logs con `access_token` (DEF-22, #581), Problem Details (DEF-10), ETag con 412 (DEF-05) e `Idempotency-Key` (DEF-06). No hay hallazgos bloqueantes. Los `DEF-xx` remiten a [`06-registro-defectos.md`](06-registro-defectos.md).

**Lo que no aplica, declarado:** SOAP/WSDL y XXE (el módulo es REST/JSON más RabbitMQ: no expone ni consume SOAP, no publica WSDL y no parsea XML); hash de contraseñas y login propio en el backend (el JWT lo emite M1, ADR-004; el login que sí existe es el del BFF, cubierto en la fila de fuerza bruta); cookies en el backend (el JWT va en el header).

**Decisión de diseño que hay que defender en vivo (ADR-008):** los `GET` de servicios, expedientes e inspecciones **no se filtran por cuadrilla**: cualquier rol de M6, Campo incluido, puede leer por `GET` un servicio de otra cuadrilla. Es a propósito: es un dato operativo municipal, no un dato personal, y Campo necesita ver la cola y el detalle de lo que comparte con Operaciones (ADR-008: «No se filtran los listados»; «Los GET de expedientes e inspecciones quedan abiertos a cualquier rol de M6»). Lo protegido por pertenencia es **la lectura de la evidencia** (fotos y archivos) y **todas las escrituras** sobre el servicio, la inspección y la evidencia. Por eso, en una prueba de BOLA, pedir `GET /services/:id` de otra cuadrilla y recibir 200 **no es un hallazgo**; la prueba de BOLA se hace sobre la evidencia y las escrituras (sección 4, fila BOLA).

## 3. Controles de la Clase 11 (SEC-W01 a SEC-D02)

Origen: tarjetas del tablero «M6 - Histórico de Sprints», lista «Clase 11: Seguridad · Sprint 7» (HU-31).

| ID | Control | Estado hoy | Evidencia | Veredicto original (Trello) |
|---|---|---|---|---|
| **SEC-W01** | Validación del token JWT | **CUMPLE** | `src/auth/jwt.strategy.spec.ts` (`rechaza: %s`, `it.each` de 16 casos que pasan por el flujo real de `passport-jwt` y dan 401: firma incorrecta, `iss` incorrecto o ausente, `typ=refresh`, sin `exp`, **vencido**, **`alg` none**, `alg` RS256, rol ausente o inválido y subtipo inesperado). 401 sin token en `test/services-lifecycle.e2e-spec.ts:53` y `test/auth-roles.e2e-spec.ts`. Algoritmos fijados en `src/auth/jwt.strategy.ts:55` (HS256, HS384, HS512); `iss` obligatorio en `:56`; `ignoreExpiration: false` en `:57` | «Cumple por código; falta ejecutar el test». Decía que no se fijaba el algoritmo: hoy sí |
| **SEC-W02** | Autorización por rol en acciones de gestión | **CUMPLE** | `RolesGuard` global como `APP_GUARD` registrado después de `JwtAuthGuard` (`src/app.module.ts:103-104`); una escritura sin `@Roles` da 403 para todos (`src/common/guards/roles.guard.ts`). `src/auth/route-roles.spec.ts`: toda escritura no pública declara `@Roles`, `M6_AUDITOR` no figura en ninguna escritura y `POST /events/inbox` es solo de `M6_ADMIN`. Matriz 200/401/403 por rol en `test/auth-roles.e2e-spec.ts`. El 403 lleva `code: ROLE_REQUIRED` y no revela qué rol faltaba (`auth-roles.e2e-spec.ts:245`) | **NO CUMPLE**. Está desactualizado: lo cerraron #161 (21/10) y #235 |
| **SEC-W03** | Portal ciudadano: mínima exposición y límite de consultas | **CUMPLE** (a y b) · **CUMPLE con salvedad** (c) | (a) un reclamo sin expediente da 404 sin decir si el ticket existe: `src/modules/citizen-portal/citizen-portal.service.spec.ts:113`. (b) devuelve «exactamente los campos públicos, ni uno más» (`:38`) y no consulta hallazgos, inspector, checklist ni denunciante (`:56`). (c) el límite del portal existe (`ThrottlerGuard` en `citizen-portal.controller.ts`, 20 por minuto en seguimiento según `rate-limits.ts`). **Hay un e2e del 429**: `test/throttler.e2e-spec.ts` (límite global, `GET /zones` con `THROTTLE_LIMIT=3`). **Salvedad:** el e2e prueba el límite global, no el tope de 20 por minuto del portal | «Cumple por código; falta ejecutar el test» |
| **SEC-W04** | Campos no permitidos rechazados | **CUMPLE** | `ValidationPipe` con `whitelist` y `forbidNonWhitelisted` (`src/configure-app.ts:52-55`), la misma configuración en los e2e. `test/services-lifecycle.e2e-spec.ts:61`: un campo extra da 400. `test/security-input.e2e-spec.ts` prueba el caso exacto de la tarjeta: `PATCH /services/:id` con `{status:'COMPLETED'}` (y `role`, `id`, una mezcla) da 400 y la fila queda idéntica; `PATCH /zones/:id` con campos fuera del DTO también | «Cumple por código; falta ejecutar el test» |
| **SEC-W05** | Manejo seguro de errores internos | **CUMPLE** (desde el 16/11, #701) | `src/common/filters/http-exception.filter.ts` responde «Error interno del servidor» y manda el stack solo al log. El cuerpo es Problem Details (RFC 9457, ADR-011). **Id de correlación:** cada error lleva un `traceId`, el mismo del header `X-Request-Id` y del log de la excepción (`http-exception.filter.ts:92-159`); `path` e `instance` salen **sin la query** (`soloRuta`). Probado en `test/security-live.e2e-spec.ts` › «un 500 devuelve Problem Details con traceId y sin stack; el log tiene el mismo traceId», «ruta inexistente: 404 en Problem Details, sin stack» y «JSON mal formado: 400 sin el detalle del parser», más `http-exception.filter.spec.ts` y `test/problem-details.e2e-spec.ts` | «Parcial». Cerrado con #701 (formato con #590, id de correlación con #701) |
| **SEC-W06** | Carga segura de evidencias | **CUMPLE** | (a) un contenido que no coincide con el tipo declarado da 400 y no sube nada (`src/modules/attachments/attachments.service.spec.ts:255`); tipos fuera de la lista blanca (`:237`). (c) se eliminan EXIF y GPS (`:285`, `evidence-file.spec.ts`). (b) **413 por más de 10 MB: ahora hay e2e** (`test/security-input.e2e-spec.ts` › «un archivo de más de 10 MB responde 413 (lo corta multer)»). Limitación conocida: los PDF conservan sus metadatos y la evidencia se sirve por URL pública (DEF-38) | «Cumple por código; falta e2e». El e2e del 413 se sumó después |
| **SEC-D01** | Logs sin secretos ni datos personales | **CUMPLE** (consumidor AMQP y log HTTP) | AMQP: `src/events/consumers/rabbitmq.consumer.spec.ts:329` verifica que un `x-core-last-error` con `NEGOCIO-SECRETO` no aparezca en el log (#317). HTTP: **defecto real corregido (DEF-22, #581)**: el `LoggingInterceptor` registraba la URL completa con su query, incluido un `access_token`. Ahora pasa por `redactUrl` (`src/common/utils/redact-url.ts`). Tests: `src/common/utils/redact-url.spec.ts` (21 nombres sensibles redactados, 8 parámetros legítimos intactos) y `logging.interceptor.spec.ts` › «el log no incluye el token de la query ni el header Authorization» | «Cumple por código; falta ejecutar el test». Antes el log HTTP figuraba NO VERIFICABLE; el PR que sumó el test corrigió además el defecto |
| **SEC-I01** | Idempotencia en el consumo de eventos | **CUMPLE** | `test/inbox.e2e-spec.ts:103` («descarta el mismo eventId sin volver a aplicarlo») corre en el CI. El duplicado lo detecta la base (`messageId` único), no una consulta previa. `test/rabbitmq-real.e2e-spec.ts` lo prueba también por un RabbitMQ real («un eventId repetido se procesa una sola vez») | «Cumple por código; falta ejecutar el e2e». Ya ejecutado |
| **SEC-I02** | Rechazo de eventos que violan el contrato | **CUMPLE** (400 y sin fila) · **NO VERIFICABLE** (apartado en DLQ) | `test/inbox.e2e-spec.ts:131`: el payload inválido da 400 y no deja fila; por un broker real, `rabbitmq-real` («un mensaje inválido no deja fila ni traba al consumer»). El mensaje apartado en una DLQ depende del Core: M6 hace `nack` sin reencolar (#264) y la DLQ es de M9; no se puede probar desde este repo. Los campos extra se toleran a propósito en el bus (`configure-app.ts:44-49`) | «Parcial; revalidar contra develop». Revalidado en parte |
| **SEC-D02** | Auditoría de lectura de datos Tier 2 | **CUMPLE** (#643) | `AuditService.recordRead` (sin interceptor) registra una fila `READ` con el actor del token en las lecturas exitosas de `GET /environmental-inspections/:id/violation-notice`, `GET /events/inbox/:messageId` y `GET /events/outbox/:id`; falla cerrado y 401/403/404 no registran. Riesgo aceptado: `GET /audit` no se audita a sí mismo (`docs/entidades/auditoria.md`). ADR-005 lo exigía para producción | **CUMPLE** (cerrado con #643; antes NO CUMPLE) |

### 3.1 Qué se corrigió respecto de la matriz original

Por control: qué decía la matriz de Trello, qué hay hoy, con qué corrección (issue, PR y commit) y qué test la cubre.

| ID | Original | Hoy | Corrección (issue · PR · commit) | Test que la cubre |
|---|---|---|---|---|
| **SEC-W01** | «Cumple por código; falta ejecutar el test». No fijaba el algoritmo; no verificaba `iss` | **CUMPLE** | #354 · PR #358 · `b9511a7`: validar el JWT de M1 (HS256 con secreto base64, `iss`, `typ` y claim `rol`). #448 · PR #450 · `bd61e3a`: aceptar HS256, HS384 y HS512 | `src/auth/jwt.strategy.spec.ts` (`rechaza: %s`, 16 casos) |
| **SEC-W02** | **NO CUMPLE**: `RolesGuard` y `@Roles` existían pero ningún controller los usaba | **CUMPLE** | #161 · PR #366 · `e6153f9` (base de roles adaptados desde M1) y PR #369 · `f1e1ff6` (**`RolesGuard` global y `@Roles` en todas las escrituras**). #235 (matriz 200/401/403) entró en el mismo PR #369. #466 · PR #468 · `c2d12a8` cerró la lectura de evidencia | `src/auth/route-roles.spec.ts` y `test/auth-roles.e2e-spec.ts` |
| **SEC-W03** | «Cumple por código; falta ejecutar el test». Menores: `ticketId` sin `ParseUUIDPipe` | **CUMPLE** (a, b) · **CUMPLE con salvedad** (c, 429) | #470 · PR #480 · `65dde9f`: el límite cuenta la IP del vecino que reenvía el BFF (con `X-M6-BFF-Key`), no la del BFF. #568 · PR #580 · `fb62519`: `ThrottlerGuard` global y e2e del 429 | `client-tracker.spec.ts`, `citizen-portal.service.spec.ts:38`, `:56` y `:113`, y `test/throttler.e2e-spec.ts` |
| **SEC-W04** | «Cumple por código; falta ejecutar el test» | **CUMPLE** | Sin corrección de código: el e2e existe desde #162 · PR #219 · `8985eb1`. El caso exacto de la tarjeta se probó con #569 · PR #581 | `test/services-lifecycle.e2e-spec.ts:61` y `test/security-input.e2e-spec.ts` |
| **SEC-W05** | «Parcial» | **CUMPLE** | #581: redacción de la query en `path`. #590 · PR #597 · `142e1a3`: errores en Problem Details. #696 · PR #701 · `6704c54`: `traceId` en el cuerpo, el header y el log, y `path` sin query | `http-exception.filter.spec.ts`, `test/problem-details.e2e-spec.ts` y `test/security-live.e2e-spec.ts` |
| **SEC-W06** | «Cumple por código; falta e2e» | **CUMPLE** | Sin cambios en la carga (validación autoritativa, EXIF y nombre: #110 · `34c44a3`). Control de lectura: #466 · PR #468 · `c2d12a8`. e2e del 413: #569 · PR #581 · `a733f44` | `attachments.service.spec.ts:255`, `:285`, `evidence-file.spec.ts` y `test/security-input.e2e-spec.ts` |
| **SEC-D01** | «Cumple por código; falta ejecutar el test» | **CUMPLE** | #317 · `d3b9d08`: saneo de logs del consumidor. #569 · PR #581 · `a733f44`: `redactUrl` en el interceptor de logs y en el `path` de los errores (DEF-22) | `rabbitmq.consumer.spec.ts:329` y `:121`, `redact-url.spec.ts` y `logging.interceptor.spec.ts` |
| **SEC-I01** | «Cumple por código; el e2e ya existe, falta ejecutarlo y adjuntar la captura» | **CUMPLE** | Sin corrección de código. Lo que faltaba era la ejecución | `test/inbox.e2e-spec.ts:103` y `test/rabbitmq-real.e2e-spec.ts` |
| **SEC-I02** | «Parcial; revalidar contra `develop`» | **CUMPLE** (400 y sin fila) · **NO VERIFICABLE** (DLQ) | #189 · PR #215 · `6048655`: rechazar con 400 los eventos con payload inválido. #264 · PR #271 · `3ca3625`: nunca reencolar (`nack` con `requeue=false`) y delegar los reintentos al backoff del Core | `test/inbox.e2e-spec.ts:131` y `src/events/consumers/rabbitmq.consumer.spec.ts` (todo error → `nack`) |
| **SEC-D02** | **NO CUMPLE** | **CUMPLE** | **Cerrado con #643**: auditoría de lectura con `AuditService.recordRead`. Antes, #460 · PR #483 · `39069dc` · 02/11 registraba solo **cambios de estado** | `test/environmental-flow.e2e-spec.ts`, `src/common/audit/audit.service.spec.ts` |

**Resumen de lo corregido:** SEC-W02 pasó de **NO CUMPLE a CUMPLE** (`RolesGuard` global, 21/10); SEC-W01 ganó los algoritmos fijados y la validación de `iss` y `typ`; SEC-D01 pasó de NO VERIFICABLE a CUMPLE, y el PR que sumó el test corrigió un defecto real (el `access_token` de la query en los logs); SEC-W06 ganó el e2e del 413; SEC-W03 ganó un e2e del 429; SEC-D02 pasó a CUMPLE con #643, y SEC-W05 pasó a CUMPLE el 16/11 con #701 (id de correlación). Ningún control de la Clase 11 queda en NO CUMPLE.

## 4. Pruebas de seguridad generales

| Prueba | Resultado esperado | Estado | Evidencia y observaciones |
|---|---|---|---|
| **BOLA / IDOR** (A pide un recurso de B) | 403 o 404, nunca el dato | **CUMPLE** sobre lo que tiene dueño (evidencia y escrituras) | **Cómo se demuestra:** dos integrantes de cuadrillas distintas (A y B) y un servicio de A. `test/security-live.e2e-spec.ts` › describe «BOLA: Campo sobre un recurso de otra cuadrilla → 403, nunca el dato»: B lee la evidencia del servicio de A → 403 `NOT_ASSIGNED` sin URLs (el integrante de A sí la ve); B sube evidencia → 403 y no queda archivo; B suspende, cierra o informa zona → 403 y **la fila no cambia en la base**; otro inspector cierra una inspección asignada → 403 y sigue abierta; `/me` ignora un `userId` en la query; un id inexistente es 404. También `test/crew-ownership.e2e-spec.ts` y `attachments.service.spec.ts`. Un token de ciudadano recibe 403 en todo lo no público. **Decisión de diseño (ADR-008, ver sección 2):** los `GET` de servicios, expedientes e inspecciones no se restringen por cuadrilla; un 200 en `GET /services/:id` de otra cuadrilla es el comportamiento esperado, no un hallazgo |
| **BFLA** (rol sin privilegio invoca un endpoint de administración) | 403 | **CUMPLE** | `test/security-live.e2e-spec.ts` › «BFLA: rol sin permiso → 403 ROLE_REQUIRED» (auditor crea una zona, cuadrilla se asigna `M6_ADMIN`, Operaciones lista roles, ciudadano lee servicios: 403 sin nombrar el rol que falta y sin filas nuevas). Matriz por actor en `test/auth-roles.e2e-spec.ts` y `route-roles.spec.ts`. Tabla endpoint por rol en `docs/api/endpoints.md` |
| **JWT** vencido, firma alterada, `alg=none`, otro emisor | 401 | **CUMPLE** | `test/security-live.e2e-spec.ts` › «JWT inválido → 401»: vencido, payload editado con la firma vieja, otra clave, `alg=none`, otro `iss`, sin `iss`, `typ=refresh`, sin `exp`, `nbf` futuro y basura, contra la app levantada; un token rechazado tampoco escribe. Además `jwt.strategy.spec.ts` (`rechaza: %s`; ver SEC-W01) |
| **Mass assignment** | Ignorado o 400, nunca persistido | **CUMPLE** (400) | `test/security-live.e2e-spec.ts` › «mass assignment → 400 y nada persistido» (`POST /zones`, `/services` con `status: COMPLETED`, `/environmental-reports` con estado y fecha de cierre, `PATCH /services/:id` con `status`, `crewId` ajeno e `id`, `PUT /role-assignments` con un rol fuera del catálogo). `configure-app.ts:52-55`; `test/security-input.e2e-spec.ts` (6 tests): `PATCH /services/:id` con `status`, `role`, `id` o una mezcla da 400 y la fila queda idéntica; `PATCH /zones/:id` con `code` y `createdAt` da 400; un `role` en el body no escala privilegios. También `services-lifecycle.e2e-spec.ts:61` |
| **Inyección SQL** | Sin ejecución | **CUMPLE** | `test/security-input.e2e-spec.ts` (9 tests: `'; DROP TABLE zone;--`, `' OR 1=1--` y `<script>alert(1)</script>` en nombre de zona, dirección y descripción de expediente y notas de servicio): ni 500 ni efectos, el dato vuelve idéntico y la tabla sigue viva. Prisma parametriza; hay 5 consultas crudas, todas con *template tag* y sin `Unsafe`: `src/health/health.controller.ts:58`, `src/modules/crews/crews.service.ts:344`, `src/modules/indicators/indicators.service.ts:367` y `:378`, `src/modules/trees/trees.service.ts:67`. **Qué NO se hizo:** las 5 consultas crudas no tienen un test propio con payloads |
| **NoSQL** | Sin ejecución | **CUMPLE** | La base es PostgreSQL (no hay motor NoSQL), pero se prueba igual: operadores `$gt` y `$ne` en el body → 400 (`test/security-live.e2e-spec.ts` › «operadores NoSQL en el body ($gt, $ne): 400»); un carácter nulo en un texto → 400 |
| **XSS** en campos de texto | Escapado o rechazado | **Mixto** | Los mismos 9 tests de arriba. **La API no rechaza ni escapa el `<script>`: lo guarda como texto y lo devuelve idéntico.** No se ejecuta porque la API responde solo JSON con `nosniff` y `Content-Security-Policy: default-src 'none'`. El criterio literal «escapado o rechazado» **no se cumple en la API**; la defensa real es que el frontend escape al renderizar (React escapa por defecto). El e2e del frontend `e2e/xss-escaping.spec.ts` (FE #977, mergeado el 16/11) lo verifica en la UI; queda Mixto porque la API, por sí sola, no cumple el criterio literal. Los caracteres nulos y el JSON demasiado anidado sí se rechazan (`no-null-chars.pipe.spec.ts`) |
| **XXE** en SOAP | Rechazado | **N/A** | No aplica: M6 no expone ni consume SOAP/WSDL y no parsea XML (REST/JSON y mensajes JSON por RabbitMQ). Un cuerpo XML no llega a ningún parser: no hay `body-parser` de XML |
| **Fuerza bruta sobre el login** | 429 | **CUMPLE**, con salvedad (FE #977) | El backend no tiene login (el JWT lo emite M1); el login que se puede atacar es el del BFF del frontend (`POST /api/session/login`). Desde FE #977 responde **429 con `Retry-After`** tras 5 fallos por cuenta o 20 por IP en 15 minutos; el login correcto reinicia el contador; la respuesta no revela si la cuenta existe; la IP solo se toma de `X-Forwarded-For` en Vercel. Test: `e2e/login-rate-limit.spec.ts`, más los unitarios del limitador y de la IP. Evidencia: `Frontend-M6-DAPS2/docs/security/eje-d-evidencia.md`. **Salvedad:** el contador está en memoria por instancia; en Vercel (serverless) varias instancias tienen contadores separados, así que el límite efectivo puede ser mayor (decisión documentada en un ADR del frontend) |
| **Rate limiting** de la API | 429 | **CUMPLE** (DEF-07, cerrado por #568 · PR #580) | `ThrottlerGuard` global (primer `APP_GUARD`, `src/app.module.ts:100`): 600 por minuto por IP y por endpoint (`THROTTLE_LIMIT`, `THROTTLE_TTL_MS`), `POST /events/inbox` 300 por minuto, `POST /evidence` 30 por minuto, `/health` excluido. e2e en `test/throttler.e2e-spec.ts` (corre en el CI). Decisión en [ADR-010](../decisiones/adr-010-rate-limit-global.md). El 429 sale en Problem Details (`test/problem-details.e2e-spec.ts`). **Límites:** los contadores están en memoria, valen para **una** instancia; y detrás del BFF el límite solo cuenta por vecino si el BFF manda `X-M6-BFF-Key` y sobrescribe `X-Forwarded-For`. `BFF_SHARED_KEY` está configurada en Render y en Vercel (verificado por el equipo); que la variable exista no prueba que el BFF la mande ni que sobrescriba `X-Forwarded-For`, y ese contrato con el frontend sigue **sin verificarse** (el issue [Frontend #898](https://github.com/hllous/Frontend-M6-DAPS2/issues/898) cubre el formato de error, ETag e `Idempotency-Key`). Para la prueba de carga en local se subió `THROTTLE_LIMIT` a 100000; en el despliegue el límite sigue en 600 por minuto |
| **SonarCloud** (Quality Gate) | 0 bugs Blocker/Critical, 0 vulnerabilidades, duplicación ≤ 3 %, ratings A, 100 % hotspots revisados | **CUMPLE** (gate **bloqueante** desde #700) | Análisis de `main` del 16/11/2026: **0 bugs, 0 vulnerabilidades**, duplicación **1,2 %**, confiabilidad, seguridad y mantenibilidad **A**, hotspots **100 %** revisados, cobertura **97,3 %**, **Quality Gate OK**. Antes (15/11, primer análisis): 12 bugs, 23 vulnerabilidades, confiabilidad D y seguridad E. Detalle, tabla antes y ahora y enlaces en 5.5. Desde #700 el job espera el gate (`sonar.qualitygate.wait=true`) y `sonar` es check obligatorio de `develop`, `test` y `main` |
| **OWASP ZAP** (baseline y activo autenticado) | 0 alertas High | **CUMPLE** | Corrida final sobre `main` ([run 43788946357](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/43788946357)): baseline contra Render **0 High**, 1 Medium, 5 Low; activo autenticado **0 High**, 1 Medium. Cada Medium está justificada en 5.2. La High que había (DOMPurify del Swagger UI, DEF-25) se cerró |
| **Dependencias** (SCA) | 0 CVE críticas o altas sin mitigación | **CUMPLE** | Dos SCA independientes. `npm audit --omit=dev`: **0 vulnerabilidades en producción** tras NestJS 12 (#628); sin `overrides` (sección 5.1). Trivy (#658): `fs`, `image` y `config` en **0 HIGH/CRITICAL** sobre `main` (5.2); la imagen traía 6 HIGH del `npm` embebido y corría como root (DEF-26, corregido en #670) |
| **Cabeceras de seguridad** | CSP, HSTS y `X-Content-Type-Options` | **CUMPLE** | `src/common/middleware/security-headers.middleware.ts` pone en la API `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` y en `/api/docs` una CSP propia compatible con Swagger UI (sin scripts en línea; #701, DEF-19), más `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Permissions-Policy` (cámara, micrófono, geolocalización y pagos deshabilitados), `Cross-Origin-Resource-Policy: same-site` y HSTS si `NODE_ENV=production`. `X-Powered-By` deshabilitado. Probado en `test/security-live.e2e-spec.ts` › «cabeceras de seguridad» (API, `/api/docs` con su CSP y sus scripts cargando, HSTS en producción), `security-headers.middleware.spec.ts` y `test/security-input.e2e-spec.ts`. Frontend: CSP, `nosniff`, `X-Frame-Options`, `Referrer-Policy` y `Permissions-Policy` desde FE #958; HSTS desde la app con FE #977. **Pendiente:** la Medium de ZAP de la corrida del 16/11 (CSP ausente en `/api/docs`) es de `main` sin #701; re-correr ZAP tras promover #701 (5.2) |
| **CORS** sin comodín con credenciales | Sin `*` con credenciales | **CUMPLE** | `test/security-live.e2e-spec.ts` › «CORS: el origen permitido se refleja, sin credenciales; con X-Request-Id expuesto» y «CORS: un origen ajeno no recibe Access-Control-Allow-Origin, y nunca *». `src/main.ts:18-34`: sin `CORS_ORIGINS` se acepta cualquier origen, pero **sin `credentials`**, que es la combinación peligrosa. `CORS_ORIGINS` está cargada en Render y desde #642 es obligatoria en producción: sin ella el backend no arranca (DEF-18 cerrado). El CORS expone los headers `ETag` e `Idempotency-Replayed` y deja pasar `If-Match` e `Idempotency-Key` en el preflight (ADR-012 y ADR-013) |
| **Cookies** (`Secure`, `HttpOnly`, `SameSite`) | — | **N/A** en el backend | El backend no emite cookies: el JWT va en el header. La cookie de sesión la emite el BFF del frontend (sellada, `httpOnly`); FE #977 suma un test que verifica `Secure`, `HttpOnly` y `SameSite` |
| **Errores sin stack al cliente** | Sin trazas | **CUMPLE** | `test/security-live.e2e-spec.ts` › «errores sin stack y logs sin datos personales ni tokens» (500 forzado con `traceId`, 404 y JSON roto, todos sin stack). `http-exception.filter.spec.ts`. Los errores salen como `application/problem+json` (ADR-011) |
| **Logs sin datos personales ni tokens** | Sin datos sensibles | **CUMPLE** | Ver SEC-D01. `test/security-live.e2e-spec.ts` › «el log HTTP no registra el Authorization ni el token de la query». El `access_token` de la query se redacta (DEF-22, cerrado) |
| **TLS** en tránsito | Cifrado | **CUMPLE** (broker y Core) · **NO VERIFICABLE** (HTTP) | En producción la validación de arranque exige `amqps://`, prohíbe el usuario `guest` y exige `https://` para el Core y para M1 (`src/config/env.validation.ts`, bloque de producción desde la línea 216), cubierto en `src/config/configuration.spec.ts`. El TLS del HTTP lo termina Render y no se puede probar desde el repo |
| **Hash de contraseñas** | bcrypt o Argon2 | **N/A** | M6 no almacena contraseñas |
| **Datos sensibles minimizados** | — | **CUMPLE** | El portal público devuelve solo etapa, tipo, dirección y fechas (`citizen-portal.service.spec.ts:38` y `:56`). Las URLs de evidencia son públicas, protegidas por una key aleatoria (DEF-38) |

## 5. Resultados de herramientas

### 5.1 Dependencias: `npm audit` (SCA)

**Primera medición, con red:** 15 vulnerabilidades en producción (1 crítica, 6 altas, 8 moderadas); con las dependencias de desarrollo, 64 (2 críticas y 11 altas). El CI del backend no corría `npm audit`, por eso no se había visto. Una corrida previa con `--offline` dio 0 vulnerabilidades; ese resultado venía de la caché local y **no es válido**.

| Severidad | Paquete | Directa | Qué reporta | Corrección |
|---|---|---|---|---|
| Crítica | `proxy-addr` | No (Express) | Suplantación de IP vía subred de IPv6 mapeada a IPv4 (GHSA-jqcg-44mw-7w3h) | **Resuelta** con `npm audit fix` (#566, PR #576) |
| Alta | `@nestjs/platform-express` | Sí | Arrastra `body-parser` y `multer` | **Resuelta** (#628): NestJS 12, con Express 5 |
| Alta | `body-parser` | No | DoS por un `limit` inválido y por bytes sobrantes tras un cuerpo comprimido | **Resuelta** (#619): override a 1.20.9. Desde #628, 2.4.0 por Express 5, sin override |
| Alta | `multer` | No | DoS por un `fileFilter` asíncrono pendiente tras cerrar el pedido (GHSA-q7qp-rjg7-q26m) | **Resuelta** (#619): override, 2.5.0. Desde #628, 2.5.0 por `@nestjs/platform-express` 12, sin override |
| Alta | `js-yaml` | No (Swagger) | Contaminación de prototipo y DoS por claves de fusión | **Resuelta** (#619): override a 4.3.2. Desde #628, 5.5.0 por `@nestjs/swagger` 12, sin override |
| Alta | `lodash` | No | Inyección de código en `_.template` y contaminación de prototipo | **Resuelta** (#619): override a 4.18.1. Desde #628 ya no está en el árbol |
| Alta | `zod` | Sí | Agotamiento de memoria al validar colecciones enormes (GHSA-mrhx-c7xc-m3w5) | **Resuelta** (#619): `zod` 4.6.7 |
| Moderadas | `@nestjs/common`, `@nestjs/config`, `@nestjs/core`, `@nestjs/schedule`, `@nestjs/swagger`, `file-type`, `qs`, `uuid` | Mixto | DoS y neutralización incorrecta de caracteres especiales | Tras #619 seguían 8 moderadas (`@nestjs/core`, `file-type`, `qs`, `uuid` y dependientes `@nestjs/common`, `@nestjs/platform-express` y `@nestjs/schedule`). **Resueltas** (#628): NestJS 12 |

**Lo que se hizo (DEF-08):**

1. `npm audit fix` sin `--force` (#566, PR #576). Resultado en producción: **13 vulnerabilidades, 0 críticas, 6 altas, 7 moderadas**. Build, lint y tests siguieron en verde.
2. Job `audit` en el CI (#578): corre `npm audit --omit=dev --audit-level=high`. Fue **informativo** (con altas terminaba en verde con un aviso `::warning`); desde #628 una alta o crítica en producción pone el CI en rojo y **frena el deploy** a Render (`deploy` depende de `audit`). No es check obligatorio del merge: la protección de ramas exige solo `build` y `test`.
3. Dependabot semanal (`.github/dependabot.yml`), sin los majors de `@nestjs/*` ni de `zod`.
4. #619 (10/11/2026): `overrides` de `body-parser` ^1.20.9, `lodash` ^4.18.1, `js-yaml` ^4.3.2 y `multer` ^2.4.0, y `zod` ^4.6.7. Resultado: **8 vulnerabilidades en producción, 0 críticas, 0 altas, 8 moderadas**. Build, lint (0 errores) y 2855 tests unitarios y 343 e2e en verde (la suite de RabbitMQ real no se corrió).
5. Jest 30 se descartó: NestJS 12 es solo-ESM y Jest no carga sus paquetes, así que los tests pasaron a Vitest (#628).
6. #628 (10/11/2026): NestJS 12 (`@nestjs/core` 12.4.2, `@nestjs/swagger` 12.1.1) y TypeScript 6.0.3, sin los 4 `overrides`. Resultado: **0 vulnerabilidades en producción**. En desarrollo quedan 15 moderadas (`minimatch` vía ESLint, `typescript-eslint` y Stryker; `qs` vía Stryker), antes 37 con 4 altas. Prisma 7 sigue aplazado.

Lo que se comprobó en el código sobre las 6 altas, **antes** de #619 (hoy ya no figuran):

| Alta restante | Qué se comprobó | Qué NO se analizó |
|---|---|---|
| `zod` | Solo lo importan `src/config/env.validation.ts` y `src/identity/m1-identity.client.ts`: valida variables de entorno y respuestas de M1, no cuerpos de usuarios | Si una respuesta de M1 podría traer una colección enorme |
| `@nestjs/platform-express`, `body-parser`, `multer` | La subida de archivos exige token válido y rol (ver `attachments.service.ts` y el límite de 10 MB) | Explotabilidad real del DoS de `multer` y de `body-parser` |
| `@nestjs/swagger`, `js-yaml`, `lodash`, `@nestjs/config` | — | Explotabilidad: no se analizó |

**Estado unificado:** el criterio de dependencias **CUMPLE**: 0 vulnerabilidades en producción tras NestJS 12 (#628) y el job `audit` frena el deploy si aparece una alta o crítica (no frena el merge). Segundo SCA: Trivy (job `trivy`, sección 5.2).

### 5.2 OWASP ZAP

**HECHO** (#659, workflow [`dast.yml`](../../.github/workflows/dast.yml), a demanda y los lunes, sin engancharse al deploy). **Corrida final sobre `main`, 16/11/2026: [run 43788946357](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/43788946357)** (4 min 58 s), con el código que se entrega y DOMPurify 3.4.17 en Render. La primera corrida, del 15/11 sobre la rama `chore/659-zap` ([run 43764318178](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/43764318178), con un disparo temporal por `push` porque `workflow_dispatch` exige el workflow en `main`), dio 1 High en el baseline; es la que archivan los reportes de [`evidencia/zap-2026-11-15/`](evidencia/zap-2026-11-15/). Los artifacts del run final vencen a los 90 días; el reporte final no se archivó en `evidencia/` y se puede volver a generar con el workflow.

Sin reglas ignoradas: no hay archivo de reglas. El workflow falla ante cualquier High.

| | Baseline (pasivo) | Activo (API scan) |
|---|---|---|
| Objetivo | Render, `/api/docs` (sin autenticar) | `docker compose` efímero (base y broker descartables, `JWT_SECRET` de prueba, seed de demo) con `docs/api/openapi.json` |
| Resultado final (16/11, `main`) | **0 High**, 1 Medium, 5 Low | **0 High**, 1 Medium, 0 Low |
| Primera corrida (15/11, rama) | 1 High, 1 Medium, 5 Low, 8 Informational | 0 High, 1 Medium, 0 Low, 7 Informational |
| Autenticación | no aplica | token de rol admin (`test/api/make-token.mjs`) puesto como `Authorization` en todos los pedidos |

**El activo no va contra Render** (escribe datos, choca con el límite de 600 req/min y publicaría al bus del Core). Cambio solo en el entorno efímero: `THROTTLE_LIMIT=1000000` (`.github/dast/compose.dast.yml`); la configuración de producción no cambia. Aun así quedan 429 de los límites fijos de `/public/*` y `POST /evidence`, que son parte del diseño.

**Prueba de que el activo llegó autenticado.** Un proxy de registro delante del backend (`.github/dast/proxy.mjs`) contó cada pedido de ZAP. Corrida del 15/11: **46 577 pedidos, los 46 577 con `Authorization: Bearer`**. Códigos: 400 ×17 560 (mutaciones de ZAP rechazadas por la validación), 403 ×4095 (reglas de rol y de pertenencia a cuadrilla), 422 ×2229 (validación de negocio), 404 ×1174, 429 ×549 (límites fijos de `POST /evidence` y `/public/*`), 2xx ×82 (en 76 rutas distintas) y 409 ×5. **Cero 401.** Tabla completa en `evidencia/zap-2026-11-15/activo-efimero/pedidos-por-codigo.txt`. Una re-corrida tras endurecer el proxy y fijar las actions por SHA ([run 43779076076](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/43779076076)) dio el mismo recuento.

Limitación: ZAP arma los pedidos con los ejemplos del OpenAPI; la mayoría de los ids no existen o los cuerpos no pasan la validación, así que el grueso de las respuestas es 4xx y la cobertura de escrituras exitosas es baja. No se presenta como prueba de ausencia de fallas en la lógica de negocio.

*Primeras corridas, descartadas:* con `-z "-config replacer..."` la action parte la línea por espacios y descarta las comillas, y el escaneo no llevaba el header; se pasó a `ZAP_AUTH_HEADER_VALUE`, la vía soportada por el contenedor de ZAP.

#### Alertas del baseline (Render)

| Riesgo | Alerta | Estado y justificación |
|---|---|---|
| ~~High~~ | *Vulnerable JS Library*: DOMPurify 3.1.4 en `swagger-ui-bundle.js` (solo en la corrida del 15/11) | **Cerrada** (DEF-25, issue [#668](https://github.com/hllous/Backend-M6-DAPS2/issues/668)). No es una dependencia declarada: viene embebida en `swagger-ui-dist`, por eso `npm audit` no la ve. La corrigió #628 en `develop`; con la promoción a `main` Render sirve DOMPurify 3.4.17 y el baseline final da **0 High** |
| Medium | *Content Security Policy (CSP) Header Not Set*, 1 instancia: `/api/docs` (en la corrida final sobre `main` @ `78bf714`) | **Corregida en `develop` el 16/11** ([PR #701](https://github.com/hllous/Backend-M6-DAPS2/pull/701), DEF-19): `/api/docs` ahora manda una CSP propia compatible con Swagger UI (sus scripts pasaron a archivos propios, sin scripts en línea), probada en `test/security-live.e2e-spec.ts`. Render sirve `main`, que todavía no tiene #701: la confirmación con una nueva corrida de ZAP queda **PENDIENTE** hasta la promoción |
| Low | Cross-Origin-Embedder/Opener/Resource-Policy, Permissions Policy, Timestamp Disclosure | Informativas para una API que solo devuelve JSON y un Swagger UI; no se cambian. La Cross-Origin-Resource-Policy de la API ya vale `same-site` (a propósito: el frontend es otro dominio) |
| Informational | Sec-Fetch-\*, Base64 Disclosure, cachés, Modern Web Application | Sin acción: son observaciones sobre los archivos del Swagger UI |

#### Alertas del activo (entorno efímero)

| Riesgo | Alerta | Estado y justificación |
|---|---|---|
| Medium | *Cross-Domain Misconfiguration* (`access-control-allow-origin: *`; 5 instancias el 15/11, 1 Medium en la corrida final) | **Artefacto del entorno efímero, no de producción.** El compose corre con `NODE_ENV=development` y sin `CORS_ORIGINS`, que acepta cualquier origen (`src/main.ts`). En producción la validación de entorno exige `CORS_ORIGINS` con orígenes exactos (#642). Verificado contra Render el 15/11 con `Origin: https://evil.example`: la respuesta **no** trae `access-control-allow-origin`. No se modificó el entorno efímero para esconder la alerta |
| Informational | *Sensitive Information in URL* (`ticketId` en la query de `GET /environmental-reports` y `GET /services`) | Falso positivo del patrón: es un id de ticket usado como filtro, no una credencial |
| Informational | Client Error (415), Non-Storable Content, Sec-Fetch-\* | Sin acción: es el ruido esperado de un escaneo activo |

**Trivy: HECHO (#658), en verde.** Job `trivy` del CI, con tres pasadas (`fs` con lockfile y secretos, `image` con la imagen del `Dockerfile` y `config` con `Dockerfile` y `docker-compose.yml`). Cada una sube su SARIF a Code Scanning (categorías `trivy-fs`, `trivy-image`, `trivy-config`; HIGH y CRITICAL, incluidas las sin fix) y después corre un gate que falla con HIGH/CRITICAL **con fix**. El job frena el deploy (`deploy` depende de él), no el merge.

| Pasada | Resultado en `main` ([run 43786978363](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/43786978363), job `trivy` en verde; 16/11) |
|---|---|
| `fs` (lockfile y secretos) | 0 HIGH/CRITICAL, 0 secretos |
| `image` | 0 HIGH/CRITICAL (antes: 6 HIGH con fix) |
| `config` | 0 HIGH/CRITICAL (antes: 1 HIGH, contenedor como root) |

**Hallazgos de la primera corrida ([run](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/43762807669)):** el gate de `image` falló con 6 HIGH con fix en el `npm` embebido de `node:24-alpine` (brace-expansion 5.0.9 y undici 6.28.0; #665) y el de `config` con DS-0002, el contenedor corría como root (#666). Se corrigieron en `develop` (DEF-26: npm 11.21.2 y `USER node`) y el job quedó en verde sin entradas en `.trivyignore`.

**Tabla de HIGH/CRITICAL sin fix (`.trivyignore`):**

| CVE | Paquete | Justificación | Mitigación |
|---|---|---|---|
| — | — | Ninguna HIGH/CRITICAL sin fix; `.trivyignore` está vacío | — |

**Prueba en rojo (una vez):** con `lodash@4.17.15` (CVE-2020-8203, CVE-2021-23337 y CVE-2026-4800, todas HIGH con fix) en un PR descartable (#664, cerrado sin mergear), los tres gates fallaron: [run](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/43763092974). El gate de `fs` listó las 3 CVE de lodash y el de `image` las encontró también en la imagen.

**Alerta High *Vulnerable JS Library* (DOMPurify, #668, DEF-25): cerrada.** El baseline de ZAP contra Render reportó DOMPurify 3.1.4 en el `swagger-ui-bundle.js` de `/api/docs`. Es la versión que trae `swagger-ui-dist` 5.17.14, la de `main` hasta la promoción (`@nestjs/swagger` 7.4.2). `develop` ya usaba `swagger-ui-dist` 5.34.1 (#628), cuyo bundle trae **DOMPurify 3.4.17** (verificado en `node_modules/swagger-ui-dist/swagger-ui-bundle.js`; la 5.35.0, la última, trae la misma). No se mitigó ocultando `/api/docs`: la corrección es el despliegue. Verificado el 16/11: Render sirve DOMPurify 3.4.17 y el baseline final da 0 High. Queda un aviso de severidad media (GHSA-qm7q-q8h9-jg8q) que solo corrige DOMPurify 3.4.18, hoy en ningún `swagger-ui-dist`; las altas y la crítica de DOMPurify se corrigieron en 3.4.5 y 3.4.17.

### 5.3 CodeQL

El workflow `codeql.yml` corre en el CI y el del commit `142e1a3` terminó en `success` ([run 42632174330](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/42632174330)).

### 5.4 Escaneo de secretos (G6)

En cada PR y push corren dos jobs sobre **todo el historial** (checkout completo, todas las ramas y tags):

| Job | Herramienta | Configuración | Frena |
|---|---|---|---|
| `secrets` | gitleaks v8.30.1 | Con [`.gitleaks.toml`](../../.gitleaks.toml) (reglas por defecto más una lista de valores de juguete excluidos por valor exacto, no por archivo) | Sí: es check obligatorio de `develop`, `test` y `main` |
| `secrets-default` (#695, issue #691) | gitleaks v8.30.1 **con la configuración por defecto** (borra `.gitleaks.toml` y respeta [`.gitleaksignore`](../../.gitleaksignore)) y trufflehog v3.99.9 (verificados, desconocidos y no verificados) | Es como lo correría alguien de afuera, sin nuestras excepciones | Sí, ante cualquier hallazgo de gitleaks en el historial o una credencial **verificada** por trufflehog. El escaneo del estado actual de los archivos y lo no verificado de trufflehog son informativos; los reportes (con los valores redactados) quedan como artifact |

**Resultado del 16/11** (Backend: [run 43903772411](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/43903772411); Frontend: [run 43903780749](https://github.com/hllous/Frontend-M6-DAPS2/actions/runs/43903780749); los dos en verde, y en local da lo mismo):

| Medición | Backend | Frontend |
|---|---|---|
| gitleaks por defecto sobre el historial, respetando `.gitleaksignore` | **0 hallazgos** | **0 hallazgos** |
| Huellas en `.gitleaksignore` | 15 | 511 |
| trufflehog, credenciales **verificadas** (vivas) | **0** | **0** |
| trufflehog, no verificadas | ~50 | 3 |

**Qué hay en `.gitleaksignore` y por qué no se borra el historial.** Cada huella es un hallazgo puntual (commit, archivo, regla y línea) de gitleaks por defecto, revisado a mano: son **valores de juguete** que quedaron en el historial (el secreto de ejemplo de `.env.example`, secretos de prueba de tests unitarios y e2e, tokens de ejemplo y URLs con usuario y clave falsos en documentación). Ninguno es ni fue una credencial real; trufflehog, que intenta autenticarse con lo que encuentra, no verificó ninguno. Se eligió ignorarlos por huella en vez de reescribir el historial porque una huella es exacta: un hallazgo nuevo en el mismo archivo tiene otra huella y frena el job. Los valores de ejemplo que seguían en los archivos actuales se reemplazaron por otros que no parecen secretos (#695), y este informe ya no cita ninguno textualmente.

**Por qué trufflehog sin verificar sigue mostrando hallazgos.** trufflehog reporta como «no verificado» todo lo que coincide con el patrón de un detector pero no pudo autenticarse contra el servicio real: en el Backend, ~50 coincidencias con los mismos valores de juguete (URLs `postgres://` y `amqp://` con credenciales de ejemplo de `docker-compose.yml`, `.env.example` y la documentación, y tokens de prueba); en el Frontend, 3. Que no se verifiquen es justamente la evidencia de que no son credenciales vivas. Por eso el job frena solo ante verificados.

**Incidente (registrado como P-1 en [`06-registro-defectos.md`](06-registro-defectos.md)):** el workflow `api-tests.yml` de #572 llevaba un **secreto de juguete escrito literalmente**. El job `secrets` lo detectó en el CI (run [42505473347](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/42505473347), commit `e07ad42`, job `secrets` en rojo). No era una credencial real; se corrigió **reescribiendo la rama** antes de mergear (ahora el workflow genera un secreto efímero) y nunca llegó a `develop`. Es una prueba de que el control funciona.

Revisión complementaria (todas las ramas): sin claves privadas, claves de AWS ni tokens de GitHub o Slack; `.env` ignorado y nunca versionado (`git log --all -- .env` vacío); sin `.pem`, `.key`, `.p12` ni `.pfx` versionados. El arranque de G1 (`docker compose up` sin `.env`) usa valores por defecto de desarrollo (`cambiame`), declarados como excepción de Sonar `secrets:S6698` en `docker-compose.yml`; no sirven fuera del compose local.

**Un punto sigue abierto:** `.env.example` y `docs/deploy.md` publican el usuario `module_ambiente` y el host del broker del Core. La clave figura como marcador y ninguna herramienta la encontró. Confirmar con M9 si es aceptable que usuario y host sean públicos; si la clave alguna vez se pegó en un commit, hay que **rotarla** en vez de reescribir el historial.

Limitación: gitleaks no analiza el contenido de los PDF ni de los binarios.

### 5.5 SonarCloud (#657)

Job `sonar` del CI (desde #662), con el `lcov` de Vitest; configuración y exclusiones en `sonar-project.properties` (las de cobertura son las de `vitest.config.ts`). Dashboard: [hllous_Backend-M6-DAPS2](https://sonarcloud.io/summary/overall?id=hllous_Backend-M6-DAPS2). Análisis de `main` del 16/11/2026 (57 817 líneas de código):

| Métrica | Exigido | Primer análisis (15/11) | **Final (16/11)** |
|---|---|---|---|
| Quality Gate | Aprobado | rojo | **OK** |
| Bugs | 0 Blocker/Critical | 12 (D) | **0** |
| Vulnerabilidades | 0 | 23 (E) | **0** |
| Rating de confiabilidad / seguridad / mantenibilidad | A | D / E / A | **A / A / A** |
| Duplicación | ≤ 3 % | 1,2 % | **1,2 %** |
| Hotspots revisados | 100 % | 100 % | **100 %** |
| Cobertura | — | 97,3 % | **97,3 %** (líneas 98,8 %) |

- Se llegó a A **corrigiendo en código** (#672 y #675; DEF-27 y DEF-28), no marcando. La última vulnerabilidad, `S8707` en `scripts/build-espacios-verdes.ts:160` (script local con argumentos del propio equipo), la **aceptó el líder en SonarCloud** con su usuario: un «cumple» dictaminado por una IA no vale.
- Las 3 Blocker `S6698` del primer análisis eran URLs de ejemplo con `usuario:usuario@localhost`: **G6 (sin secretos en el historial) nunca estuvo en riesgo**; además se sacaron del código (#675).
- El gate frenó código nuevo dos veces: el proxy de ZAP (2 Blocker: contaminación de prototipo y redirección abierta) y la cobertura de PR nuevos; se corrigieron antes de mergear.
- Vitest y Sonar marcan **las mismas líneas sin cubrir** (la diferencia de porcentaje es solo el denominador).
- **Limitación:** el gate «Sonar way» evalúa código nuevo; por eso las métricas del código total se reportan aparte contra el criterio de la cátedra.
- **Gate bloqueante y requerido (16/11):** desde #700 el job `sonar` corre con `sonar.qualitygate.wait=true` y falla si el gate no pasa (Opción C, paso 2, [ADR-017](../decisiones/adr-017-herramientas-analisis-estatico-y-seguridad.md); #660 cerrado), y `sonar` es check obligatorio de `develop`, `test` y `main` (verificado con la API de GitHub). En el Frontend el gate es bloqueante desde FE #972 (mergeado el 16/11), pero `sonar` todavía no es check obligatorio (**PENDIENTE**).

## 6. Hallazgos y tratamiento

| # | Hallazgo | Severidad propuesta | Tratamiento | Registro |
|---|---|---|---|---|
| 1 | Dependencias de producción: la crítica, las 6 altas y las 8 moderadas se resolvieron | Mayor (cerrado) | **Cerrado** (#619 y #628): `npm audit fix` (#566), `overrides` y `zod` 4, después NestJS 12 sin `overrides`; job `audit` gate y Dependabot (#578). Trivy en DEF-13 | DEF-08 (cerrado) |
| 2 | Sin rate limiting fuera del portal público | Mayor | **Cerrado** (#568, PR #580) | DEF-07 |
| 3 | Sin auditoría de lecturas Tier 2 (SEC-D02) | Mayor (cerrado) | **Cerrado** (#643): `AuditService.recordRead` sobre los tres `GET` con datos Tier 2 | DEF-09 (cerrado) |
| 4 | SonarCloud, Trivy y ZAP no estaban hechos; al hacerlos aparecieron hallazgos reales (6 CVE HIGH del `npm` de la imagen, contenedor como root, DOMPurify del Swagger UI, 12 bugs y 23 vulnerabilidades de Sonar) | Mayor (propuesta) | **Cerrado el 16/11** (#656): corregidos en #670, #671, #672 y #675; Sonar gate OK y A/A/A, Trivy 0 HIGH/CRITICAL, ZAP 0 High. Queda el gate de Sonar no bloqueante (#660) | DEF-13, DEF-25, DEF-26, DEF-27 y DEF-28 (cerrados) |
| 5 | Errores 500 sin id de correlación (SEC-W05) | Mayor | **Cerrado** el 16/11 (#701): `traceId` en el cuerpo, el header `X-Request-Id` y el log. El formato RFC 9457 se cerró antes (#590) | DEF-10 y DEF-19 (cerrados) |
| 6 | CORS abierto si falta `CORS_ORIGINS`; ambas variables cargadas en Render | Menor (cerrado) | **Cerrado** (#642): en producción la validación de entorno exige `CORS_ORIGINS` | DEF-18 |
| 7 | Swagger UI sin CSP | Menor | **Cerrado** el 16/11 (#701): CSP propia en `/api/docs` | DEF-19 (cerrado) |
| 8 | Swagger UI público en producción; evidencia servida por URL pública; los PDF conservan metadatos | Menor | Ocultar `/api/docs` en producción y URLs firmadas, o aceptar el riesgo por escrito | DEF-38 (abierto) |
| 9 | Logs con `access_token` de la query | Mayor (corregido) | **Cerrado** (#581): `redactUrl` en logs y en el `path` de los errores | DEF-22 |
| 10 | Tests de inyección, XSS, 429 y 413 | Menor | **Hecho** (#569, #568): `security-input` y `throttler` | — |
| 11 | No se valida `aud` del JWT | Menor | Justificado: M1 no emite `aud` (`docs/integracion/m1.md`) | — |
| 12 | El login del BFF no limitaba los intentos fallidos (fuerza bruta sin 429) | Mayor (propuesta) | **Cerrado** con FE #977 (429 con `Retry-After`, mergeado el 16/11). Salvedad: contador por instancia | Frontend #969 (cerrado) |
| 13 | gitleaks con la configuración por defecto marcaba valores de juguete del historial | Menor | **Cerrado** (#695 y FE #971): huellas revisadas en `.gitleaksignore`, valores de ejemplo reemplazados y trufflehog sin credenciales verificadas | — |

## 7. Cómo reproducir las pruebas en vivo

| Prueba | Comando o archivo |
|---|---|
| **Pruebas en vivo (Eje D), todas juntas** | `npm run test:e2e -- security-live` (base descartable; ver `docs/testing.md`) |
| **Las mismas contra una URL** (local o Render) | `JWT_SECRET='<el del entorno, base64>' node scripts/security-live.mjs --base-url <URL>`: imprime caso, esperado, obtenido y OK/FALLA, y sale con código 1 si un caso falla. Sin `JWT_SECRET` corre solo los casos sin token válido |
| Fuerza bruta en el login del BFF (frontend) | `pnpm exec playwright test e2e/login-rate-limit.spec.ts` en `Frontend-M6-DAPS2` |
| Rechazo de JWT (16 casos) | `npx vitest run src/auth/jwt.strategy.spec.ts` |
| Roles por endpoint | `npx vitest run src/auth/route-roles.spec.ts` y `npm run test:e2e -- auth-roles` (con una base descartable; ver `docs/testing.md`) |
| Pertenencia de Campo | `npm run test:e2e -- crew-ownership` |
| Mass assignment, SQL, XSS, 413 y CSP | `npm run test:e2e -- security-input` |
| Cabeceras | `npm run test:e2e -- services-lifecycle` |
| Rate limiting (429) | `npm run test:e2e -- throttler` |
| Logs sin token | `npx vitest run src/common/utils/redact-url.spec.ts src/common/interceptors/logging.interceptor.spec.ts` |
| Idempotencia del inbox | `npm run test:e2e -- inbox` |
| Errores en Problem Details | `npm run test:e2e -- problem-details` y `npx vitest run src/common/filters/http-exception.filter.spec.ts` |
| ETag e `If-Match` (412) | `npm run test:e2e -- etag-if-match` y `npx vitest run src/common/etag.spec.ts src/modules/services/services-if-match.spec.ts` |
| `Idempotency-Key` | `npm run test:e2e -- idempotency` y `npx vitest run src/common/idempotency` |
| Consumer contra RabbitMQ real | `npm run test:e2e -- rabbitmq-real` (con `RABBITMQ_URL` local; ver `docs/testing.md`) |
| Secretos (G6) | Jobs `secrets` y `secrets-default` del CI; en local, gitleaks por defecto: `docker run --rm -v "$PWD:/repo" zricethezav/gitleaks:v8.30.1 git /repo --redact --no-banner --log-opts="--all"` tras apartar `.gitleaks.toml` |
| Dependencias | `npm audit --omit=dev` y Trivy: `docker run --rm -v "$PWD:/w" aquasec/trivy:latest fs --severity HIGH,CRITICAL /w` |
| SonarCloud | `curl -s "https://sonarcloud.io/api/qualitygates/project_status?projectKey=hllous_Backend-M6-DAPS2"` y las métricas en el dashboard (5.5) |
| ZAP | Actions → `dast` → *Run workflow* (`docs/testing.md`) |
