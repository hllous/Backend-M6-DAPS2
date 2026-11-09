# Módulo 6 — Ambiente e Higiene · Backend

Backend del **Módulo 6** de la plataforma Municipalidad UADE. TPO de Desarrollo de Aplicaciones II — 2do cuatrimestre 2026, **Grupo 04**.

M6 gestiona los servicios urbanos y el control ambiental de la ciudad: recolección, limpieza, contenedores, arbolado, espacios verdes y trámite de denuncias ambientales hasta el acta de constatación.

## Stack

- **NestJS** + TypeScript + Node 22 LTS
- **PostgreSQL** + Prisma como ORM
- **RabbitMQ** para eventos asincrónicos (el bus del Core, vía el exchange `muni.inbox`)
- **Jest** + Supertest para testing (cobertura mínima 85%)
- Deploy en **Vercel** (frontend) + **Render** (backend) + **Supabase** (PostgreSQL)

Ver decisiones detalladas en [`docs/decisiones/`](docs/decisiones/).

## Cómo correr localmente

### Con Docker (un solo comando)

Requiere Docker con Compose. Levanta Postgres, RabbitMQ (con el exchange `muni.inbox` y la cola `q.ambiente` ya creados, como los crea el Core) y el backend.

```bash
cp .env.example .env        # 1. crear tu .env (no se versiona)
docker compose up --build   # 2. un solo comando
```

**No hace falta editar nada en `.env`:** `.env.example` ya trae valores de ejemplo que sirven tal cual en tu máquina, y cada variable tiene un comentario que explica qué es y para qué sirve. Si querés cambiar las claves de Postgres o RabbitMQ (`POSTGRES_PASSWORD`, `RABBITMQ_PASSWORD`), usá solo letras y números.

Si falta el `.env` o una variable obligatoria, `docker compose` corta con un mensaje del tipo `Falta POSTGRES_PASSWORD en .env`. Las credenciales no se imprimen en los logs. Con `cp .env.example .env` las claves quedan predecibles (`cambiame`), por eso Postgres (5432) y RabbitMQ (5672 y consola 15672) se publican solo en `127.0.0.1`: no son accesibles desde otras máquinas de la red. Si cambiás ese binding, cambiá antes las claves.

Cuando termina, el backend responde en `http://localhost:3000`:

- Salud: `GET http://localhost:3000/health/ready` → 200 con `"database":"up"` y `"broker":"connected"`.
- Swagger: `http://localhost:3000/api/docs`.
- Consola de RabbitMQ: `http://localhost:15672` (con el `RABBITMQ_USER` y `RABBITMQ_PASSWORD` de tu `.env`).

Datos de demo (opcional, ver [`docs/seed.md`](docs/seed.md)):

```bash
docker compose --profile seed run --rm seed
```

