# Despliegue y estado del Módulo 6

> Estado del despliegue de producción del M6 (Ambiente, Higiene y Servicios Urbanos) al **01/09/2026**.
> Mantenido por DevOps. Si algo cambia de plataforma o de URL, actualizar este archivo.

---

## 1. Estado actual

| Componente | Plataforma | Estado | URL |
|---|---|---|---|
| **Backend** (NestJS) | Render (Web Service, free) | ✅ Live | `https://m6-backend-m64k.onrender.com` |
| **PostgreSQL** | Render (Managed, free) | ✅ Available | (Internal URL, no accesible desde afuera) |
| **Frontend** (Next.js) | Vercel (free) | ✅ Live | `https://m6-ambiente-frontend.vercel.app` |

El deploy está **enlazado a la rama `develop`** de cada repo: al pushear código a `develop`, Render y Vercel buildean y depliegan automáticamente (~2-5 min).

---

## 2. URLs útiles

| Recurso | URL |
|---|---|
| Frontend (landing) | `https://m6-ambiente-frontend.vercel.app` |
| Frontend health | `https://m6-ambiente-frontend.vercel.app/api/health` |
| Backend health | `https://m6-backend-m64k.onrender.com/health` |
| Backend Swagger UI | `https://m6-backend-m64k.onrender.com/api/docs` |

---

## 3. Cómo verificar que está todo OK

```bash
# Backend: debe devolver status ok
curl https://m6-backend-m64k.onrender.com/health
# → {"status":"ok","timestamp":"...","service":"m6-ambiente-backend"}

# Frontend: debe devolver status ok
curl https://m6-ambiente-frontend.vercel.app/api/health
# → {"status":"ok","timestamp":"...","service":"m6-ambiente-frontend"}
```

- **Swagger UI** en `.../api/docs` lista los endpoints REST (zones, crews, vehicles, containers, trees, green-spaces, etc.).
- **Nota**: un `GET /` (raíz) del backend devuelve `404 Cannot GET /` — es esperado, el backend no expone una ruta raíz. Usar `/health` o `/api/docs` para probar.

---

## 4. Cómo funciona el deploy

### Automático (lo normal)

```
git push origin develop
    ↓
Render detecta cambios en Backend-M6-DAPS2 → buildea Docker → deploya
Vercel detecta cambios en Frontend-M6-DAPS2 → buildea Next.js → deploya
    ↓
Servicios actualizados en ~2-5 min
```

No hay que hacer nada manual en el día a día.

### Deploy manual (cuando hace falta forzarlo)

- **Render** → servicio → pestaña **Deploys** → **Manual Deploy → Deploy latest commit**.
- **Vercel** → proyecto → **Deployments** → **Redeploy** del último deploy.

### Variables de entorno

**Backend (Render):**

| Variable | Valor |
|---|---|
| `DATABASE_URL` | (Internal Database URL del Postgres) |
| `JWT_SECRET` | secreto ≥ 8 caracteres (generar random) |
| `JWT_EXPIRATION` | `3600` |
| `NODE_ENV` | `production` |

> **Importante**: **NO** setear `PORT` a mano. Render inyecta su propio `PORT` automáticamente; pisarlo rompe el health check del deploy (la app corre en `10000` en free tier).

**Frontend (Vercel):**

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://m6-backend-m64k.onrender.com` |

> `NEXT_PUBLIC_*` se inyecta en **build time** (client-side). Si el backend cambia de URL, hay que actualizar la variable y redeployar.

---

## 5. Gotchas conocidos

- **Spin-down de Render (free tier)**: el backend se "duerme" tras **15 min** sin requests. El primer request tras dormirse tarda **30-60 s** en responder (lo despierta). Para demos, abrir `/health` ~1 min antes. El Postgres y el frontend (Vercel) **no se duermen**.
- **Health Check Path de Render**: dejarlo **vacío**. Un path de health check mal configurado produce `==> Timed Out` en el deploy aunque la app arranque bien.
- **Bind `0.0.0.0`**: el backend escucha en `0.0.0.0:PORT` (no `localhost`), que es lo que Render espera. No cambiar esto.
- **Postgres free tier**: 256 MB de storage y retención de 90 días (los datos viejos se purgan). Suficiente para el TPO.

---

## 6. Estado de la app end-to-end

> Actualizado al 02/09/2026, tras las Fases 0, 1 y 2 del plan de implementación.

La infraestructura está deployada, las migraciones corren solas en cada deploy y la API sirve datos reales.

| # | Qué | Estado |
|---|---|---|
| 1 | **Migraciones de Prisma** | ✅ Resuelto (PR #49). El `CMD` del Dockerfile corre `npx prisma migrate deploy` antes de arrancar. Si la migración falla, el contenedor no levanta — es deliberado: preferimos no servir una API contra un esquema desactualizado |
| 2 | **Services de dominio** | ✅ Zonas, cuadrillas, vehículos, contenedores, arbolado, espacios verdes, catálogos y `Service` completo |
| 3 | **Autenticación** | ⚠️ Provisoria. Todo endpoint exige JWT (guard global), pero la verificación es HS256 contra `JWT_SECRET` hasta que M9 publique su claim set. La autorización por rol **todavía no existe**: cualquier usuario autenticado puede llamar cualquier endpoint. Ver [ADR-002](decisiones/adr-002-auth-provisoria.md) |
| 4 | **Eventos** | ⏳ Fase 3. No se publica ni se consume nada del bus todavía |
| 5 | **UI del frontend** | ⏳ Frontend. Falta construir las vistas que consuman la API por `NEXT_PUBLIC_API_URL` |

### Cómo verificar que la API sirve datos

```bash
# 1. Health: publico, no pide token
curl https://m6-backend-m64k.onrender.com/health
# → {"status":"ok",...}

# 2. Cualquier endpoint de dominio SIN token → 401, no 500
curl https://m6-backend-m64k.onrender.com/zones
# → 401 {"statusCode":401,"message":"Unauthorized",...}
```

**Un 401 acá es la respuesta correcta, no un error.** Significa que la base tiene esquema y que el guard está funcionando. Si devuelve `500`, ahí sí hay algo roto.

Para probar con datos, generá un JWT firmado con el mismo `JWT_SECRET` del servicio y pegalo en el botón **Authorize** del [Swagger UI](https://m6-backend-m64k.onrender.com/api/docs).

---

## 7. Referencia

- Guías paso a paso de deploy (fuera de git, en el workspace del DevOps): `docs/deploy-render.md` y `docs/deploy-vercel.md`.
- Seguimiento DevOps completo: `DEVOPS-SEGUIMIENTO.md` (workspace).