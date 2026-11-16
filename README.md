# Módulo 6 — Ambiente e Higiene · Backend

[![CI](https://github.com/hllous/Backend-M6-DAPS2/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/hllous/Backend-M6-DAPS2/actions/workflows/ci.yml)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=hllous_Backend-M6-DAPS2&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=hllous_Backend-M6-DAPS2)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=hllous_Backend-M6-DAPS2&metric=coverage)](https://sonarcloud.io/summary/new_code?id=hllous_Backend-M6-DAPS2)

Backend del **Módulo 6** de Municipalidad UADE (Desarrollo de Aplicaciones II, 2.º cuatrimestre 2026, **Grupo 04**). Gestiona servicios urbanos y control ambiental: recolección, contenedores, arbolado, espacios verdes y denuncias ambientales.

NestJS · PostgreSQL (Prisma) · RabbitMQ.

## Levantar el sistema en local

### Requisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) abierto.
- [Node.js 22](https://nodejs.org/) y Git (solo para el frontend).

### 1. Backend, base de datos y broker

```bash
git clone https://github.com/hllous/Backend-M6-DAPS2.git
cd Backend-M6-DAPS2
cp .env.example .env
docker compose up --build
```

`.env` no se edita: los valores de ejemplo sirven tal cual. El primer arranque tarda unos 5 minutos. Está listo cuando <http://localhost:3000/health/ready> responde `"database":"up"` y `"broker":"connected"`.

### 2. Datos de demo

En otra terminal, dentro de `Backend-M6-DAPS2`:

```bash
docker compose --profile seed run --rm seed
```

Sin este paso las cuentas de prueba entran sin rol.

### 3. Frontend y M1 falso

El login lo emite M1 (otro grupo). En local lo reemplaza un **M1 falso** que viene con el frontend. Cloná el frontend al lado del backend:

```bash
git clone https://github.com/hllous/Frontend-M6-DAPS2.git
cd Frontend-M6-DAPS2
git checkout v2.0-entrega4
corepack enable
pnpm install
```

Después abrí **dos terminales** dentro de `Frontend-M6-DAPS2`. Elegí la variante de tu sistema.

**macOS / Linux / Git Bash**

```bash
# Terminal A: M1 falso
M1_FAKE_JWT_SECRET=Q0hBTkdFX01FX2xvY2FsX2Rldl9zZWNyZXRfbTZfMzJieXRlcw== pnpm dev:fake-m1
```

```bash
# Terminal B: frontend
M6_AUTH_MODE=real-m1 M1_FAKE_ENABLED=true M1_BASE_URL=http://127.0.0.1:3120/api/v1/ \
M6_BACKEND_ORIGIN=http://localhost:3000 M6_SESSION_SECRET=local-dev-secret \
pnpm dev --port 3001
```

**Windows (PowerShell)**

```powershell
# Terminal A: M1 falso
$env:M1_FAKE_JWT_SECRET="Q0hBTkdFX01FX2xvY2FsX2Rldl9zZWNyZXRfbTZfMzJieXRlcw=="; pnpm dev:fake-m1
```

```powershell
# Terminal B: frontend
$env:M6_AUTH_MODE="real-m1"; $env:M1_FAKE_ENABLED="true"; $env:M1_BASE_URL="http://127.0.0.1:3120/api/v1/"
$env:M6_BACKEND_ORIGIN="http://localhost:3000"; $env:M6_SESSION_SECRET="local-dev-secret"
pnpm dev --port 3001
```

El secreto de la terminal A es el `JWT_SECRET` de `.env.example`. Si lo cambiaste en `.env`, usá el mismo valor.

### 4. Entrar

Abrí <http://localhost:3001/login>. Todas las cuentas usan la clave `m6-dev-796`:

| Cuenta | Rol |
|---|---|
| `carlos.rodriguez@m6.local` | Administrador |
| `julian.lopez@m6.local` | Oficina · operaciones |
| `diego.sosa@m6.local` | Oficina · ambiental |
| `camila.medina@m6.local` | Auditoría |
| `sofia.lopez@m6.local` | Campo · líder de cuadrilla |
| `diego.martinez@m6.local` | Campo · integrante |
| `carlos.medina@m6.local` | Campo · inspector |

Otras direcciones útiles:

- API (Swagger): <http://localhost:3000/api/docs>
- Consola de RabbitMQ: <http://localhost:15672> (usuario `m6`, clave `cambiame`)

Para apagar todo: `Ctrl+C` en cada terminal y `docker compose down`. Con `docker compose down -v` también se borran la base y la cola.

## Versión desplegada

| | URL |
|---|---|
| Aplicación | <https://m6-ambiente-higiene.vercel.app> |
| API (Swagger) | <https://m6-backend-m64k.onrender.com/api/docs> |

El primer pedido a la API desplegada puede tardar hasta un minuto (Render se suspende sin uso).

## Documentación

| | Dónde |
|---|---|
| Plan de pruebas, HU, matriz, informes, defectos y manual de usuario | [`docs/QA/`](docs/QA/) |
| Tests unitarios, e2e y herramientas de análisis | [`docs/testing.md`](docs/testing.md) |
| Decisiones técnicas (ADR) | [`docs/decisiones/`](docs/decisiones/) |
| Eventos publicados y consumidos | [`docs/eventos/`](docs/eventos/) |
| Estado de la integración con otros módulos | [`docs/bloqueantes.md`](docs/bloqueantes.md) |
| Índice completo | [`docs/README.md`](docs/README.md) |

## Equipo

Grupo 04: Llousas, Nicolas Facundo (frontend) · Martinez, Benjamin (backend) · Castro Cantelli, Bautista (DevOps) · Peralta, Santiago Tomas (QA, UX/UI) · Quintieri, Miqueas (Scrum Master) · Iriarte, Facundo (Product Owner).
