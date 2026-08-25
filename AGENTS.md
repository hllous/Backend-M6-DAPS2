# AGENTS.md — Módulo 6, Grupo 04

TPO "Municipalidad UADE" de Desarrollo de Aplicaciones II: plataforma municipal distribuida, 9 grupos, un módulo cada uno, integración por eventos asincrónicos (`AsyncAPI`/bus de eventos, sobre pendiente de que M9 lo defina) y REST solo para lo síncrono. Cada módulo tiene frontend + backend en tres capas + base de datos propia; nada de acceso directo entre bases. Ver [enunciado/TPO - Desarrollo de Apps II - Gestión de municipalidad.pdf](enunciado/TPO%20-%20Desarrollo%20de%20Apps%20II%20-%20Gesti%C3%B3n%20de%20municipalidad.pdf) para el enunciado completo.

## Por dónde empezar

1. [docs/README.md](docs/README.md) — qué hace el módulo y el glosario de términos propios (`Zone`, `Service`, `Crew`, etc.)
2. [docs/entidades/](docs/entidades/) — el modelo de datos, con diagramas de estado
3. [docs/eventos/publicados/](docs/eventos/publicados/) — los 8 eventos que este módulo emite, con payload y consumidores
4. [docs/eventos/consumidos/](docs/eventos/consumidos/) — los 11 eventos que este módulo escucha de otros módulos
5. [docs/bloqueantes.md](docs/bloqueantes.md) — **fuente única** del estado de la integración: qué está confirmado y qué falta de cada contraparte. Si vas a tocar un evento o un payload, leé esto primero
6. [docs/enumeraciones.md](docs/enumeraciones.md) — catálogo de valores cerrados usados en entidades y eventos
7. [docs/api/](docs/api/) — estándar Swagger + endpoints REST del backend
8. [docs/decisiones/](docs/decisiones/) — ADRs (registro de decisiones técnicas)
9. [docs/gestion/](docs/gestion/) — proceso Scrum: DoD, sprints, retros, bitácoras individuales del challenge

## Qué NO es `docs/`

`docs/` es documentación interna de trabajo — para el equipo y para cualquier sesión de IA que ayude a programar este módulo. No es lo que se entrega a la cátedra ni lo que circula a otros grupos: eso sigue siendo el pipeline de PDF en [`fuentes/`](fuentes/) (ver [LEEME.md](LEEME.md)). Los dos conjuntos pueden decir cosas ligeramente distintas por un tiempo — no están unificados todavía, es una mejora pendiente, no un bug.

## Convenciones

- Nombres de evento y de campo en **camelCase**
- Un archivo de evento se llama igual que el evento: `docs/eventos/publicados/urbanServiceScheduled.md`.
- Cada evento publicado tiene un `.schema.json` hermano con su payload en JSON Schema — es la fuente para validar y generar tipos, no para leer prosa.
- Los eventos consumidos no tienen schema propio: el payload lo define el módulo que lo publica. Documentamos ahí solo los campos que necesitamos.
- `Eventos.txt` es un volcado histórico de la cohorte — ya no se edita como fuente de bloqueantes, eso vive en `docs/bloqueantes.md`.
