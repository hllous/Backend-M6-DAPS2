# 07 · Informe de seguridad

> Versión 2.0 · 10/11/2026. Backend del Módulo 6 (Grupo 04), sobre `develop` @ `142e1a3`. Base: criterios SEC de la Clase 11 (OWASP ASVS 5.0, OWASP API Security Top 10, Ley 25.326) y las pruebas de seguridad de la consigna.

## 1. Método y regla de evidencia

- Cada control se **reverificó contra el código y los tests actuales**. Los veredictos originales de las tarjetas SEC de Trello quedaron viejos: se citan solo para mostrar qué cambió.
- **Regla de evidencia:** un CUMPLE sin test ejecutado ni evidencia se toma como NO VERIFICABLE. Por eso un CUMPLE acá siempre cita un test que corrió (**R08**: 2746 unitarios y 312 e2e pasan, 4 de 4 en RabbitMQ real, 0 fallos; **R09**: 2854 unitarios y 343 e2e pasan, 0 fallos; CI de `develop` en verde, run [42632174201](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/42632174201)) o una prueba observable. No repetimos el cotejo test por test de cada CUMPLE en R09: siguen citando la evidencia de R08.
- La revisión de código sola, sin test, deja el control en NO VERIFICABLE.
- Las pruebas de entrada (SQL, XSS, mass assignment, 413, CSP) se ejecutaron **contra la aplicación levantada en el e2e local y en el CI**, no contra el despliegue de Render. No ejecutamos ataques en vivo contra el despliegue ni corrimos ZAP ni Trivy. Lo que depende de eso figura como NO VERIFICABLE o NO HECHO.
- Estados: **CUMPLE**, **NO CUMPLE**, **NO VERIFICABLE**, **N/A** (no aplica a este módulo). **Mixto** agrupa los controles con una parte en cada estado.

## 2. Resumen

| Estado | Controles de la Clase 11 (10) | Pruebas de seguridad generales (20 filas) |
|---|---|---|
| CUMPLE | 6 (W01, W02, W04, W06, D01, I01) | 10 (BOLA, BFLA, JWT, mass assignment, inyección SQL, rate limiting, CORS, errores sin stack, logs, datos minimizados) |
| Mixto: CUMPLE en una parte, NO CUMPLE o NO VERIFICABLE en otra | 2 (W03, I02) | 3 (XSS, cabeceras y CSP, TLS del broker y del HTTP) |
| NO CUMPLE | 2 (W05, D02) | 1 (dependencias) |
| NO VERIFICABLE | 0 | 1 (ZAP) |
| N/A | 0 | 5 (NoSQL, XXE, fuerza bruta en login, cookies, hash de contraseñas) |

