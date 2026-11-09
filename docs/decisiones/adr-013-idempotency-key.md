# ADR-013: `Idempotency-Key` opcional en los POST de creación

## Estado

**Aceptado** — 2026-11-09

## Contexto

Un POST de creación que se reintenta (timeout, doble clic, red móvil) duplica el recurso. DEF-06 / #592: la cátedra pide que repetir el mismo POST con la misma `Idempotency-Key` cree un único recurso y devuelva la misma respuesta. Hoy solo `POST /evidence` lo resuelve (header obligatorio + unique `ownerType/ownerId/idempotencyKey`); no se toca. El contrato tiene que ser compatible hacia atrás: sin el header, nada cambia.

## Decisión

Header `Idempotency-Key` **opcional** en los POST de creación, implementado una sola vez en `IdempotencyInterceptor` y activado con `@Idempotent()` en cada handler (también agrega el header y los 409/422 al OpenAPI).

- **Formato**: 1 a 255 caracteres ASCII imprimibles; si no, 400.
- **Alcance**: `sub` del token + método + ruta real (con el id) + clave. Unique `(scope, key)` en la tabla `idempotency_record`.
- **Huella**: sha256 del body con las claves ordenadas (el orden de propiedades no cuenta).
- **Misma clave, mismo cuerpo, ya terminada**: se devuelve la respuesta guardada (mismo status y cuerpo) con `Idempotency-Replayed: true`, sin ejecutar el handler (no hay escrituras ni outbox).
- **Misma clave, otro cuerpo**: 422.
- **Misma clave con la primera en curso**: 409.
- Solo se guardan **2xx**; un error libera la clave (se puede reintentar corregido).
- **Carreras**: el `INSERT` inicial del registro `IN_PROGRESS` es atómico por el unique; solo un request lo gana.
- **Retención**: `IdempotencyRetentionSweeper` (cron diario, 3 AM) borra registros de más de 24 h.
- **CORS**: `allowedHeaders` no se fija (el preflight sigue reflejando los headers pedidos, así `Idempotency-Key` pasa); `Idempotency-Replayed` va en `exposedHeaders`.

### Endpoints incluidos

Altas de recursos de dominio y de catálogo (el duplicado cuesta caro o, sin unique, pasa silencioso): `/zones`, `/routes`, `/service-frequencies`, `/service-types`, `/disposal-sites`, `/crews`, `/vehicles`, `/services`, `/containers`, `/green-points`, `/green-spaces`, `/trees`, `/trees/:treeId/surveys`, `/tree-interventions`, `/environmental-reports`, `/environmental-reports/:reportId/inspections`, `/repair-requests`, `/street-closure-requests`, y los registros que cuelgan de un servicio: `/services/:id/zone-results`, `/collection-records`, `/delay-notices`.

### Endpoints excluidos

- `POST /evidence`: ya tiene su propia clave (obligatoria).
- `POST /events/inbox`: idempotente por `eventId`.
- Acciones y transiciones (`/start`, `/close`, `/approve`, `/complete`, `/authorize`, `/violation-notice`, `/events/outbox/*`...): la máquina de estados ya las hace seguras (un repetido da 409) y no crean un recurso nuevo.
- `/crews/:id/members`, `/crews/:id/zone-assignments`, `/zones/:id/neighborhoods`: no crean un recurso con identidad propia (agregan a un conjunto, ignoran duplicados o validan solapamiento).
- Públicos del portal (`/public/*`): sin principal autenticado, el alcance no existe; tienen su propio rate limit.

## Alternativas consideradas

- **Interceptor global para todo POST**: alcanza acciones que ya son seguras y el portal público; más superficie sin beneficio.
- **Lógica por service con constraint propio (como `/evidence`)**: una columna por tabla y código duplicado en ~20 services.
- **Cache en memoria / Redis**: se pierde al reiniciar (el free tier duerme el proceso) y no resuelve carreras entre instancias; Postgres ya está.
- **Registro dentro de la transacción de dominio** (atómico): obligaría a cada service a participar; descartado por el costo, ver limitación.

## Consecuencias

### Positivas

- Un reintento no duplica, y el cliente recibe la respuesta original.
- Una sola implementación; sumar un endpoint es una línea.

### Negativas

- **Limitación conocida: el registro de la respuesta no es atómico con la transacción de dominio.** Si el proceso cae después de crear el recurso y antes de guardar la respuesta, queda un registro `IN_PROGRESS` y el recurso creado. Un registro `IN_PROGRESS` de más de **60 s** se considera abandonado y el reintento lo retoma (ejecuta de nuevo): en ese caso el duplicado es posible, y lo frenan solo los `unique` de negocio (`code`, etc.). Dentro de los 60 s el reintento recibe 409.
- Una escritura más por request con clave, y el cuerpo de la respuesta se guarda como JSON (24 h).
- Solo se guarda lo que entra a un 2xx: un handler que responde 2xx y falla al serializar queda como arriba.

### Neutras

- Migración aditiva `idempotency_record`; sin datos existentes tocados.
- Para el frontend: mandar `Idempotency-Key` (UUID por intento de creación) es opcional; ver `docs/api/endpoints.md`.

## Referencias

- Issue #592 (DEF-06)
- `src/common/idempotency/`
- `POST /evidence`: `src/modules/attachments`
