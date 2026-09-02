# Módulo 6 — Ambiente e Higiene · Backend

Backend del **Módulo 6** de la plataforma Municipalidad UADE. TPO de Desarrollo de Aplicaciones II — 2do cuatrimestre 2026, **Grupo 04**.

M6 gestiona los servicios urbanos y el control ambiental de la ciudad: recolección, limpieza, contenedores, arbolado, espacios verdes y trámite de denuncias ambientales hasta el acta de constatación.

## Stack

- **NestJS** + TypeScript + Node 20 LTS
- **PostgreSQL** + Prisma como ORM
- **Kafka** para eventos asincrónicos (confirmado por M9)
- **Jest** + Supertest para testing (cobertura mínima 85%)
- Deploy en **Vercel** (frontend) + **Render** (backend + postgres)

Ver decisiones detalladas en [`docs/decisiones/`](docs/decisiones/).

## Cómo correr localmente

```bash
npm install
cp .env.example .env          # completar DATABASE_URL y JWT_SECRET
npm run prisma:migrate:deploy # crea el esquema
npm run prisma:seed           # catálogos y recursos mínimos (idempotente)
npm run start:dev
```

Requisitos:

- Node.js 20 LTS o superior
- PostgreSQL 15+ (o base gestionada tipo Neon)
- Kafka (confirmado por M9)

> Para levantar el stack completo con Docker local: ver `docker-compose.yml` en la raíz del workspace DevOps.

## Enlaces útiles

| Recurso | Dónde |
|---|---|---|
| **API interactiva (Swagger)** | `https://m6-backend-m64k.onrender.com/api/docs` |
| **Despliegue y estado** | [`docs/deploy.md`](docs/deploy.md) |
| **Índice de la documentación** | [`LEEME.md`](LEEME.md) |
| **Alcance del módulo** | [`docs/Documento de Alcance.pdf`](docs/Documento%20de%20Alcance%20-%20Grupo%2004%20%28Modulo%206%29.pdf) |
| **Diagrama de eventos** | [`docs/Diagrama de Eventos.pdf`](docs/Diagrama%20de%20Eventos%20-%20Grupo%2004%20%28Modulo%206%29.pdf) |
| **Contrato de eventos** | [`docs/Acuerdo-Eventos-M6.md`](docs/Acuerdo-Eventos-M6.md) — es lo que circula a los otros grupos |
| **Estado de la integración** | [`docs/bloqueantes.md`](docs/bloqueantes.md) — fuente única de qué está confirmado y qué falta |
| **Modelo de datos** | [`docs/entidades/`](docs/entidades/) |
| **Eventos publicados** | [`docs/eventos/publicados/`](docs/eventos/publicados/) — 8 eventos con JSON Schema |
| **Eventos consumidos** | [`docs/eventos/consumidos/`](docs/eventos/consumidos/) — 11 eventos de 5 módulos |

Para orientarse en el repo, el punto de entrada recomendado es [`AGENTS.md`](AGENTS.md).

## Estructura del repo

```
.
├── docs/                    documentación técnica y de gestión
├── fuentes/                 fuentes .md de las versiones largas del alcance
├── M6-por-modulo/           una ficha por módulo (M1..M9) para circular
├── enunciado/               TPO oficial de la cátedra
├── referencias/             documentación relevante de otros módulos
├── src/                     código NestJS (controllers y services en desarrollo)
├── prisma/                  schema completo; migraciones pendientes de generar
└── test/                    tests (pendientes — ver DoD: cobertura ≥ 85%)
```

Detalle completo del contenido de doc: ver [`LEEME.md`](LEEME.md).

## Integración con otros módulos

M6 se comunica con el resto de la plataforma **por eventos asincrónicos** vía el bus del Core (M9). REST síncrono se usa solo para casos justificados (búsqueda de establecimiento a M4, catálogo de barrios a M9).

- Publicamos **8 eventos**, todos con consumidor confirmado.
- Consumimos **10 eventos** de M2, M3, M4, M7 y M9, más una alerta meteorológica simulada internamente.

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
