# Cómo trabajar en este repo

Guía interna del **Grupo 04 — Módulo 6**. Reglas cortas para que el trabajo del equipo no se pise entre sí y para que el código y la documentación crezcan alineados.

## Antes de empezar a codear

1. Leé el [`AGENTS.md`](AGENTS.md) para orientarte.
2. Chequeá el [`docs/bloqueantes.md`](docs/bloqueantes.md) si vas a tocar algo de integración.
3. Tomá o creá una tarjeta en Trello. Todo lo que se codea tiene que estar asociado a una tarjeta.

## Branches

Rama principal: **`main`**.

Se trabaja siempre en una rama nueva a partir de `main`, con este formato:

```
<tipo>/<descripción-corta>
```

Los tipos que usamos:

| Prefijo | Cuándo |
|---|---|
| `feature/` | Funcionalidad nueva |
| `fix/` | Corrección de un bug |
| `docs/` | Cambios solo en documentación |
| `refactor/` | Reescritura sin cambio de comportamiento |
| `test/` | Agregado o corrección de tests |
| `chore/` | Configuración, dependencias, tooling |

Ejemplos:

```
feature/endpoint-crear-contenedor
fix/validacion-fecha-servicio
docs/adr-002-broker
refactor/service-modulo-arboles
test/environmental-report-coverage
chore/actualizar-nestjs
```

**Descripciones en minúscula, separadas por guión, en castellano.** Sin acentos ni caracteres especiales.

## Mensajes de commit

Usamos [Conventional Commits](https://www.conventionalcommits.org/) **como sugerencia, no como obligación**. La idea es que el historial se lea claro, no bloquear a nadie.

Formato sugerido:

```
<tipo>: <descripción imperativa en minúscula>
```

Ejemplos:

```
feat: endpoint para crear contenedor
fix: validar fecha de programación no anterior a hoy
docs: agregar ADR sobre elección de broker
test: cobertura del servicio de arbolado
chore: bump nestjs a 10.4
```

Un commit por cambio lógico. No metas 15 archivos sin relación en un commit gigante.

## Pull Requests

Todo cambio entra a `main` por PR. Nada de commits directos a `main`.

**Un buen PR tiene:**

- Título claro, con el mismo formato que un commit (`feat: ...`, `fix: ...`).
- Descripción con:
  - Qué hace y por qué
  - Link a la tarjeta de Trello
  - Si tocó documentación, cuál
  - Si hay algo que quede pendiente en otro PR
- Checklist mínima marcada (ver abajo).
- Idealmente menos de 400 líneas cambiadas — PRs gigantes son difíciles de revisar y de revertir.

### Checklist mínima antes de mergear

- [ ] El código compila y los tests pasan localmente
- [ ] Cobertura de tests ≥ 85% en los archivos tocados
- [ ] Si es un endpoint: cumple el [estándar Swagger](docs/api/estandar-swagger.md)
- [ ] Si es un evento nuevo o cambia un payload: `docs/eventos/` actualizada y schema JSON actualizado
- [ ] Si es una decisión técnica: hay un ADR en [`docs/decisiones/`](docs/decisiones/)
- [ ] Ninguna variable de entorno queda hardcodeada
- [ ] El linter no arroja warnings nuevos

### Política de reviews

**Hoy no hay reviews obligatorias.** El autor mergea bajo su criterio.

Recomendación fuerte: si el cambio es no trivial (endpoint nuevo, modificación de un evento, decisión técnica), pedile a alguien del equipo que le pegue una mirada — aunque sea informalmente por WhatsApp — antes de mergear. Ayuda a evitar retrabajo y difunde conocimiento.

Esta política se puede endurecer más adelante si el equipo lo decide en una retro. Cualquier cambio queda registrado en un ADR y actualiza esta sección.

## Documentación

**Si tocás código, tocá la doc relacionada en el mismo PR.** No dejar la doc para después.

Casos concretos:

| Cambio en el código | Actualizar |
|---|---|
| Agregar o modificar un endpoint | Swagger (via decoradores en el código) + `docs/api/endpoints.md` |
| Agregar o cambiar un evento publicado | `docs/eventos/publicados/*.md` y `*.schema.json` |
| Cambiar la forma en que se consume un evento | `docs/eventos/consumidos/*.md` |
| Agregar o cambiar una entidad | `docs/entidades/*.md` y `docs/DER.puml` |
| Nuevo enum o valor de enum | `docs/enumeraciones.md` |
| Decisión de arquitectura o tecnología | Nuevo ADR en `docs/decisiones/` |
| Confirmar o levantar un bloqueante con otro grupo | `docs/bloqueantes.md` |

Si vas a hacer un cambio grande en la doc de dominio (`docs/entidades/`, `docs/eventos/`), avisá al equipo antes — puede impactar a otros PRs en curso.

## Estilo de código

- **ESLint** y **Prettier** configurados en el proyecto — corren en cada commit vía `husky` (ver sprint 1).
- No cambiar reglas del linter sin discutirlo con el equipo.
- No commitear código comentado. Si un bloque ya no se usa, se borra — Git guarda la historia.
- Nombres de variables y funciones en **inglés**. Comentarios y doc en **castellano**.
- Los nombres de eventos, campos de eventos y enums van en **camelCase** (ya definido a nivel cohorte, ver [`AGENTS.md`](AGENTS.md)).

## Testing

- Todo lo que se codea tiene tests unitarios asociados en el mismo PR.
- Cobertura mínima **85%** (requisito del TPO, no negociable).
- Tests de integración para endpoints y consumers de eventos.
- No commitear tests que están fallando o marcados como `skip` sin justificación en el PR.

## Variables de entorno y secretos

- **Nunca commitear** claves, tokens, connection strings, secretos de ningún tipo.
- Todo va a `.env` (que está en `.gitignore`).
- Si agregás una nueva variable, actualizá el `.env.example` (a crear en sprint 1) con un valor placeholder.

## Cuando algo se rompe en `main`

Si un PR mergeado rompe el build o los tests en `main`:

1. Avisar al equipo por el canal del grupo.
2. Revertir el commit (`git revert`) si la fix va a tardar más de 1 hora.
3. Trabajar la fix en una rama `fix/*` aparte, no directo en `main`.

`main` siempre debe estar deployable.

## Definition of Done

El DoD acordado por el equipo vive en `docs/gestion/definition-of-done.md` (pendiente sprint 1). Una tarea no está terminada hasta que cumple el DoD.

---

## Preguntas o cambios a esta guía

Si algo de esta guía no funciona o hay que cambiarlo, se discute en la retro del sprint y se actualiza este archivo con un PR. El CONTRIBUTING no es sagrado — es una herramienta.
