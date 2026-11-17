# Módulo 6 — Ambiente e Higiene · Backend

[![CI](https://github.com/hllous/Backend-M6-DAPS2/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/hllous/Backend-M6-DAPS2/actions/workflows/ci.yml)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=hllous_Backend-M6-DAPS2&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=hllous_Backend-M6-DAPS2)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=hllous_Backend-M6-DAPS2&metric=coverage)](https://sonarcloud.io/summary/new_code?id=hllous_Backend-M6-DAPS2)

Backend del **Módulo 6** de Municipalidad UADE (Desarrollo de Aplicaciones II, 2.º cuatrimestre 2026, **Grupo 04**). Gestiona servicios urbanos y control ambiental: recolección, contenedores, arbolado, espacios verdes y denuncias ambientales.

NestJS · PostgreSQL (Prisma) · RabbitMQ.

## Levantar el sistema en local

### Requisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (o Docker Engine con Compose v2) abierto.
- Git.

No hace falta Node, pnpm ni clonar el frontend: Docker construye todo.

### Un solo comando

```bash
git clone https://github.com/hllous/Backend-M6-DAPS2.git
cd Backend-M6-DAPS2
docker compose up --build
```

Levanta la base de datos (PostgreSQL), el broker de mensajes (RabbitMQ), el backend (aplica las migraciones), los datos de demo, el M1 falso que emite los logins y el frontend. El frontend se construye desde su repositorio ([hllous/Frontend-M6-DAPS2](https://github.com/hllous/Frontend-M6-DAPS2)) sin clonarlo a mano. No hay que crear ni editar `.env`.

El primer arranque descarga imágenes y compila, y el tiempo depende de la máquina y de la red. En la medición del 16/11/2026 (Windows 11, Docker Desktop, desde cero y sin caché de Docker, con `FRONTEND_REF=main`) fueron unos 14 minutos: ≈13 de build y ≈1 de arranque hasta tener todos los servicios en estado healthy. Los arranques siguientes reutilizan la caché de Docker. Está listo cuando el log muestra `Ready` del servicio `frontend`. La primera vez que se abre cada pantalla tarda unos segundos más: el frontend corre en modo desarrollo y la compila en ese momento.

### Entrar

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
- Estado del backend: <http://localhost:3000/health/ready> (`"database":"up"` y `"broker":"connected"`)
- Consola de RabbitMQ: <http://localhost:15672> (usuario `m6`, clave `cambiame`)

### Apagar

`Ctrl+C` en la terminal del comando, o `docker compose down` desde otra. Con `docker compose down -v` también se borran la base y la cola; el próximo `up` vuelve a cargar los datos de demo.

Volver a correr `docker compose up` es seguro: los datos de demo no se duplican.

### Opcional

- **Otra versión del frontend**: `FRONTEND_REF=<rama o tag> docker compose up --build` (por defecto, `main`). Para la entrega está previsto fijarlo al tag `v2.0-entrega4`, que todavía no existe en el repositorio del frontend (pendiente de crear); hasta entonces, lo probado es `main`.
- **Cambiar usuarios o claves locales**: `cp .env.example .env` y editarlo. Sin `.env`, el compose usa los valores de ejemplo, que valen solo en tu máquina.
- **Puertos ocupados**: el sistema usa 3000, 3001, 5432, 5672 y 15672.

La prueba de este arranque corre en GitHub Actions ([`g1-arranque`](.github/workflows/g1-arranque.yml)): clon limpio, este comando, login real por el frontend y límite de 15 minutos.

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
