# 07 · Informe de seguridad

> Versión 2.2 · 16/11/2026

Base: criterios SEC de la Clase 11 (OWASP ASVS 5.0, OWASP API Security Top 10, Ley 25.326) y pruebas de seguridad de la consigna. Medido sobre `develop` @ `53cde64` (3056 unitarios y 410 e2e en verde, CI [43927922346](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/43927922346)); cifras de cada herramienta en [`05`](05-informe-ejecucion.md).

## 1. Método

- Cada control se verificó contra el código y un test que corre en el CI. Un CUMPLE siempre cita ese test.
- Las pruebas de entrada y el guion de seguridad en vivo corren contra la aplicación levantada en el e2e (`test/security-input.e2e-spec.ts`, `test/security-live.e2e-spec.ts`); el mismo guion corre contra cualquier URL con `scripts/security-live.mjs`. El escaneo activo de ZAP corre contra un entorno efímero y contra Render solo el baseline pasivo.
- Estados: **CUMPLE**, **Mixto** (CUMPLE en una parte y salvedad declarada en otra), **N/A** (no aplica al módulo).

## 2. Resumen

| Estado | Controles de la Clase 11 (10) | Pruebas generales (21) |
|---|---|---|
| CUMPLE | 9 (W01, W02, W04, W05, W06, D01, D02, I01, I02) | 14 |
| Mixto | 1 (W03) | 2 (XSS, TLS) |
| NO CUMPLE | 0 | 0 |
| N/A | 0 | 5 (NoSQL, XXE, fuerza bruta en login, cookies, hash de contraseñas) |

No hay hallazgos bloqueantes. Los `DEF-xx` remiten a [`06`](06-registro-defectos.md).

## 3. Controles de la Clase 11

