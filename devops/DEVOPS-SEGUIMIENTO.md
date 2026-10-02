# Seguimiento DevOps — Módulo 6 (Ambiente e Higiene)

> **Autor**: Castro, Bautista (DevOps) · **Fecha**: 26/08/2026
> **Proyecto**: Municipalidad UADE — DAPS2, Grupo 04
> Este documento registra TODO lo que se hizo, creó y dónde quedó cada cosa, explicado para que cualquiera del equipo lo entienda.

---

## 0. Estado general

| Tema | Estado |
|---|---|
| Backend (Docker + CI) | ✅ Listo y verificado |
| Frontend (esqueleto + Docker + CI) | ✅ Listo y verificado |
| Git Flow (branch protection) | 🟡 Ramas y CODEOWNERS listos; branch protection no se implementa por ahora |
| docker-compose local | ✅ Listo (Fase 4 completada 01/09/2026) |
| Deploy | ✅ Configurado (Fase 5: Vercel + Render, completada 01/09/2026) + deploy backend automatizado vía GitHub Actions + Deploy Hook (02/09/2026, PR #78) |

**Dónde está el código**: clonado localmente en esta carpeta (`Desarrollo de apps 2`).
- `Backend-M6-DAPS2/` (repo `hllous/Backend-M6-DAPS2`)
- `Frontend-M6-DAPS2/` (repo `hllous/Frontend-M6-DAPS2`)

**Estado en Git**: los cambios están **commiteados en ramas locales** `infra/docker-ci-cd` (una en cada repo). **Todavía NO están pusheados** a GitHub, para que se revisen antes.

---

## 1. Backend (`Backend-M6-DAPS2`)

Rama: `infra/docker-ci-cd` (parte de `develop`).

### Archivos creados y qué hace cada uno

| Archivo | Qué hace |
|---|---|
| `Dockerfile` | Construye la imagen Docker del backend. Build **multi-stage**: etapa `builder` (instala todo, genera cliente Prisma y compila TypeScript) y etapa `runner` (imagen final liviana con solo lo necesario). |
| `.dockerignore` | Lista de archivos que NO se copian a la imagen (node_modules, dist, .env, docs, test...). |
| `.github/workflows/ci.yml` | Pipeline de integración continua. Corre en PRs/pushes a `develop`/`test`/`main`. Tiene 2 jobs: `build` y `test`. |

### Detalles importantes del `Dockerfile`

1. **Multi-stage**: la imagen final solo lleva dependencias de producción + código compilado (`dist/`) + cliente Prisma. Más liviana y segura.
2. **`apk add openssl`**: Prisma necesita OpenSSL en Alpine (Linux). Sin esto, `$connect()` a la base falla en runtime. Se agregó en las dos etapas.
3. **`prisma generate`**: genera el cliente de Prisma desde `prisma/schema.prisma` (no necesita conexión a la base).
4. **`npm ci --omit=dev`**: instala solo dependencias de producción en la imagen final.
5. El cliente Prisma generado se copia de la etapa `builder` a la `runner` (`.prisma`), porque en la imagen final no está el CLI de Prisma.

### Detalles del `ci.yml`

- Jobs llamados **`build`** y **`test`** a propósito: así lo exige la **branch protection** del equipo (`docs/gestion/branch-protection-rules.json` pide checks `build` y `test`). No renombrarlos.
- `build`: `npm ci` → `prisma generate` → `npm run build` (compila NestJS).
- `test`: `npm ci` → `prisma generate` → `npm run test -- --passWithNoTests`.
  - `--passWithNoTests` es **temporal**: hoy el backend no tiene tests (`*.spec.ts` = 0). Cuando el backend dev agregue tests, se quita ese flag.

### Verificación hecha (funcionó)

1. `docker build -t m6-backend:test .` → compila OK.
2. Se levantó un Postgres (`postgres:16-alpine`) y el backend en una red Docker.
3. `GET /health` → **HTTP 200** `{"status":"ok","service":"m6-ambiente-backend",...}`.

---

## 2. Frontend (`Frontend-M6-DAPS2`)

Rama: `infra/docker-ci-cd` (parte de `main`, porque el repo estaba vacío y solo tiene `main`).

### Qué se creó

Se generó un **esqueleto base de Next.js 14** (App Router + TypeScript + Tailwind) para que el equipo de frontend construya encima, más los archivos DevOps.

| Archivo/Carpeta | Qué es |
|---|---|
| `src/app/` | App Router: `layout.tsx`, `page.tsx` (landing simple del M6), `globals.css`, `fonts/`, `favicon.ico` |
| `src/app/api/health/route.ts` | Endpoint de health check (`GET /api/health`). Devuelve `{"status":"ok","service":"m6-ambiente-frontend"}` |
| `public/.gitkeep` | Carpeta `public/` para assets estáticos (vacía por ahora) |
| `next.config.mjs` | Config con `output: "standalone"` (necesario para el Dockerfile) |
| `package.json` | Nombre `m6-ambiente-frontend`, scripts (`dev`, `build`, `start`, `lint`) |
| `Dockerfile` | Build multi-stage (deps → builder → runner) usando standalone output |
| `.dockerignore` | Archivos que no van a la imagen |
| `.env.example` | Variable de ejemplo `NEXT_PUBLIC_API_URL` (apunta al backend) |
| `.github/workflows/ci.yml` | Pipeline CI (jobs `build` y `test`) |
| `README.md` | Reescrito con cómo correr el frontend |
| `.gitignore` | Se agregó `.env` (para no commitear secretos) |

### Detalles importantes

1. **`output: "standalone"`** en `next.config.mjs`: hace que `next build` genere un servidor auto-contenido (`.next/standalone`) con su propio `node_modules` mínimo. La imagen final solo lleva eso + los assets estáticos (`.next/static`) + `public/`. Resultado: imagen liviana.
2. **`ci.yml`**: job `build` corre `npm run build`; job `test` **por ahora corre `npm run lint`** como placeholder (el frontend todavía no tiene framework de tests). Cuando se agregue Jest/Vitest, se reemplaza.
3. **Dockerfile copia `public/`**: por eso se creó la carpeta `public/` (con `.gitkeep`), para que el `COPY` no falle y quede lista para cuando agreguen imágenes/estáticos.

### Verificación hecha (funcionó)

1. `docker build -t m6-frontend:test .` → compila OK.
2. Se corrió el contenedor.
3. `GET /api/health` → **HTTP 200** `{"status":"ok","service":"m6-ambiente-frontend"}`.
4. `GET /` (home) → **HTTP 200**.

---

## 3. Cómo revisar lo que se hizo (sin pushear todavía)

Los cambios están en ramas locales. Para verlos:

```bash
# Backend
cd "Backend-M6-DAPS2"
git log --oneline -3          # ver commits locales
git diff develop..infra/docker-ci-cd   # ver qué cambió respecto a develop

# Frontend
cd "../Frontend-M6-DAPS2"
git log --oneline -3
git diff main..infra/docker-ci-cd      # ver qué cambió respecto a main
```

Para ver los archivos nuevos directamente: `Dockerfile`, `.dockerignore`, `.github/workflows/ci.yml` (en ambos), y en frontend además todo `src/` y los configs.

---

## 4. Cómo probar Docker localmente (cuando quieras)

Backend:
```bash
docker build -t m6-backend .
docker run --rm -p 3000:3000 -e DATABASE_URL=postgresql://... -e JWT_SECRET=12345678 m6-backend
```

Frontend:
```bash
docker build -t m6-frontend .
docker run --rm -p 3000:3000 m6-frontend
```

---

## 5. Fase 3 — Git Flow (avance)

### Qué se hizo

1. **Autenticación**: instalé `gh` CLI y quedó logueado como `bcanteli-dev` (scopes: repo, workflow, read:org).
2. **`CODEOWNERS`**: agregué `.github/CODEOWNERS` en ambos repos (`* @hllous @bcanteli-dev`). Actualizar con los usuarios del backend/frontend dev cuando se conozcan.
3. **Ramas**: el backend ya tenía `main`/`test`/`develop`. En el frontend creé `develop` y `test` (desde `main`).
4. **Push + PR + merge** de Fase 1-2:
   - Backend: PR **#15** → `develop` (mergeado).
   - Frontend: PR **#1** → `develop` (mergeado).
   - CI corrió y los checks **`build`** y **`test`** quedaron verdes en ambos.
5. **Branch protection**: ⚠️ **NO se pudo aplicar** porque `bcanteli-dev` es solo `write` (no admin). Lo tiene que hacer `hllous`.

### Cómo terminar la branch protection (para `hllous`)

Hay un script **commiteado en el repo backend**: **`docs/gestion/apply-branch-protection.ps1`** (PR #16 → `develop`).

`hllous` (admin) tiene que:
1. Instalar `gh` (https://cli.github.com) y hacer `gh auth login`.
2. `git pull origin develop`
3. Correr: `powershell -ExecutionPolicy Bypass -File docs/gestion/apply-branch-protection.ps1`

El script aplica a los 2 repos × 3 ramas: 1 aprobación, checks `build`+`test`, squash merge, historial lineal, sin force-push ni borrado, y code owner review en `main`/`test`.

*(Alternativa sin script: hacerlo por la web — Settings → Branches → Add branch protection rule, con los mismos parámetros.)*

## 6. Próximos pasos

1. **Fase 5 — Deploy en producción**: seguir las guías de deploy para levantar los servicios en Vercel y Render.
2. **Verificación**: confirmar que frontend, backend y postgres estén corriendo y conectados correctamente.

---

## 6. Fase 4 — docker-compose local (completada 01/09/2026)

### Qué se creó

En la **raíz del workspace** (`Desarrollo de apps 2/`):

| Archivo | Qué hace |
|---|---|
| `docker-compose.yml` | Orquesta los 3 servicios: `postgres`, `backend`, `frontend` (+ `rabbitmq` comentado para cuando se necesiten eventos). |
| `.env` | Variables del compose: credenciales Postgres, JWT secret, puertos (3001 backend, 3002 frontend), URLs. |

### Modificación al Dockerfile del frontend

Se agregó un `ARG NEXT_PUBLIC_API_URL` en la etapa `builder` del `Frontend-M6-DAPS2/Dockerfile` para que la URL del backend se inyecte en build time (las variables `NEXT_PUBLIC_*` de Next.js se resuelven en compilación para client-side).

### Servicios del compose

| Servicio | Imagen / Build | Puerto host | Depende de |
|---|---|---|---|
| `postgres` | `postgres:16-alpine` | 5432 | — (healthcheck con `pg_isready`) |
| `backend` | Build de `./Backend-M6-DAPS2` | **3001**:3000 | postgres (healthy) |
| `frontend` | Build de `./Frontend-M6-DAPS2` | **3002**:3000 | backend |
| `rabbitmq` | (comentado) `rabbitmq:3.13-management-alpine` | 5672, 15672 | — |

### Cómo usar

```bash
# Desde la raíz del workspace (Desarrollo de apps 2/)
docker-compose up --build

# O en background
docker-compose up --build -d

# Ver logs
docker-compose logs -f

# Bajar todo
docker-compose down

# Bajar y borrar volúmenes (resetea la DB)
docker-compose down -v
```

Una vez levantado:
- **Frontend**: http://localhost:3002
- **Backend**: http://localhost:3001
- **Backend health**: http://localhost:3001/health
- **Postgres**: localhost:5432 (user: `m6_user`, pass: `m6_pass`, db: `m6_ambiente`)

### Decisiones

- **Puertos 3001/3002**: el 3000 está ocupado en esta máquina (según registro previo).
- **DB interna**: el backend se conecta a `postgresql://m6_user:m6_pass@postgres:5432/m6_ambiente` usando el hostname del servicio Docker.
- **RabbitMQ comentado**: M9 confirmó RabbitMQ. Listo para descomentar cuando se necesite mensajería en desarrollo local.

---

## 5. Fase 5 — Deploy en producción (completada 01/09/2026)

### Decisión de stack

Después de evaluar opciones (Oracle Cloud, Railway, Fly.io, Koyeb), se eligió:

| Servicio | Plataforma | Razón |
|---|---|---|
| **Frontend** (Next.js) | **Vercel** | Creadores de Next.js, soporte nativo, sin spin-down, free tier generoso |
| **Backend** (NestJS) | **Render** (Web Service) | Deploy automático desde Dockerfile, free tier, simple |
| **Postgres** | **Render** (Managed) | Todo en un lugar con el backend, free tier suficiente |

**Costo total**: **$0** (todo en free tier)

### Por qué no Oracle Cloud

Oracle Cloud Free Tier es técnicamente mejor (siempre gratis, sin spin-down, VM ARM potente), pero:
- Requiere cuenta con tarjeta de crédito
- Setup complejo: security lists, SSH keys, firewall manual
- Alta fricción inicial para un TPO
- Vercel + Render son más simples y suficientes para el alcance del proyecto

### URLs de producción (una vez deployado)

| Servicio | URL |
|---|---|
| Frontend | `https://m6-frontend.vercel.app` |
| Backend | `https://m6-backend.onrender.com` |
| Backend Health | `https://m6-backend.onrender.com/health` |
| Postgres | (Internal URL de Render, no accesible desde afuera) |

### Limitaciones conocidas

**Render Free Tier**:
- **Spin-down**: el backend se "duerme" tras 15 min de inactividad. El primer request tarda ~30-60s en "despertar". Después responde normal.
- **Postgres**: 256 MB storage, 90 días de data retention (después se borran datos viejos).
- Para el TPO: aceptable. Si van a presentar, hacer un request 1 min antes para despertar el backend.

**Vercel Free Tier**:
- Sin spin-down (siempre activo)
- 100 GB bandwidth/mes (más que suficiente)
- Sin limitaciones prácticas para el TPO

### Guías de deploy paso a paso

Se crearon dos documentos detallados en `docs/`:

| Archivo | Qué cubre |
|---|---|
| [`docs/deploy-render.md`](./docs/deploy-render.md) | Crear Postgres + Backend en Render (paso a paso con capturas) |
| [`docs/deploy-vercel.md`](./docs/deploy-vercel.md) | Deployar frontend en Vercel (paso a paso) |

### Orden recomendado de deploy

1. **Primero**: crear Postgres en Render → obtener Internal Database URL
2. **Segundo**: crear Backend en Render con la URL del Postgres → obtener `https://m6-backend.onrender.com`
3. **Tercero**: deployar Frontend en Vercel con `NEXT_PUBLIC_API_URL=https://m6-backend.onrender.com`

### Variables de entorno en producción

**Backend (Render)**:
```
DATABASE_URL=<Internal Database URL de Render>
JWT_SECRET=<random seguro generado con openssl>
JWT_EXPIRATION=3600
NODE_ENV=production
PORT=3000
```

**Frontend (Vercel)**:
```
NEXT_PUBLIC_API_URL=https://m6-backend.onrender.com
```

### Deploy automático (02/09/2026: ahora vía CI + Deploy Hook de Render)

**Backend (Render)** — lo dispara GitHub Actions:

```
git push origin develop
    ↓
GitHub Actions corre build + test (CI)
    ↓  si ambos pasan
Job "deploy" dispara el Deploy Hook de Render (con el commit exacto)
    ↓
Render buildea Docker y deploya el backend
    ↓
Backend actualizado en ~3-5 min
```

**Frontend (Vercel)** — deploy nativo: push a `develop` → Vercel buildea y deploya.

No hay que hacer nada manual después de la configuración inicial. El secret `RENDER_DEPLOY_HOOK_URL` (Deploy Hook del servicio en Render) vive en GitHub Actions secrets; **Auto-Deploy de Render queda apagado** para evitar dobles deploys.

---

## 7. Notas y decisiones técnicas

- **Node 20 LTS** en todas las imágenes (Alpine) → coincide con el stack del equipo.
- **OpenSSL en Alpine** es un "gotcha" conocido de Prisma: sin la librería, el query engine falla. Ya resuelto en el Dockerfile.
- **Build multi-stage** en ambos: separa "compilar" de "correr", dejando imágenes finales más chicas y seguras.
- **Nombres de jobs `build`/`test`** en CI: son los checks que espera la branch protection. No cambiar sin actualizar la regla.
- **Port 3000** ya está ocupado en esta máquina por otro proceso; en las pruebas locales se mapeó a puertos alternativos (3001/3002). No afecta al deploy.

---

## 8. Sesión del 01/09/2026 — Resumen para el equipo

### Qué se hizo hoy

En esta sesión se completaron las **Fases 4 y 5** del plan DevOps:

#### Fase 4: docker-compose local (completada)

Se creó un entorno de desarrollo local completo con docker-compose para levantar todos los servicios juntos:

**Archivos creados en la raíz del workspace:**
- `docker-compose.yml` — orquesta postgres + backend + frontend + rabbitmq (comentado)
- `.env` — variables de entorno para el compose (credenciales DB, JWT, puertos)

**Modificación al Frontend:**
- `Frontend-M6-DAPS2/Dockerfile` — se agregó `ARG NEXT_PUBLIC_API_URL` para inyectar la URL del backend en build time (las variables `NEXT_PUBLIC_*` de Next.js se resuelven en compilación)

**Cómo usar docker-compose local:**
```bash
# Desde la raíz del workspace
docker-compose up --build

# URLs una vez levantado:
# Frontend: http://localhost:3002
# Backend: http://localhost:3001
# Postgres: localhost:5432 (user: m6_user, pass: m6_pass, db: m6_ambiente)
```

#### Fase 5: Deploy en producción (completada)

**Decisión de stack de deploy:**

| Servicio | Plataforma | URL | Costo |
|---|---|---|---|
| Frontend (Next.js) | **Vercel** | `https://m6-frontend.vercel.app` | $0 |
| Backend (NestJS) | **Render** | `https://m6-backend.onrender.com` | $0 |
| Postgres | **Render** (Managed) | (Internal URL) | $0 |
| **Total** | | | **$0** |

**Por qué esta combinación:**
- **Vercel**: soporte nativo de Next.js (sin Dockerfile), sin spin-down, deploy automático
- **Render**: deploy automático desde Dockerfile, Postgres incluido, free tier suficiente
- **Costo cero**: todo en free tier, sin tarjeta de crédito requerida

**Limitación conocida**: Render hace spin-down del backend tras 15 min de inactividad (primer request tarda ~30-60s). Para demos, hacer un request 1 min antes.

**Guías de deploy creadas:**
- `docs/deploy-vercel.md` — paso a paso para frontend en Vercel
- `docs/deploy-render.md` — paso a paso para backend + postgres en Render

**Orden de deploy:**
1. Crear Postgres en Render → obtener Internal Database URL
2. Crear Backend en Render con la URL del Postgres
3. Deployar Frontend en Vercel con `NEXT_PUBLIC_API_URL=https://m6-backend.onrender.com`

#### Cambio importante: RabbitMQ → Kafka

**M9 confirmó que el broker de eventos es Kafka** (no RabbitMQ como se había planeado inicialmente).

**Archivos actualizados:**
- `Backend-M6-DAPS2/.env.example` — variables `KAFKA_BROKERS`, `KAFKA_CLIENT_ID`, `KAFKA_GROUP_ID`
- `Backend-M6-DAPS2/src/config/env.validation.ts` — schema actualizado con variables Kafka
- `Backend-M6-DAPS2/AGENTS.md` — referencias a mensajería actualizadas
- `Backend-M6-DAPS2/README.md` — stack actualizado: Kafka confirmado
- `Backend-M6-DAPS2/docs/decisiones/adr-001-stack-tecnologico.md` — ADR actualizada
- `docker-compose.yml` — servicio `kafka` (bitnami/kafka con KRaft, sin Zookeeper) comentado
- `DEVOPS-SEGUIMIENTO.md` — referencias actualizadas

**Kafka en docker-compose** usa `bitnami/kafka:latest` con **KRaft mode** (sin Zookeeper, más simple). Está comentado, listo para descomentar cuando se implementen eventos.

#### Cambio importante: Kafka → RabbitMQ (30/09/2026)

**M9 anunció que el bus de la cohorte pasa de Kafka a RabbitMQ.** El backend ya migró en `origin/develop` (PR #234/#239): `kafkajs` sale de `package.json`, entra `amqplib`, y se agregan `RabbitMqEventPublisher`, `RabbitMqConsumer` y el ADR-006. Sin `RABBITMQ_URL` la app arranca igual (outbox + log + `POST /events/inbox`).

**Archivos DevOps actualizados:**
- `docker-compose.yml` — servicio `rabbitmq` (`rabbitmq:3.13-management-alpine`, puertos 5672 + 15672, healthcheck) comentado; variables `RABBITMQ_*` en el backend.
- `.env` — bloque RabbitMQ (`RABBITMQ_URL`, `RABBITMQ_EXCHANGE`, `RABBITMQ_EXCHANGE_TYPE`, `RABBITMQ_QUEUE`, `RABBITMQ_DEAD_LETTER_EXCHANGE`, `RABBITMQ_PREFETCH`), comentado con defaults provisorios.
- `DEVOPS-SEGUIMIENTO.md`, `PRESENTACION-DEVOPS.md`, `resumen-devops.md` — referencias actualizadas.

**Defaults provisorios** (hasta que M9 publique su catálogo): exchange `municipalidad.events` (tipo `topic`), cola `m6.ambiente`, prefetch `1`.

**Pendiente de M9 para enchufar** (ver `MENSAJE-M9-RABBITMQ.md`): URL/host/puerto/vhost/TLS, credenciales, nombre y tipo de exchange, convención de routing key, nombre de cola, DLX + TTL, tipo de cola y permisos.

### Archivos modificados/creados hoy

**En la raíz del workspace (no es repo git, solo local):**
- `docker-compose.yml` (nuevo)
- `.env` (nuevo)
- `docs/deploy-vercel.md` (nuevo)
- `docs/deploy-render.md` (nuevo)
- `DEVOPS-SEGUIMIENTO.md` (actualizado)

**En Backend-M6-DAPS2 (rama `develop`):**
- `.env.example` (actualizado: RabbitMQ → Kafka)
- `AGENTS.md` (actualizado)
- `README.md` (actualizado)
- `docs/decisiones/adr-001-stack-tecnologico.md` (actualizado)
- `src/config/env.validation.ts` (actualizado)

**En Frontend-M6-DAPS2 (rama `infra/docker-ci-cd`):**
- `Dockerfile` (modificado: agregado ARG para NEXT_PUBLIC_API_URL)
- `README.md` (actualizado: deploy en Vercel + docker-compose)

### Próximos pasos para el equipo

1. **Deploy en producción**: seguir las guías en `docs/deploy-vercel.md` y `docs/deploy-render.md` para levantar los servicios en Vercel y Render
2. **Enchufar eventos con RabbitMQ**: cuando M9 pase la URL y credenciales del broker, cargar `RABBITMQ_*` en `.env`/Render y descomentar el servicio `rabbitmq` en `docker-compose.yml` (el backend ya tiene el adaptador RabbitMQ en `develop`)
3. **Branch protection**: pendiente de que `hllous` (admin) corra el script `docs/gestion/apply-branch-protection.ps1` (o se decida no implementarla)

### Estado final del proyecto

| Componente | Estado | Ubicación |
|---|---|---|
| Backend (Docker + CI) | ✅ Listo | `Backend-M6-DAPS2/` en `develop` |
| Frontend (Docker + CI) | ✅ Listo | `Frontend-M6-DAPS2/` en `develop` |
| docker-compose local | ✅ Listo | Raíz del workspace |
| Deploy en producción | ✅ Configurado (guías creadas) | Ver `docs/deploy-*.md` |
| Branch protection | 🟡 Pendiente | Script listo, falta ejecutar |
| Eventos RabbitMQ | ⏳ Pendiente | Adaptador listo en el backend; falta URL/credenciales de M9 |
