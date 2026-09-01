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

## 6. Pendientes para que la app funcione end-to-end

Hoy la infraestructura está deployada y los health checks pasan, pero la app todavía **no** funciona de punta a punta. Falta:

| # | Pendiente | Responsable | Detalle |
|---|---|---|---|
| 1 | **Migraciones de Prisma** | Backend | Generar la primera migración desde `schema.prisma` y **sumar `npx prisma migrate deploy` al Dockerfile** (hoy está comentado en el CMD). Sin esto la DB no tiene tablas y los endpoints de dominio devuelven `500`. |
| 2 | **Terminar services de dominio** | Backend | Los controllers ya existen (rutas mapeadas), pero los services pueden estar a medio completar. |
| 3 | **UI del frontend** | Frontend | El frontend es un esqueleto (landing + health). Falta construir las vistas que consuman la API del backend por `NEXT_PUBLIC_API_URL`. |

**Prueba rápida del bloqueo actual** (sin migraciones):

```bash
curl https://m6-backend-m64k.onrender.com/zones
# → 500 {"statusCode":500,"message":"Error interno del servidor",...}
```

Cuando existan las migraciones, esto debería devolver `[]` (o los datos reales).

---

## 7. Referencia

- Guías paso a paso de deploy (fuera de git, en el workspace del DevOps): `docs/deploy-render.md` y `docs/deploy-vercel.md`.
- Seguimiento DevOps completo: `DEVOPS-SEGUIMIENTO.md` (workspace).