| ID | Control | Estado | Evidencia |
|---|---|---|---|
| **SEC-W01** | Validación del token JWT | **CUMPLE** | `src/auth/jwt.strategy.spec.ts` (`rechaza: %s`, 16 casos por el flujo real de `passport-jwt`: firma incorrecta, `iss` incorrecto o ausente, `typ=refresh`, sin `exp`, vencido, `alg` none, RS256, rol ausente o inválido). Algoritmos HS256/384/512 e `iss` obligatorio en `src/auth/jwt.strategy.ts`. 401 sin token en `test/services-lifecycle.e2e-spec.ts` y `test/auth-roles.e2e-spec.ts`; en vivo en `test/security-live.e2e-spec.ts` |
| **SEC-W02** | Autorización por rol | **CUMPLE** | `RolesGuard` global como `APP_GUARD` tras `JwtAuthGuard`: una escritura sin `@Roles` da 403. `src/auth/route-roles.spec.ts`: toda escritura no pública declara `@Roles`, `M6_AUDITOR` no figura en ninguna y `POST /events/inbox` es solo de `M6_ADMIN`. Matriz 200/401/403 por rol en `test/auth-roles.e2e-spec.ts`; el 403 lleva `ROLE_REQUIRED` y no revela qué rol faltaba |
| **SEC-W03** | Portal ciudadano: mínima exposición y límite | **Mixto** | (a) un reclamo sin expediente da 404 sin decir si el ticket existe y (b) devuelve solo los campos públicos: `src/modules/citizen-portal/citizen-portal.service.spec.ts`. (c) límite del portal de 20 por minuto en seguimiento (`rate-limits.ts`); el e2e del 429 (`test/throttler.e2e-spec.ts`) prueba el límite global con `GET /zones`, no el tope propio del portal |
| **SEC-W04** | Campos no permitidos rechazados | **CUMPLE** | `ValidationPipe` con `whitelist` y `forbidNonWhitelisted` (`src/configure-app.ts`). `test/security-input.e2e-spec.ts` y `test/security-live.e2e-spec.ts`: `PATCH /services/:id` con `status`, `role`, `id` o una mezcla da 400 y la fila queda idéntica |
| **SEC-W05** | Manejo seguro de errores internos | **CUMPLE** | `src/common/filters/http-exception.filter.ts` responde 500 con «Error interno del servidor», manda el stack solo al log y devuelve Problem Details (RFC 9457, ADR-011) con `traceId` igual al header `X-Request-Id` y al log; `path` e `instance` sin query. Tests: `http-exception.filter.spec.ts`, `src/common/middleware/request-id.middleware.spec.ts`, `test/problem-details.e2e-spec.ts` y `test/security-live.e2e-spec.ts` («un 500 devuelve Problem Details con traceId y sin stack») |
| **SEC-W06** | Carga segura de evidencias | **CUMPLE** | Contenido distinto del tipo declarado: 400 sin subir nada; tipos fuera de la lista blanca; EXIF y GPS eliminados (`attachments.service.spec.ts`, `evidence-file.spec.ts`); 413 por más de 10 MB (`test/security-input.e2e-spec.ts`). Los PDF conservan sus metadatos y la evidencia se sirve por URL pública (DEF-19) |
| **SEC-D01** | Logs sin secretos ni datos personales | **CUMPLE** | Consumidor AMQP: `rabbitmq.consumer.spec.ts` (un `x-core-last-error` sensible no aparece en el log). HTTP: `redactUrl` (`src/common/utils/redact-url.ts`; DEF-22) con `redact-url.spec.ts` y `logging.interceptor.spec.ts`; en vivo, el log no registra `Authorization` ni el token de la query (`security-live`) |
| **SEC-I01** | Idempotencia en el consumo de eventos | **CUMPLE** | `test/inbox.e2e-spec.ts` («descarta el mismo eventId sin volver a aplicarlo»): el duplicado lo detecta la base (`messageId` único). Igual por RabbitMQ real en `test/rabbitmq-real.e2e-spec.ts` |
| **SEC-I02** | Rechazo de eventos que violan el contrato | **CUMPLE** | `test/inbox.e2e-spec.ts`: payload inválido da 400 y no deja fila; por broker real, `rabbitmq-real`. M6 hace `nack` sin reencolar; la DLQ es del Core (DEF-37) |
| **SEC-D02** | Auditoría de lectura de datos Tier 2 | **CUMPLE** | `AuditService.recordRead` registra una fila `READ` con el actor del token en las lecturas exitosas de `GET /environmental-inspections/:id/violation-notice`, `GET /events/inbox/:messageId` y `GET /events/outbox/:id`; falla cerrado. `src/common/audit/audit.service.spec.ts`, `test/environmental-flow.e2e-spec.ts` |

## 4. Pruebas de seguridad generales