Hallazgos mayores abiertos: **dependencias con 6 altas aceptadas como riesgo, sin análisis de explotabilidad** (DEF-08), **sin auditoría de lecturas Tier 2** (DEF-09), **errores 500 sin id de correlación** (SEC-W05; el formato RFC 9457 ya está hecho: DEF-10), **sin ZAP ni Trivy** (DEF-13). Cerrados: **rate limiting** (DEF-07, #580), **logs con `access_token`** (DEF-22, #581), **errores en Problem Details** (DEF-10, #590; no cambia el veredicto de SEC-W05 por el id de correlación), **ETag con 412** (DEF-05, #591) e **`Idempotency-Key`** (DEF-06, #592). No hay hallazgos bloqueantes. Los `DEF-xx` remiten a [`06-registro-defectos.md`](06-registro-defectos.md).

## 3. Controles de la Clase 11 (SEC-W01 a SEC-D02)

Origen: tarjetas del tablero «M6 - Histórico de Sprints», lista «Clase 11: Seguridad · Sprint 7» (HU-31).

| ID | Control | Estado hoy | Evidencia | Veredicto original (Trello) |
|---|---|---|---|---|
| **SEC-W01** | Validación del token JWT | **CUMPLE** | `src/auth/jwt.strategy.spec.ts` (`rechaza: %s`, `it.each` de 16 casos que pasan por el flujo real de `passport-jwt` y dan 401: firma incorrecta, `iss` incorrecto o ausente, `typ=refresh`, sin `exp`, **vencido**, **`alg` none**, `alg` RS256, rol ausente o inválido y subtipo inesperado). 401 sin token en `test/services-lifecycle.e2e-spec.ts:53` y `test/auth-roles.e2e-spec.ts`. Algoritmos fijados en `src/auth/jwt.strategy.ts:55` (HS256, HS384, HS512); `iss` obligatorio en `:56`; `ignoreExpiration: false` en `:57` | «Cumple por código; falta ejecutar el test». Decía que no se fijaba el algoritmo: hoy sí |
| **SEC-W02** | Autorización por rol en acciones de gestión | **CUMPLE** | `RolesGuard` global como `APP_GUARD` registrado después de `JwtAuthGuard` (`src/app.module.ts:103-104`); una escritura sin `@Roles` da 403 para todos (`src/common/guards/roles.guard.ts`). `src/auth/route-roles.spec.ts`: toda escritura no pública declara `@Roles`, `M6_AUDITOR` no figura en ninguna escritura y `POST /events/inbox` es solo de `M6_ADMIN`. Matriz 200/401/403 por rol en `test/auth-roles.e2e-spec.ts`. El 403 lleva `code: ROLE_REQUIRED` y no revela qué rol faltaba (`auth-roles.e2e-spec.ts:245`) | **NO CUMPLE**. Está desactualizado: lo cerraron #161 (21/10) y #235 |
| **SEC-W03** | Portal ciudadano: mínima exposición y límite de consultas | **CUMPLE** (a y b) · **CUMPLE con salvedad** (c) | (a) un reclamo sin expediente da 404 sin decir si el ticket existe: `src/modules/citizen-portal/citizen-portal.service.spec.ts:113`. (b) devuelve «exactamente los campos públicos, ni uno más» (`:38`) y no consulta hallazgos, inspector, checklist ni denunciante (`:56`). (c) el límite del portal existe (`ThrottlerGuard` en `citizen-portal.controller.ts`, 20 por minuto en seguimiento según `rate-limits.ts`). **Hay un e2e del 429**: `test/throttler.e2e-spec.ts` (límite global, `GET /zones` con `THROTTLE_LIMIT=3`). **Salvedad:** el e2e prueba el límite global, no el tope de 20 por minuto del portal | «Cumple por código; falta ejecutar el test» |
| **SEC-W04** | Campos no permitidos rechazados | **CUMPLE** | `ValidationPipe` con `whitelist` y `forbidNonWhitelisted` (`src/configure-app.ts:52-55`), la misma configuración en los e2e. `test/services-lifecycle.e2e-spec.ts:61`: un campo extra da 400. `test/security-input.e2e-spec.ts` prueba el caso exacto de la tarjeta: `PATCH /services/:id` con `{status:'COMPLETED'}` (y `role`, `id`, una mezcla) da 400 y la fila queda idéntica; `PATCH /zones/:id` con campos fuera del DTO también | «Cumple por código; falta ejecutar el test» |
| **SEC-W05** | Manejo seguro de errores internos | **NO CUMPLE** (mensaje y stack: cumple; formato: cumple; id de correlación: no existe) | Cumple el mensaje genérico y que no se filtre el stack: `src/common/filters/http-exception.filter.ts` responde «Error interno del servidor» y manda el stack solo al log (`http-exception.filter.spec.ts`, «deja en 500 cualquier error no contemplado»). **El cuerpo es Problem Details (RFC 9457, `application/problem+json`, ADR-011)**, también para el JSON mal formado y el cuerpo grande (`test/problem-details.e2e-spec.ts`). **Sigue sin existir el id de correlación** que pide la tarjeta (ni en el filtro ni en el interceptor). `instance` y `path` incluyen la query string, con los parámetros sensibles redactados (`http-exception.filter.ts:131-141`, desde #581) | «Parcial». Mejoró el formato; el id de correlación sigue pendiente |
| **SEC-W06** | Carga segura de evidencias | **CUMPLE** | (a) un contenido que no coincide con el tipo declarado da 400 y no sube nada (`src/modules/attachments/attachments.service.spec.ts:255`); tipos fuera de la lista blanca (`:237`). (c) se eliminan EXIF y GPS (`:285`, `evidence-file.spec.ts`). (b) **413 por más de 10 MB: ahora hay e2e** (`test/security-input.e2e-spec.ts` › «un archivo de más de 10 MB responde 413 (lo corta multer)»). Limitación conocida: los PDF conservan sus metadatos y la evidencia se sirve por URL pública (DEF-19) | «Cumple por código; falta e2e». El e2e del 413 se sumó después |
| **SEC-D01** | Logs sin secretos ni datos personales | **CUMPLE** (consumidor AMQP y log HTTP) | AMQP: `src/events/consumers/rabbitmq.consumer.spec.ts:329` verifica que un `x-core-last-error` con `NEGOCIO-SECRETO` no aparezca en el log (#317). HTTP: **defecto real corregido (DEF-22, #581)**: el `LoggingInterceptor` registraba la URL completa con su query, incluido un `access_token`. Ahora pasa por `redactUrl` (`src/common/utils/redact-url.ts`). Tests: `src/common/utils/redact-url.spec.ts` (21 nombres sensibles redactados, 8 parámetros legítimos intactos) y `logging.interceptor.spec.ts` › «el log no incluye el token de la query ni el header Authorization» | «Cumple por código; falta ejecutar el test». Antes el log HTTP figuraba NO VERIFICABLE; el PR que sumó el test corrigió además el defecto |
| **SEC-I01** | Idempotencia en el consumo de eventos | **CUMPLE** | `test/inbox.e2e-spec.ts:103` («descarta el mismo eventId sin volver a aplicarlo») corre en el CI. El duplicado lo detecta la base (`messageId` único), no una consulta previa. `test/rabbitmq-real.e2e-spec.ts` lo prueba también por un RabbitMQ real («un eventId repetido se procesa una sola vez») | «Cumple por código; falta ejecutar el e2e». Ya ejecutado |
| **SEC-I02** | Rechazo de eventos que violan el contrato | **CUMPLE** (400 y sin fila) · **NO VERIFICABLE** (apartado en DLQ) | `test/inbox.e2e-spec.ts:131`: el payload inválido da 400 y no deja fila; por un broker real, `rabbitmq-real` («un mensaje inválido no deja fila ni traba al consumer»). El mensaje apartado en una DLQ depende del Core: M6 hace `nack` sin reencolar (#264) y la DLQ es de M9; no se puede probar desde este repo. Los campos extra se toleran a propósito en el bus (`configure-app.ts:44-49`) | «Parcial; revalidar contra develop». Revalidado en parte |
| **SEC-D02** | Auditoría de lectura de datos Tier 2 | **NO CUMPLE** | No hay interceptor de lecturas. `src/common/audit/` registra solo cambios de estado (#460). El ADR-005 lo exige para producción (`docs/decisiones/adr-005-alineacion-frontend-sesion-y-seguridad.md:22` y `:46`) | **NO CUMPLE**. Sigue igual |

### 3.1 Qué se corrigió respecto de la matriz original

Por control: qué decía la matriz de Trello, qué hay hoy, con qué corrección (issue, PR y commit) y qué test la cubre.

| ID | Original | Hoy | Corrección (issue · PR · commit) | Test que la cubre |
|---|---|---|---|---|
| **SEC-W01** | «Cumple por código; falta ejecutar el test». No fijaba el algoritmo; no verificaba `iss` | **CUMPLE** | #354 · PR #358 · `b9511a7`: validar el JWT de M1 (HS256 con secreto base64, `iss`, `typ` y claim `rol`). #448 · PR #450 · `bd61e3a`: aceptar HS256, HS384 y HS512 | `src/auth/jwt.strategy.spec.ts` (`rechaza: %s`, 16 casos) |
| **SEC-W02** | **NO CUMPLE**: `RolesGuard` y `@Roles` existían pero ningún controller los usaba | **CUMPLE** | #161 · PR #366 · `e6153f9` (base de roles adaptados desde M1) y PR #369 · `f1e1ff6` (**`RolesGuard` global y `@Roles` en todas las escrituras**). #235 (matriz 200/401/403) entró en el mismo PR #369. #466 · PR #468 · `c2d12a8` cerró la lectura de evidencia | `src/auth/route-roles.spec.ts` y `test/auth-roles.e2e-spec.ts` |
| **SEC-W03** | «Cumple por código; falta ejecutar el test». Menores: `ticketId` sin `ParseUUIDPipe` | **CUMPLE** (a, b) · **CUMPLE con salvedad** (c, 429) | #470 · PR #480 · `65dde9f`: el límite cuenta la IP del vecino que reenvía el BFF (con `X-M6-BFF-Key`), no la del BFF. #568 · PR #580 · `fb62519`: `ThrottlerGuard` global y e2e del 429 | `client-tracker.spec.ts`, `citizen-portal.service.spec.ts:38`, `:56` y `:113`, y `test/throttler.e2e-spec.ts` |
| **SEC-W04** | «Cumple por código; falta ejecutar el test» | **CUMPLE** | Sin corrección de código: el e2e existe desde #162 · PR #219 · `8985eb1`. El caso exacto de la tarjeta se probó con #569 · PR #581 | `test/services-lifecycle.e2e-spec.ts:61` y `test/security-input.e2e-spec.ts` |
| **SEC-W05** | «Parcial» | **NO CUMPLE** | #581: redacción de la query en `path`. #590 · PR #597 · `142e1a3`: errores en Problem Details. Sigue sin id de correlación | `http-exception.filter.spec.ts` (mensaje genérico y sin stack; Problem Details) y `test/problem-details.e2e-spec.ts` |
| **SEC-W06** | «Cumple por código; falta e2e» | **CUMPLE** | Sin cambios en la carga (validación autoritativa, EXIF y nombre: #110 · `34c44a3`). Control de lectura: #466 · PR #468 · `c2d12a8`. e2e del 413: #569 · PR #581 · `a733f44` | `attachments.service.spec.ts:255`, `:285`, `evidence-file.spec.ts` y `test/security-input.e2e-spec.ts` |
| **SEC-D01** | «Cumple por código; falta ejecutar el test» | **CUMPLE** | #317 · `d3b9d08`: saneo de logs del consumidor. #569 · PR #581 · `a733f44`: `redactUrl` en el interceptor de logs y en el `path` de los errores (DEF-22) | `rabbitmq.consumer.spec.ts:329` y `:121`, `redact-url.spec.ts` y `logging.interceptor.spec.ts` |
| **SEC-I01** | «Cumple por código; el e2e ya existe, falta ejecutarlo y adjuntar la captura» | **CUMPLE** | Sin corrección de código. Lo que faltaba era la ejecución | `test/inbox.e2e-spec.ts:103` y `test/rabbitmq-real.e2e-spec.ts` |
| **SEC-I02** | «Parcial; revalidar contra `develop`» | **CUMPLE** (400 y sin fila) · **NO VERIFICABLE** (DLQ) | #189 · PR #215 · `6048655`: rechazar con 400 los eventos con payload inválido. #264 · PR #271 · `3ca3625`: nunca reencolar (`nack` con `requeue=false`) y delegar los reintentos al backoff del Core | `test/inbox.e2e-spec.ts:131` y `src/events/consumers/rabbitmq.consumer.spec.ts` (todo error → `nack`) |
| **SEC-D02** | **NO CUMPLE** | **NO CUMPLE** | **Sin cambios**: el interceptor de lecturas no existe. Lo más cercano, #460 · PR #483 · `39069dc` · 02/11, registra solo **cambios de estado** | `test/audit.e2e-spec.ts` (cubre las escrituras, no las lecturas) |

**Resumen de lo corregido:** SEC-W02 pasó de **NO CUMPLE a CUMPLE** (`RolesGuard` global, 21/10); SEC-W01 ganó los algoritmos fijados y la validación de `iss` y `typ`; SEC-D01 pasó de NO VERIFICABLE a CUMPLE, y el PR que sumó el test corrigió un defecto real (el `access_token` de la query en los logs); SEC-W06 ganó el e2e del 413; SEC-W03 ganó un e2e del 429. **No cambiaron** de veredicto SEC-W05 (mejoró el formato con #590, falta el id de correlación) y SEC-D02, que siguen abiertos.

## 4. Pruebas de seguridad generales

| Prueba | Resultado esperado | Estado | Evidencia y observaciones |
|---|---|---|---|
| **BOLA / IDOR** (A pide un recurso de B) | 403 o 404, nunca el dato | **CUMPLE** para recursos con dueño | Campo solo actúa sobre lo propio: `test/crew-ownership.e2e-spec.ts:66` (403 `NOT_ASSIGNED`) y la matriz propio, ajeno y sin cuadrilla. La lectura de evidencia también (#466): `attachments.service.spec.ts:543`. Un token de ciudadano recibe 403 en todo lo no público (`src/common/guards/jwt-auth.guard.spec.ts:59`, `test/inbox.e2e-spec.ts:363`). **Matiz de diseño:** Oficina, Auditoría y Campo leen todos los recursos por `GET`; el dominio es compartido y no hay datos «por usuario». Hay que defenderlo en la prueba |
| **BFLA** (rol sin privilegio invoca un endpoint de administración) | 403 | **CUMPLE** | Matriz por actor en `test/auth-roles.e2e-spec.ts` (`it.each(TODOS)`, `:169`) y `route-roles.spec.ts`. Tabla endpoint por rol en `docs/api/endpoints.md`, generada de la metadata |
| **JWT** vencido, firma alterada, `alg=none`, otro emisor | 401 | **CUMPLE** | `jwt.strategy.spec.ts` (`rechaza: %s`; ver SEC-W01) |
| **Mass assignment** | Ignorado o 400, nunca persistido | **CUMPLE** (400) | `configure-app.ts:52-55`; `test/security-input.e2e-spec.ts` (6 tests): `PATCH /services/:id` con `status`, `role`, `id` o una mezcla da 400 y la fila queda idéntica; `PATCH /zones/:id` con `code` y `createdAt` da 400; un `role` en el body no escala privilegios. También `services-lifecycle.e2e-spec.ts:61` |
| **Inyección SQL** | Sin ejecución | **CUMPLE** | `test/security-input.e2e-spec.ts` (9 tests: `'; DROP TABLE zone;--`, `' OR 1=1--` y `<script>alert(1)</script>` en nombre de zona, dirección y descripción de expediente y notas de servicio): ni 500 ni efectos, el dato vuelve idéntico y la tabla sigue viva. Prisma parametriza; hay 5 consultas crudas, todas con *template tag* y sin `Unsafe`: `src/health/health.controller.ts:58`, `src/modules/crews/crews.service.ts:344`, `src/modules/indicators/indicators.service.ts:367` y `:378`, `src/modules/trees/trees.service.ts:67`. **Qué NO se hizo:** las 5 consultas crudas no tienen un test propio con payloads |
| **NoSQL** | — | **N/A** | La base es PostgreSQL |
| **XSS** en campos de texto | Escapado o rechazado | **Mixto** | Los mismos 9 tests de arriba. **La API no rechaza ni escapa el `<script>`: lo guarda como texto y lo devuelve idéntico.** No se ejecuta porque la API responde solo JSON con `nosniff` y `Content-Security-Policy: default-src 'none'`. El criterio literal «escapado o rechazado» **no se cumple**; la defensa real depende de que el frontend escape al renderizar, y eso **no se verificó** en este informe. Los caracteres nulos y el JSON demasiado anidado sí se rechazan (`no-null-chars.pipe.spec.ts`) |
| **XXE** en SOAP | Rechazado | **N/A** | M6 no tiene canal SOAP |
| **Fuerza bruta sobre el login** | 429 | **N/A** | M6 no tiene login: el JWT lo emite M1 |
| **Rate limiting** de la API | 429 | **CUMPLE** (DEF-07, cerrado por #568 · PR #580) | `ThrottlerGuard` global (primer `APP_GUARD`, `src/app.module.ts:100`): 600 por minuto por IP y por endpoint (`THROTTLE_LIMIT`, `THROTTLE_TTL_MS`), `POST /events/inbox` 300 por minuto, `POST /evidence` 30 por minuto, `/health` excluido. e2e en `test/throttler.e2e-spec.ts` (corre en el CI). Decisión en [ADR-010](../decisiones/adr-010-rate-limit-global.md). El 429 sale en Problem Details (`test/problem-details.e2e-spec.ts`). **Límites:** los contadores están en memoria, valen para **una** instancia; y detrás del BFF el límite solo cuenta por vecino si el BFF manda `X-M6-BFF-Key` y sobrescribe `X-Forwarded-For`. `BFF_SHARED_KEY` está configurada en Render y en Vercel (verificado por el equipo); que la variable exista no prueba que el BFF la mande ni que sobrescriba `X-Forwarded-For`, y ese contrato con el frontend sigue **sin verificarse** (el issue [Frontend #898](https://github.com/hllous/Frontend-M6-DAPS2/issues/898) cubre el formato de error, ETag e `Idempotency-Key`). Para la prueba de carga en local se subió `THROTTLE_LIMIT` a 100000; en el despliegue el límite sigue en 600 por minuto |
| **OWASP ZAP** (baseline y activo autenticado) | 0 alertas High | **NO VERIFICABLE: NO HECHO** | No hay configuración ni ejecución (DEF-13) |
| **Dependencias** (SCA) | 0 CVE críticas o altas sin mitigación | **NO CUMPLE** (riesgo aceptado, sin mitigación analizada) | `npm audit --omit=dev`: 13 vulnerabilidades en producción, **0 críticas, 6 altas, 7 moderadas**. Las 6 altas están aceptadas sin análisis de explotabilidad. Ver sección 5.1 |
| **Cabeceras de seguridad** | CSP, HSTS y `X-Content-Type-Options` | **CUMPLE** salvo `/api/docs` | `src/common/middleware/security-headers.middleware.ts` pone `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` en toda ruta **salvo `/api/docs`** (Swagger UI la necesita), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Cross-Origin-Resource-Policy: same-site` y HSTS solo si `NODE_ENV=production`. Probado en `security-headers.middleware.spec.ts` (`:21`, `:45`), `services-lifecycle.e2e-spec.ts:67` y `test/security-input.e2e-spec.ts` (CSP presente; ausente en `/api/docs`). `X-Powered-By` está deshabilitado (`configure-app.ts:26`). `/api/docs` sin CSP queda en DEF-19. No hay helmet ni `Permissions-Policy` |
| **CORS** sin comodín con credenciales | Sin `*` con credenciales | **CUMPLE** | `src/main.ts:18-34`: sin `CORS_ORIGINS` se acepta cualquier origen, pero **sin `credentials`**, que es la combinación peligrosa. `CORS_ORIGINS` está cargada en Render (DEF-18 sigue abierto solo porque la variable es opcional). El CORS expone los headers `ETag` e `Idempotency-Replayed` y deja pasar `If-Match` e `Idempotency-Key` en el preflight (ADR-012 y ADR-013) |
| **Cookies** (`Secure`, `HttpOnly`, `SameSite`) | — | **N/A** | El backend no emite cookies: el JWT va en el header |
| **Errores sin stack al cliente** | Sin trazas | **CUMPLE** | `http-exception.filter.spec.ts` («deja en 500 cualquier error no contemplado» y «500 genérico sin stack ni detalle interno»). Los errores salen como `application/problem+json` (ADR-011) |
| **Logs sin datos personales ni tokens** | Sin datos sensibles | **CUMPLE** | Ver SEC-D01. El `access_token` de la query se redacta (DEF-22, cerrado) |
| **TLS** en tránsito | Cifrado | **CUMPLE** (broker y Core) · **NO VERIFICABLE** (HTTP) | En producción la validación de arranque exige `amqps://`, prohíbe el usuario `guest` y exige `https://` para el Core y para M1 (`src/config/env.validation.ts`, bloque de producción desde la línea 216), cubierto en `src/config/configuration.spec.ts`. El TLS del HTTP lo termina Render y no se puede probar desde el repo |
| **Hash de contraseñas** | bcrypt o Argon2 | **N/A** | M6 no almacena contraseñas |
| **Datos sensibles minimizados** | — | **CUMPLE** | El portal público devuelve solo etapa, tipo, dirección y fechas (`citizen-portal.service.spec.ts:38` y `:56`). Las URLs de evidencia son públicas, protegidas por una key aleatoria (DEF-19) |

## 5. Resultados de herramientas

### 5.1 Dependencias: `npm audit` (SCA)

**Primera medición, con red:** 15 vulnerabilidades en producción (1 crítica, 6 altas, 8 moderadas); con las dependencias de desarrollo, 64 (2 críticas y 11 altas). El CI del backend no corría `npm audit`, por eso no se había visto. Una corrida previa con `--offline` dio 0 vulnerabilidades; ese resultado venía de la caché local y **no es válido**.

| Severidad | Paquete | Directa | Qué reporta | Corrección |
|---|---|---|---|---|
| Crítica | `proxy-addr` | No (Express) | Suplantación de IP vía subred de IPv6 mapeada a IPv4 (GHSA-jqcg-44mw-7w3h) | **Resuelta** con `npm audit fix` (#566, PR #576) |
| Alta | `@nestjs/platform-express` | Sí | Arrastra `body-parser` y `multer` | Subir a NestJS 12 (cambio mayor) |
| Alta | `body-parser` | No | DoS por un `limit` inválido y por bytes sobrantes tras un cuerpo comprimido | NestJS 12 |
| Alta | `multer` | No | DoS por un `fileFilter` asíncrono pendiente tras cerrar el pedido (GHSA-q7qp-rjg7-q26m) | NestJS 12 |
| Alta | `js-yaml` | No (Swagger) | Contaminación de prototipo y DoS por claves de fusión | `@nestjs/swagger` 12 |
| Alta | `lodash` | No | Inyección de código en `_.template` y contaminación de prototipo | `@nestjs/swagger` o `@nestjs/config` 12 |
| Alta | `zod` | Sí | Agotamiento de memoria al validar colecciones enormes (GHSA-mrhx-c7xc-m3w5) | `zod` 4.6.7 (cambio mayor) |
| Moderadas | `@nestjs/common`, `@nestjs/config`, `@nestjs/core`, `@nestjs/schedule`, `@nestjs/swagger`, `file-type`, `qs`, `uuid` | Mixto | DoS y neutralización incorrecta de caracteres especiales | `npm audit fix` resolvió `file-type`, `qs` y `@nestjs/common`; el resto, cambio mayor |

**Lo que se hizo (DEF-08):**

1. `npm audit fix` sin `--force` (#566, PR #576). Resultado en producción: **13 vulnerabilidades, 0 críticas, 6 altas, 7 moderadas**. Build, lint y tests siguieron en verde.
2. Job `audit` en el CI (#578): corre `npm audit --omit=dev --audit-level=high` y es **informativo**: si hay altas, termina en verde con un aviso (`::warning`) y no bloquea el merge.
3. Dependabot semanal (`.github/dependabot.yml`), sin los majors de `@nestjs/*` ni de `zod`.
4. El salto mayor (NestJS 12, zod 4) queda fuera de este corte para no cambiar la plataforma a días de la prueba.

Lo que se pudo comprobar en el código sobre las 6 altas restantes:

| Alta restante | Qué se comprobó | Qué NO se analizó |
|---|---|---|
| `zod` | Solo lo importan `src/config/env.validation.ts` y `src/identity/m1-identity.client.ts`: valida variables de entorno y respuestas de M1, no cuerpos de usuarios | Si una respuesta de M1 podría traer una colección enorme |
| `@nestjs/platform-express`, `body-parser`, `multer` | La subida de archivos exige token válido y rol (ver `attachments.service.ts` y el límite de 10 MB) | Explotabilidad real del DoS de `multer` y de `body-parser` |
| `@nestjs/swagger`, `js-yaml`, `lodash`, `@nestjs/config` | — | Explotabilidad: no se analizó |

**Estado unificado:** el criterio de dependencias es **NO CUMPLE**, con las 6 altas como **riesgo aceptado y abierto, sin mitigación analizada**. No se puede declarar CUMPLE hasta analizar la explotabilidad, correr un segundo SCA (Trivy, **NO HECHO**) y decidir el salto a NestJS 12.

### 5.2 OWASP ZAP y Trivy

**ZAP: NO HECHO.** No hay configuración ni ejecución. **Trivy: NO HECHO.** Plan: `zap-baseline.py` contra el despliegue (1 a 2 h), archivar el reporte y justificar cada alerta Media.

### 5.3 CodeQL

El workflow `codeql.yml` corre en el CI y el del commit `142e1a3` terminó en `success` ([run 42632174330](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/42632174330)).

### 5.4 Escaneo de secretos

**Escaneo con gitleaks v8.30.1** (imagen `zricethezav/gitleaks:v8.30.1`) sobre todas las ramas: 270 commits, 78 MB. Además corre **en el CI sobre todo el historial** (job `secrets`, checkout completo, en cada PR y push); en el run de `develop` terminó en verde (32 s).

```bash
docker run --rm -v "$PWD:/repo" zricethezav/gitleaks:v8.30.1 git /repo --redact --no-banner --log-opts="--all"
```

| Corrida | Resultado |
|---|---|
| Sin configuración propia | **9 hallazgos**, todos reglas `generic-api-key`, que se reducen a **2 valores** (ver abajo) |
| Con [`.gitleaks.toml`](../../.gitleaks.toml) | **0 hallazgos** (`no leaks found`) |
| CI de `develop` | Job `secrets` en verde |
| Local sobre el historial del tag `v1.0-testing` (`main` @ `6333ecb`), gitleaks v8.30.1 con `.gitleaks.toml` | **0 hallazgos** (`no leaks found`, 327 commits escaneados). Un primer intento sobre un `git worktree` escaneó 0 commits y se descartó; esta corrida es sobre un clon completo |

Los 2 valores marcados, ambos verificados a mano:

| Valor | Dónde | Por qué no es un secreto |
|---|---|---|
| `JWT_SECRET` de ejemplo (base64) | `.env.example`, `src/config/env.validation.ts` (`JWT_SECRET_EJEMPLO`), commits b9511a7, c8eb299 y fb60b7e | Decodifica a `CHANGE_ME_local_dev_secret_m6_32bytes`. **El equipo confirmó que nunca fue un secreto real.** En producción la validación de arranque lo rechaza |
| `SECRET = secreto-de-maquina-m6` | `src/core/core.client.spec.ts:4`, commits 3ca3625, 96087d7 y 6d2c732 | Valor de prueba de un test unitario |

El `.gitleaks.toml` excluye esos dos valores **por valor exacto**, no por archivo, así que una credencial real en esos mismos archivos se sigue detectando.

**Incidente (registrado como P-1 en [`06-registro-defectos.md`](06-registro-defectos.md)):** el workflow `api-tests.yml` de #572 llevaba un **secreto de juguete escrito literalmente**. El job `secrets` lo detectó en el CI (run [42505473347](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/42505473347), commit `e07ad42`, job `secrets` en rojo). No era una credencial real; se corrigió **reescribiendo la rama** antes de mergear (ahora el workflow genera un secreto efímero) y nunca llegó a `develop`. Es una prueba de que el control funciona, y también de que un secreto literal estuvo a un `git push` de entrar.

Revisión complementaria por expresiones regulares (todas las ramas, 252 commits): sin claves privadas, claves de AWS ni tokens de GitHub o Slack; `.env` ignorado y nunca versionado (`git log --all -- .env` vacío); sin `.pem`, `.key`, `.p12` ni `.pfx` versionados.

**Un punto sigue abierto:** `.env.example` y `docs/deploy.md` publican el usuario `module_ambiente` y el host del broker (`core-uade-2026.duckdns.org:5671/core`). La clave figura como marcador y gitleaks no encontró ninguna. Confirmar con M9 si es aceptable que usuario y host sean públicos; si la clave alguna vez se pegó en un commit, hay que **rotarla** en vez de reescribir el historial.

Limitación: gitleaks no analiza el contenido de los PDF ni de los binarios.

## 6. Hallazgos y tratamiento

| # | Hallazgo | Severidad propuesta | Tratamiento | Registro |
|---|---|---|---|---|
| 1 | 6 altas en dependencias de producción (la crítica se resolvió) | Mayor (sube a Crítica si hay explotabilidad) | `npm audit fix` hecho (#566), job `audit` informativo y Dependabot hechos (#578); pendiente: análisis de explotabilidad, Trivy y salto a NestJS 12 | DEF-08 |
| 2 | Sin rate limiting fuera del portal público | Mayor | **Cerrado** (#568, PR #580) | DEF-07 |
| 3 | Sin auditoría de lecturas Tier 2 (SEC-D02) | Mayor | Interceptor de lectura sobre los `GET` de denuncias y actas (sin hacer) | DEF-09 |
| 4 | Sin ZAP ni Trivy (SCA informativo, Dependabot, CodeQL y gitleaks sí) | Mayor | `zap-baseline` manual (sin hacer) | DEF-13 |
| 5 | Errores 500 sin id de correlación (SEC-W05); el formato RFC 9457 ya está | Mayor | Agregar el id de correlación al filtro y al log (sin hacer). El formato se **cerró** (#590, PR #597) | DEF-10 (cerrado) |
| 6 | CORS abierto si falta `CORS_ORIGINS`; ambas variables cargadas en Render | Menor | Sin acción: la variable es opcional por diseño | DEF-18 |
| 7 | Swagger UI público y sin CSP en producción | Menor | Decisión documentada por Swagger UI; ocultarlo o aceptarlo | DEF-19 |
| 8 | Evidencia servida por URL pública; los PDF conservan metadatos | Menor | URLs firmadas, o aceptar el riesgo por escrito | DEF-19 |
| 9 | Logs con `access_token` de la query | Mayor (corregido) | **Cerrado** (#581): `redactUrl` en logs y en el `path` de los errores | DEF-22 |
| 10 | Tests de inyección, XSS, 429 y 413 | Menor | **Hecho** (#569, #568): `security-input` y `throttler` | — |
| 11 | No se valida `aud` del JWT | Menor | Justificado: M1 no emite `aud` (`docs/integracion/m1.md`) | — |

## 7. Cómo reproducir las pruebas en vivo

| Prueba | Comando o archivo |
|---|---|
| Rechazo de JWT (16 casos) | `npx jest src/auth/jwt.strategy.spec.ts` |
| Roles por endpoint | `npx jest src/auth/route-roles.spec.ts` y `npm run test:e2e -- auth-roles` (con una base descartable; ver `docs/testing.md`) |
| Pertenencia de Campo | `npm run test:e2e -- crew-ownership` |
| Mass assignment, SQL, XSS, 413 y CSP | `npm run test:e2e -- security-input` |
| Cabeceras | `npm run test:e2e -- services-lifecycle` |
| Rate limiting (429) | `npm run test:e2e -- throttler` |
| Logs sin token | `npx jest src/common/utils/redact-url.spec.ts src/common/interceptors/logging.interceptor.spec.ts` |
| Idempotencia del inbox | `npm run test:e2e -- inbox` |
| Errores en Problem Details | `npm run test:e2e -- problem-details` y `npx jest src/common/filters/http-exception.filter.spec.ts` |
| ETag e `If-Match` (412) | `npm run test:e2e -- etag-if-match` y `npx jest src/common/etag.spec.ts src/modules/services/services-if-match.spec.ts` |
| `Idempotency-Key` | `npm run test:e2e -- idempotency` y `npx jest src/common/idempotency` |
| Consumer contra RabbitMQ real | `npm run test:e2e -- rabbitmq-real` (con `RABBITMQ_URL` local; ver `docs/testing.md`) |
| Dependencias | `npm audit --omit=dev` |
