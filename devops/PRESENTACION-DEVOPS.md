# Presentación DevOps — Módulo 6 (Ambiente, Higiene y Servicios Urbanos)

> Guión para la persona del equipo a cargo de DevOps (M6, Grupo 04 — Municipalidad UADE).
> Tiempo estimado: ~5 minutos. Hablar en primera persona, natural, apoyándose en la demo en vivo (no leer textual).

---

## 1. Mi rol en el equipo

- Soy el **DevOps** del Módulo 6. Mi responsabilidad es que el equipo tenga un ambiente de desarrollo y despliegue que funcione solo: que el código que escriben llegue a producción sin pasos manuales y con la menor fricción posible.
- Me encargo de: infraestructura (Docker, docker-compose), integración continua (CI), despliegue (CD), seguridad de secretos y el flujo de trabajo con Git (Git Flow).
- El objetivo: **"push a develop = deploy en producción"**. Eso ya está funcionando.

---

## 2. Stack tecnológico

- **Backend**: NestJS + TypeScript + Prisma + PostgreSQL.
- **Frontend**: Next.js + TypeScript + Tailwind.
- **Mensajería**: RabbitMQ (eventos asincrónicos entre módulos). El patrón outbox ya está implementado en el backend; el broker lo define M9.
- **Contenedores**: imágenes Docker **multi-stage** (una etapa compila, otra corre liviana) para backend y frontend.
- **docker-compose local**: levanta `postgres + backend + frontend` juntos en una red (RabbitMQ queda comentado hasta que se use).
- **Plataformas de deploy**: **Render** (backend + PostgreSQL) y **Vercel** (frontend). **Costo: $0** — todo en free tier, sin tarjeta de crédito.

---

## 3. El pipeline CI/CD (lo importante)

```
git push origin develop
    ↓
GitHub Actions corre build + test (CI)
    ↓  si ambos pasan
Job "deploy" dispara el Deploy Hook de Render (con el commit exacto)
    ↓
Render buildea la imagen Docker y la deploya (~3-5 min)
```

Puntos para destacar:

- **CI**: cada PR a `develop` corre `build` y `test` (verificación automática antes de mergear).
- **CD automático**: el deploy del backend lo dispara **GitHub Actions**, no una persona. El Web Service de Render está conectado al repo, pero con auto-deploy apagado a propósito: el deploy se gatilla desde el CI, solo si build+test pasan. Así no se deploya código roto.
- **Deploy Hook de Render**: el job de deploy hace un POST a la URL del hook con el commit exacto mergeado (`&ref=<sha>`). La URL vive como **secret** en GitHub (`RENDER_DEPLOY_HOOK_URL`), nunca se commitea.
- **Vercel (frontend)**: deploy nativo — cada push a `develop` buildea y deploya el frontend automáticamente.
- Resultado: el equipo no toca los dashboards en el día a día. Se actualiza solo.

---

## 4. Seguridad

- **Secretos nunca en git**: `.env` está ignorado en ambos repos; en producción las variables viven en los paneles de Render/Vercel o en GitHub Secrets (como el Deploy Hook).
- **JWT**: el backend valida los tokens de identidad (HS256 contra `JWT_SECRET`). Los endpoints de dominio exigen token; el health check y Swagger son públicos.
- **Migraciones automáticas**: en el arranque del contenedor corre `prisma migrate deploy` antes de levantar la API. Si la base no está actualizada, el servicio no arranca (preferimos no servir una API contra un esquema desactualizado).
- **Imágenes livianas**: `.dockerignore` + build multi-stage → la imagen final solo tiene dependencias de producción y el código compilado.

---

## 5. Git Flow

- Ramas: `main ← test ← develop ← feature/*|bugfix/*|refactor/*|infra/*|docs/*`. Nunca se commitea directo a main/test/develop.
- **Conventional Commits**: `feat(scope):`, `fix(scope):`, `chore(ci):`, etc.
- **PRs siempre hacia `develop`** con checklist obligatorio.
- `CODEOWNERS` definido en ambos repos.
- **Branch protection**: el script para aplicarla está listo en el repo; falta que un admin (`hllous`) la active.

---

## 6. Estado actual y pendientes (ser honestos)

**Lo que está funcionando:**
- Backend y frontend deployados en producción con CI/CD automático.
- Health checks respondiendo, Swagger con todos los módulos (zones, services, containers, trees, etc.).
- Base de datos con migraciones aplicadas.

**Pendientes / en curso:**
- **RabbitMQ**: outbox listo en el backend, pero el broker aún no está expuesto (depende de M9).
- **Frontend**: la UI se está construyendo sobre el esqueleto deployado.
- **Branch protection**: pendiente de activación por un admin del repo.

---
## Preguntas probables y respuestas cortas

- **¿Por qué Render y no otro servicio?** Por simplicidad y costo $0 para un TPO: deploy desde Dockerfile, Postgres incluido, sin configuración de servidor. Evaluamos Oracle Cloud, Railway y Koyeb y ganó Render por simplicidad.
- **¿Qué pasa si el backend "duerme"?** Render free tier duerme el backend tras 15 min sin requests; el primer request tarda 30-60s en despertarlo. Para demos se despierta 1 min antes. El Postgres y el frontend (Vercel) no se duermen.
- **¿El deploy se puede romper?** Si build o test fallan, el job de deploy no corre: la última versión buena sigue viva. El rollback es redeployar el commit anterior (Manual Deploy → Deploy a specific commit).
- **¿Dónde está la evidencia de que funciona?** GitHub Actions (checks verdes), Render → Deploys ("Live") y los health checks públicos.