**Cómo se entra en local.** El frontend trae un M1 falso con cuentas de prueba (ver la sección siguiente). El frontend **no** es un servicio del compose: se levanta aparte con `pnpm dev` (el servicio en el compose queda como mejora, #560). El login real contra M1 existe solo en el despliegue (ver abajo).

### Con el frontend (`pnpm dev`)

Requiere Node 22 y pnpm. Con el backend ya levantado y con datos (`docker compose up --build` y el seed de arriba), en otra carpeta:

```bash
git clone https://github.com/hllous/Frontend-M6-DAPS2.git && cd Frontend-M6-DAPS2
git checkout v1.0-testing      # la versión de la prueba; sin esto queda en develop
pnpm install
```

Hacen falta **dos procesos**, cada uno en su terminal. El secreto del M1 falso tiene que ser **el mismo `JWT_SECRET`** del `.env` del backend: si no coincide, el backend responde 401 a todo.

```bash
# Terminal 1: M1 falso (puerto 3120). Cambiá la ruta si el backend está en otra carpeta.
export M1_FAKE_JWT_SECRET="$(grep '^JWT_SECRET=' ../Backend-M6-DAPS2/.env | cut -d= -f2-)"
pnpm dev:fake-m1

# Terminal 2: frontend (puerto 3001, porque el backend usa el 3000)
export M6_AUTH_MODE=real-m1 M1_FAKE_ENABLED=true M1_BASE_URL=http://127.0.0.1:3120/api/v1/
export M6_BACKEND_ORIGIN=http://localhost:3000 M6_SESSION_SECRET=local-dev-secret
pnpm dev --port 3001
```

En PowerShell las variables se definen con `$env:NOMBRE = "valor"` y el secreto con `$env:M1_FAKE_JWT_SECRET = ((Get-Content ..\Backend-M6-DAPS2\.env | Where-Object { $_ -like 'JWT_SECRET=*' }) -replace '^JWT_SECRET=','')`.

Abrí `http://localhost:3001/login` y entrá con una cuenta del M1 falso (la clave de todas es `m6-dev-796`). Los `sub` coinciden con los del seed, así que cada cuenta llega con los roles de [`docs/seed.md`](docs/seed.md):

| Cuenta | Rol en M6 |
|---|---|
| `carlos.rodriguez@m6.local` | Admin (`M6_ADMIN`) |
| `julian.lopez@m6.local` | Oficina · operaciones |
| `diego.sosa@m6.local` | Oficina · ambiental |
| `camila.medina@m6.local` | Auditoría |
| `sofia.lopez@m6.local` | Campo · líder de cuadrilla |
| `diego.martinez@m6.local` | Campo · integrante |
| `carlos.medina@m6.local` | Campo · inspector |

Sin `M6_AUTH_MODE=real-m1` el frontend arranca en modo `mock` (datos de ejemplo del propio frontend) y **no llama al backend**: sirve para ver la interfaz, no para probar la integración. Más detalle del M1 falso en el repositorio del frontend: `docs/agents/real-m1-development.md`.

Sin las variables de Cloudflare R2, `POST /evidence` responde 503; el resto funciona. `docker compose down -v` borra la base y la cola. El Core de M9 no se levanta: RabbitMQ local hace de bus.

### Despliegue (login real contra M1)

En Render el JWT lo emite M1 con el login real y las credenciales y secretos van en el panel del servicio, no en `.env`. Ver [`docs/deploy.md`](docs/deploy.md).

### Sin Docker

```bash
npm install
cp .env.example .env          # completar DATABASE_URL y JWT_SECRET
npm run prisma:migrate:deploy # crea el esquema
npm run prisma:seed           # catálogos y recursos mínimos (idempotente)
npm run start:dev
```

Requisitos:

- Node.js 22 LTS o superior
- PostgreSQL 15+ (o base gestionada tipo Neon)
- RabbitMQ (el bus del Core, vía el exchange `muni.inbox`)

## Enlaces útiles

| Recurso | Dónde |
|---|---|
| **API interactiva (Swagger)** | `https://m6-backend-m64k.onrender.com/api/docs` |
| **Despliegue y estado** | [`docs/deploy.md`](docs/deploy.md) |
| **Tests unitarios y e2e** | [`docs/testing.md`](docs/testing.md) |
| **Índice de la documentación** | [`docs/README.md`](docs/README.md) |
| **Alcance del módulo** | [`docs/Documento de Alcance.pdf`](docs/Documento%20de%20Alcance%20-%20Grupo%2004%20%28Modulo%206%29.pdf) |
| **Diagrama de eventos** | [`docs/Diagrama de Eventos.pdf`](docs/Diagrama%20de%20Eventos%20-%20Grupo%2004%20%28Modulo%206%29.pdf) |
| **Contrato de eventos** | [`docs/Acuerdo-Eventos-M6.md`](docs/Acuerdo-Eventos-M6.md) — es lo que circula a los otros grupos |
| **Estado de la integración** | [`docs/bloqueantes.md`](docs/bloqueantes.md) — fuente única de qué está confirmado y qué falta |
| **Modelo de datos** | [`docs/entidades/`](docs/entidades/) |
| **Eventos publicados** | [`docs/eventos/publicados/`](docs/eventos/publicados/) — 6 eventos con JSON Schema |
| **Eventos consumidos** | [`docs/eventos/consumidos/`](docs/eventos/consumidos/) — 10 eventos de 5 módulos, 9 con handler |

Para orientarse en el repo, el punto de entrada recomendado es [`AGENTS.md`](AGENTS.md).

## Estructura del repo

```
.
├── docs/                    documentación técnica y de gestión
├── src/                     código NestJS: 103 rutas (152 operaciones) en 22 módulos (21 con endpoints; weather-alerts está vacío)
│   ├── auth/                validación del JWT que emite M1
│   ├── common/              guards, filtros, interceptores y DTOs compartidos
│   ├── events/              outbox, inbox, consumidores y publishers
│   └── modules/             un módulo por recurso
├── prisma/                  schema (44 modelos), migraciones y seed
└── test/                    suites e2e contra Postgres real (ver docs/testing.md)
```

Los tests unitarios viven al lado del código que prueban (`*.spec.ts` dentro de `src/`), no en `test/`. Cómo correr unos y otros: [`docs/testing.md`](docs/testing.md).

El pipeline de documentación que genera los entregables para la cátedra —`fuentes/`, `M6-por-modulo/`, `enunciado/` y los PDF compilados— vive en el **repositorio de documentación**, no acá. Detalle del mapeo fuente → PDF: ver [`docs/README.md`](docs/README.md#repositorio-de-documentación).

## Integración con otros módulos

M6 se comunica con el resto de la plataforma **por eventos asincrónicos** vía el bus del Core (M9). REST síncrono se usa solo para casos justificados (búsqueda de establecimiento a M4, catálogo de barrios a M9).

- Publicamos **6 eventos**, todos con consumidor declarado.
- Consumimos **10 eventos**: 9 de M2, M3, M4, M7 y M9 más una alerta meteorológica simulada internamente. 9 tienen handler; `notificationSent` (M9) no, porque nadie lo publica.

Ver detalle en [`docs/eventos/`](docs/eventos/) y estado vivo en [`docs/bloqueantes.md`](docs/bloqueantes.md).

## Equipo

Grupo 04 — DAPS2 UADE 2026.

- Frontend Developer · *Llousas, Nicolas Facundo*
- Backend Developer · *Martinez, Benjamin*
- DevOps · *Castro, Bautista*
- QA - UX/UI · *Peralta, Santiago Tomas*
- Scrum Master · *Quintieri, Miqueas*
- Product Owner · *Iriarte, Facundo*


## Cátedra

- Universidad Argentina de la Empresa (UADE)
- Materia: Desarrollo de Aplicaciones II
- Cuatrimestre: 2do de 2026
- Proyecto: Municipalidad UADE — plataforma distribuida por módulos
