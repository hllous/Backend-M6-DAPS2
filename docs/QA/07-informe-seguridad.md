# 07 · Informe de seguridad

> Backend del Módulo 6 (Grupo 04). Estado al **03/11/2026**, sobre `develop` @ `f288d31`. Base: criterios SEC de la Clase 11 (OWASP ASVS 5.0, OWASP API Security Top 10, Ley 25.326) y pruebas de seguridad de la cátedra.

## 1. Método y regla de evidencia

- Cada control se **reverificó contra el código y los tests actuales**. Los veredictos del 13/10 que figuran en las tarjetas SEC de Trello quedaron viejos: se citan como «veredicto 13/10» solo para mostrar qué cambió.
- **Regla de la cátedra:** un CUMPLE sin test ejecutado ni evidencia se toma como NO VERIFICABLE. Por eso un CUMPLE acá siempre cita un test que corrió (la corrida local del 03/11 pasó los 112 suites y el CI de `main` pasó los 291 e2e) o una prueba observable.
- La revisión de código sola, sin test, deja el control en NO VERIFICABLE.
- Esta auditoría **no ejecutó ataques en vivo** contra el despliegue ni corrió ZAP. Lo que depende de eso figura como no verificable.
- Estados: **CUMPLE**, **NO CUMPLE**, **NO VERIFICABLE**, **N/A** (no aplica a este módulo).

## 2. Resumen

| Estado | Controles de la Clase 11 (10) | Pruebas de la cátedra (20 filas) |
|---|---|---|
| CUMPLE | 4 (W01, W02, W04, I01) | 6 (BOLA, BFLA, JWT, mass assignment, errores sin stack, datos minimizados) |
| Mixto: CUMPLE en una parte, NO CUMPLE o NO VERIFICABLE en otra | 4 (W03, W06, I02, D01) | 2 (cabeceras y CSP, TLS del broker y del HTTP) |
| NO CUMPLE | 2 (W05, D02) | 2 (rate limiting de la API, dependencias) |
| NO VERIFICABLE | 0 | 5 (inyección SQL, XSS, ZAP, CORS en el despliegue, logs HTTP) |
| N/A | 0 | 5 (NoSQL, XXE, fuerza bruta en login, cookies, hash de contraseñas) |

Hallazgos mayores: **dependencias con 1 crítica y 6 altas** (DEF-08), **sin rate limiting fuera del portal** (DEF-07), **sin auditoría de lecturas Tier 2** (DEF-09), **sin ZAP ni escaneo de secretos con herramienta** (DEF-13). No hay hallazgos bloqueantes. Los números de `DEF-xx` remiten a [`06-registro-defectos.md`](06-registro-defectos.md).

## 3. Controles de la Clase 11 (SEC-W01 a SEC-D02)

Origen: tarjetas del tablero «M6 - Histórico de Sprints», lista «Clase 11: Seguridad · Sprint 7» (HU-31).

