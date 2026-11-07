# Referencia de operación

Datos que cambian poco: dónde está cada cosa, qué corre en CI y qué variables lee el backend. Cómo se usa todo esto: [desplegar.md](desplegar.md) y [runbooks.md](runbooks.md).

## URLs

| Recurso | Plataforma | URL |
|---|---|---|
| Backend (NestJS) | Render, Web Service free | `https://m6-backend-m64k.onrender.com` |
| Backend health (liveness) | Render | `https://m6-backend-m64k.onrender.com/health` |
| Backend readiness | Render | `https://m6-backend-m64k.onrender.com/health/ready` |
| Swagger UI | Render | `https://m6-backend-m64k.onrender.com/api/docs` |
| Frontend (Next.js) | Vercel, free | `https://m6-ambiente-higiene.vercel.app` |
| Frontend health | Vercel | `https://m6-ambiente-higiene.vercel.app/api/health` |
| PostgreSQL | Supabase, free | URI directa, puerto `5432` (el host va en el panel de Render, no acá) |
| Login de M1 | Render (M1) | `https://ciudadanos-m1-backend.onrender.com` |
| Core de M9 (API) | AWS | `https://core-uade-2026.duckdns.org` (readiness: `/health/ready`) |

El frontend publica su URL en el campo "website" de [`hllous/Frontend-M6-DAPS2`](https://github.com/hllous/Frontend-M6-DAPS2). Un `GET /` del backend responde `404`: no tiene ruta raíz.

IP de salida de Render, para el alta del puerto 5671 del Core (rangos públicos, compartidos por los servicios de la región): `74.220.48.0/24` y `74.220.56.0/24`. Si Render los cambia, avisar a M9 antes de volver a probar.

## Workflows

| Archivo | Cuándo corre | Qué hace |
|---|---|---|
| [`ci.yml`](../../.github/workflows/ci.yml) | PR y push a `develop`, `test`, `main` | Jobs `build` (docs:check, generate, build, lint, OpenAPI al día) y `test` (`test:cov`), obligatorios por branch protection; `e2e` y `secrets` (gitleaks) se miran pero no bloquean. El job `deploy` corre solo en push a `main` y solo si `build` y `test` pasan: hace `POST` al Deploy Hook de Render con el commit exacto |
| [`keepalive.yml`](../../.github/workflows/keepalive.yml) | Cron `*/10 * * * *` (en la práctica cada 2-3 horas) y a mano | Pega a `RENDER_HEALTH_URL` con `--max-time 180`; si la variable no existe avisa y sale sin fallar; si la respuesta no es 200 el job queda rojo |

Configuración en GitHub:

| Nombre | Tipo | Valor | Usado por |
|---|---|---|---|
| `RENDER_DEPLOY_HOOK_URL` | Secret del repo | Deploy Hook del servicio en Render | `ci.yml` (job `deploy`) |
| `RENDER_HEALTH_URL` | Variable del repo (Settings › Secrets and variables › Actions › Variables) | `https://m6-backend-m64k.onrender.com/health` | `keepalive.yml` |

En Render, **Auto-Deploy va apagado** (si no, hay doble deploy) y el **Health Check Path va vacío** (un path mal puesto da `==> Timed Out` aunque la app arranque).

## Variables de entorno del backend

Son las 34 claves de [`src/config/env.validation.ts`](../../src/config/env.validation.ts), una vez cada una. El ejemplo comentado está en [`.env.example`](../../.env.example). Los **secretos** se cargan solo en el panel de Render, nunca en el repo, en capturas ni en logs. "Dónde" es Render salvo que diga otra cosa.

### Servidor y base

| Variable | Valor / ejemplo | Obligatoriedad | Dónde |
|---|---|---|---|
| `PORT` | default `3000` | Opcional. **No setear en Render**: lo inyecta la plataforma (`10000` en free tier) y pisarlo rompe el health check | Local |
| `NODE_ENV` | `development` (default), `production`, `test` | `production` en Render: activa los chequeos de https/amqps y rechaza secretos de ejemplo | Local `development`; Render `production` |
| `DATABASE_URL` | URI directa de Supabase, puerto `5432`, con `?schema=public` | **Obligatoria** (URL válida). Secreta | Local y Render. Los e2e truncan la base: nunca apuntarlos a la de Render |
| `CORS_ORIGINS` | `https://m6-ambiente-higiene.vercel.app`; varios, separados por coma | Opcional: sin ella se acepta cualquier origen (higiene, no límite de seguridad) | Render |

### Auth y roles

| Variable | Valor / ejemplo | Obligatoriedad | Dónde |
|---|---|---|---|
| `JWT_SECRET` | `APP_JWT_SECRET` de M1: base64 estándar, decodifica a 32 bytes o más. Provisorio: `openssl rand -base64 32` | **Obligatoria**. Secreta. En producción rechaza el valor de `.env.example` y los de un byte repetido. En texto plano el servicio no arranca | Render; Local con el placeholder del `.env.example` |
| `JWT_ISSUER` | `modulo1-ciudadanos` (default) | Opcional: es el `iss` exigido en el token | Render (no hace falta tocarlo) |
| `M6_BOOTSTRAP_ADMIN_USER_IDS` | Ids numéricos de M1 (`sub`) separados por coma, ej. `1,10000`. Cada uno necesita además `RESPONSABLE_AREA` en M1 | Opcional, pero **sin ella nadie puede asignar roles** ([ADR-008](../decisiones/adr-008-roles-m6-adaptados-desde-m1.md)). Al arrancar se loguea solo cuántos hay. Quitar a alguien exige sacarlo de la variable y redesplegar | Render |
| `BFF_SHARED_KEY` | Mínimo 32 caracteres, ej. `openssl rand -base64 32`; el mismo valor va en Vercel (header `X-M6-BFF-Key`) | Opcional, pero sin ella todos los vecinos del BFF comparten un solo límite de tasa ([portal](../api/endpoints.md#citizen-portal--vista-pública)). Secreta | Render |

### Reglas de negocio e indicadores

| Variable | Valor / ejemplo | Obligatoriedad | Dónde |
|---|---|---|---|
| `SANCTION_DEADLINE_DAYS` | `30` (default) | Opcional: días de espera de la resolución de M4 antes de cerrar el expediente | Render |
| `INDICATORS_TARGET_COVERAGE_PCT` | `95` (0 a 100) | Opcional | Render |
| `INDICATORS_TARGET_COMPLIANCE_PCT` | `90` (0 a 100) | Opcional | Render |
| `INDICATORS_TARGET_RESOLUTION_BUSINESS_DAYS` | `5` (positivo, días hábiles) | Opcional | Render |
| `INDICATORS_TARGET_SCHEDULING_DEVIATION_PCT` | `10` (0 a 100) | Opcional | Render |
| `INDICATORS_TARGET_LANDFILL_DIVERSION_PCT` | sin valor (0 a 100) | Opcional: vacía o ausente = sin meta, el tablero no la dibuja | Render |
| `INDICATORS_REPORT_DEADLINE_BUSINESS_DAYS` | `5` (positivo, días hábiles) | Opcional: plazo único de resolución de denuncias, supuesto de M6 hasta que M2 acuerde el suyo | Render |
| `INDICATORS_TARGET_REPORTS_WITHIN_DEADLINE_PCT` | `85` (0 a 100) | Opcional: se cumple con 85 % o más | Render |
| `INDICATORS_TARGET_REPORTS_OVERDUE_PCT` | `10` (0 a 100) | Opcional: se cumple con 10 % o menos | Render |
| `INDICATORS_MIN_SAMPLE` | `5` (entero positivo) | Opcional: debajo de esa cantidad de programados el porcentaje se marca `lowSample` | Render |

### Bus RabbitMQ del Core

| Variable | Valor / ejemplo | Obligatoriedad | Dónde |
|---|---|---|---|
| `RABBITMQ_URL` | `amqps://module_ambiente:<clave percent-encoded>@core-uade-2026.duckdns.org:5671/core`. El vhost `core` va en la ruta; la clave se percent-encodea (`/ ? # @ : %`) | Opcional (vacía = ausente): sin ella la app arranca, los eventos quedan en el outbox y no se consume nada. Con `NODE_ENV=production` exige `amqps://` y rechaza el usuario `guest`. Secreta | Render; Local solo contra un broker propio |
| `RABBITMQ_EXCHANGE` | `muni.inbox` (default): el fanout donde publicamos | Opcional. Lo crea el Core; la app solo verifica que exista. **No definirla en Render**: un override viejo (`municipalidad.events`) da 404 | Render (no definir) |
| `RABBITMQ_QUEUE` | `q.ambiente` (default): la cola de la que consumimos | Opcional. La crea el Core al registrar las suscripciones; la app solo verifica. **No definirla en Render** (override viejo: `m6.ambiente`) | Render (no definir) |
| `RABBITMQ_PREFETCH` | `1` (default): mensajes sin ack a la vez | Opcional. No garantiza orden: el Core reintenta y reordena | Render |
| `INBOX_RETENTION_DAYS` | `180` (default); `0` = no purgar | Opcional. Un job diario (03:00) borra las filas de `inbox_event` procesadas con más de esos días; pendientes y fallidas no se tocan. Vacía es inválida | Render |

### Core de M9 y M1

| Variable | Valor / ejemplo | Obligatoriedad | Dónde |
|---|---|---|---|
| `CORE_MODULE_ID` | `ambiente` (default): va como `sourceModule` y debe coincidir con el módulo del token (si no, 403) | Opcional | Render |
| `CORE_API_URL` | `https://core-uade-2026.duckdns.org` (la app agrega `/api/v1/...`) | Opcional: sin ella la app arranca y no se le pide nada al Core. En producción, `https://` | Render |
| `CORE_MODULE_SECRET` | Secret de máquina que entrega M9 por privado | **Obligatoria si hay `CORE_API_URL`** (sin él la app no arranca). Secreta; no se loguea | Render, solo en el panel |
| `CORE_SUBSCRIPTION_MAX_ATTEMPTS` | `4` (default, 1 a 10) | Opcional. Rige solo al crear la suscripción: cambiarla después no actualiza las ya registradas | Render |
| `CORE_REGISTER_ON_BOOT` | `true` (default); acepta `true`/`false`/`1`/`0` sin distinguir mayúsculas | Opcional. Con más de una réplica conviene `false` y correr `npm run core:register` en el deploy | Render |
| `M1_BASE_URL` | `https://ciudadanos-m1-backend.onrender.com` (sin credenciales, query ni hash; en producción `https://`) | Opcional: sin ella el cliente de M1 queda deshabilitado y la validación de cuadrillas no corre. Necesita `CORE_API_URL` y `CORE_MODULE_SECRET` ([ADR-009](../decisiones/adr-009-rest-m6-a-m1-consultas-de-identidad.md)) | Render |

### Cloudflare R2 (evidencia)

Sin estas cinco la app arranca, pero `POST /evidence` responde 503.

| Variable | Valor / ejemplo | Obligatoriedad | Dónde |
|---|---|---|---|
| `R2_ACCOUNT_ID` | Account ID de Cloudflare | Para adjuntos | Render |
| `R2_ACCESS_KEY_ID` | Key ID de la API de R2 | Para adjuntos. Secreta | Render |
| `R2_SECRET_ACCESS_KEY` | Secret de la API de R2 | Para adjuntos. Secreta | Render |
| `R2_BUCKET` | `m6-evidence` | Para adjuntos | Render |
| `R2_PUBLIC_URL_BASE` | `https://pub-xxxx.r2.dev`, sin barra final | Para adjuntos: sin ella `/evidence` no devuelve URL directa | Render |

### Variables que ya no existen

Si siguen en el panel de Render, borrarlas (pisan defaults y dan 404 en el broker): `RABBITMQ_EXCHANGE_TYPE`, `RABBITMQ_DEAD_LETTER_EXCHANGE`, `KAFKA_*`, `JWT_EXPIRATION`.

### Frontend (Vercel)

No están en esta tabla: `M6_AUTH_MODE`, `M6_BACKEND_ORIGIN` y `M6_SESSION_SECRET` (y la copia de `M1_BASE_URL` que usa el BFF) viven en Vercel y se documentan en el repo del frontend, [`hllous/Frontend-M6-DAPS2`](https://github.com/hllous/Frontend-M6-DAPS2). `M6_DEV_JWT`, `M6_JWT_SECRET` y `NEXT_PUBLIC_API_URL` ya no se usan: borrarlas si quedaron.
