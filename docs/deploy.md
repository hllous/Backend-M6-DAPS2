# Despliegue y estado del Módulo 6

> Estado del despliegue de producción del M6 (Ambiente, Higiene y Servicios Urbanos) revisado el **08/10/2026**.
> Mantenido por DevOps. Si algo cambia de plataforma o de URL, actualizar este archivo.

---

## 1. Estado actual

| Componente | Plataforma | Estado | URL |
|---|---|---|---|
| **Backend** (NestJS) | Render (Web Service, free) | ✅ `/health` 200 y `/health/ready` 200 con `"database":"up"` el 08/10 12:09 UTC | `https://m6-backend-m64k.onrender.com` |
| **PostgreSQL** | Supabase (Managed, free) | ✅ Available | `db.oscepollzibotvggabfv.supabase.co` (URI directa, puerto `5432`) |
| **Frontend** (Next.js) | Vercel (free) | ✅ `/api/health` 200 el 04/10 | `https://frontend-m6-daps2-grupo4-modulo6.vercel.app` |

El frontend publica su URL en el repo [`hllous/Frontend-M6-DAPS2`](https://github.com/hllous/Frontend-M6-DAPS2) (campo "website"). `https://m6-ambiente-frontend.vercel.app` también respondía el 04/10, pero la vigente es la de arriba.

El deploy está **enlazado a la rama `develop`** de cada repo: al pushear código a `develop` se actualiza automáticamente — el backend vía GitHub Actions + Deploy Hook de Render, el frontend vía auto-deploy nativo de Vercel (~2-5 min).

---

## 2. URLs útiles

| Recurso | URL |
|---|---|
| Frontend (landing) | `https://frontend-m6-daps2-grupo4-modulo6.vercel.app` |
| Frontend health | `https://frontend-m6-daps2-grupo4-modulo6.vercel.app/api/health` |
| Backend health | `https://m6-backend-m64k.onrender.com/health` |
| Backend Swagger UI | `https://m6-backend-m64k.onrender.com/api/docs` |

---

## 3. Cómo verificar que está todo OK

```bash
# Backend: debe devolver status ok
curl https://m6-backend-m64k.onrender.com/health
# → {"status":"ok","timestamp":"...","service":"m6-ambiente-backend"}

# Frontend: debe devolver status ok
curl https://frontend-m6-daps2-grupo4-modulo6.vercel.app/api/health
# → {"status":"ok","timestamp":"...","service":"m6-ambiente-frontend"}
```

- **Swagger UI** en `.../api/docs` lista los endpoints REST (zones, crews, vehicles, containers, trees, green-spaces, etc.).
- **Nota**: un `GET /` (raíz) del backend devuelve `404 Cannot GET /` — es esperado, el backend no expone una ruta raíz. Usar `/health` o `/api/docs` para probar.

---

## 4. Cómo funciona el deploy

### Automático (lo normal)

**Backend (Render)** — lo dispara GitHub Actions:

```
git push origin develop
    ↓
GitHub Actions corre build + test (CI)
    ↓  si ambos pasan
Job "deploy" dispara el Deploy Hook de Render (con el commit exacto)
    ↓
Render buildea Docker y deploya
    ↓
Backend actualizado en ~3-5 min
```

**Frontend (Vercel)** — deploy nativo:

```
git push origin develop
    ↓
Vercel detecta cambios en Frontend-M6-DAPS2 → buildea Next.js → deploya
    ↓
Frontend actualizado en ~2-5 min
```

No hay que hacer nada manual en el día a día.

> **Nota**: el job `deploy` de GitHub Actions depende de `build`+`test`: si el CI falla, **no** se deploya. La config es el secret `RENDER_DEPLOY_HOOK_URL` (Deploy Hook del servicio en Render) + **Auto-Deploy apagado** en Render (para evitar dobles deploys).

### Deploy manual (cuando hace falta forzarlo)

- **Render** → servicio → pestaña **Deploys** → **Manual Deploy → Deploy latest commit**.
- **Vercel** → proyecto → **Deployments** → **Redeploy** del último deploy.

### Variables de entorno

**Backend (Render):**

| Variable | Valor | Requerida |
|---|---|---|
| `DATABASE_URL` | Connection string de Supabase (URI directa, puerto `5432`, con `?schema=public`) | ✅ Sí |
| `JWT_SECRET` | Secreto ≥ 8 caracteres (generar random) | ✅ Sí |
| `CORS_ORIGINS` | `https://frontend-m6-daps2-grupo4-modulo6.vercel.app` | No, pero conviene: sin ella se acepta cualquier origen |
| `JWT_EXPIRATION` | `3600` | No (default 3600s) |
| `NODE_ENV` | `production` | ✅ Sí |
| `SANCTION_DEADLINE_DAYS` | `30` | No (default 30 días para cierre de expediente ambiental sin resolución M4) |
| `R2_ACCOUNT_ID` | Account ID de Cloudflare R2 | Para subida de adjuntos (`/evidence`). Sin esta variable, `POST /evidence` responde 503 |
| `R2_ACCESS_KEY_ID` | Key ID de API de Cloudflare R2 | Para subida de adjuntos (`/evidence`) |
| `R2_SECRET_ACCESS_KEY` | Secret de API de Cloudflare R2 | Para subida de adjuntos (`/evidence`) |
| `R2_BUCKET` | Nombre del bucket R2, p. ej. `m6-evidence` | Para subida de adjuntos (`/evidence`) |
| `R2_PUBLIC_URL_BASE` | Dominio público del bucket, p. ej. `https://pub-xxxx.r2.dev` (sin barra final) | Para devolver URLs directas en `/evidence`. Sin esta variable, `POST /evidence` responde 503 |
| `RABBITMQ_URL` | `amqp[s]://usuario:clave@host:5672/vhost` (clave percent-encoded; `amqps://` obligatorio con `NODE_ENV=production`) | Opcional hasta que M9 provea broker |
| `RABBITMQ_EXCHANGE` | `muni.inbox` (default): el fanout al que publicamos. Lo crea el Core y la app solo verifica que exista (`checkExchange`), no lo declara | No |
| `RABBITMQ_QUEUE` | `q.ambiente` (default): la cola de la que consumimos. La crea el Core al registrar nuestras suscripciones y la app solo verifica que exista (`checkQueue`), sin bindings propios | No |
| `RABBITMQ_PREFETCH` | `1` (default): cuántos mensajes sin ack puede tener la app a la vez. No garantiza orden: el Core reintenta y reordena | No |
| `CORE_MODULE_ID` | `ambiente` (default): nuestro módulo ante el Core, va como `sourceModule` en el sobre y en el pedido de token | No |
| `CORE_API_URL` | URL base de la API REST del Core (M9), p. ej. `https://core.example.com`; `https://` obligatorio con `NODE_ENV=production` | Opcional hasta que M9 publique la URL de cada ambiente. Sin ella la app arranca igual y no se le pide nada al Core |
| `CORE_MODULE_SECRET` | Secret de máquina para pedir el token de módulo (`POST /api/v1/auth/module-token`). Lo entrega M9; se carga **solo en el panel de Render**, nunca en el repo ni en `.env.example`, y la app no lo loguea | ✅ Sí si hay `CORE_API_URL` (sin él la app no arranca) |

> **Variables viejas de RabbitMQ**: si el panel de Render todavía tiene `RABBITMQ_EXCHANGE=municipalidad.events` o `RABBITMQ_QUEUE=m6.ambiente`, borrarlas (pisan los defaults nuevos y `checkExchange`/`checkQueue` dan 404). Lo mismo con `RABBITMQ_EXCHANGE_TYPE` y `RABBITMQ_DEAD_LETTER_EXCHANGE`, que ya no existen.

> **Importante**: **NO** setear `PORT` a mano. Render inyecta su propio `PORT` automáticamente; pisarlo rompe el health check del deploy (la app corre en `10000` en free tier).

**Frontend (Vercel):**

| Variable | Valor |
|---|---|
| `M6_AUTH_MODE` | `backend-development` (demo contra el backend real) |
| `M6_BACKEND_ORIGIN` | `https://m6-backend-m64k.onrender.com` |
| `M6_DEV_JWT` | JWT firmado con el `JWT_SECRET` del backend (payload `{ sub, exp }`) |
| `M6_SESSION_SECRET` | Clave secreta para sellar la cookie de sesión del Next.js BFF |

> `M6_AUTH_MODE=backend-development` reenvía cada petición del BFF al backend con `M6_DEV_JWT` como Bearer. `M6_BACKEND_ORIGIN`, `M6_DEV_JWT` y `M6_SESSION_SECRET` se leen en runtime (server-side), así que se pueden cambiar sin rebuild. `NEXT_PUBLIC_API_URL` quedó obsoleto: el código actual no lo usa.

---

## 5. Gotchas conocidos

- **Spin-down de Render (free tier)**: el backend se "duerme" tras **15 min** sin requests. El primer request tras dormirse tarda **30-60 s** en responder (lo despierta). El frontend (Vercel) **no se duerme**; Supabase free se **pausa** tras ~1 semana sin actividad (se reactiva desde el dashboard, no pierde datos).

  **Y mientras duerme no corren los procesos de fondo**, que es lo que de verdad importa:

  | Proceso | Qué hace | Dormido |
  |---|---|---|
  | `@Interval(10s)` | Despacha el outbox | Los eventos quedan `PENDING`; se recupera solo al despertar |
  | `@Cron(EVERY_HOUR)` | Cierra expedientes vencidos | Se atrasa hasta despertar; **también barre al arrancar**, así que se pone al día solo |

  `ReportDeadlineSweeper` es el único camino por el que un expediente pasa de `NOTICE_ISSUED` a `CLOSED` cuando M4 nunca contesta. Como el barrido es idempotente (`updateMany` sobre los vencidos) y desde #150 corre **también en `onModuleInit`**, dormirse retrasa el cierre pero no lo pierde: al despertar, el primer arranque ya cierra lo vencido.

  El workflow [`keepalive.yml`](../.github/workflows/keepalive.yml) pega a `/health` para tener el servicio tibio. **Necesita la variable de repositorio `RENDER_HEALTH_URL`** (Settings › Secrets and variables › Actions › Variables) con `https://m6-backend-m64k.onrender.com/health`. Sin ella el workflow avisa y sale sin fallar.

  > ⚠️ **El keepalive no evita el spin-down.** Pide el cron cada 10 minutos, pero GitHub descarta la mayoría de las ejecuciones programadas: en la práctica corre **cada 2-3 horas** (7-8 veces por día). Por eso el barrido al arrancar es lo que sostiene el cierre por vencimiento, y no este ping. El `--max-time` del ping es de 180 s porque el arranque en frío corre `prisma migrate deploy` antes de escuchar y con 90 s fallaba por timeout sin que nada estuviera roto.
- **Health Check Path de Render**: dejarlo **vacío**. Un path de health check mal configurado produce `==> Timed Out` en el deploy aunque la app arranque bien.
- **Monitoreo**: `GET /health/ready` devuelve 503 si la base no responde; `/health` es solo liveness (keepalive) y sigue en 200 aunque la base esté caída. Con la base inalcanzable al arrancar el servidor ni empieza a escuchar (Prisma falla en `onModuleInit`): `/health/ready` solo detecta una base que se cae con el proceso ya arriba.
- **Bind `0.0.0.0`**: el backend escucha en `0.0.0.0:PORT` (no `localhost`), que es lo que Render espera. No cambiar esto.
- **Supabase free tier**: 500 MB de storage y sin el vencimiento de 30 días de Render, pero el proyecto se **pausa** tras ~1 semana de inactividad (se reactiva desde el dashboard). Suficiente para el TPO.

---

## 6. Estado de la app end-to-end

> Conteos contrastados con el código el 04/10/2026 (134 rutas en 23 tags Swagger). El estado en vivo de Render y Vercel hay que confirmarlo con los `curl` de abajo: no se asume.

La infraestructura está deployada, las migraciones corren solas en cada deploy y la API sirve datos reales.

| # | Qué | Estado |
|---|---|---|
| 1 | **Migraciones de Prisma** | ✅ Resuelto (PR #49). El `CMD` del Dockerfile corre `npx prisma migrate deploy` antes de arrancar. Si la migración falla, el contenedor no levanta |
| 2 | **Services de dominio** | ✅ Fases 1 a 7 completas (134 endpoints en 23 tags): catálogos, recursos (cuadrillas, vehículos), contenedores, arbolado, espacios verdes, `Service` (máquina de estados, ZoneResults, CollectionRecords), control ambiental (expedientes, inspecciones, actas, sanciones), derivaciones (M3 reparaciones, M7 cortes), tablero de indicadores (`/indicators`) y portal ciudadano (`/public`) |
| 3 | **Autenticación** | ⚠️ Provisoria. Todo endpoint exige JWT (guard global), pero la verificación es HS256 contra `JWT_SECRET` hasta que M1 publique su contrato de firma y claims. La autorización por rol server-side está diferida hasta que M1 defina su taxonomía; el frontend realiza control de permisos optimista en UI (ver [ADR-002](decisiones/adr-002-auth-provisoria.md)) |
| 4 | **Eventos** | ✅ Outbox transaccional (Fase 3), Inbox con handlers (Fase 6) y adaptador/consumidor de RabbitMQ (#234) implementados. Lo que resta es el broker del Core (M9): sin `RABBITMQ_URL` configurada, los eventos se encolan en outbox y se registran en log. Con ella, la app publica al exchange `muni.inbox` y consume `q.ambiente`, que crea el Core al registrar nuestras suscripciones: hasta entonces `checkQueue` falla (404) y el consumidor reintenta la conexión. La ingesta manual puede ejercitarse vía `POST /events/inbox` |
| 5 | **Evidencia y adjuntos** | ✅ Resuelto (Fase 7). `POST /evidence` genérico sobre Cloudflare R2 con `Idempotency-Key` obligatoria respaldada por constraint único en DB (`SERVICE`, `ZONE_RESULT`, `INSPECTION`, `CONTAINER`) |
| 6 | **Frontend (Next.js)** | ⏳ En desarrollo. Etapa de mapa de Wayfinder completada: diseño (DESIGN.md con paleta Azul Institucional y WCAG 2.2 AA), contratos (CONTRACTS.md), BFF session (ADR-0004) y prototipos interactivos validados |

### Cómo verificar que la API sirve datos

```bash
# 1. Health: publico, no pide token
curl https://m6-backend-m64k.onrender.com/health
# → {"status":"ok",...}

# 2. Endpoints publicos (portal ciudadano): responden 200 sin token
curl https://m6-backend-m64k.onrender.com/public/zones
# → [...]

# 3. Cualquier endpoint de dominio protegido SIN token → 401, no 500
curl https://m6-backend-m64k.onrender.com/zones
# → 401 {"statusCode":401,"message":"Unauthorized",...}
```

**Un 401 acá es la respuesta correcta, no un error.** Significa que la base tiene esquema y que el guard está funcionando. Si devuelve `500`, ahí sí hay algo roto.

Para probar con datos, generá un JWT firmado con el mismo `JWT_SECRET` del servicio y pegalo en el botón **Authorize** del [Swagger UI](https://m6-backend-m64k.onrender.com/api/docs).

---

## 7. Referencia

- Guías paso a paso de deploy (fuera de git, en el workspace del DevOps): `docs/deploy-render.md` y `docs/deploy-vercel.md`.
- Seguimiento DevOps completo: `DEVOPS-SEGUIMIENTO.md` (workspace).