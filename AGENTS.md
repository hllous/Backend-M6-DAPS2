# AGENTS.md — Módulo 6, Grupo 04

TPO "Municipalidad UADE" (Desarrollo de Aplicaciones II): plataforma municipal distribuida, 9 grupos, 1 módulo c/u, integrada por eventos asincrónicos (`AsyncAPI`/bus de eventos, sobre pendiente de que M9 lo defina) + REST solo para lo síncrono. Cada módulo: frontend + backend en 3 capas + DB propia; sin acceso directo entre bases. Enunciado completo: [enunciado/TPO - Desarrollo de Apps II - Gestión de municipalidad.pdf](enunciado/TPO%20-%20Desarrollo%20de%20Apps%20II%20-%20Gesti%C3%B3n%20de%20municipalidad.pdf).

## Por dónde empezar

1. [docs/README.md](docs/README.md) — qué hace el módulo + glosario propio (`Zone`, `Service`, `Crew`, etc.)
2. [docs/entidades/](docs/entidades/) — modelo de datos, con diagramas de estado
3. [docs/eventos/publicados/](docs/eventos/publicados/) — los 8 eventos que emite el módulo, con payload y consumidores
4. [docs/eventos/consumidos/](docs/eventos/consumidos/) — los 11 eventos que escucha de otros módulos
5. [docs/bloqueantes.md](docs/bloqueantes.md) — **fuente única** del estado de integración (qué está confirmado / qué falta de cada contraparte). Leer antes de tocar cualquier evento o payload
6. [docs/enumeraciones.md](docs/enumeraciones.md) — catálogo de valores cerrados usados en entidades y eventos
7. [docs/api/](docs/api/) — estándar Swagger + endpoints REST del backend
8. [docs/decisiones/](docs/decisiones/) — ADRs (decisiones técnicas)
9. [docs/gestion/](docs/gestion/) — proceso Scrum: DoD, sprints, retros, bitácoras individuales

## Qué NO es `docs/`

Documentación interna (equipo + IA que programe el módulo), no lo entregado a la cátedra ni lo que circula a otros grupos — eso es el pipeline de PDF en [`fuentes/`](fuentes/) (ver [LEEME.md](LEEME.md)). Ambos conjuntos pueden divergir un tiempo; no están unificados aún — mejora pendiente, no bug.

## PDFs en `docs/`

`docs/*.pdf` (Documento de Alcance, Diagrama de Eventos, Acuerdo-Eventos-M6) son entregables compilados, no fuente — no leerlos para contexto. El contenido vive en Markdown editable: `Acuerdo-Eventos-M6.md`, `fuentes/alcance-entregable.md`, y el resto de `docs/` (ver [LEEME.md](LEEME.md) para el mapeo fuente → PDF). Abrir el PDF solo si se pide explícitamente verificar el entregable compilado tal cual se presentó.

## Convenciones

- Nombres de evento y campo en **camelCase**
- Archivo de evento = nombre del evento: `docs/eventos/publicados/urbanServiceScheduled.md`
- Cada evento publicado tiene un `.schema.json` hermano (payload en JSON Schema) — fuente para validar/generar tipos, no para leer prosa
- Eventos consumidos no tienen schema propio (el payload lo define el módulo emisor); documentamos solo los campos que usamos
- `Eventos.txt` = volcado histórico de la cohorte, ya no se edita; bloqueantes viven en `docs/bloqueantes.md`

## Git Flow

Flujo: `main ← test ← develop ← feature/*|bugfix/*|refactor/*|infra/*|docs/*|hotfix/*`. Nunca commitear directo a `main`/`test`/`develop`.

- **Ramas**: parten de `develop`, formato obligatorio `tipo/XXX-descripcion-corta` (ej. `feature/101-alta-servicio-urbano`), donde `XXX` es el número de Issue en GitHub
- **Commits**: Conventional Commits (`feat(scope):`, `fix(scope):`, `refactor(scope):`, `test(scope):`, `docs(scope):`, `chore(ci):`) — nunca mensajes vagos ("update", "fix")
- **PRs**: siempre hacia `develop`, nunca merge directo; checklist obligatorio (descripción, Issue #XXX, cambios, evidencias, checklist compilación/tests/docs/Swagger)
- **Antes de abrir PR**: debe compilar, tests deben pasar, docs/Swagger actualizados, sin conflictos
- **Cambios a contratos** (APIs REST, DTOs públicos, eventos/exchanges/colas RabbitMQ, OpenAPI): avisar a consumidores, actualizar docs, mantener retrocompatibilidad cuando sea posible

**Stack confirmado**: Node.js + TypeScript + Nest.js + PostgreSQL (backend); React + TypeScript + Next.js + Tailwind (frontend); ORM pendiente (TypeORM/Prisma); mensajería RabbitMQ (config pendiente de M9). M6 se comunica solo por eventos asincrónicos, patrón outbox/inbox.

**Principios clave**: nunca hardcodear secretos (usar `.env.example`); status como enums; `ValidationPipe` global desde el inicio; Auth/JWT prioritario antes de tocar módulos de dominio.

## Agent skills

### Issue tracker

GitHub Issues (repo: `hllous/Backend-M6-DAPS2`), via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five canonical roles (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context, but this repo predates `CONTEXT.md`/`docs/adr/`: use the existing `docs/README.md` (glossary) and `docs/decisiones/` (ADRs) instead. See `docs/agents/domain.md`.