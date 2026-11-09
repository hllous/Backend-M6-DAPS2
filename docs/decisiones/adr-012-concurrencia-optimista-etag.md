# ADR-012: Concurrencia optimista con ETag e If-Match

## Estado

**Aceptado** — 2026-11-09 (issue [#591](https://github.com/hllous/Backend-M6-DAPS2/issues/591), DEF-05). La cátedra pide 412 ante una actualización concurrente con un ETag desactualizado.

## Contexto

Dos operadores pueden tener abierto el mismo contenedor, servicio, intervención o expediente y accionar sobre una versión vieja. Las transiciones ya tenían un guard de estado (`where: { status }` → 409), pero no detectaban que el recurso había cambiado por otra vía (datos, cuadrilla, motivo) sin cambiar de estado.

## Decisión

- **ETag débil derivado de `updatedAt`**: `W/"<epoch ms>"`. Los cuatro modelos tienen `updatedAt @updatedAt` (precisión de milisegundos), así que no hace falta una columna de versión ni una migración.
- **`GET /{recurso}/:id` y toda respuesta de transición/`PATCH` sobre `:id`** devuelven `ETag` (interceptor `ETagInterceptor`, que solo actúa si el cuerpo es el recurso de la ruta). Alcance: `containers`, `services`, `tree-interventions` y `environmental-reports`.
- **`If-Match` es opcional** en las transiciones de estado de esos cuatro recursos y en los dos `PATCH` de edición de datos que existen: `PATCH /containers/:id` y `PATCH /services/:id`. Sin el header, o con `*`, el comportamiento es el de siempre. Con un ETag que no coincide: **412 Precondition Failed**. Se compara de forma débil (se ignora `W/`) y se acepta una lista separada por comas.
- **Atómico con la escritura**: `ifMatchWhere()` (`src/common/etag.ts`) valida contra la fila ya leída y devuelve `{ updatedAt }`, que el service agrega al `where` del UPDATE dentro de la misma `$transaction` que el outbox, el historial y la auditoría. Si otro request escribió entre la lectura y el UPDATE, no hay fila (P2025) y se traduce a 412: no se escribe nada ni se encola ningún evento. Con `If-Match` presente, un P2025 es siempre «versión vieja» porque cualquier escritura mueve `updatedAt`.
- El 412 se evalúa antes que la validez de la transición: un ETag viejo sobre una transición inválida da 412, uno vigente sigue dando 409.
- **CORS**: `exposedHeaders: ['ETag']`. `allowedHeaders` no se fija; se refleja lo que pide el preflight, así que `If-Match` ya pasa.
- **OpenAPI**: decorador `@ApiETag({ ifMatch })` documenta el header `ETag` en los 2xx, el parámetro `If-Match` y el 412.

## Consecuencias

- Retrocompatible: ningún cliente actual está obligado a mandar el header.
- `tree-interventions` y `environmental-reports` no tienen `PATCH` de edición, así que su única escritura sobre `:id` son las transiciones.
- No cubre: `assign-service`, `assign-crew`, `request-information`, `delay-notices`, `zone-results`, `collection-records` ni las inspecciones; tampoco los recursos sin ETag. Se agregan con el mismo helper si se piden.
- Una escritura de otro módulo en la misma fila (p. ej. `applyTransition` del expediente desde una inspección) también mueve `updatedAt` y por lo tanto invalida los ETags en circulación: es lo correcto.
- Express agrega su propio ETag (hash del cuerpo) a las respuestas que no pasan por el interceptor, como los listados; no es nuestro y no sirve para `If-Match`.
- Si `updatedAt` se tocara sin cambio visible, el cliente recibe un 412 espurio: debe releer y reintentar.
