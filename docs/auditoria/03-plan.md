# Fase 3 — Plan de cambios

Estado al 2026-11-07: **ejecutado**, salvo E10 (pospuesto) y lo que figura como pendiente al final de esta sección. Issue general: [#530](https://github.com/hllous/Backend-M6-DAPS2/issues/530).

| Ítem | Sub-issue | PR |
|---|---|---|
| Informes de la auditoría | #531 | #543 |
| QW1 a QW3 (plantillas de PR e issues, `SECURITY.md`) | #532 | #544 |
| QW4 a QW10 (correcciones puntuales) | #533 | #545 |
| E1 `LEEME.md` fusionado en `docs/README.md` | #534 | #546 |
| E2 `devops/` (borrar bitácora, `CODEOWNERS`, mensaje a M9) | #535 | #553 |
| E3 referencia de variables, URLs y workflows | #536 | #550 |
| E4 desplegar e historial; `deploy.md` como índice | #537 | #551 |
| E5 runbooks | #538 | #552, #557 |
| E6 `docs:check` ampliado | #539 | #558 |
| E7 vistas C4 y secuencias | #540 | #547 |
| E8 semántica de entrega de eventos | #541 | #549 |
| E9 ejemplos en Swagger | #542 | #548 |
| Extra: compose para G1 y su corrección | #555, #561 | #556, #562 |
| Extra: CodeQL en `develop` | #563 | #564 |
| E10 tabla de rutas y roles generada | — | **pospuesto** |

Pendiente fuera de este plan: frontend en el compose, fijado al tag `v1.0-testing` ([#560](https://github.com/hllous/Backend-M6-DAPS2/issues/560)); e2e intermitente ([#554](https://github.com/hllous/Backend-M6-DAPS2/issues/554)); reporte privado de vulnerabilidades de GitHub (lo habilita el dueño del repo) y después actualizar `SECURITY.md`; decidir si habrá backup de la base. Lo que sigue describe el plan tal como se aprobó.

## Decisiones ya tomadas (2026-11-07)

- **LICENSE: no se incluye.** G11 queda cerrada, sin trabajo asociado.
- **`docs/superpowers/` se retira** (QW5). Ojo: `.gitignore:66` ya lista `docs/superpowers/`, pero el plan está versionado porque se agregó a la fuerza. Se deja la línea del `.gitignore` para que los planes futuros de agentes no se vuelvan a versionar.
- **`docs/documentacion/` es la copia local del repositorio de documentación**, ignorada a propósito (`.gitignore:12`). Ningún cambio de este plan la toca.
- **El CSV de cuentas es ficticio** (declarado por el equipo): solo se rotula (QW7).

## Resumen

| Bloque | Ítems | Esfuerzo total |
|---|---|---|
| Quick wins (≤ 1 h c/u) | QW1 a QW10, agrupables en 2 PRs | ≈ 5 h |
| Estructurales | E1 a E10 (E10 diferible) | ≈ 20 h |
| Cross-repo | X1 (issue en el repo del frontend) | 15 min |

**Contratos que circulan a otros grupos:** ningún ítem modifica `Acuerdo-Eventos-M6.md`, `Sobres-M6.md`, `Cruce-Eventos-M6.md`, los `.schema.json` ni los `.md` de `docs/eventos/publicados/`. E8 es la única página que describe el comportamiento de entrega de eventos; es interna, y si algún día se manda a otros grupos requiere aviso. E9 cambia `openapi.json` (lo consume el frontend) solo para agregar ejemplos.

## Convenciones para todos los PRs

- Rama `tipo/<N>-slug`, con `<N>` = número del Issue. **Hay que abrir un Issue por PR antes de empezar** (o uno paraguas con checklist, referenciado en cada rama). No los creo sin tu aprobación.
- PRs hacia `develop`, con la plantilla de PR (a partir de QW1), commit convencional y checklist de `CONTRIBUTING.md`.
- Tamaño objetivo 100–400 líneas de diff. Los quick wins sueltos son menores a propósito y se agrupan (ver abajo).
- Verificación al final de cada PR: `npm run docs:check`; script de links (728 enlaces hoy, 0 rotos esperados); `npm run openapi:generate` sin diff en `docs/api/openapi.json`; si el PR toca código, `npm run build`, `lint:check` y `test`; y los comandos de cualquier quickstart citado, ejecutados.

## Quick wins (menos de 1 hora cada uno)

| ID | Qué | Archivos | Criterio de aceptación verificable | Commit |
|---|---|---|---|---|
| QW1 | Plantilla de PR (G3) | `.github/PULL_REQUEST_TEMPLATE.md` (≈ 30 líneas, tomadas de `CONTRIBUTING.md:67-90` y `docs/gestion/definition-of-done.md`) | Al abrir un PR de prueba aparece el checklist (descripción, `Closes #XXX`, cambios, evidencias, compilación/tests/docs/Swagger). Los ítems coinciden textualmente con `CONTRIBUTING.md`. | `docs(github): sumar plantilla de PR con el checklist de CONTRIBUTING (#N)` |
| QW2 | Plantillas de issue (G13) | `.github/ISSUE_TEMPLATE/bug.md`, `tarea.md`, `config.yml` | Las dos plantillas aparecen en "New issue" y aplican la etiqueta `needs-triage` (`docs/agents/triage-labels.md`). | `docs(github): sumar plantillas de issue para bug y tarea (#N)` |
| QW3 | SECURITY.md (G10) | `SECURITY.md` (≈ 15 líneas) | Cómo reportar (canal privado del equipo, sin abrir issue público), qué rama se mantiene (`main`) y tiempo de respuesta esperado. Sin correos personales. GitHub lo muestra en la pestaña Security. | `docs: sumar SECURITY.md con la política de reporte (#N)` |
| QW4 | Quitar la fila `CORS_ORIGINS` con el dominio viejo (A1) | `docs/deploy.md:97` | Queda una sola fila `CORS_ORIGINS`, con `https://m6-ambiente-higiene.vercel.app`, igual a `.env.example:42`. | `docs(deploy): quitar la fila duplicada de CORS_ORIGINS con el dominio viejo (#N)` |
| QW5 | Retirar `docs/superpowers/` (decidido) | `git rm docs/superpowers/plans/2026-10-28-preparar-prueba-backend.md` | `git ls-files docs/superpowers` → 0; no quedan referencias entrantes (hoy no hay ninguna aparte del `.gitignore`). | `docs: retirar el plan de agente docs/superpowers (#N)` |
| QW6 | Rotular `docs/agents/` como andamiaje de agente (G15) | `docs/agents/README.md` nuevo (≈ 8 líneas) y una frase en `docs/README.md` | `docs/README.md` aclara que `docs/agents/` configura a los agentes y no describe el producto. `AGENTS.md` no crece. | `docs(agents): rotular docs/agents como andamiaje de agente (#N)` |
| QW7 | Aviso de que el CSV de cuentas es ficticio (G22) | `docs/integracion/m1.md` (1 línea cerca de L67) y encabezado en `docs/integracion/README.md` | Ambos dicen "datos ficticios" y apuntan al CSV. `npm run docs:check` pasa. | `docs(integracion): aclarar que el CSV de cuentas de M1 es ficticio (#N)` |
| QW8 | Estados de ADR completos (G21) | `docs/decisiones/_template-adr.md:5`, `docs/decisiones/README.md` | La plantilla lista `Reemplazado parcialmente por ADR-YYY` y la convención "Aceptado con nota fechada". El índice no cambia de contenido. | `docs(adr): completar los estados posibles en la plantilla (#N)` |
| QW9 | Dejar una sola entrada de `M1_BASE_URL` en `.env.example` (B4) | `.env.example` (líneas 132 y 150-154) | `grep -c '^# M1_BASE_URL' .env.example` = 1; el bloque "No son del backend" lista solo variables que `src/` no lee; `npm run build` y los tests de configuración siguen verdes. | `docs(config): dejar una sola entrada de M1_BASE_URL en .env.example (#N)` |
| QW10 | Resolver la doble fuente del DER (B8, G16) | `docs/DER.puml` o nota en `docs/DER.md` | Se compara entidad por entidad con `DER.md` y con `prisma/schema.prisma` (43 modelos). Si `DER.puml` difiere, se elimina (Mermaid renderiza en GitHub); si coincide, se rotula "derivado de DER.md". Ningún enlace entrante queda roto. | `docs(der): dejar DER.md como única fuente del modelo (#N)` |

**Agrupación sugerida:** PR-A = QW1+QW2+QW3 (≈ 90 líneas, solo `.github/` y `SECURITY.md`; `.github/` tiene CODEOWNER de DevOps, pedir su review). PR-B = QW4 a QW10 (≈ 150 líneas). Si QW4 y E3 salen cerca, se puede omitir QW4.

## Cambios estructurales

### E1 — `LEEME.md`: fusionar en `docs/README.md` y eliminar (A2, A3, A10, G1, G14)

**Propuesta: fusionar y eliminar.** `LEEME.md` describe un repo anterior (A2) y su contenido útil cabe en una sección corta.

- Se conserva: la idea de "dos conjuntos de documentación" y la tabla *fuente → entregable* (qué archivo del repositorio de documentación produce qué PDF).
- Se descarta: el árbol de la raíz, "Estado al 5 de octubre", "En cuanto se cree el proyecto NestJS" y el resumen de integración (ya está en `docs/bloqueantes.md`).
- **Dependencia del repositorio de documentación (G14):** `docs/README.md` suma una sección "Repositorio de documentación" que dice qué vive allá (PDF compilados, enunciado, fichas por módulo, versiones largas del alcance), con el **enlace al repo** en lugar de rutas relativas, y qué *no* se puede verificar desde este repo (contenido de los PDF y de las fichas). Aclara que `docs/documentacion/` es una copia local ignorada por git, para cross-reference.
- Se actualizan los enlaces entrantes: `README.md:42` y `:69`, `AGENTS.md:44,48`, `docs/gestion/definition-of-done.md:57`, `docs/integracion/README.md:3`.

| Campo | Valor |
|---|---|
| Rama | `docs/<N>-fusionar-leeme` |
| Archivos | `LEEME.md` (borrar, −92), `docs/README.md` (+≈ 40), `README.md`, `AGENTS.md` (1 línea c/u), `docs/gestion/definition-of-done.md`, `docs/integracion/README.md` |
| Diff | ≈ 150 líneas |
| Criterio | `git ls-files LEEME.md` vacío; ningún `*.md` versionado enlaza a `LEEME.md`; `AGENTS.md` sigue por debajo de 8 KB; script de links sin rotos. |
| Commit | `docs: fusionar LEEME en docs/README y documentar la dependencia del repo de documentación (#N)` |
| Falta un dato | La URL del repositorio de documentación. |
| Contrato | No. Solo se describe dónde viven los contratos; no se edita ninguno. |

### E2 — `devops/`: borrar la bitácora de septiembre, conservar lo vigente (A4, A5, B2, G4)

**Decisión del equipo (2026-11-07): borrar en vez de archivar.** Es coherente con retirar `docs/superpowers/` (QW5): el historial de git conserva la bitácora, y archivarla dejaría ≈ 450 líneas de la época Kafka que agentes y `grep` seguirían encontrando. **Bloqueado hasta consultar con DevOps** (es su trabajo); no se abre el PR sin su conformidad.

| Archivo | Naturaleza | Destino |
|---|---|---|
| `DEVOPS-SEGUIMIENTO.md` (449 líneas) | Bitácora de septiembre: Dockerfile, CI, Kafka, branch protection, compose. Lo vigente ya está en `ci.yml` y `Dockerfile`. | **Borrar** |
| `PRESENTACION-DEVOPS.md`, `resumen-devops.md` | Guiones y explicación del 02/10 | **Borrar** |
| `MENSAJE-M9-RABBITMQ.md` | Mensaje ya enviado a M9 (21/10) | **Mover** a `docs/integracion/` si `mensajes.md` no lo duplica; si lo duplica, borrar |
| `docker-compose.yml` | Config vigente | **Conservar**, con `devops/README.md` de 10 líneas |

También: `README.md:33` dice que el compose está "en la raíz del workspace DevOps", y `.github/CODEOWNERS:15-16` protege `/docker-compose.yml` y `/docker/`, que **no existen** en la raíz. CODEOWNERS pasa a apuntar a `/devops/`.

| Campo | Valor |
|---|---|
| Rama | `docs/535-borrar-devops` |
| Archivos | `devops/*.md` (borrar), `devops/README.md` nuevo, `README.md:33`, `.github/CODEOWNERS`, `docs/deploy.md:280-281` (se corrige en E4) |
| Diff | ≈ 80 líneas agregadas (el resto son borrados) |
| Criterio | `docker compose -f devops/docker-compose.yml config` sin error; links rotos = 0; sin `kafka` en `devops/`; CODEOWNERS apunta a rutas existentes. |
| Commit | `docs(devops): borrar la bitácora de septiembre y dejar solo el compose vigente (#535)` |
| Contrato | No. |

### E3 — Dividir `deploy.md` (1/3): referencia única de variables, URLs y workflows (A1, A11, B3, B4, B6, G2)

**Propuesta general de división** de `docs/deploy.md` (280 líneas, 7 secciones):

| Sección actual | Líneas | Tipo | Destino |
|---|---|---|---|
| §1 Estado actual | 8-21 | Registro fechado | `docs/operacion/historial.md` (snapshot con fecha; en el índice se reemplaza por "verificá con los comandos de §3") |
| §2 URLs útiles | 22-32 | Referencia | `docs/operacion/referencia.md` |
| §3 Cómo verificar | 33-49 | How-to | `docs/operacion/desplegar.md` |
| §4 Cómo funciona el deploy (automático y manual) | 50-86 | Explicación + how-to | `docs/operacion/desplegar.md` |
| §4 Variables de entorno | 87-155 | Referencia | `docs/operacion/referencia.md` (**una sola tabla**) |
| §4 Checklist de despliegue para DevOps | 156-191 | How-to | `docs/operacion/desplegar.md` |
| §4 Scripts: sincronizar zonas (#421), migrar cuadrillas (#365) | 192-217 | How-to | `docs/operacion/desplegar.md` |
| §5 Gotchas conocidos | 218-240 | Explicación → runbooks | `docs/operacion/runbooks.md` (E5) |
| §6 Estado end-to-end | 241-277 | Registro fechado | `docs/operacion/historial.md` |
| §7 Referencia | 278-280 | Obsoleta (A4) | se elimina (la bitácora de DevOps se borra en E2) |

`docs/deploy.md` **queda como índice de ~15 líneas** que enlaza a los cuatro documentos nuevos. Motivo: lo citan ≈ 25 archivos (README, ADR-001/007/008, QA, integración, DoD…) y moverlo rompería links y anclas.

**E3 cubre** `docs/operacion/README.md` y `docs/operacion/referencia.md`:

- **Una sola tabla de variables**, con las 34 claves de `env.validation.ts`, incluidas las 9 `INDICATORS_*` que faltan (B3); `CORS_ORIGINS` una vez (A1); `M1_BASE_URL` una vez (B4).
- Las variables de Vercel (`M6_AUTH_MODE`, `M6_BACKEND_ORIGIN`, `M6_SESSION_SECRET`) **salen** del backend: queda un enlace al repo del frontend (ver X1) (B6).
- Workflows: `ci.yml`, `keepalive.yml` y la variable de repositorio `RENDER_HEALTH_URL`.

| Campo | Valor |
|---|---|
| Rama | `docs/<N>-operacion-referencia` |
| Archivos | `docs/operacion/README.md`, `docs/operacion/referencia.md` (nuevos); `docs/deploy.md` (se vacía de §2 y variables) |
| Diff | ≈ 300 líneas |
| Criterio | Las 34 claves de `env.validation.ts` aparecen exactamente una vez en `referencia.md` (mismo `comm` de la Fase 1); una sola fila `CORS_ORIGINS`; links rotos = 0; ninguna variable `M6_*` de Vercel en `docs/operacion/`. |
| Commit | `docs(operacion): separar la referencia de variables, URLs y workflows de deploy.md (#N)` |
| Contrato | No. |

### E4 — Dividir `deploy.md` (2/3): how-to e historial (A4, B5, A11, G2)

- `docs/operacion/desplegar.md`: verificación, deploy automático y manual, checklist DevOps, scripts #421 y #365.
- `docs/operacion/historial.md`: §1 y §6 con cabecera "snapshot, no es el estado actual". La contradicción del frontend ✅/⏳ (B5) se resuelve **reemplazando los estados fechados por los comandos de verificación**: el estado vivo se comprueba con `curl`, no con una tabla que envejece.
- `docs/deploy.md` queda como índice.

| Campo | Valor |
|---|---|
| Rama | `docs/<N>-operacion-desplegar-historial` |
| Archivos | `docs/operacion/desplegar.md`, `docs/operacion/historial.md` (nuevos); `docs/deploy.md` (índice final); enlaces entrantes con ancla |
| Diff | ≈ 350 líneas |
| Criterio | `wc -l docs/deploy.md` < 25; `git grep -n 'deploy.md#'` sin anclas rotas (o actualizadas); los `curl` de `desplegar.md` se ejecutan y devuelven 200 (backend `/health`, frontend `/api/health`); no queda ✅/⏳ fechado fuera de `historial.md`. |
| Commit | `docs(operacion): separar el how-to de despliegue y el historial de deploy.md (#N)` |
| Contrato | No. |

### E5 — Runbooks (7a, G19)

`docs/operacion/runbooks.md` (o una carpeta si crece), con formato **síntoma → diagnóstico → acción → verificación → rollback → escalamiento**. Parte de los Gotchas de `deploy.md §5` y se completa con:

1. Render dormido o cold start lento (`keepalive.yml`).
2. Base caída: `/health/ready` devuelve 503.
3. Bus desconectado u outbox atascado (`/health/ready` informa `broker`).
4. Evento rechazado por el Core o mensaje en cola de error.
5. Rotación o valor incorrecto de `JWT_SECRET`.
6. Rollback de un deploy fallido (Render: redeploy del commit anterior).

Cada runbook se **valida contra el código y contra el comportamiento real** (qué responde `/health/ready`, qué hace `OutboxDispatcher`), no solo contra los docs.

| Campo | Valor |
|---|---|
| Rama | `docs/<N>-runbooks` |
| Archivos | `docs/operacion/runbooks.md`, `docs/operacion/README.md` |
| Diff | ≈ 250 líneas |
| Criterio | 6 runbooks con las 6 secciones; cada comando citado se ejecutó o se marcó "no verificado"; los Gotchas de `deploy.md §5` están absorbidos (nada se pierde). |
| Commit | `docs(operacion): sumar runbooks de salud, bus, base, JWT y rollback (#N)` |
| Contrato | No. |

### E6 — Ampliar `docs:check` (A9, A12, 9b, 9c, G5, G6)

Un solo script, sin dependencias nuevas:

1. **Links relativos de todo `docs/` y de los `.md` de la raíz** (el script de auditoría tiene ≈ 20 líneas), sin anclas.
2. **Conteos documentados vs realidad:** rutas, operaciones y tags contra `docs/api/openapi.json`; modelos contra `prisma/schema.prisma`; módulos contra `src/modules/`. Busca frases `N rutas|operaciones|tags|modelos|módulos` y las compara.
3. **Variables:** cada clave de `env.validation.ts` aparece en `docs/operacion/referencia.md`.

Va **después de E1, E2 y E4**, para nacer en verde. Debe ignorar `docs/documentacion/` (no existe en CI).

| Campo | Valor |
|---|---|
| Rama | `tests/<N>-docs-check-ampliado` (o `chore/`) |
| Archivos | `scripts/check-docs-integracion.mjs` (o `scripts/check-docs.mjs` + `package.json`); `.github/workflows/ci.yml` solo si cambia el nombre del script |
| Diff | ≈ 200 líneas |
| Criterio | `npm run docs:check` verde hoy. Prueba negativa: cambiar un `152` por `151` en `README.md`, o romper un link, hace fallar el comando con un mensaje que nombra archivo y línea. CI verde. |
| Commit | `chore(docs): ampliar docs:check a links, conteos y variables de entorno (#N)` |
| Contrato | No. |

### E7 — Vistas de arquitectura en Mermaid (5a, 5b, G7)

`docs/arquitectura/README.md` (o un archivo por vista), con:

- **C4 nivel 1 (contexto):** M6, usuarios (oficina, campo, ciudadano), M1 (JWT e identidad), M2/M3/M4/M7 por eventos, M9 (Core y bus).
- **C4 nivel 2 (contenedores):** backend NestJS, PostgreSQL (Supabase), frontend/BFF (Vercel), RabbitMQ del Core, almacenamiento de evidencia (R2), Render.
- **Tres secuencias:** (1) publicar un evento: cambio de dominio + outbox en la misma transacción, `OutboxDispatcher`, `muni.inbox`; (2) consumir un evento: bus → inbox idempotente → consumer → máquina de estados; (3) login con JWT de M1 y asignación de rol local (ADR-004, ADR-008).

Cada diagrama se **contrasta con el código** (`src/events/outbox`, `src/events/inbox`, `src/auth`, `src/common/guards`) antes de escribirlo. Se enlaza desde `docs/README.md`; `AGENTS.md` suma una línea, no una sección.

| Campo | Valor |
|---|---|
| Rama | `docs/<N>-vistas-de-arquitectura` |
| Archivos | `docs/arquitectura/README.md` (nuevo), `docs/README.md` |
| Diff | ≈ 250 líneas |
| Criterio | GitHub renderiza los 5 diagramas (se revisa la vista previa del PR); cada flecha de las secuencias cita el archivo del código que la implementa; sin herramientas nuevas. |
| Commit | `docs(arquitectura): sumar vistas C4 y secuencias de publicación, consumo y login (#N)` |
| Contrato | No (describe, no define). |

### E8 — Semántica de entrega de eventos (4c, 4d, G8)

`docs/eventos/semantica-de-entrega.md`: una página que **reúne lo ya decidido** en ADR-006/007 y `src/events/envelope.ts`:

- Entrega *at-least-once* e idempotencia (por `eventId` y por estado, ADR-007 L58).
- Política de ack/nack y quién reintenta (el Core), DLQ.
- Qué significa `eventVersion: '1.0'` y la regla para cambiarla (qué es compatible).
- Qué pasa con un evento sin consumidor o descartado.

No inventa reglas: si algo no está decidido, lo marca "no definido" y lo deja para el equipo.

| Campo | Valor |
|---|---|
| Rama | `docs/<N>-semantica-de-entrega` |
| Archivos | `docs/eventos/semantica-de-entrega.md` (nuevo); enlace desde `docs/eventos/publicados/README.md` y `consumidos/README.md` (1 línea c/u) |
| Diff | ≈ 130 líneas |
| Criterio | Cada afirmación cita ADR o archivo de código; los "no definido" quedan listados al final; no se modifica ningún `.schema.json` ni `.md` de evento publicado. |
| Commit | `docs(eventos): documentar la semántica de entrega, idempotencia y versionado (#N)` |
| Contrato | **Aviso solo si se circula afuera.** Es interno por defecto. |

### E9 — Ejemplos en el Swagger de los flujos principales (6c, G17)

**Es código, no solo docs:** va por el flujo del implementador y la revisión. Alcance acotado a unos 15 endpoints que usan el frontend y la demo (alta y transición de `Service`, alta de `EnvironmentalReport`, `public/*`, evidencia, alta de cuadrilla), con `example` en los DTOs y respuestas. **No** se apunta a los 152. Los endpoints y DTOs exactos se eligen en el PR leyendo `docs/api/endpoints.md` y los controllers; los ejemplos deben ser válidos contra el DTO.

| Campo | Valor |
|---|---|
| Rama | `docs/<N>-ejemplos-swagger` |
| Archivos | DTOs y controllers de los recursos elegidos, `docs/api/openapi.json` (regenerado) |
| Diff | ≈ 300 líneas |
| Criterio | `npm run openapi:generate` deja `openapi.json` consistente (CI lo exige); operaciones con ejemplo suben de 30 a ≥ 45; `build`, `lint:check` y `test` verdes; cobertura ≥ 85 %; ningún cambio de comportamiento. |
| Commit | `docs(api): ejemplos de request y response en los flujos principales de Swagger (#N)` |
| Contrato | **Sí:** cambia `openapi.json`, que consume el frontend. No cambia forma ni validación, solo agrega ejemplos; se avisa en el PR. |

### E10 — Tabla de rutas y roles de `endpoints.md` generada (G18) — **diferible**

Extender `docs:roles` para generar la tabla de rutas, métodos, roles y tags a partir de `openapi.json` y del código, y dejar a mano solo lo explicativo. `endpoints.md` pesa 114 KB y lo protege `CODEOWNERS` (`/docs/api/endpoints.md @hllous`): requiere su review.

| Campo | Valor |
|---|---|
| Rama | `docs/<N>-endpoints-tabla-generada` |
| Archivos | `scripts/generate-roles-table.ts`, `docs/api/endpoints.md`, `package.json` |
| Diff | ≈ 400 líneas |
| Criterio | Un cambio de ruta sin regenerar la tabla falla en CI; `docs:roles` es idempotente. |
| Commit | `chore(docs): generar la tabla de rutas y roles de endpoints.md desde openapi.json (#N)` |
| Contrato | No, pero la revisa `@hllous` por CODEOWNERS. |
| Recomendación | **Posponer.** Valor medio, esfuerzo L; hacerlo solo si E6 muestra deriva entre `endpoints.md` y `openapi.json`. |

## Cross-repo

**X1 — Issue en `hllous/Frontend-M6-DAPS2`** (según `AGENTS.md`, "Cross-repo changes"): las variables `M6_AUTH_MODE`, `M6_BACKEND_ORIGIN` y `M6_SESSION_SECRET` de Vercel hoy se documentan en el repo del backend (`deploy.md`). Pedir que el frontend las documente en su repo (o confirmar que ya lo hace) y enlazarlas desde `docs/operacion/referencia.md`. Linkear al issue de E3. Se abre al empezar E3.

## Orden recomendado

1. **PR-A y PR-B** (quick wins): no dependen de nada.
2. **E1 → E2**: dejan los links en verde y eliminan el `LEEME.md` y el `devops/` viejo (E2 espera a DevOps).
3. **E3 → E4 → E5**: la división de `deploy.md`. E5 puede ir en paralelo con E4.
4. **E6**: después de E1, E2 y E4, para nacer en verde.
5. **E7** y **E8**: independientes, en cualquier momento.
6. **E9**: independiente; va por el flujo de código (implementador, revisor y auditor de contratos).
7. **E10**: solo si hace falta.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Romper links y anclas al mover `deploy.md` (≈ 25 archivos lo citan) | `docs/deploy.md` queda como índice; antes de mergear E3 y E4 se corre `git grep -n 'deploy.md#'` y el script de links. |
| `docs:check` ampliado falla por frases ambiguas (por ejemplo "29 tags" en prosa histórica) | Se comparan solo patrones `N rutas\|operaciones\|tags\|modelos\|módulos` fuera de bloques marcados como históricos; se prueba contra el repo antes de activarlo en CI. |
| `docs/documentacion/` no existe en CI | Ningún `*.md` versionado puede enlazar ahí; el script lo ignora y E1 lo documenta. |
| CODEOWNERS: `.github/` y `/docs/api/endpoints.md` exigen review del dueño | Avisar a DevOps (PR-A, E2) y a `@hllous` (E10) al abrir los PRs. |
| E7 y E8 afirman cosas que el código ya no hace | Cada afirmación cita archivo y línea; el revisor de contratos las contrasta. |
| E9 modifica `openapi.json`, consumido por el frontend | Solo agrega ejemplos; el PR lo avisa y CI verifica el diff de `openapi.json`. |
| Los 2 PDFs y las fichas por módulo no se pueden verificar desde este repo | E1 lo declara explícitamente; no se promete exactitud sobre ellos. |

## Qué necesito de vos para empezar la Fase 4

1. **Aprobación** del plan completo o de un subconjunto (por ejemplo, PR-A, PR-B y E1 a E6).
2. **URL del repositorio de documentación**, para E1.
3. **¿Un Issue paraguas con checklist, o uno por PR?** Por defecto propongo un paraguas más un issue por PR estructural.
4. Confirmar que **E10 queda pospuesto**.