| Prueba | Esperado | Estado | Evidencia |
|---|---|---|---|
| **BOLA / IDOR** | 403 o 404, nunca el dato | **CUMPLE** | `test/crew-ownership.e2e-spec.ts` (403 `NOT_ASSIGNED`; propio, ajeno y sin cuadrilla), `test/security-live.e2e-spec.ts` (Campo B sobre el servicio de A: 403 y sin URLs; `/me` solo con lo del token), `attachments.service.spec.ts`. Un ciudadano recibe 403 en todo lo no público. Oficina, Auditoría y Campo leen por `GET` todos los recursos: el dominio es compartido |
| **BFLA** | 403 | **CUMPLE** | `test/auth-roles.e2e-spec.ts` (`it.each(TODOS)`), `route-roles.spec.ts` y `security-live`; tabla por rol en `docs/api/endpoints.md` |
| **JWT** vencido, firma alterada, `alg=none`, otro emisor | 401 | **CUMPLE** | `jwt.strategy.spec.ts` y `security-live` |
| **Mass assignment** | 400, nunca persistido | **CUMPLE** | `test/security-input.e2e-spec.ts` (6 tests) y `security-live` (`POST /services`, `POST /environmental-reports`, `PATCH /services/:id`, `PUT /role-assignments`) |
| **Inyección SQL** | Sin ejecución | **CUMPLE** | `security-input` (9 tests con `'; DROP TABLE zone;--`, `' OR 1=1--` y `<script>`) y `security-live` (SQL en el id, en filtros y en body: 400 o dato idéntico, nunca 500). Prisma parametriza; las 5 consultas crudas usan *template tag* sin `Unsafe` (`health.controller.ts`, `crews.service.ts`, `indicators.service.ts` ×2, `trees.service.ts`) |
| **NoSQL** | — | **N/A** | La base es PostgreSQL; `security-live` verifica que los operadores `$gt` y `$ne` en el body dan 400 |
| **XSS** en campos de texto | Escapado o rechazado | **Mixto** | La API guarda el texto y lo devuelve idéntico como JSON con `nosniff` y `Content-Security-Policy: default-src 'none'`: no se ejecuta. El escape al renderizar es del frontend. Los caracteres nulos y el JSON demasiado anidado se rechazan (`no-null-chars.pipe.spec.ts`) |
| **XXE** | — | **N/A** | M6 no tiene canal SOAP ni XML |
| **Fuerza bruta en login** | 429 | **N/A** | M6 no tiene login: el JWT lo emite M1 |
| **Rate limiting** | 429 | **CUMPLE** | `ThrottlerGuard` global: 600 por minuto por IP y endpoint, `POST /events/inbox` 300, `POST /evidence` 30, `/health` excluido (`test/throttler.e2e-spec.ts`; [ADR-010](../decisiones/adr-010-rate-limit-global.md)). Los contadores están en memoria: valen para una instancia. El 429 sale en Problem Details |
| **SonarCloud** | 0 bugs Blocker/Critical, 0 vulnerabilidades, duplicación ≤ 3 %, ratings A, 100 % hotspots | **CUMPLE** | Gate OK, 0 / 0, 1,2 %, A/A/A, 100 % ([`05`](05-informe-ejecucion.md), sección 7) |
| **OWASP ZAP** | 0 High | **CUMPLE** | Baseline y activo con 0 High; cada Medium justificada en 5.2 |
| **Dependencias** | 0 CVE críticas o altas sin mitigación | **CUMPLE** | `npm audit --omit=dev` en 0 (job `audit`, gate); Trivy `fs`, `image` y `config` en 0 HIGH/CRITICAL (5.1) |
| **Cabeceras** | CSP, HSTS y `X-Content-Type-Options` | **CUMPLE** | `src/common/middleware/security-headers.middleware.ts`: `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` en toda ruta y una CSP propia en `/api/docs` (`DOCS_CSP`, sin `unsafe-eval`), `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Cross-Origin-Resource-Policy: same-site`, `Permissions-Policy` y HSTS solo con `NODE_ENV=production`; sin `X-Powered-By`. `security-headers.middleware.spec.ts`, `security-input` y `security-live` |
| **CORS** | Sin `*` con credenciales | **CUMPLE** | `src/common/http/cors-options.ts`: nunca habilita credenciales; en producción `CORS_ORIGINS` es obligatoria y el arranque falla sin ella (DEF-18). Un origen ajeno no recibe `Access-Control-Allow-Origin` (`security-live`, `cors-options.spec.ts`). Expone `ETag`, `Idempotency-Replayed` y `X-Request-Id` |
| **Cookies** | — | **N/A** | El backend no emite cookies: el JWT va en el header |
| **Errores sin stack** | Sin trazas | **CUMPLE** | Ver SEC-W05; también ruta inexistente y JSON mal formado (`security-live`) |
| **Logs sin datos personales ni tokens** | Sin datos sensibles | **CUMPLE** | Ver SEC-D01 |
| **TLS** | Cifrado | **Mixto** | Broker y Core: en producción la validación de arranque exige `amqps://`, prohíbe el usuario `guest` y exige `https://` para el Core y M1 (`src/config/env.validation.ts`, `configuration.spec.ts`). El TLS del HTTP lo termina Render y la API envía HSTS en producción |
| **Hash de contraseñas** | bcrypt o Argon2 | **N/A** | M6 no almacena contraseñas |
| **Datos minimizados** | — | **CUMPLE** | El portal público devuelve solo etapa, tipo, dirección y fechas (`citizen-portal.service.spec.ts`) |