| ID | Control | Estado hoy | Evidencia | Veredicto 13/10 |
|---|---|---|---|---|
| **SEC-W01** | Validación del token JWT | **CUMPLE** | `src/auth/jwt.strategy.spec.ts:167-187` (`rechaza: %s`): 16 casos que pasan por el flujo real de `passport-jwt` y dan 401. Cubren firma incorrecta, `iss` incorrecto o ausente, `typ=refresh`, sin `exp`, **vencido**, **`alg` none**, `alg` RS256, rol ausente o inválido y subtipo inesperado. 401 sin token en `test/services-lifecycle.e2e-spec.ts:53` y `test/auth-roles.e2e-spec.ts:159`. Algoritmos fijados en `src/auth/jwt.strategy.ts:55` (HS256, HS384, HS512); `iss` obligatorio en `:56`; `ignoreExpiration: false` en `:57` | «Cumple por código; falta ejecutar el test». Decía que no se fijaba el algoritmo: hoy sí |
| **SEC-W02** | Autorización por rol en acciones de gestión | **CUMPLE** | `RolesGuard` global como `APP_GUARD` registrado después de `JwtAuthGuard` (`src/app.module.ts:82-83`); una escritura sin `@Roles` da 403 para todos (`src/common/guards/roles.guard.ts`). `src/auth/route-roles.spec.ts`: toda escritura no pública declara `@Roles`, `M6_AUDITOR` no figura en ninguna escritura y `POST /events/inbox` es solo de `M6_ADMIN`. Matriz 200/401/403 por rol en `test/auth-roles.e2e-spec.ts`. El 403 lleva `code: ROLE_REQUIRED` y no revela qué rol faltaba (`auth-roles.e2e-spec.ts:245`) | **NO CUMPLE**. Está desactualizado: lo cerraron #161 (21/10) y #235 |
| **SEC-W03** | Portal ciudadano: mínima exposición y límite de consultas | **CUMPLE** (a y b) · **NO VERIFICABLE** (c) | (a) un reclamo sin expediente da 404 sin decir si el ticket existe: `src/modules/citizen-portal/citizen-portal.service.spec.ts:113`. (b) devuelve «exactamente los campos públicos, ni uno más» (`:38`) y no consulta hallazgos, inspector, checklist ni denunciante (`:56`). (c) el límite existe (`ThrottlerGuard` en `src/modules/citizen-portal/citizen-portal.controller.ts:30`, 20 por minuto en seguimiento según `rate-limits.ts:26`), pero **ningún test dispara el 429** | «Cumple por código; falta ejecutar el test» |
| **SEC-W04** | Campos no permitidos rechazados | **CUMPLE** | `ValidationPipe` con `whitelist` y `forbidNonWhitelisted` (`src/configure-app.ts:52-55`), la misma configuración en los e2e. `test/services-lifecycle.e2e-spec.ts:61`: un campo extra da 400. `UpdateServiceDto` no declara `status`. El caso exacto de la tarjeta (`PATCH /services/:id` con `status`) no tiene test propio | «Cumple por código; falta ejecutar el test» |
| **SEC-W05** | Manejo seguro de errores internos | **NO CUMPLE** | Cumple el mensaje genérico y que no se filtre el stack: `src/common/filters/http-exception.filter.ts` responde «Error interno del servidor» y manda el stack solo al log (`http-exception.filter.spec.ts:72`). **No existe el id de correlación** que pide la tarjeta (ni en el filtro ni en el interceptor). El cuerpo no es Problem Details (RFC 9457) y `path` incluye la query string (`http-exception.filter.ts:116`) | «Parcial». Sigue igual |
| **SEC-W06** | Carga segura de evidencias | **CUMPLE** (a y c) · **NO VERIFICABLE** (b) | (a) un contenido que no coincide con el tipo declarado da 400 y no sube nada (`src/modules/attachments/attachments.service.spec.ts:255`); tipos fuera de la lista blanca (`:237`). (c) se eliminan EXIF y GPS (`:285`, `src/modules/attachments/evidence-file.spec.ts`). (b) 413 por más de 10 MB: el límite existe (multer, documentado en `attachments.controller.ts:85`), pero el test del service devuelve 400 y **no hay e2e del 413**. Los PDF conservan sus metadatos | «Cumple por código; falta e2e». Sigue sin e2e |
| **SEC-D01** | Logs sin secretos ni datos personales | **CUMPLE** (log del consumidor AMQP) · **NO VERIFICABLE** (log HTTP) | AMQP: la línea de log del consumidor no incluye el contenido del evento: `src/events/consumers/rabbitmq.consumer.spec.ts:328` verifica que un `x-core-last-error` con `NEGOCIO-SECRETO` no aparezca en el log (#317). HTTP: `src/common/interceptors/logging.interceptor.ts:21` loguea solo método, URL, estado y duración, pero **ningún test comprueba que el token no aparezca en un log**, y la URL se registra con su query string | «Cumple por código; falta ejecutar el test». Mejoró en parte (ver sección 3.1) |
| **SEC-I01** | Idempotencia en el consumo de eventos | **CUMPLE** | `test/inbox.e2e-spec.ts:103` («descarta el mismo eventId sin volver a aplicarlo») corre en el CI. El duplicado lo detecta la base (`messageId` único), no una consulta previa | «Cumple por código; falta ejecutar el e2e». Ya ejecutado: 291 e2e pasados en el CI |
| **SEC-I02** | Rechazo de eventos que violan el contrato | **CUMPLE** (400 y sin fila) · **NO VERIFICABLE** (apartado en DLQ) | `test/inbox.e2e-spec.ts:131`: el payload inválido da 400 y no deja fila. El mensaje apartado en una DLQ depende del Core: M6 hace `nack` sin reencolar (#264) y la DLQ es de M9; no se puede probar desde este repo. Los campos extra se toleran a propósito en el bus (`configure-app.ts:44-49`) | «Parcial; revalidar contra develop». Revalidado en parte |
| **SEC-D02** | Auditoría de lectura de datos Tier 2 | **NO CUMPLE** | No hay interceptor de lecturas. `src/common/audit/` registra solo cambios de estado (#460). El ADR-005 lo exige para producción (`docs/decisiones/adr-005-alineacion-frontend-sesion-y-seguridad.md:22` y `:46`) | **NO CUMPLE**. Sigue igual |

### 3.1 Estado el 13/10 → estado hoy: qué se corrigió

La matriz de Trello (SEC-W01 a D02) se evaluó el 13/10. Esta tabla muestra, por cada control, qué dijo entonces, qué hay hoy y **con qué corrección** (issue, PR, commit y fecha), y **qué test la cubre**. «CI verde» significa que el workflow `CI` terminó en `success` en el *push* a `develop` de ese commit (`gh run list --workflow CI --commit <sha>`); prueba que el build, el lint y los tests del repo pasaron en ese commit, no que cada test nombrado haya sido el que se corrigió. Los enlaces de run son `https://github.com/hllous/Backend-M6-DAPS2/actions/runs/<id>`.

| ID | 13/10 | Hoy | Corrección hecha (issue · PR · commit · fecha) | Test que la cubre | Evidencia de ejecución |
|---|---|---|---|---|---|
| **SEC-W01** | «Cumple por código; falta ejecutar el test». No fijaba el algoritmo; no verificaba `iss` | **CUMPLE** | #354 · PR #358 · `b9511a7` · 21/10: validar el JWT de M1 (HS256 con secreto base64, `iss`, `typ` y claim `rol`). #448 · PR #450 · `bd61e3a` · 28/10: aceptar HS256, HS384 y HS512 | `src/auth/jwt.strategy.spec.ts:167-187` (16 casos de rechazo) | CI verde: runs 39636009746 (`b9511a7`) y 40767759833 (`bd61e3a`). **Pasó** en la corrida local del 03/11 (112 suites, 2533 tests, 0 fallados) |
| **SEC-W02** | **NO CUMPLE**: `RolesGuard` y `@Roles` existían pero ningún controller los usaba | **CUMPLE** | #161 · PR #366 · `e6153f9` · 21/10 (base de roles adaptados desde M1) y PR #369 · `f1e1ff6` · 21/10 (**`RolesGuard` global y `@Roles` en todas las escrituras**). #235 (matriz 200/401/403) entró en el mismo PR #369. #466 · PR #468 · `c2d12a8` · 30/10 cerró la lectura de evidencia | `src/auth/route-roles.spec.ts` y `test/auth-roles.e2e-spec.ts` | CI verde: runs 39651981646 (`e6153f9`), 39673886235 (`f1e1ff6`) y 41047597104 (`c2d12a8`). **Pasó** `PASS test/auth-roles.e2e-spec.ts` en el CI de `main` del 03/11 ([run 41556929968](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/41556929968)) |
| **SEC-W03** | «Cumple por código; falta ejecutar el test». Menores: `ticketId` sin `ParseUUIDPipe` | **CUMPLE** (a, b) · **NO VERIFICABLE** (c, 429) | #470 · PR #480 · `65dde9f` · 02/11: el límite cuenta la IP del vecino que reenvía el BFF (con `X-M6-BFF-Key`), no la del BFF | `src/modules/citizen-portal/client-tracker.spec.ts` (dos vecinos, claves distintas; clave incorrecta ignora `X-Forwarded-For`) y `citizen-portal.service.spec.ts:38`, `:56` y `:113` | CI verde: run 41476302943. **Pasó** en la corrida local del 03/11. **Pendiente:** ningún test dispara el 429; sigue sin `ParseUUIDPipe` |
| **SEC-W04** | «Cumple por código; falta ejecutar el test» | **CUMPLE** | Sin corrección de código: el e2e existe desde #162 · PR #219 · `8985eb1` · 21/09 | `test/services-lifecycle.e2e-spec.ts:61` | CI verde: run 35598688580. **Pasó** `PASS test/services-lifecycle.e2e-spec.ts` en el CI de `main` del 03/11 (run 41556929968). El caso `PATCH /services/:id` con `status` no tiene test propio |
| **SEC-W05** | «Parcial» | **NO CUMPLE** | **Sin cambios** (verificado): sigue sin id de correlación y sin formato RFC 9457 | Mensaje genérico y sin stack: `http-exception.filter.spec.ts:72` | Corregido: nada. Abierto en DEF-10 |
| **SEC-W06** | «Cumple por código; falta e2e» | **CUMPLE** (a, c) · **NO VERIFICABLE** (b, 413) | Sin cambios en la carga (validación autoritativa, EXIF y nombre: #110 · `34c44a3` · 04/09). Se sumó el control de lectura: #466 · PR #468 · `c2d12a8` · 30/10 | `src/modules/attachments/attachments.service.spec.ts:255`, `:285` y `evidence-file.spec.ts` | CI verde: run 41047597104. **Pasó** en la corrida local del 03/11. **Pendiente:** e2e del 413 |
| **SEC-D01** | «Cumple por código; falta ejecutar el test» | **CUMPLE** (consumidor AMQP) · **NO VERIFICABLE** (log HTTP) | #317 · `d3b9d08` · 20/10: saneo de logs del consumidor (el detalle del error se trunca y no se vuelca el contenido del evento) | `src/events/consumers/rabbitmq.consumer.spec.ts:328` (no aparece `NEGOCIO-SECRETO`) y `:120` (el error se trunca a 500 caracteres) | CI verde: run 39458179963. **Pasó** en la corrida local del 03/11. **Pendiente:** test de que el token no aparezca en el log HTTP |
| **SEC-I01** | «Cumple por código; el e2e ya existe, falta ejecutarlo y adjuntar la captura» | **CUMPLE** | Sin corrección de código. Lo que faltaba era la ejecución | `test/inbox.e2e-spec.ts:103` | **Pasó** `PASS test/inbox.e2e-spec.ts` en el CI de `main` del 03/11 (run 41556929968, job `e2e`: 16 suites, 291 tests) |
| **SEC-I02** | «Parcial; revalidar contra `develop`» | **CUMPLE** (400 y sin fila) · **NO VERIFICABLE** (DLQ) | #189 · PR #215 · `6048655` · 20/09: rechazar con 400 los eventos con payload inválido. #264 · PR #271 · `3ca3625` · 07/10: nunca reencolar (`nack` con `requeue=false`) y delegar los reintentos al backoff del Core. Revalidado contra `develop` el 03/11 | `test/inbox.e2e-spec.ts:131` y `src/events/consumers/rabbitmq.consumer.spec.ts:63`, `:94`, `:129`, `:134` (todo error → `nack`) | CI verde: runs 35519143213 (`6048655`) y 37710896602 (`3ca3625`). **Pasó** `PASS test/inbox.e2e-spec.ts` en el CI de `main` del 03/11. **Pendiente:** la DLQ es de M9, no se prueba desde M6 |
| **SEC-D02** | **NO CUMPLE** | **NO CUMPLE** | **Sin cambios** (verificado): el interceptor de lecturas no existe. Lo más cercano, #460 · PR #483 · `39069dc` · 02/11, registra solo **cambios de estado** | `test/audit.e2e-spec.ts` (cubre las escrituras, no las lecturas) | CI verde: run 41531138310 (cubre #460, no la lectura Tier 2). Abierto en DEF-09 |

**Resumen de lo corregido desde el 13/10:** SEC-W02 pasó de **NO CUMPLE a CUMPLE** (`RolesGuard` global, 21/10); SEC-W01 ganó los algoritmos fijados y la validación de `iss` y `typ`; SEC-D01 sumó una prueba de que el consumidor AMQP no vuelca datos de negocio al log; SEC-I02 quedó revalidado contra `develop` con el `nack` sin reencolar. **No cambiaron** SEC-W05 y SEC-D02, que siguen abiertos.


## 4. Pruebas de seguridad de la cátedra

| Prueba | Resultado esperado | Estado | Evidencia y observaciones |
|---|---|---|---|
| **BOLA / IDOR** (A pide un recurso de B) | 403 o 404, nunca el dato | **CUMPLE** para recursos con dueño | Campo solo actúa sobre lo propio: `test/crew-ownership.e2e-spec.ts:65-66` (403 `NOT_ASSIGNED`) y la matriz propio, ajeno y sin cuadrilla. La lectura de evidencia también (#466): `attachments.service.spec.ts:543`. Un token de ciudadano recibe 403 en todo lo no público (`src/common/guards/jwt-auth.guard.spec.ts:59`, `test/inbox.e2e-spec.ts:363`). **Matiz de diseño:** Oficina, Auditoría y Campo leen todos los recursos por `GET`; el dominio es compartido y no hay datos «por usuario». Hay que defenderlo en la prueba |
| **BFLA** (rol sin privilegio invoca un endpoint de administración) | 403 | **CUMPLE** | Matriz por actor en `test/auth-roles.e2e-spec.ts` (`it.each(TODOS)`, `:169`) y `route-roles.spec.ts`. Tabla endpoint por rol en `docs/api/endpoints.md`, generada de la metadata |
| **JWT** vencido, firma alterada, `alg=none`, otro emisor | 401 | **CUMPLE** | `jwt.strategy.spec.ts:167-187` (ver SEC-W01) |
| **Mass assignment** | Ignorado o 400, nunca persistido | **CUMPLE** | `configure-app.ts:52-55`, `services-lifecycle.e2e-spec.ts:61` |
| **Inyección SQL** | Sin ejecución | **NO VERIFICABLE** | Prisma parametriza. Hay 3 consultas crudas y las 3 usan *template tag*, sin `Unsafe`: `src/health/health.controller.ts:51`, `src/modules/crews/crews.service.ts:322`, `src/modules/indicators/indicators.service.ts:354`. **No hay test con payloads de inyección** |
| **NoSQL** | — | **N/A** | La base es PostgreSQL |
| **XSS** en campos de texto | Escapado o rechazado | **NO VERIFICABLE** | La API devuelve solo JSON con `nosniff` y no refleja HTML; el texto libre se guarda tal cual y depende de que el frontend escape. Los DTO recortan y limitan el largo. **No hay test con `<script>`**. Los caracteres nulos y el JSON demasiado anidado sí se rechazan (`no-null-chars.pipe.spec.ts`) |
| **XXE** en SOAP | Rechazado | **N/A** | M6 no tiene canal SOAP |
| **Fuerza bruta sobre el login** | 429 | **N/A** | M6 no tiene login: el JWT lo emite M1 |
| **Rate limiting** de la API | 429 | **NO CUMPLE** | `ThrottlerGuard` solo en el portal público; los endpoints autenticados y `POST /events/inbox` no tienen límite (DEF-07). No hay test de 429 |
| **OWASP ZAP** (baseline y activo autenticado) | 0 alertas High | **NO VERIFICABLE** | No realizado: no hay configuración ni ejecución (DEF-13) |
| **Dependencias** (SCA) | 0 CVE críticas o altas sin mitigación | **NO CUMPLE** | `npm audit --omit=dev` del 03/11: 15 vulnerabilidades (1 crítica, 6 altas, 8 moderadas). Ver sección 5 |
| **Cabeceras de seguridad** | CSP, HSTS y `X-Content-Type-Options` | **CUMPLE** (cabeceras) · **NO CUMPLE** (CSP) | `src/common/middleware/security-headers.middleware.ts` pone `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Cross-Origin-Resource-Policy: same-site` y HSTS solo si `NODE_ENV=production`; probado en `security-headers.middleware.spec.ts:21` y `:32`, y en `services-lifecycle.e2e-spec.ts:67`. `X-Powered-By` está deshabilitado (`configure-app.ts:26`). **No hay CSP**, a propósito: rompería Swagger UI (`/api/docs`). No hay helmet ni `Permissions-Policy` |
| **CORS** sin comodín con credenciales | Sin `*` con credenciales | **NO VERIFICABLE** en el despliegue | `src/main.ts:19-27`: sin `CORS_ORIGINS` se acepta cualquier origen, pero **sin `credentials`**, que es la combinación peligrosa. Hay que confirmar que la variable esté cargada en Render (DEF-18) |
| **Cookies** (`Secure`, `HttpOnly`, `SameSite`) | — | **N/A** | El backend no emite cookies: el JWT va en el header |
| **Errores sin stack al cliente** | Sin trazas | **CUMPLE** | `http-exception.filter.spec.ts:72` |
| **Logs sin datos personales ni tokens** | Sin datos sensibles | **NO VERIFICABLE** | Ver SEC-D01 |
| **TLS** en tránsito | Cifrado | **CUMPLE** (broker y Core) · **NO VERIFICABLE** (HTTP) | En producción la validación de arranque exige `amqps://`, prohíbe el usuario `guest` y exige `https://` para el Core (`src/config/env.validation.ts:176-216`), cubierto en `src/config/configuration.spec.ts:172-184`. El TLS del HTTP lo termina Render y no se puede probar desde el repo |
| **Hash de contraseñas** | bcrypt o Argon2 | **N/A** | M6 no almacena contraseñas |
| **Datos sensibles minimizados** | — | **CUMPLE** | El portal público devuelve solo etapa, tipo, dirección y fechas (`citizen-portal.service.spec.ts:38` y `:56`). Las URLs de evidencia son públicas, protegidas por una key aleatoria (DEF-19) |

## 5. Resultados de herramientas

### 5.1 Dependencias: `npm audit` (SCA)

`npm audit --omit=dev` el 03/11/2026 **con red**. Resultado: **15 vulnerabilidades en producción: 1 crítica, 6 altas, 8 moderadas**. Con las dependencias de desarrollo son 64 (2 críticas y 11 altas). El CI del backend **no corre `npm audit`**, por eso no se había visto.

Una corrida previa con `--offline` dio 0 vulnerabilidades; ese resultado venía de la caché local y **no es válido**.

| Severidad | Paquete | Directa | Qué reporta | Corrección |
|---|---|---|---|---|
| Crítica | `proxy-addr` | No (Express) | Suplantación de IP vía subred de IPv6 mapeada a IPv4 (GHSA-jqcg-44mw-7w3h) | `npm audit fix`, sin cambio mayor |
| Alta | `@nestjs/platform-express` | Sí | Arrastra `body-parser` y `multer` | Subir a NestJS 12 (cambio mayor) |
| Alta | `body-parser` | No | DoS por un `limit` inválido y por bytes sobrantes tras un cuerpo comprimido | NestJS 12 |
| Alta | `multer` | No | DoS por un `fileFilter` asíncrono pendiente tras cerrar el pedido (GHSA-q7qp-rjg7-q26m) | NestJS 12 |
| Alta | `js-yaml` | No (Swagger) | Contaminación de prototipo y DoS por claves de fusión | `@nestjs/swagger` 12 |
| Alta | `lodash` | No | Inyección de código en `_.template` y contaminación de prototipo | `@nestjs/swagger` o `@nestjs/config` 12 |
| Alta | `zod` | Sí | Agotamiento de memoria al validar colecciones enormes (GHSA-mrhx-c7xc-m3w5) | `zod` 4.6.7 (cambio mayor) |
| Moderadas (8) | `@nestjs/common`, `@nestjs/config`, `@nestjs/core`, `@nestjs/schedule`, `@nestjs/swagger`, `file-type`, `qs`, `uuid` | Mixto | DoS y neutralización incorrecta de caracteres especiales | `npm audit fix` resuelve `file-type`, `qs` y `@nestjs/common`; el resto, cambio mayor |

**Tratamiento propuesto (DEF-08):**

1. Correr `npm audit fix` (sin `--force`) y volver a correr los tests: según npm resuelve `proxy-addr`, `qs`, `file-type` y `@nestjs/common` sin cambios mayores.
2. Para lo que exige NestJS 12, **documentar la mitigación una por una** en este informe (la cátedra acepta CVE con mitigación documentada). Por ejemplo: las rutas con `multer` exigen rol de Campo y un token válido; M6 usa `trust proxy 1` (número de saltos) y no una lista de subredes. **No se analizó la explotabilidad**; eso queda para quien corrija.
3. Agregar `npm audit --omit=dev --audit-level=high` al CI y Dependabot.

### 5.2 OWASP ZAP

**No realizado.** No hay configuración ni ejecución. Plan: `zap-baseline.py` contra el despliegue (1 a 2 h), archivar el reporte y justificar cada alerta Media.

### 5.3 Escaneo de secretos

**Realizado el 03/11/2026 con gitleaks v8.30.1** (imagen `zricethezav/gitleaks:v8.30.1`) sobre todas las ramas: 270 commits, 78 MB.

```bash
docker run --rm -v "$PWD:/repo" zricethezav/gitleaks:v8.30.1 git /repo --redact --no-banner --log-opts="--all"
```

| Corrida | Resultado |
|---|---|
| Sin configuración propia | **9 hallazgos**, todos reglas `generic-api-key`, que se reducen a **2 valores** (ver abajo) |
| Con [`.gitleaks.toml`](../../.gitleaks.toml) | **0 hallazgos** (`no leaks found`) |

Los 2 valores marcados, ambos verificados a mano:

| Valor | Dónde | Por qué no es un secreto |
|---|---|---|
| `JWT_SECRET` de ejemplo (base64) | `.env.example`, `src/config/env.validation.ts:33` (`JWT_SECRET_EJEMPLO`), commits b9511a7, c8eb299 y fb60b7e | Decodifica a `CHANGE_ME_local_dev_secret_m6_32bytes`. **El equipo confirmó el 03/11 que nunca fue un secreto real.** En producción la validación de arranque lo rechaza |
| `SECRET = secreto-de-maquina-m6` | `src/core/core.client.spec.ts:4`, commits 3ca3625, 96087d7 y 6d2c732 | Valor de prueba de un test unitario |

El `.gitleaks.toml` excluye esos dos valores **por valor exacto**, no por archivo, así que una credencial real en esos mismos archivos se sigue detectando. El job `secrets` del CI (`.github/workflows/ci.yml`) repite el escaneo del historial completo en cada PR y push.

Revisión complementaria previa por expresiones regulares (todas las ramas, 252 commits): sin claves privadas, claves de AWS ni tokens de GitHub o Slack; `.env` ignorado y nunca versionado (`git log --all -- .env` vacío); sin `.pem`, `.key`, `.p12` ni `.pfx` versionados; el resto de los `JWT_SECRET`, `DATABASE_URL` y URLs de RabbitMQ con credenciales son marcadores de posición o valores de prueba de specs.

**Un punto sigue abierto:** `.env.example:92` y `docs/deploy.md` publican el usuario `module_ambiente` y el host del broker (`core-uade-2026.duckdns.org:5671/core`). La clave figura como marcador y gitleaks no encontró ninguna. Confirmar con M9 si es aceptable que usuario y host sean públicos; si la clave alguna vez se pegó en un commit, hay que **rotarla** en vez de reescribir el historial.

Limitaciones: gitleaks no analiza el contenido de los PDF ni de los binarios, y trufflehog no se corrió.

## 6. Hallazgos y tratamiento

| # | Hallazgo | Severidad propuesta | Tratamiento | Registro |
|---|---|---|---|---|
| 1 | 1 crítica y 6 altas en dependencias de producción | Mayor (sube a Crítica si hay explotabilidad) | `npm audit fix`, documentar mitigaciones y sumar `npm audit` al CI | DEF-08 |
| 2 | Sin rate limiting fuera del portal público | Mayor | Throttler global y un e2e de 429 | DEF-07 |
| 3 | Sin auditoría de lecturas Tier 2 (SEC-D02) | Mayor | Interceptor de lectura sobre los `GET` de denuncias y actas | DEF-09 |
| 4 | Sin ZAP (el escaneo de secretos con gitleaks ya se hizo y corre en el CI) | Mayor | `zap-baseline` manual | DEF-13 |
| 5 | Errores sin id de correlación ni formato RFC 9457 (SEC-W05) | Mayor | Migrar el filtro y avisar al frontend | DEF-10 |
| 6 | CORS abierto si falta `CORS_ORIGINS` | Menor | Confirmar la variable en Render | DEF-18 |
| 7 | Sin CSP, helmet ni `Permissions-Policy`; Swagger UI público en producción | Menor | Decisión documentada por Swagger UI; ocultarlo o aceptarlo | DEF-19 |
| 8 | Evidencia servida por URL pública; los PDF conservan metadatos | Menor | URLs firmadas, o aceptar el riesgo por escrito | DEF-19 |
| 9 | Sin tests de inyección, XSS, 429 ni 413 | Menor | Sumar un test por cada uno | — |
| 10 | No se valida `aud` del JWT | Menor | Justificado: M1 no emite `aud` (`docs/integracion/m1.md`) | — |

## 7. Cómo reproducir las pruebas en vivo

| Prueba | Comando o archivo |
|---|---|
| Rechazo de JWT (16 casos) | `npx jest src/auth/jwt.strategy.spec.ts` |
| Roles por endpoint | `npx jest src/auth/route-roles.spec.ts` y `npm run test:e2e -- auth-roles` (con una base descartable; ver `docs/testing.md`) |
| Pertenencia de Campo | `npm run test:e2e -- crew-ownership` |
| Mass assignment y cabeceras | `npm run test:e2e -- services-lifecycle` |
| Idempotencia del inbox | `npm run test:e2e -- inbox` |
| Dependencias | `npm audit --omit=dev` |
