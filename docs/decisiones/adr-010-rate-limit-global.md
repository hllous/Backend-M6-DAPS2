# ADR-010: Límite de tasa global con topes propios

## Estado

**Aceptado** — 2026-11-08 (issue [#568](https://github.com/hllous/Backend-M6-DAPS2/issues/568)). Reemplaza a [ADR-008](adr-008-roles-m6-adaptados-desde-m1.md) solo en el punto «sin rate limit»; el resto de ese ADR sigue vigente.

## Contexto

ADR-008 dejaba el rate limit general «para después de la entrega» y `ThrottlerModule` vivía solo en `citizen-portal`. La cátedra pide 429 ante abuso (DEF-07).

## Decisión

- `ThrottlerGuard` global (primer `APP_GUARD`, antes de JWT y roles), con `THROTTLE_LIMIT` (600) por `THROTTLE_TTL_MS` (60 s), por IP y por endpoint. El tracker es el del portal (`BFF_SHARED_KEY` + `X-Forwarded-For`).
- Topes propios: `POST /events/inbox` 300/min, `POST /evidence` 30/min.
- `/health` queda fuera (`@SkipThrottle`). El portal conserva su límite más estricto y convive con el global.
- `BFF_SHARED_KEY` sigue opcional: exigirla podría impedir el arranque si falta en Render.

## Consecuencias

Cualquier endpoint puede responder 429. El BFF debe mandar la clave y sobrescribir `X-Forwarded-For`; si no, sus usuarios comparten un balde de 600/min por endpoint.