## 5. Resultados de herramientas

### 5.1 Dependencias, imagen y configuración

- `npm audit --omit=dev`: **0 vulnerabilidades en producción** (NestJS 12, sin `overrides`). El job `audit` corre con `--audit-level=high` y frena el deploy. Dependabot semanal.
- **Trivy** (job `trivy`; SARIF en Code Scanning, gate sobre HIGH/CRITICAL con fix, frena el deploy): `fs`, `image` y `config` con **0 HIGH/CRITICAL**. `.trivyignore` vacío: ninguna HIGH/CRITICAL sin fix.
- **CodeQL**: `success` en `javascript-typescript` y `actions`.

### 5.2 OWASP ZAP

Workflow [`dast.yml`](../../.github/workflows/dast.yml) (a demanda y los lunes). Último run: [43895156093](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/43895156093) sobre `main`. Sin reglas ignoradas; falla ante cualquier High. Reportes archivados en [`evidencia/zap-2026-11-15/`](evidencia/zap-2026-11-15/).

| | Baseline (pasivo) | Activo (API scan) |
|---|---|---|
| Objetivo | Render, `/api/docs` sin autenticar | `docker compose` efímero (base y broker descartables, `JWT_SECRET` de prueba, seed de demo) con `docs/api/openapi.json` |
| Resultado | **0 High**, 1 Medium, 8 Low o informativos | **0 High**, 1 Medium, 122 reglas sin hallazgo |
| Autenticación | no aplica | token de rol admin (`test/api/make-token.mjs`) en todos los pedidos |

El activo no va contra Render: escribe datos, choca con el límite de 600 por minuto y publicaría al bus del Core. Prueba de que llegó autenticado: un proxy de registro (`.github/dast/proxy.mjs`) contó 46 577 pedidos, todos con `Authorization: Bearer` y cero 401 (`evidencia/zap-2026-11-15/activo-efimero/`). ZAP arma los pedidos con los ejemplos del OpenAPI: el grueso de las respuestas es 4xx y la cobertura de escrituras exitosas es baja.

