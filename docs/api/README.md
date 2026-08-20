# API REST del backend M6

Documentación técnica de la API que expone el backend, para uso del equipo interno.

## Qué hay acá

- [`estandar-swagger.md`](estandar-swagger.md) — convenciones que **todo endpoint debe cumplir** (tags, formato de respuestas, códigos HTTP, autenticación, DTOs). De lectura obligatoria antes de escribir el primer endpoint.
- `endpoints.md` — resumen de endpoints REST expuestos por M6. *A completar cuando existan endpoints reales.*

## URL pública del Swagger

Cuando el backend esté desplegado, la doc interactiva vive en:

> `https://[url-railway]/api/docs`

*Pendiente: pegar la URL cuando se haga el primer deploy (sprint 1).*

## Convención general

La comunicación entre módulos es **por eventos asincrónicos** — no REST (ver [`docs/eventos/`](../eventos/)). REST se usa solo para:

1. Comunicación frontend M6 → backend M6 (uso interno).
2. Casos justificados de consulta síncrona a otros módulos (por ejemplo, consulta de establecimiento a M4 antes de emitir un acta).
