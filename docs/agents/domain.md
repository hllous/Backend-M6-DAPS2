# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

This repo predates the generic `CONTEXT.md` / `docs/adr/` convention and already has functionally equivalent docs under different names. Skills should read **these** instead of looking for `CONTEXT.md` or `docs/adr/` — don't create those files.

## Before exploring, read these

- **[`docs/README.md`](../README.md)** — the `CONTEXT.md` equivalent: what the module (M6) does, plus its glossary (`Zone`, `Service`, `Ticket`, `Acta`, `Crew`, etc.). Use these terms exactly; don't drift to synonyms the glossary explicitly avoids (e.g. `Ticket`, not `complaint`).
- **[`docs/decisiones/`](../decisiones/)** — the `docs/adr/` equivalent. Read ADRs that touch the area you're about to work in. Spanish-named (`decisiones` = decisions), one file per ADR (`adr-001-*.md`, `adr-002-*.md`, ...), following [`docs/decisiones/_template-adr.md`](../decisiones/_template-adr.md). The index lives in [`docs/decisiones/README.md`](../decisiones/README.md).
- **[`docs/bloqueantes.md`](../bloqueantes.md)** — live state of cross-module integration (what's confirmed vs. pending from other modules). Read before touching any event or payload.
- **[`docs/enumeraciones.md`](../enumeraciones.md)** — catalog of closed enum values used across entities and events.

If any of these files don't exist, proceed silently. Don't flag their absence; don't suggest creating them upfront.

## File structure (single-context)

```
/
├── docs/
│   ├── README.md              ← module overview + glossary (CONTEXT.md equivalent)
│   ├── bloqueantes.md         ← live integration status
│   ├── enumeraciones.md       ← closed enum catalog
│   ├── decisiones/            ← ADRs (docs/adr/ equivalent)
│   │   ├── README.md          ← index
│   │   ├── _template-adr.md
│   │   └── adr-001-*.md
│   ├── entidades/             ← data model, with state diagrams
│   ├── eventos/
│   │   ├── publicados/        ← events this module emits (with .schema.json)
│   │   └── consumidos/        ← events this module listens to
│   ├── DER.md                 ← relational model (Mermaid)
│   ├── api/                   ← Swagger standard, endpoint map, openapi.json
│   ├── deploy.md · testing.md ← operations
│   └── gestion/               ← Scrum process
```

The implementation lives in `src/` (NestJS) and `prisma/schema.prisma`; when a doc and the code disagree, the code wins.

## Writing new ADRs

When `/domain-modeling` (or `/grill-with-docs`, `/improve-codebase-architecture`) needs to record a new architecture decision:

- Add a new file `docs/decisiones/adr-00N-<slug>.md` following `_template-adr.md`, continuing the correlative numbering.
- Update the index table in `docs/decisiones/README.md`.
- ADRs are not rewritten once accepted: a changed decision gets a new ADR, and the old one gets a dated correction note (see ADR-002 and ADR-001 for the format).

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `docs/README.md`'s glossary. If the concept isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR under `docs/decisiones/`, surface it explicitly rather than silently overriding:

> _Contradicts ADR-001 (stack tecnológico), but worth reopening because…_