| Escaneo | Medium | Justificación |
|---|---|---|
| Baseline | *CSP Header Not Set* en `/api/docs` | La API sí envía CSP en todas las rutas; en `/api/docs` el middleware pone `DOCS_CSP` (#701), que Render sirve desde el próximo deploy |
| Activo | *Cross-Domain Misconfiguration* (`access-control-allow-origin: *`) | Artefacto del entorno efímero (`NODE_ENV=development`, sin `CORS_ORIGINS`). En producción `CORS_ORIGINS` es obligatoria (#642) |

Las alertas Low (Cross-Origin-Embedder/Opener/Resource-Policy, Permissions Policy, Timestamp Disclosure) y las informativas son observaciones sobre una API JSON y los archivos del Swagger UI; no se cambian.

### 5.3 Escaneo de secretos

| Job | Qué hace | Resultado |
|---|---|---|
| `secrets` | gitleaks v8.30.1 con [`.gitleaks.toml`](../../.gitleaks.toml) sobre todo el historial | `success` |
| `secrets-default` | gitleaks por defecto (sin `.gitleaks.toml`, con `.gitleaksignore`) y trufflehog sobre todas las ramas y tags; falla ante un hallazgo de gitleaks o una credencial verificada por trufflehog | `success` |

Los valores de ejemplo que un escaneo sin configuración marca (el `JWT_SECRET` de `.env.example` y `src/config/env.validation.ts`, y el secreto de prueba de `src/core/core.client.spec.ts`) no son secretos reales; `.gitleaks.toml` y `.gitleaksignore` los excluyen por valor exacto, no por archivo. En producción la validación de arranque rechaza el `JWT_SECRET` de ejemplo. Gitleaks no analiza PDF ni binarios.

### 5.4 SonarCloud

Job `sonar` (`sonar-project.properties`; las exclusiones de cobertura son las de `vitest.config.ts`). Último análisis, de `main` (16/11/2026): gate **OK**, 0 bugs, 0 vulnerabilidades, A/A/A, duplicación 1,2 %, hotspots 100 %, cobertura 97,3 % ([`05`](05-informe-ejecucion.md), sección 7). Se llegó a A corrigiendo en código (#672, #675); la única vulnerabilidad aceptada, `S8707` en `scripts/build-espacios-verdes.ts` (script local con argumentos del propio equipo), la aceptó el líder en SonarCloud. El gate es bloqueante (`qualitygate.wait=true`) y evalúa código nuevo; las métricas del código total se reportan aparte.

## 6. Hallazgos y tratamiento

| # | Hallazgo | Severidad | Tratamiento | Registro |
|---|---|---|---|---|
| 1 | Swagger UI público en producción (`/api/docs`) | Menor | Ocultarlo o aceptarlo por escrito | DEF-19 |
| 2 | Evidencia servida por URL pública; los PDF conservan metadatos | Menor | URLs firmadas, o aceptar el riesgo por escrito | DEF-19 |
| 3 | DLQ delegada al Core: M6 no puede verla ni reprocesarla | Menor | Consultarla por la API del Core | DEF-37 |
| 4 | `.env.example` y `docs/deploy.md` publican el usuario y el host del broker; la clave es un marcador | Menor | Confirmar con M9 que usuario y host sean públicos; si una clave alguna vez se pegó en un commit, rotarla | — |
| 5 | No se valida `aud` del JWT | Menor | Justificado: M1 no emite `aud` (`docs/integracion/m1.md`) | — |

## 7. Cómo reproducir las pruebas

| Prueba | Comando |
|---|---|
| Rechazo de JWT | `npx vitest run src/auth/jwt.strategy.spec.ts` |
| Roles por endpoint | `npx vitest run src/auth/route-roles.spec.ts` y `npm run test:e2e -- auth-roles` |
| Pertenencia de Campo | `npm run test:e2e -- crew-ownership` |
| Mass assignment, SQL, XSS, 413 y CSP | `npm run test:e2e -- security-input` |
| Guion en vivo (JWT, BFLA, BOLA, mass assignment, inyección, cabeceras, CORS, errores) | `npm run test:e2e -- security-live` y `node scripts/security-live.mjs [--base-url URL]` |
| Rate limiting (429) | `npm run test:e2e -- throttler` |
| Logs sin token | `npx vitest run src/common/utils/redact-url.spec.ts src/common/interceptors/logging.interceptor.spec.ts` |
| Idempotencia del inbox | `npm run test:e2e -- inbox` |
| Problem Details y `traceId` | `npm run test:e2e -- problem-details` y `npx vitest run src/common/filters/http-exception.filter.spec.ts src/common/middleware/request-id.middleware.spec.ts` |
| Consumer contra RabbitMQ real | `npm run test:e2e -- rabbitmq-real` (con `RABBITMQ_URL` local) |
| Dependencias | `npm audit --omit=dev` y `docker run --rm -v "$PWD:/w" aquasec/trivy:latest fs --severity HIGH,CRITICAL /w` |
| SonarCloud | `curl -s "https://sonarcloud.io/api/qualitygates/project_status?projectKey=hllous_Backend-M6-DAPS2"` |
| ZAP | Actions → `dast` → *Run workflow* |

Los e2e truncan la base: usar una descartable (`docs/testing.md`).
