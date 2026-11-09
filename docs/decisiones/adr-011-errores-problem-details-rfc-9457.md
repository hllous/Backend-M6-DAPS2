# ADR-011: Errores en Problem Details (RFC 9457) con los campos históricos como extensión

## Estado

**Aceptado** — 2026-11-09 (issue [#590](https://github.com/hllous/Backend-M6-DAPS2/issues/590), DEF-10).

## Contexto

La cátedra pide errores en formato Problem Details (RFC 9457, `application/problem+json`). Hasta ahora el filtro global devolvía `application/json` con `statusCode`, `message`, `error`, `code?`, `timestamp` y `path` (`docs/api/estandar-swagger.md` §5.3), y el frontend y varios tests ya dependen de esos campos.

## Decisión

El `HttpExceptionFilter` responde todo error con `Content-Type: application/problem+json` y los campos RFC 9457: `type` (`about:blank`), `title` (frase estándar del status), `status`, `detail` (el mensaje; un arreglo de validación va unido con `; `) e `instance` (la ruta, con `redactUrl`). Los campos históricos (`statusCode`, `message`, `error`, `timestamp`, `path`) se conservan como extensiones, con los mismos valores que antes. `code` también es una extensión, pero **opcional**: solo aparece en algunos errores (`ROLE_REQUIRED`, `NOT_ASSIGNED`). El mapeo de Prisma (P2025→404, P2002→409, P2003→404) y el 500 genérico sin stack no cambian.

Errores previos al router: un JSON mal formado ya salía por el filtro (400); un cuerpo sobre el límite del body-parser (413) caía en el 500 genérico. El filtro ahora respeta el status 4xx de los errores de body-parser (`http-errors` con `expose`), con el mismo formato.

En OpenAPI, `createOpenApiDocument()` (`src/swagger-config.ts`, usado por `main.ts`, `openapi:generate` y `openapi-contract.spec.ts`) reescribe a `application/problem+json` el media type de toda respuesta 4xx/5xx. `ErrorResponseDto` suma los campos RFC.

## Alternativas consideradas

- **Reemplazar los campos históricos por los del RFC**: rompe al frontend y a los tests; descartado. Se retirarán en otro ADR cuando el frontend migre a `detail`/`status`.
- **Declarar el media type en cada `@ApiResponse`**: ~700 respuestas de error a mano; descartado por el post-proceso central.
- **Tipos propios por error (`type` con URI)**: no hay catálogo todavía; `about:blank` es válido según el RFC. El `code` estable cumple ese rol por ahora.

## Consecuencias

- Los clientes que fuerzan `Accept: application/json` y validan el `Content-Type` de los errores deben aceptar `application/problem+json` (axios/fetch lo parsean igual con `res.json()`).
- `detail` e `instance` duplican `message` y `path` mientras convivan los dos formatos.
