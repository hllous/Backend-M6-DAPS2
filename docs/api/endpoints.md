# Endpoints REST de M6

**Este archivo es un mapa, no el contrato.** Es una tabla resumen: dice qué hace cada endpoint y por qué, no la forma exacta de sus DTO.

El **contrato autoritativo** es [`openapi.json`](openapi.json), generado desde el código con `npm run openapi:generate` y versionado en el repo. Ahí están los request y response completos, con required/optional, enums, formatos y ejemplos — que es lo que necesita un consumidor para generar tipos o validar con Zod. El CI falla si queda desactualizado respecto del código.

El mismo documento se sirve interactivo en `/api/docs`, pero el JSON del repo se lee sin levantar nada y se difea en un PR.

> 152 operaciones sobre 103 rutas, agrupadas en 29 tags de Swagger (cuenta contrastada contra `openapi.json`).

## Convenciones

Todas descriptas en [`estandar-swagger.md`](estandar-swagger.md). Lo mínimo para leer esta tabla:

- **Autenticación**: todo exige `Authorization: Bearer <JWT>` salvo lo marcado como público. El `JwtAuthGuard` está registrado como guard global, así que un endpoint nuevo nace protegido; los públicos se marcan explícitamente con `@Public()`. **Solo personal municipal**: el guard exige `sub_type: EMPLEADO`; un token válido de ciudadano (`sub_type: CIUDADANO`) recibe **403** (`Este sistema es solo para personal municipal`) en todo endpoint no público, incluido `POST /events/inbox`. Sin token o con token inválido sigue siendo 401. Ver [ADR-002](../decisiones/adr-002-auth-provisoria.md).
- **Autorización por rol**: el `RolesGuard` es global, después del `JwtAuthGuard` ([ADR-008](../decisiones/adr-008-roles-m6-adaptados-desde-m1.md)). Cada escritura declara `@Roles` (tabla "Rol requerido por endpoint" de abajo); sin el rol, **403** con `code: "ROLE_REQUIRED"`. Un GET sin `@Roles` exige cualquier rol de M6 (el auditor incluido): un empleado sin ningún rol de M6 recibe 403 también en lectura, salvo en `GET /me`. Una escritura sin `@Roles` se rechaza para todos. Los roles de M6 son efectivos = asignados por un `M6_ADMIN` ∩ lo que permite el rol de M1; se leen por request (`GET /me` los muestra). No aplica a los `@Public()` (`health` y los cuatro de `citizen-portal`): esos ni siquiera piden JWT.
- **Listados**: paginados con `?page` (default 1) y `?pageSize` (default 20, máx 100). Devuelven `{ data: [...], meta: { total, page, pageSize, totalPages } }`.
- **Booleanos**: en filtros (`?active=`) y en bodies se acepta `true` o `false`, sin distinguir mayúsculas. Cualquier otro valor (`0`, `1`, vacío, `maybe`) da 400.
- **Listas en el query**: con clave repetida (`?status=A&status=B`) o separadas por coma, según el endpoint. Desde NestJS 12 (Express 5, parser `simple`) la sintaxis con corchetes (`?status[]=A`, `?a[b]=x`) **no** arma arrays ni objetos: llega como propiedad no declarada y da 400 (antes, `status[]=A` daba 200). #628
- **Textos**: `code`, `name`, `plate` y `surveyCode` se recortan (bordes) antes de validar y guardar. Un valor que quede vacío (solo espacios) da 400. Lo mismo vale para los textos obligatorios de motivo y dirección (`reason`, `address` de reubicación, `streetName`, `fromCross`, `toCross`, `itemCode`, `label`). Cualquier string con el carácter nulo (`\u0000`) en body o query, a cualquier profundidad, da 400 (Postgres no lo acepta).
- **Rangos numéricos**: todo número de entrada tiene tope según su columna, y fuera de rango da 400 con el mensaje del campo. `lat` va de -90 a 90 y `lng` de -180 a 180, y ambos admiten hasta 7 decimales (con más da 400); `capacityLiters` hasta 2.147.483.647; `capacity`, `areaM2`, `weightKg` y `volumeM3` hasta 99.999.999,99; `heightM` hasta 999,99; `diameterCm` hasta 9999,9; `page` hasta 10.000.000. Pesos y capacidades no pueden ser negativos. Los mismos rangos figuran como `minimum`/`maximum` en el swagger (`openapi.json`); un test falla si un campo con `@Min`/`@Max` no los declara.
- **Tope de tamaño**: `search` admite hasta 100 caracteres; los ids externos (`ticketId`, `publicId`, `weatherAlertId`, `leaderUserId`, `organizationId`, `authorizedByUserId`, `inspectorId`, `eventId` y cada elemento de `userIds` y `neighborhoodIds`) hasta 100; en el sobre del bus, `eventType` hasta 120, `sourceModule` hasta 60 y `eventVersion` hasta 20 (los topes del Core); `reason` de un aviso de demora hasta 500 y `notes` de un servicio y `description` de un expediente hasta 2000. Los arrays (`userIds`, `neighborhoodIds`, `treeIds`, `wasteTypes`) admiten hasta 100 elementos. Pasarse da 400.
- **Errores**: `{ statusCode, message, error, timestamp, path }`.
- **Concurrencia optimista ([ADR-012](../decisiones/adr-012-concurrencia-optimista-etag.md), #591)**: `GET /:id` de `containers`, `services`, `tree-interventions` y `environmental-reports` devuelve `ETag` (débil, `W/"<ms de updatedAt>"`), y las respuestas de sus transiciones de estado devuelven el ETag nuevo. Esas transiciones (`report-overflow`, `report-damage`, `empty`, `start-repair`, `complete-repair`, `relocate`, `confirm-relocation`, `remove`; `start`, `suspend`, `resume`, `complete`, `cancel`, `reschedule`, `confirm-reschedule`; `submit-for-authorization`, `authorize`, `reject`; `start-review`, `forward`, `dismiss`, `close`) aceptan el header opcional `If-Match`: si no coincide con el ETag actual, **412** y no se escribe nada; con `*` o sin header se aplica como siempre. El 412 se evalúa antes que el 409 de transición inválida. También validan `If-Match` los dos `PATCH` de edición: `PATCH /containers/:id` y `PATCH /services/:id`. `tree-interventions` y `environmental-reports` no tienen `PATCH` de edición.
- **`Idempotency-Key` (opcional, [ADR-013](../decisiones/adr-013-idempotency-key.md))**: en los POST de creación (`/zones`, `/routes`, `/service-frequencies`, `/service-types`, `/disposal-sites`, `/crews`, `/vehicles`, `/services`, `/containers`, `/green-points`, `/green-spaces`, `/trees`, `/trees/:treeId/surveys`, `/tree-interventions`, `/environmental-reports`, `/environmental-reports/:reportId/inspections`, `/repair-requests`, `/street-closure-requests`, `/services/:id/{zone-results,collection-records,delay-notices}`). 1 a 255 caracteres imprimibles (400 si no). Misma clave y mismo cuerpo: misma respuesta (status y cuerpo) con `Idempotency-Replayed: true`, sin crear nada; otro cuerpo: **422**; la primera todavía en curso: **409**. Alcance: usuario + método + ruta; solo se guardan 2xx; vale 24 h. Sin el header, el comportamiento no cambia. `POST /evidence` conserva su propio header, obligatorio. Límite: el guardado de la respuesta no es atómico con la transacción de dominio (ver el ADR).
- **CORS**: los orígenes permitidos salen de `CORS_ORIGINS`. Sin esa variable se acepta cualquiera, que es lo que hace falta en desarrollo; en producción es obligatoria y el backend no arranca sin ella (#642). Cada entrada tiene que ser un origen exacto (sin path ni barra final, ni `*` ni `null`; `https://` en producción) o el backend no arranca. El JWT viaja en un header y no en una cookie, así que esto no cierra un CSRF — es higiene, no un límite de seguridad.
- **Tags**: cada recurso tiene su propio tag en Swagger UI, y los 29 tags están declarados en `src/swagger-config.ts` en orden de lectura — primero sobre qué se programa, después la operación, después el inventario.
- **Baja**: es lógica (`active = false`) en todos los catálogos e inventarios. `DELETE` devuelve 204 y el registro sigue existiendo. La excepción está anotada donde corresponde.

## Rol requerido por endpoint

Tabla generada desde `@Roles`/`@Public` (`npm run docs:roles`); un spec falla si queda desactualizada. "Cualquier rol de M6" = un GET sin `@Roles`: lo pueden todos los roles de M6, el auditor incluido, pero no un empleado sin roles. Una escritura sin `@Roles` se rechaza para todos.

<!-- roles:start (generado por npm run docs:roles, no editar a mano) -->

| Método | Ruta | Rol |
| --- | --- | --- |
| GET | `/audit` | `M6_ADMIN`, `M6_AUDITOR` |
| GET | `/communes` | cualquier rol de M6 |
| GET | `/containers` | cualquier rol de M6 |
| POST | `/containers` | `M6_ADMIN`, `M6_OFICINA_OPERACIONES` |
| GET | `/containers/:id` | cualquier rol de M6 |
| PATCH | `/containers/:id` | `M6_ADMIN`, `M6_OFICINA_OPERACIONES` |
| POST | `/containers/:id/complete-repair` | `M6_ADMIN`, `M6_OFICINA_OPERACIONES` |
| POST | `/containers/:id/confirm-relocation` | `M6_ADMIN`, `M6_OFICINA_OPERACIONES` |
| POST | `/containers/:id/empty` | `M6_CAMPO_CUADRILLA` |
| GET | `/containers/:id/history` | cualquier rol de M6 |
| POST | `/containers/:id/relocate` | `M6_ADMIN`, `M6_OFICINA_OPERACIONES` |
| POST | `/containers/:id/remove` | `M6_ADMIN`, `M6_OFICINA_OPERACIONES` |
| POST | `/containers/:id/report-damage` | `M6_CAMPO_CUADRILLA` |
| POST | `/containers/:id/report-overflow` | `M6_CAMPO_CUADRILLA` |
| POST | `/containers/:id/start-repair` | `M6_ADMIN`, `M6_OFICINA_OPERACIONES` |
| GET | `/crews` | cualquier rol de M6 |
| POST | `/crews` | `M6_ADMIN` |
| DELETE | `/crews/:id` | `M6_ADMIN` |
| GET | `/crews/:id` | cualquier rol de M6 |
| PATCH | `/crews/:id` | `M6_ADMIN` |
| POST | `/crews/:id/members` | `M6_ADMIN` |
| DELETE | `/crews/:id/members/:userId` | `M6_ADMIN` |
| GET | `/crews/:id/zone-assignments` | cualquier rol de M6 |
| POST | `/crews/:id/zone-assignments` | `M6_ADMIN`, `M6_OFICINA_OPERACIONES` |
| GET | `/disposal-sites` | cualquier rol de M6 |
| POST | `/disposal-sites` | `M6_ADMIN` |
| DELETE | `/disposal-sites/:id` | `M6_ADMIN` |
| GET | `/disposal-sites/:id` | cualquier rol de M6 |
| PATCH | `/disposal-sites/:id` | `M6_ADMIN` |
| GET | `/environmental-inspections/:id` | cualquier rol de M6 |
| POST | `/environmental-inspections/:id/complete` | `M6_CAMPO_INSPECTOR` |
| GET | `/environmental-inspections/:id/violation-notice` | `M6_ADMIN`, `M6_OFICINA_AMBIENTAL`, `M6_CAMPO_INSPECTOR`, `M6_AUDITOR` |
| POST | `/environmental-inspections/:id/violation-notice` | `M6_ADMIN`, `M6_OFICINA_AMBIENTAL` |
| GET | `/environmental-reports` | cualquier rol de M6 |
| POST | `/environmental-reports` | `M6_ADMIN`, `M6_OFICINA_AMBIENTAL`, `M6_CAMPO_INSPECTOR` |
| GET | `/environmental-reports/:id` | cualquier rol de M6 |
| POST | `/environmental-reports/:id/close` | `M6_ADMIN`, `M6_OFICINA_AMBIENTAL` |
| POST | `/environmental-reports/:id/dismiss` | `M6_ADMIN`, `M6_OFICINA_AMBIENTAL` |
| POST | `/environmental-reports/:id/forward` | `M6_ADMIN`, `M6_OFICINA_AMBIENTAL` |
| POST | `/environmental-reports/:id/request-information` | `M6_ADMIN`, `M6_OFICINA_AMBIENTAL` |
| POST | `/environmental-reports/:id/start-review` | `M6_ADMIN`, `M6_OFICINA_AMBIENTAL` |
| GET | `/environmental-reports/:reportId/inspections` | cualquier rol de M6 |
| POST | `/environmental-reports/:reportId/inspections` | `M6_ADMIN`, `M6_OFICINA_AMBIENTAL` |
| GET | `/events/handlers` | cualquier rol de M6 |
| GET | `/events/inbox` | `M6_ADMIN`, `M6_AUDITOR` |
| POST | `/events/inbox` | `M6_ADMIN` |
| GET | `/events/inbox/:messageId` | `M6_ADMIN` |
| GET | `/events/outbox` | `M6_ADMIN`, `M6_AUDITOR` |
| GET | `/events/outbox/:id` | `M6_ADMIN` |
| POST | `/events/outbox/:id/retry` | `M6_ADMIN` |
| POST | `/events/outbox/retry-failed` | `M6_ADMIN` |
| GET | `/evidence` | `M6_ADMIN`, `M6_OFICINA_OPERACIONES`, `M6_OFICINA_AMBIENTAL`, `M6_AUDITOR`, `M6_CAMPO_CUADRILLA`, `M6_CAMPO_INSPECTOR` |
| POST | `/evidence` | `M6_CAMPO_CUADRILLA`, `M6_CAMPO_INSPECTOR` |
| GET | `/green-points` | cualquier rol de M6 |
| POST | `/green-points` | `M6_ADMIN`, `M6_OFICINA_OPERACIONES` |
| DELETE | `/green-points/:id` | `M6_ADMIN`, `M6_OFICINA_OPERACIONES` |
| GET | `/green-points/:id` | cualquier rol de M6 |
| PATCH | `/green-points/:id` | `M6_ADMIN`, `M6_OFICINA_OPERACIONES` |
| GET | `/green-spaces` | cualquier rol de M6 |
| POST | `/green-spaces` | `M6_ADMIN`, `M6_OFICINA_OPERACIONES` |
| DELETE | `/green-spaces/:id` | `M6_ADMIN`, `M6_OFICINA_OPERACIONES` |
| GET | `/green-spaces/:id` | cualquier rol de M6 |
| PATCH | `/green-spaces/:id` | `M6_ADMIN`, `M6_OFICINA_OPERACIONES` |
| GET | `/health` | público |
| GET | `/health/ready` | público |
| GET | `/indicators/compliance` | cualquier rol de M6 |
| GET | `/indicators/coverage` | cualquier rol de M6 |
| GET | `/indicators/incidents` | cualquier rol de M6 |
| GET | `/indicators/waste` | cualquier rol de M6 |
| GET | `/me` | cualquier empleado |
| GET | `/neighborhoods` | cualquier rol de M6 |
| GET | `/public/green-points` | público |
| GET | `/public/reports/:ticketId` | público |
| GET | `/public/services` | público |
| GET | `/public/zones` | público |
| GET | `/repair-requests` | cualquier rol de M6 |
| POST | `/repair-requests` | `M6_ADMIN`, `M6_OFICINA_OPERACIONES` |
| GET | `/repair-requests/:id` | cualquier rol de M6 |
| POST | `/repair-requests/:id/close` | `M6_ADMIN` |
| POST | `/repair-requests/:id/start` | `M6_ADMIN` |
| GET | `/role-assignments` | `M6_ADMIN` |
| DELETE | `/role-assignments/:userId` | `M6_ADMIN` |
| GET | `/role-assignments/:userId` | `M6_ADMIN` |
| PUT | `/role-assignments/:userId` | `M6_ADMIN` |
| GET | `/routes` | cualquier rol de M6 |
| POST | `/routes` | `M6_ADMIN` |
| DELETE | `/routes/:id` | `M6_ADMIN` |
| GET | `/routes/:id` | cualquier rol de M6 |
| PATCH | `/routes/:id` | `M6_ADMIN` |
| PUT | `/routes/:id/stops` | `M6_ADMIN` |
| GET | `/service-frequencies` | cualquier rol de M6 |
| POST | `/service-frequencies` | `M6_ADMIN` |
| DELETE | `/service-frequencies/:id` | `M6_ADMIN` |
| GET | `/service-frequencies/:id` | cualquier rol de M6 |
| PATCH | `/service-frequencies/:id` | `M6_ADMIN` |
| GET | `/service-types` | cualquier rol de M6 |
| POST | `/service-types` | `M6_ADMIN` |
| DELETE | `/service-types/:id` | `M6_ADMIN` |
| GET | `/service-types/:id` | cualquier rol de M6 |
| PATCH | `/service-types/:id` | `M6_ADMIN` |
| GET | `/services` | cualquier rol de M6 |
| POST | `/services` | `M6_ADMIN`, `M6_OFICINA_OPERACIONES` |
| GET | `/services/:id` | cualquier rol de M6 |
| PATCH | `/services/:id` | `M6_ADMIN`, `M6_OFICINA_OPERACIONES` |
| POST | `/services/:id/assign-crew` | `M6_ADMIN`, `M6_OFICINA_OPERACIONES` |
| GET | `/services/:id/assignment-conflicts` | cualquier rol de M6 |
| POST | `/services/:id/cancel` | `M6_ADMIN`, `M6_OFICINA_OPERACIONES` |
| GET | `/services/:id/collection-records` | cualquier rol de M6 |
| POST | `/services/:id/collection-records` | `M6_CAMPO_CUADRILLA` |
| POST | `/services/:id/complete` | `M6_CAMPO_CUADRILLA` |
| POST | `/services/:id/confirm-reschedule` | `M6_ADMIN`, `M6_OFICINA_OPERACIONES` |
| GET | `/services/:id/delay-notices` | cualquier rol de M6 |
| POST | `/services/:id/delay-notices` | `M6_CAMPO_CUADRILLA` |
| POST | `/services/:id/reschedule` | `M6_ADMIN`, `M6_OFICINA_OPERACIONES` |
| POST | `/services/:id/resume` | `M6_CAMPO_CUADRILLA` |
| POST | `/services/:id/start` | `M6_CAMPO_CUADRILLA` |
| POST | `/services/:id/suspend` | `M6_CAMPO_CUADRILLA` |
| GET | `/services/:id/zone-results` | cualquier rol de M6 |
| POST | `/services/:id/zone-results` | `M6_CAMPO_CUADRILLA` |
| GET | `/street-closure-requests` | cualquier rol de M6 |
| POST | `/street-closure-requests` | `M6_ADMIN`, `M6_OFICINA_OPERACIONES` |
| GET | `/street-closure-requests/:id` | cualquier rol de M6 |
| POST | `/street-closure-requests/:id/approve` | `M6_ADMIN` |
| POST | `/street-closure-requests/:id/end` | `M6_ADMIN` |
| POST | `/street-closure-requests/:id/reject` | `M6_ADMIN` |
| GET | `/tree-interventions` | cualquier rol de M6 |
| POST | `/tree-interventions` | `M6_ADMIN`, `M6_OFICINA_OPERACIONES` |
| GET | `/tree-interventions/:id` | cualquier rol de M6 |
| POST | `/tree-interventions/:id/assign-service` | `M6_ADMIN`, `M6_OFICINA_OPERACIONES` |
| POST | `/tree-interventions/:id/authorize` | `M6_ADMIN`, `M6_OFICINA_OPERACIONES` |
| POST | `/tree-interventions/:id/reject` | `M6_ADMIN`, `M6_OFICINA_OPERACIONES` |
| POST | `/tree-interventions/:id/submit-for-authorization` | `M6_ADMIN`, `M6_OFICINA_OPERACIONES` |
| GET | `/trees` | cualquier rol de M6 |
| POST | `/trees` | `M6_ADMIN`, `M6_OFICINA_OPERACIONES` |
| DELETE | `/trees/:id` | `M6_ADMIN`, `M6_OFICINA_OPERACIONES` |
| GET | `/trees/:id` | cualquier rol de M6 |
| PATCH | `/trees/:id` | `M6_ADMIN`, `M6_OFICINA_OPERACIONES` |
| GET | `/trees/:treeId/surveys` | cualquier rol de M6 |
| POST | `/trees/:treeId/surveys` | `M6_CAMPO_CUADRILLA` |
| GET | `/trees/:treeId/surveys/:surveyId` | cualquier rol de M6 |
| GET | `/vehicles` | cualquier rol de M6 |
| POST | `/vehicles` | `M6_ADMIN` |
| DELETE | `/vehicles/:id` | `M6_ADMIN` |
| GET | `/vehicles/:id` | cualquier rol de M6 |
| PATCH | `/vehicles/:id` | `M6_ADMIN` |
| GET | `/zones` | cualquier rol de M6 |
| POST | `/zones` | `M6_ADMIN` |
| DELETE | `/zones/:id` | `M6_ADMIN` |
| GET | `/zones/:id` | cualquier rol de M6 |
| PATCH | `/zones/:id` | `M6_ADMIN` |
| POST | `/zones/:id/neighborhoods` | `M6_ADMIN` |
| DELETE | `/zones/:id/neighborhoods/:neighborhoodId` | `M6_ADMIN` |

<!-- roles:end -->

### Pertenencia de Campo (#365, #394)

Tener el rol de Campo no alcanza: además hay que ser parte del objeto. Si no, `403` con `code: NOT_ASSIGNED` (el `ErrorResponse` estándar; no dice de quién es el objeto). Se chequea **después del 404 y antes de cualquier regla de estado**, así que un servicio sin cuadrilla da 403, no 409. Oficina (`M6_ADMIN`, Operaciones, Ambiental) no tiene restricciones: sus endpoints no chequean pertenencia.

| Quién | Endpoints | Pertenece si… |
|---|---|---|
| `M6_CAMPO_CUADRILLA` | `POST /services/:id/{start,suspend,resume,complete}`, `/zone-results`, `/collection-records`, `/delay-notices` | el usuario del token es **líder o integrante** de la cuadrilla del servicio. Sin cuadrilla asignada, nadie pertenece |
| `M6_CAMPO_INSPECTOR` | `POST /environmental-inspections/:id/complete` | es el `inspectorId` asignado; **sin inspector asignado, cualquier inspector** |
| Campo | `POST /evidence` | según `ownerType`: `SERVICE` y `ZONE_RESULT`, la cuadrilla del servicio; `INSPECTION`, el inspector asignado (o cualquiera si no hay); `CONTAINER` no tiene dueño de Campo |
| Campo | `GET /evidence` | Campo solo lee evidencia de dueños que le pertenecen: `SERVICE` y `ZONE_RESULT`, la cuadrilla del servicio; `INSPECTION`, el inspector asignado (o cualquiera si no hay); `CONTAINER`, cualquier contenedor existente. 404 si el dueño no existe, 403 `NOT_ASSIGNED` si es ajeno. No exige el rol propio del `ownerType` que sí pide el alta. Oficina, Admin y Auditoría leen cualquiera |

No filtra los listados: Campo sigue viendo todo en los `GET`; la pertenencia es solo de ejecución. Los nombres de personas (`leaderName`, `organizationName`, `displayName`) siguen esa regla: son una copia cargada a mano y los ve cualquier rol de M6, incluido Campo, así que no deben cargarse datos más allá del nombre. Igual el `reason` de las reubicaciones de zona (`/crews/:id/zone-assignments`): texto libre que lee cualquier rol de M6, sin datos sensibles. Los ids de `leaderUserId` y de integrantes (`POST /crews`, `PATCH /crews/:id`, `POST /crews/:id/members`) son ids numéricos de M1 (solo dígitos, hasta 19) y se normalizan sin ceros a la izquierda (`007` = `7`); `DELETE /crews/:id/members/:userId` **no** valida el formato, para poder quitar filas heredadas `usr-…`. Las cuadrillas con ids `usr-…` se migran con `npm run crews:migrate-user-ids` antes de activar la regla ([desplegar.md](../operacion/desplegar.md#migrar-las-cuadrillas-de-usr-a-ids-de-m1-365)).

---

## `health`

| Método | Ruta            | Qué hace                                                                                                                     |
| ------ | --------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/health`       | Liveness: el proceso responde. **Público**, no consulta la base (lo usa el keepalive).                                       |
| GET    | `/health/ready` | Readiness: `SELECT 1` con timeout de 3 s. **Público**. 200 `database: up` o 503 si la base no responde; usar para monitoreo. Incluye `broker` (`connected`, `reconnecting` o `disabled` sin `RABBITMQ_URL`): es informativo, un bus caído no da 503. |

## `auth` y `role-assignments` — identidad y roles de M6

| Método | Ruta                        | Rol        | Qué hace                                                                                                                                                                 |
| ------ | --------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET    | `/me`                       | cualquiera | `userId`, `subType`, `m1Role` (rol de M1 del token) y `roles` de M6 efectivos, más `crews` (`[{ id, name, role: LEADER \| MEMBER }]`: las cuadrillas propias, con la pertenencia de Campo; vacío para Oficina y auditoría) e `isAssignedInspector` (tiene el rol efectivo `M6_CAMPO_INSPECTOR`). Solo datos propios. El frontend usa esto en vez de deducir permisos del token |
| GET    | `/role-assignments`         | `M6_ADMIN` | Listado paginado de usuarios con roles asignados                                                                                                                         |
| GET    | `/role-assignments/:userId` | `M6_ADMIN` | Roles asignados al usuario (`[]` si no tiene). `:userId` es el id numérico de M1                                                                                         |
| PUT    | `/role-assignments/:userId` | `M6_ADMIN` | Reemplaza el conjunto de roles. 400: rol inexistente/repetido o mezcla Oficina (`M6_ADMIN`, `M6_OFICINA_*`) con Campo (`M6_CAMPO_*`). 409: quitaría el último `M6_ADMIN` |
| DELETE | `/role-assignments/:userId` | `M6_ADMIN` | Quita todos los roles (204, idempotente). Mismo 409 del último admin                                                                                                     |

Cada alta y baja escribe una fila de auditoría (`role_assignment_audit`, append-only) en la misma transacción. La asignación **no** se valida contra el rol de M1 del destinatario (M6 no tiene directorio de M1): rige al leer, por la intersección.

## `neighborhoods` — catálogo de barrios de M9

| Método | Ruta             | Descripción                                                                                                                                                                                  |
| ------ | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/neighborhoods` | Barrios del catálogo de M9 cacheados (se leen del Core al arrancar y cada 6 h). Filtros: `soloActivos`, `zona` (comuna), `q`. Sin paginar. 503 si el catálogo todavía no se pudo leer |

## `communes` — comunas

| Método | Ruta       | Descripción |
| ------ | ---------- | ----------- |
| GET    | `/communes` | Comunas con sus zonas y los barrios de cada zona (`codigo`/`nombre` de la caché de M9; sin catálogo solo el `id`). Filtro: `active`. Ordenadas por `number` (el N de `comuna-N`, entero). Sin paginar. Cualquier rol de M6 |

## `zones` — zonas operativas

| Método | Ruta                                       | Qué hace                                            |
| ------ | ------------------------------------------ | --------------------------------------------------- |
| POST   | `/zones`                                   | Crear zona operativa. `communeId` opcional (400 si la comuna no existe) |
| GET    | `/zones`                                   | Listar ordenado por número de comuna (1 a 15), luego por nombre; las zonas sin comuna al final. Con `commune {id, code, number, name}` y `neighborhood` (uno solo, el primero por id con UUID, aunque la zona tenga varios; el detalle trae todos en `neighborhoods[]`). Filtros: `active`, `search` (nombre), `communeId` |
| GET    | `/zones/:id`                               | Detalle, con los barrios asignados                  |
| PATCH  | `/zones/:id`                               | Actualizar nombre, estado y `communeId` (400 si la comuna no existe; `null` la desasigna). El código es inmutable |
| DELETE | `/zones/:id`                               | Baja lógica                                         |
| POST   | `/zones/:id/neighborhoods`                 | Asignar barrios (catálogo de M9). Ignora duplicados. Con el catálogo cargado, un `id` desconocido da 400 (un barrio dado de baja, `activo:false`, sigue siendo válido: en M9 nada se borra); sin catálogo se acepta con warning |
| DELETE | `/zones/:id/neighborhoods/:neighborhoodId` | Quitar un barrio                                    |

## `routes` — recorridos

| Método | Ruta                | Qué hace                                                                                                                                                                                                                                                                                                 |
| ------ | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/routes`           | Crear recorrido. Nace sin paradas                                                                                                                                                                                                                                                                        |
| GET    | `/routes`           | Listar, con las paradas en orden (mismo formato que el detalle). Filtros: `active`, `zoneId` (recorridos que pasan por la zona), `search`                                                                                                                                                                |
| GET    | `/routes/:id`       | Detalle con la secuencia de paradas, en orden                                                                                                                                                                                                                                                            |
| PATCH  | `/routes/:id`       | Actualizar nombre y estado                                                                                                                                                                                                                                                                               |
| DELETE | `/routes/:id`       | Baja lógica                                                                                                                                                                                                                                                                                              |
| PUT    | `/routes/:id/stops` | **Reemplaza la secuencia completa de paradas.** Cubre alta, baja y reordenamiento en una sola llamada atómica: el orden del array es el orden del recorrido. Una zona no puede repetirse (400) — rompería `ServiceZone` cuando un servicio copie el recorrido. Array vacío deja el recorrido sin paradas |

## `service-frequencies` — frecuencias

| Método | Ruta                       | Qué hace                                                                                                                                                                                                                        |
| ------ | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/service-frequencies`     | Crear la regla que genera los servicios planificados. El tipo de servicio tiene que ser de modo `ROUTE` (400 si no). **409** si se superpone con otra regla del mismo recorrido, tipo y turno que comparta algún día y vigencia |
| GET    | `/service-frequencies`     | Listar. Filtros: `serviceTypeId`, `routeId`, `shift`, `weekday` (1=Lunes…7=Domingo), `validOn` (reglas vigentes en esa fecha)                                                                                                   |
| GET    | `/service-frequencies/:id` | Detalle, con los días de la semana                                                                                                                                                                                              |
| PATCH  | `/service-frequencies/:id` | Actualizar días, turno y vigencia. El array de días reemplaza el conjunto completo. El tipo y el recorrido son inmutables. **409** si el cambio la superpone con otra regla                                                     |
| DELETE | `/service-frequencies/:id` | **Cierra la vigencia** (`validTo = hoy`), no marca `active`: el modelo no tiene esa columna y el dominio ya expresa la baja con `validTo`. Si la regla todavía no empezó a regir, se cierra en su `validFrom`                   |

> **Limitación conocida.** El chequeo de solapamiento se hace en el service (`assertNoOverlap`) y no hay una restricción en la base que lo respalde: es un rango de fechas y un `@unique` no lo expresa. Dos requests simultáneos que crean o modifican reglas que se pisan podrían pasar los dos. Cerrarlo requiere una migración con una restricción de exclusión (`EXCLUDE USING gist`) o un bloqueo por recorrido; queda pendiente hasta que sea un problema real.

## `service-types` — catálogo de tipos de servicio

| Método | Ruta                 | Qué hace                                                                                                                                 |
| ------ | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/service-types`     | Crear tipo de servicio                                                                                                                   |
| GET    | `/service-types`     | Listar. Filtros: `active`, `category`, `mode`, `search`                                                                                  |
| GET    | `/service-types/:id` | Detalle                                                                                                                                  |
| PATCH  | `/service-types/:id` | Actualizar nombre, `requiresVehicle` y estado. `code`, `category` y `mode` son inmutables: hay servicios ya programados que los copiaron |
| DELETE | `/service-types/:id` | Baja lógica                                                                                                                              |

## `disposal-sites` — sitios de disposición final

| Método | Ruta                  | Qué hace                                                       |
| ------ | --------------------- | -------------------------------------------------------------- |
| POST   | `/disposal-sites`     | Crear sitio de disposición final                               |
| GET    | `/disposal-sites`     | Listar. Filtros: `active`, `siteType`, `search`                |
| GET    | `/disposal-sites/:id` | Detalle                                                        |
| PATCH  | `/disposal-sites/:id` | Actualizar nombre, tipo y estado                               |
| DELETE | `/disposal-sites/:id` | Baja lógica. Los `CollectionRecord` ya cargados lo referencian |

## `crews` — cuadrillas

| Método | Ruta                         | Qué hace                                              |
| ------ | ---------------------------- | ----------------------------------------------------- |
| POST   | `/crews`                     | Crear cuadrilla (`leaderUserId` se valida contra M1: 422 si no existe o está inactivo, 503 si M1 no responde; sin `M1_BASE_URL` no se valida, [ADR-009](../decisiones/adr-009-rest-m6-a-m1-consultas-de-identidad.md); sin `leaderName` se usa el nombre de M1). `specialty` es obligatoria (`COLLECTION`, `SWEEPING`, `CLEANING`, `RECYCLING`, `TREES`, `GREEN_SPACES`, `INSPECTION`); `homeZoneId` (zona base, una sola), `leaderName` y `organizationName` son opcionales |
| GET    | `/crews`                     | Listar, con `membersCount` y `effectiveZoneId`. Filtros: `active`, `crewType`, `defaultShift`, `specialty`, `zoneId` (zona **efectiva hoy**: la reubicación vigente y, si no hay, la base) |
| GET    | `/crews/:id`                 | Detalle, con los integrantes y sus nombres            |
| PATCH  | `/crews/:id`                 | Actualizar (también `specialty`, `homeZoneId` y los nombres; `null` los borra). Un `leaderUserId` distinto del guardado se valida contra M1 (422 / 503) |
| DELETE | `/crews/:id`                 | Baja lógica                                           |
| POST   | `/crews/:id/members`         | Agregar integrantes: `members: [{ userId, displayName? }]` o, por compatibilidad, `userIds`. Un integrante que ya estaba solo se toca si trae nombre; los nuevos se validan contra M1 (422 / 503, igual que el líder) y sin `displayName` se guarda el de M1 |
| DELETE | `/crews/:id/members/:userId` | Quitar un integrante                                  |
| POST   | `/crews/:id/zone-assignments` | Reubicar la cuadrilla en otra zona entre `validFrom` y `validTo` (inclusive; sin `validTo`, hasta nuevo aviso). El actor sale del token. 409 si el período se pisa con otra reubicación; 400 si `validTo < validFrom` o la zona está de baja |
| GET    | `/crews/:id/zone-assignments` | Historial de reubicaciones, la más reciente primero   |

Los nombres (`leaderName`, `organizationName`, `displayName`) son una **copia** de lo que M1 sabe: M6 no consulta a M1 para mostrarlos, y un id sin nombre sigue funcionando (el campo viene `null`). La especialidad de una cuadrilla anterior a #455 puede ser `null`.

## `vehicles` — vehículos

| Método | Ruta            | Qué hace                                 |
| ------ | --------------- | ---------------------------------------- |
| POST   | `/vehicles`     | Registrar vehículo                       |
| GET    | `/vehicles`     | Listar. Filtros: `active`, `vehicleType` |
| GET    | `/vehicles/:id` | Detalle                                  |
| PATCH  | `/vehicles/:id` | Actualizar                               |
| DELETE | `/vehicles/:id` | Baja lógica                              |

## `services` — programación y ejecución

`Service` es la unidad de trabajo programable del módulo: recolección, barrido, lavado, vaciado de contenedor, poda y riego son todos un servicio. Lo que varía es sobre qué se ejecuta — un recorrido de zonas (`ROUTE`) o un objetivo puntual (`POINT`).

| Método | Ruta                                 | Qué hace                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------ | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/services`                          | Programar. El **modo se copia del `ServiceType`**, no se elige. Un `ROUTE` exige recorrido y copia sus zonas como snapshot; un `POINT` se ubica por el bien del inventario (`targetType` + `targetId`) o por una `zoneId` suelta. `origin = TICKET` exige `ticketId`, y ningún otro origen lo admite. `inspectionId` solo con `origin = INSPECTION` (el vínculo se escribe en la inspección; 404 si no existe, 409 si ya tiene servicio o ya fue cerrada, 400 si el tipo no es `POINT`) y `weatherAlertId` solo con `origin = WEATHER_ALERT`; ninguno es obligatorio. Si trae `crewId`/`vehicleId` ya tomados ese día en una franja que se pisa, o una `crewId` que no trabaja en la zona del servicio ese día o cuya especialidad no corresponde al tipo, **409** salvo que venga `overrideNote` (mismo criterio que `assign-crew`). Nace en `SCHEDULED` |
| GET    | `/services`                          | Listar. Filtros: `status`, `serviceTypeId`, `mode`, `origin`, `crewId`, `vehicleId`, `zoneId`, `targetType`, `targetId` (combinables o `targetId` solo), `ticketId`, `scheduledFrom`, `scheduledTo` (400 si `scheduledFrom` es posterior)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| GET    | `/services/:id`                      | Detalle con zonas, resultados por zona y registros de recolección                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| PATCH  | `/services/:id`                      | Corregir vehículo, ventana horaria y notas, **solo antes de iniciar**. Si el vehículo o la ventana nuevos se solapan con otro servicio de la misma cuadrilla o vehículo ese día, devuelve 409; con `overrideNote` (10-500 caracteres) se acepta y queda guardada con quién y cuándo (mismo criterio que `assign-crew`). El tipo, el modo, el recorrido, el objetivo y las zonas quedan fijos al programar                                                                                                                                                                                                                                                                                                                                       |
| POST   | `/services/:id/assign-crew`          | Asignar cuadrilla, y vehículo en la misma operación. **El solapamiento avisa, no bloquea**: si la cuadrilla o el vehículo ya están tomados ese día en una franja que se pisa, devuelve 409 nombrando los servicios; con `overrideNote` (10-500 caracteres) la asignación se hace igual y la nota queda guardada con quién y cuándo. **Lo mismo si la cuadrilla no trabaja en la zona del servicio ese día (zona efectiva en la fecha del servicio) o su especialidad no corresponde al tipo** (mapa en `src/modules/crews/crew-specialty.ts`); sin zona o especialidad cargadas no avisa                                                                                                                                                                                                                                                                                                                                                                                                              |
| GET    | `/services/:id/assignment-conflicts` | Con qué se solapa asignar `crewId` / `vehicleId`, **antes** de enviar. Sin parámetros evalúa los que el servicio ya tiene. Devuelve `conflicts` (solapamientos) y `warnings` (`CREW_ZONE_MISMATCH`, `CREW_SPECIALTY_MISMATCH`); con cualquiera de los dos `hasConflicts` es `true` y asignar exige `overrideNote`. Existe para que el planificador se entere por un aviso y no por un 409                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

**Máquina de estados.** Una transición inválida devuelve 409 nombrando las válidas desde el estado actual.

| Método | Ruta                               | Transición                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------ | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/services/:id/start`              | `SCHEDULED → IN_PROGRESS`. **403 `NOT_ASSIGNED` si el usuario no es de la cuadrilla (también si no hay cuadrilla asignada)**; 409 sin vehículo si el `ServiceType` lo exige                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| POST   | `/services/:id/suspend`            | `IN_PROGRESS → SUSPENDED`. Motivo obligatorio, `note` opcional (máx. 500; solo-espacios queda `null`), devuelta como `statusNote`. `resume` y `cancel` limpian `statusNote`. `cancel` y `reschedule` no aceptan `note` (400 por `forbidNonWhitelisted`)                                                                                                                                                                                                                                                                                             |
| POST   | `/services/:id/resume`             | `SUSPENDED → IN_PROGRESS`. Limpia el motivo                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| POST   | `/services/:id/complete`           | `IN_PROGRESS → COMPLETED` o `PARTIALLY_COMPLETED`. **El estado final se calcula**, no se elige: parcial si alguna zona quedó `NOT_SERVICED` o `PARTIAL`. 409 si falta el resultado de alguna zona. Si el servicio atiende un contenedor y cierra `COMPLETED`, **el contenedor transiciona en la misma transacción** (ver [container.md](../entidades/container.md)); si está en `RELOCATING` hace falta `containerLocation` en el body o da 400. 409 también si el servicio o el contenedor cambiaron de estado durante el cierre (nada se escribe) |
| POST   | `/services/:id/cancel`             | `SCHEDULED`, `RESCHEDULED` o `SUSPENDED` → `CANCELLED`. Motivo obligatorio. **`IN_PROGRESS` no se cancela**: hay que suspenderlo o cerrarlo                                                                                                                                                                                                                                                                                                                                                                                                         |
| POST   | `/services/:id/reschedule`         | `SCHEDULED → RESCHEDULED`. Deja el servicio a la espera de fecha nueva, con el motivo. Es donde caen los servicios ante una alerta meteorológica o el rechazo de un corte                                                                                                                                                                                                                                                                                                                                                                           |
| POST   | `/services/:id/confirm-reschedule` | `RESCHEDULED → SCHEDULED` con la fecha y ventana nuevas. 400 si la fecha es anterior a hoy (día argentino). Con `ticketId`, informa la nueva fecha y franja a M2 como texto (#303)                                                                                                                                                                                                                                                                                                                                                                  |

**`RESCHEDULED` no obliga a reprogramar.** Es el estado "hay que moverlo pero todavía no sé adónde", y el sistema mete servicios ahí solo: lo hacen el rechazo de un corte de calle de M7 y la alerta meteorológica. Si el motivo es definitivo —M7 rechaza el corte porque hay obra por dos meses— **se cancela directo**, sin pasar por una fecha inventada.

**Aviso de demora.** `DELAYED` no es un estado: el servicio sigue en `SCHEDULED` o en `IN_PROGRESS` mientras se demora, y esos son los dos únicos momentos en los que un retraso significa algo.

| Método | Ruta                          | Qué hace                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------ | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/services/:id/delay-notices` | Avisar que se demora. **No cambia el estado.** El tipo tiene que coincidir con el momento: `START` solo antes de arrancar, `DURATION` solo con la cuadrilla trabajando — la combinación cruzada da 400. Un aviso nuevo **reemplaza** al vigente y el anterior queda en el historial. Si el servicio nació de un reclamo sale hacia M2 como `updateTicketStatus / PROGRESS`, con el motivo como mensaje interno: al vecino se le dice que se demora, no por qué |
| GET    | `/services/:id/delay-notices` | Historial completo, del más reciente al más viejo. El vigente es el que tiene `active: true`                                                                                                                                                                                                                                                                                                                                                                   |

**Resultado y residuos.**

| Método | Ruta                               | Qué hace                                                                                                                                                                                 |
| ------ | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/services/:id/zone-results`       | Informar cómo quedó una zona. Solo con el servicio en `IN_PROGRESS`, una vez por zona, y sobre una zona del servicio. `reason` **obligatorio** si no quedó `SERVICED`, y rechazado si sí |
| GET    | `/services/:id/zone-results`       | Resultados informados, en orden de registro                                                                                                                                              |
| POST   | `/services/:id/collection-records` | Registrar residuos: tipo, volumen, peso y destino final. Solo sobre servicios iniciados o cerrados, contra un sitio de disposición activo                                                |
| GET    | `/services/:id/collection-records` | Registros del servicio                                                                                                                                                                   |

## `containers` — contenedores

| Método | Ruta                                 | Qué hace                                                                                  |
| ------ | ------------------------------------ | ----------------------------------------------------------------------------------------- |
| POST   | `/containers`                        | Registrar contenedor. Nace en `ACTIVE`                                                    |
| GET    | `/containers`                        | Listar. Filtros: `status`, `containerType`, `zoneId`, `search`                            |
| GET    | `/containers/:id`                    | Detalle                                                                                   |
| GET    | `/containers/:id/history`            | Historial de estados, paginado, del más reciente al más antiguo. 404 si no existe          |
| PATCH  | `/containers/:id`                    | Actualizar zona, capacidad y ubicación                                                    |
| POST   | `/containers/:id/report-overflow`    | `ACTIVE → OVERFLOWED`                                                                     |
| POST   | `/containers/:id/empty`              | `OVERFLOWED → ACTIVE`                                                                     |
| POST   | `/containers/:id/report-damage`      | `ACTIVE → DAMAGED`. Registra tipo de daño, severidad, `requiresPublicWorks` y `observations` opcional (interna, no viaja a M3) |
| POST   | `/containers/:id/start-repair`       | `DAMAGED → UNDER_REPAIR`                                                                  |
| POST   | `/containers/:id/complete-repair`    | `UNDER_REPAIR → ACTIVE`                                                                   |
| POST   | `/containers/:id/relocate`           | `ACTIVE → RELOCATING`                                                                     |
| POST   | `/containers/:id/confirm-relocation` | `RELOCATING → ACTIVE` con la nueva ubicación                                              |
| POST   | `/containers/:id/remove`             | `DAMAGED → REMOVED`. Solo desde `DAMAGED` — ver [container.md](../entidades/container.md) |

Una transición no válida devuelve 409 nombrando las que sí lo son.

## `green-points` — puntos verdes

| Método | Ruta                | Qué hace                                                                        |
| ------ | ------------------- | ------------------------------------------------------------------------------- |
| POST   | `/green-points`     | Registrar punto verde de entrega voluntaria                                     |
| GET    | `/green-points`     | Listar. Filtros: `active`, `zoneId`, `wasteType`, `search` (nombre o dirección) |
| GET    | `/green-points/:id` | Detalle, con los tipos de residuo aceptados                                     |
| PATCH  | `/green-points/:id` | Actualizar. El array de tipos de residuo reemplaza el conjunto completo         |
| DELETE | `/green-points/:id` | Baja lógica                                                                     |

## `trees` — arbolado urbano

| Método | Ruta         | Qué hace                                                            |
| ------ | ------------ | ------------------------------------------------------------------- |
| POST   | `/trees`     | Registrar árbol en el censo                                         |
| GET    | `/trees`     | Listar. Filtros: `active`, `zoneId`, `riskLevel` (`NONE`/`LOW`/`MEDIUM`/`HIGH`/`CRITICAL`, por el **último relevamiento**; 400 si no es del enum; sin relevamiento no coincide con ninguno), `search` (especie o dirección). `meta.total` ya viene filtrado |
| GET    | `/trees/:id` | Detalle                                                             |
| PATCH  | `/trees/:id` | Actualizar                                                          |
| DELETE | `/trees/:id` | Baja lógica                                                         |

**Toda respuesta de árbol trae `lastSurvey`**, el resumen del último relevamiento: `surveyedAt`, `healthStatus`, `riskLevel`, `riskType` y `suggestedIntervention`. Es `null` si el árbol todavía no fue relevado, que es un estado real —se censa el arbolado antes de poder recorrerlo entero— y no un error.

Existe para que el listado se pueda pintar por riesgo sin pedir los relevamientos árbol por árbol: en un censo real eso serían miles de llamadas. Es un **resumen**, no el historial; el inspector, las notas y las derivaciones siguen en `GET /trees/:treeId/surveys`.

## `tree-surveys` — relevamientos de arbolado

| Método | Ruta                               | Qué hace                                                                                                                         |
| ------ | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/trees/:treeId/surveys`           | Cargar un relevamiento. 400 si `surveyedAt` es posterior a hoy (huso Argentina) o si `riskLevel` es HIGH/CRITICAL sin `riskType` |
| GET    | `/trees/:treeId/surveys`           | Historial de relevamientos. Filtros: `healthStatus`, `riskLevel`                                                                 |
| GET    | `/trees/:treeId/surveys/:surveyId` | Detalle de un relevamiento                                                                                                       |

## `tree-interventions` — podas, extracciones, plantaciones y tratamientos

| Método | Ruta                                               | Qué hace                                                                                                                                                                                                                                            |
| ------ | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/tree-interventions`                              | Crear intervención sobre uno o más árboles; registra `requestedByUserId` (el usuario del token)                                                                                                                                                                                                          |
| GET    | `/tree-interventions`                              | Listar. Filtros: `interventionType`, `status`, `priority` (`LOW`/`MEDIUM`/`HIGH`/`CRITICAL`), `treeId` (las que incluyen ese árbol)                                                                                                                 |
| GET    | `/tree-interventions/:id`                          | Detalle                                                                                                                                                                                                                                             |
| POST   | `/tree-interventions/:id/submit-for-authorization` | `REQUESTED → PENDING_AUTHORIZATION`. Solo para `REMOVAL`                                                                                                                                                                                            |
| POST   | `/tree-interventions/:id/authorize`                | `→ AUTHORIZED`. Una `REMOVAL` en `REQUESTED` da 409: tiene que pasar por `PENDING_AUTHORIZATION`. Autorizar una `REMOVAL` exige `M6_ADMIN` (403 `ROLE_REQUIRED` para `M6_OFICINA_OPERACIONES`); un admin puede autorizar lo que él mismo solicitó y `requestedByUserId` y `authorizedByUserId` quedan en la respuesta                                                                                                                                                    |
| POST   | `/tree-interventions/:id/reject`                   | `PENDING_AUTHORIZATION → REJECTED`. Rechazar una `REMOVAL` también exige `M6_ADMIN`                                                                                                                                                                                                                  |
| POST   | `/tree-interventions/:id/assign-service`           | Asociar la intervención al `Service` que la ejecuta. La intervención guarda **qué** hay que hacer; el servicio, **cuándo, con qué cuadrilla y cómo terminó**. Solo una intervención `AUTHORIZED`, contra un servicio `POINT` que no ejecute ya otra |

## `events` — ingesta de eventos entrantes

| Método | Ruta               | Qué hace                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------ | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/events/inbox`    | Recibe un sobre y lo despacha al handler que corresponda. Devuelve `processed`, `duplicate`, `ignored` o `failed`. Acepta `occuredAt` (typo de M1 v3.0) como alias deprecado de `occurredAt`: si vienen los dos manda `occurredAt`, y el alias también debe ser ISO 8601. 400 si `occurredAt` no es ISO 8601 (o `occuredAt`), si `correlationId` o `causationId` (este puede ir `null`) no son UUID, si `eventId`, `eventType`, `sourceModule` o `eventVersion` pasan su tope, si `sourceModule` trae algo que no sea letras, números, `-` o `_`, o si el `data` de un evento con handler no trae sus campos obligatorios (no se guarda; ver [consumidos](../eventos/consumidos/README.md)) |
| GET    | `/events/handlers` | Los tipos de evento con handler registrado                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| GET    | `/events/inbox`    | Listado paginado de lo recibido (`M6_ADMIN`, `M6_AUDITOR`), del más reciente al más viejo por `receivedAt`, para la pantalla Eventos (pestaña Eventos recibidos). Filtros: `status` (`processed`: con `processedAt`; `failed`: sin `processedAt` y con `error`; `pending`: ninguno de los dos), `eventType`, `sourceModule`, `from`/`to` (días argentinos inclusivos sobre `receivedAt`; 400 si `from` > `to`). Trae `messageId`, `eventType`, `sourceModule`, `status`, fechas, `correlationId` y `error` (máx. 500 caracteres). **No trae el `payload`**: es de terceros y puede incluir datos personales |
| GET    | `/events/inbox/:messageId` | Detalle con el `payload` recibido (`M6_ADMIN`). 404 si no existe. Dato Tier 2 (#643): leer un `ticketUpdated` no redactado (identidad del denunciante) o un `commercialFineGenerated`/`closureUpdate` (resolución de M4) deja una fila `READ` en `GET /audit`: `ENVIRONMENTAL_REPORT` del ticket o `SANCTION_OUTCOME` del acta si existen, si no `INBOX_EVENT` con el `id` UUID de la fila del inbox (no el `messageId`); si no se puede auditar, `500` y no se entrega |

**La idempotencia es por `eventId`** y vive en el inbox, no en cada handler: un mensaje ya procesado (o en curso) se descarta sin volver a aplicar el efecto, que es lo que exige la regla 1 del enunciado. La decide el `@unique` de `InboxEvent.messageId`, no una consulta previa que podría correr en paralelo con otra igual.

Un evento sin handler se registra y se descarta sin romper. Si el handler falla, la fila queda sin `processedAt` y con el error registrado, y la respuesta es `failed`. **Reenviar ese `eventId` vuelve a correr el handler** —con el `eventType` y el payload guardados la primera vez—, y es lo que hace el Core con sus reintentos; uno con otro `eventType` sale `duplicate`, igual que uno ya procesado o en curso.

El sobre es el del Core (`sourceModule`, `correlationId`, `causationId`). El de M2 (`specVersion`, `producer`, `subject`) sigue aceptándose, marcado `deprecated` en el swagger, hasta que la cohorte haya migrado.

**El inbox no guarda contenido de negocio ajeno.** Un evento sin handler, o un `ticketUpdated` cuyo `responsibleAreaId` no es M6 (§2 y §11 del contrato de M2), deja la fila con `messageId`, `eventType` y `processedAt` —lo justo para la idempotencia— y un `payload` reemplazado por un marcador `{ "redacted": ... }`. El `ticketUpdated` de M6 conserva el payload completo, incluso los `updateType` que se descartan a propósito.

> Este endpoint es la vía manual: sirve para ejercitar los consumidores sin broker o mientras el Core no registra nuestras suscripciones. El consumidor de RabbitMQ (`q.ambiente`) llama al mismo `ingest()`.

## `outbox` — eventos salientes: consulta y reintento

Contraparte de `POST /events/inbox`: sin entrar a la base se ve qué salió, qué falló y por qué, y se reencola lo `FAILED`. El dispatcher deja una fila en `FAILED` a los 5 intentos y deja de barrerla (ver [eventos publicados](../eventos/publicados/README.md)).

| Método | Ruta                          | Roles                | Qué hace |
| ------ | ----------------------------- | -------------------- | -------- |
| GET    | `/events/outbox`              | `M6_ADMIN`, `M6_AUDITOR` | Listado paginado, del más nuevo al más viejo. Filtros: `status` (`PENDING`/`SENT`/`FAILED`), `eventType`, `from`/`to` (días argentinos inclusivos sobre `occurredAt`; 400 si `from` > `to`). **No trae el `payload`**: puede incluir datos del vecino |
| GET    | `/events/outbox/:id`          | `M6_ADMIN`           | Detalle con el `payload` y los reintentos manuales que se le hicieron. 404 si no existe. Dato Tier 2 (#643): leer un `environmentalViolationDetected` (el acta) deja una fila `READ` `VIOLATION_NOTICE` con el `violationId` del payload; si no se puede auditar, `500` y no se entrega |
| POST   | `/events/outbox/:id/retry`    | `M6_ADMIN`           | `FAILED` → `PENDING` con `attempts = 0`; el dispatcher lo reenvía en la próxima barrida (cada 10 s). 409 si no está en `FAILED` (un `SENT` no se reenvía; un `PENDING` ya está en cola) |
| POST   | `/events/outbox/retry-failed` | `M6_ADMIN`           | Lo mismo en lote. Body `{ "confirm": true, "limit": 20 }`: `confirm` obligatorio (solo el booleano `true` o la cadena `"true"`; cualquier otra cosa da 400), `limit` opcional (1 a 100, por omisión 100), los más viejos primero. Devuelve `{ requeued, remainingFailed }`; 409 si otro reintento concurrente tocó eventos de la tanda (no se reencola ni audita nada: repetir el pedido) |

**Auditoría.** Cada reintento escribe una fila en `outbox_retry_audit` (`outboxEventId`, `actorUserId`, `at`, `previousAttempts`, `previousError`) en la misma transacción que el cambio de estado: el reintento borra `attempts` y `lastError`, y ahí queda cómo estaban. El actor sale del token, nunca del body. **Reintentar republica con el mismo `eventId`** (es el id de la fila). Los módulos receptores deduplican por `eventId`, así que no hay doble efecto si el primer envío había llegado a salir. Pero el Core de M9 puede no redistribuir un `eventId` que ya registró, y uno `REJECTED` tampoco se revalida al retransmitirlo (ver [m9.md](../integracion/m9.md)): **si el motivo del `FAILED` fue un payload rechazado, el reintento no lo arregla**; hay que coordinar el reproceso con M9. Sirve sobre todo cuando el fallo fue de transporte (broker caído, red). Con el receptor todavía caído, el evento vuelve a `FAILED` tras 5 intentos. No hay reintento automático de un `FAILED`: es una acción humana auditada.

**`lastError` puede incluir datos de infraestructura** (host y puerto del broker, hasta 500 caracteres) y lo ve también el auditor en el listado; por eso el detalle, que agrega el payload y el `previousError` de cada reintento, es solo para `M6_ADMIN`.

## `audit` — auditoría de dominio

Quién hizo qué y cuándo sobre contenedores, expedientes, inspecciones, actas, derivaciones, intervenciones, servicios y catálogos ([#460](https://github.com/hllous/Backend-M6-DAPS2/issues/460)). Modelo y cobertura en [entidades/auditoria.md](../entidades/auditoria.md).

| Método | Ruta     | Roles                    | Qué hace |
| ------ | -------- | ------------------------ | -------- |
| GET    | `/audit` | `M6_ADMIN`, `M6_AUDITOR` | Listado paginado, del más reciente al más antiguo. Filtros opcionales `entityType` (valor cerrado: `CONTAINER`, `ENVIRONMENTAL_REPORT`, `ENVIRONMENTAL_INSPECTION`, `VIOLATION_NOTICE`, `REPAIR_REQUEST`, `STREET_CLOSURE_REQUEST`, `TREE_INTERVENTION`, `SERVICE`, `CREW`, `ZONE`, `VEHICLE`, `ROUTE`, `SANCTION_OUTCOME`, `INBOX_EVENT`) y `entityId` (UUID); 400 si alguno es inválido. Cada fila trae `action`, `fromStatus`/`toStatus`, `actorUserId` y `actorRoles` (del token, nunca del body), `note` (solo el motivo que el flujo ya pedía) y `occurredAt`. `action: READ` es una lectura de datos Tier 2 (acta, resolución o identidad del denunciante, #643), sin estados ni nota |

**Query params de `GET /audit`** (todos opcionales; un valor fuera de rango o con formato inválido da 400):

| Param | Tipo | Detalle |
| ----- | ---- | ------- |
| `page` | entero | 1 a 10.000.000, default 1 |
| `pageSize` | entero | 1 a 100, default 20 |
| `entityType` | enum | Uno de los valores de arriba; cualquier otro da 400 |
| `entityId` | UUID | Id de la entidad; se combina con `entityType` (AND). Sin filtros devuelve toda la tabla |

**Respuesta 200:** `{ data: [...], meta: { total, page, pageSize, totalPages } }`, ordenada por `occurredAt` descendente y, a igual instante, por `id` descendente. Cada elemento (`AuditLogResponseDto`):

| Campo | Tipo | Detalle |
| ----- | ---- | ------- |
| `id` | UUID | Id de la fila de auditoría |
| `entityType` | string | Uno de los valores cerrados del filtro |
| `entityId` | string | Id de la entidad afectada |
| `action` | string | Acción en MAYÚSCULAS (tabla de abajo); no es un enum cerrado en el contrato |
| `fromStatus` | string o null | Estado anterior; en los catálogos con baja lógica, `ACTIVE`/`INACTIVE` |
| `toStatus` | string o null | Estado nuevo |
| `actorUserId` | string | Id de M1 de quien actuó, tomado del token |
| `actorRoles` | `M6Role[]` | Roles de M6 efectivos al momento de la acción |
| `note` | string o null | Motivo que el flujo ya pedía, hasta 500 caracteres; `null` si no hubo |
| `occurredAt` | ISO 8601 | Cuándo ocurrió |

**Errores:** 400 (query inválida), 401 (token ausente o inválido), 403 `ROLE_REQUIRED` (sin `M6_ADMIN` ni `M6_AUDITOR`), 500. Un `entityId` inexistente no da 404: devuelve la página vacía.

**Valores de `action` que emite el backend**, por `entityType` (salvedades en [entidades/auditoria.md](../entidades/auditoria.md)):

| `entityType` | `action` |
| ------------ | -------- |
| `CONTAINER` | `CREATE`, `REPORT_OVERFLOW`, `EMPTY`, `REPORT_DAMAGE`, `START_REPAIR`, `COMPLETE_REPAIR`, `RELOCATE`, `CONFIRM_RELOCATION`, `REMOVE`, `COMPLETE_SERVICE` |
| `ENVIRONMENTAL_REPORT` | `CREATE`, `START_REVIEW`, `FORWARD`, `DISMISS`, `CLOSE`, `REQUEST_INFORMATION`, `STATUS_CHANGE`, y las del sistema por evento de M2: `REACTIVATE`, `REOPEN`, `PRIORITY_CHANGE`, `INFORMATION_PROVIDED`, `CANCEL_INFORMATION_REQUEST`, `ESCALATION_CHANGE`; `READ` (lectura del `ticketUpdated` en `GET /events/inbox/:messageId`) |
| `ENVIRONMENTAL_INSPECTION` | `SCHEDULE`, `COMPLETE` |
| `VIOLATION_NOTICE` | `ISSUE`, `READ` (lectura del acta o de su `environmentalViolationDetected`) |
| `REPAIR_REQUEST` | `CREATE`, `START`, `CLOSE` |
| `STREET_CLOSURE_REQUEST` | `CREATE`, `APPROVE`, `REJECT`, `END` |
| `TREE_INTERVENTION` | `CREATE`, `SUBMIT_FOR_AUTHORIZATION`, `AUTHORIZE`, `REJECT`, `ASSIGN_SERVICE` |
| `SERVICE` | `CREATE`, `UPDATE`, `ASSIGN_CREW`, `START`, `SUSPEND`, `RESUME`, `COMPLETE`, `CANCEL`, `RESCHEDULE`, `CONFIRM_RESCHEDULE` |
| `CREW` | `CREATE`, `ACTIVATE`, `DEACTIVATE`, `ADD_MEMBERS`, `REMOVE_MEMBER`, `REASSIGN_ZONE` |
| `ZONE`, `VEHICLE`, `ROUTE` | `CREATE`, `ACTIVATE`, `DEACTIVATE` |
| `SANCTION_OUTCOME` | `RECORD_OUTCOME`, `READ` (lectura junto con el acta o del evento de M4) |
| `INBOX_EVENT` | `READ` (un evento entrante con datos Tier 2 que no se pudo atar a un expediente o resolución; `entityId` es el `id` UUID de la fila del inbox, no el `messageId`) |

La tabla es de solo agregado (un trigger rechaza modificar, borrar y vaciar) y no se purga. De las lecturas, solo audita las de datos Tier 2 (ver [auditoria.md](../entidades/auditoria.md)); no audita las transiciones de otros consumidores de eventos y barridos. Las respuestas de M3 y M7 (`workOrder*`, `streetClosure*`) sí, con `actorUserId` `system:m3` / `system:m7` y `actorRoles` vacío, y solo si cambiaron el estado.

## `repair-requests` — reparaciones derivadas a M3

El daño de infraestructura que detectamos pero que no nos corresponde arreglar. La solicitud existe para **poder seguir el pedido**: publicar el evento no alcanza, porque la respuesta de M3 vuelve asincrónica.

| Método | Ruta                         | Qué hace                                                                                                                                                                                              |
| ------ | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/repair-requests`           | Crear y publicar `infrastructureRepairRequested` → M3. Si el daño salió de un servicio nacido de un reclamo —o de una inspección, vía el `ticketId` de su expediente— el `ticketId` viaja en el evento. 404 si el servicio o la inspección de origen no existe. **409** si el origen es una inspección sin cerrar, `NO_VIOLATION` o de un expediente `NOISE`/`ODOR`/`PEST_INFESTATION`/`AIR_EMISSION` (ver `ALLOWED_FOLLOW_UPS`), o si ya hay una solicitud no cerrada para el mismo origen y `damageType` |
| GET    | `/repair-requests`           | Listar. Filtros: `status`, `damageType`, `severity`, `detectedInId`                                                                                                                                   |
| GET    | `/repair-requests/:id`       | Detalle, con la orden de trabajo de M3 si la informaron                                                                                                                                               |
| POST   | `/repair-requests/:id/start` | → `IN_PROGRESS`. **Normalmente lo dispara `workOrderScheduled`** (Fase 6). **409** si la transición no es válida desde el estado actual                                                               |
| POST   | `/repair-requests/:id/close` | → `CLOSED`. **Normalmente lo dispara `workOrderCompleted`**. **409** si la transición no es válida desde el estado actual                                                                             |

**Tres estados, no una máquina**: pedida, en curso, cerrada. Alcanza con eso, y por eso no consumimos `workOrderUpdated`.

`publicSafetyRisk` es un campo propio, **no derivado de `severity`**: son dos cosas distintas y M3 prioriza con él.

## `street-closure-requests` — cortes derivados a M7

| Método | Ruta                                   | Qué hace                                                                                                                                                                                                                                                                                                                  |
| ------ | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/street-closure-requests`             | Crear y publicar `streetClosureRequested` → M7, con **`sourceModule = "M6"`**. Exige al menos un tramo (`sections`, cada uno con `streetName`, `fromCross`, `toCross` y `direction`: `FORWARD`/`REVERSE`/`BOTH`) y `closureType` (`TOTAL`/`PARTIAL`); al evento viajan como `affectedSections` `{street, from, to, direction}`. 400 si `requestedTo` es anterior a `requestedFrom`. 404 si el servicio o la intervención de origen no existe. **409** si la intervención de origen no está `AUTHORIZED` |
| GET    | `/street-closure-requests`             | Listar. Filtros: `status`, `sourceId`                                                                                                                                                                                                                                                                                     |
| GET    | `/street-closure-requests/:id`         | Detalle con sus tramos                                                                                                                                                                                                                                                                                                    |
| POST   | `/street-closure-requests/:id/approve` | → `APPROVED`, guarda el `closureId` de M7. **Normalmente lo dispara `streetClosureApproved`**. **409** si la transición no es válida desde el estado actual                                                                                                                                                               |
| POST   | `/street-closure-requests/:id/reject`  | → `REJECTED`. **Normalmente lo dispara `streetClosureRejected`**. **409** si la transición no es válida desde el estado actual                                                                                                                                                                                            |
| POST   | `/street-closure-requests/:id/end`     | → `ENDED`, desde `REQUESTED`, `APPROVED` o `EXPIRED`. **Normalmente lo dispara `streetClosureEnded`**. **409** si la transición no es válida desde el estado actual                                                                                                                                                       |

La respuesta de un corte trae, además de la ventana pedida (`closureFrom`/`closureTo`), la que autorizó M7 (`approvedFrom`/`approvedTo`, null hasta que aprueban) y el motivo del rechazo (`rejectionReason`, null si no fue rechazado). Son los nombres de nuestro REST; en los eventos de M7 llegan como `startDate`/`endDate`/`rejectionReason`.

`sourceRef` apunta al `Service` o a la `TreeIntervention` que origina el corte: es lo que hace que la respuesta de M7 se pueda aplicar sobre el trabajo correcto.

> Los endpoints de transición existen para **operación manual y para poder demostrar el circuito mientras no haya bus**. Cuando la Fase 6 conecte los consumidores, lo normal va a ser que los muevan los eventos.

## `environmental-reports` — expedientes ambientales

El expediente de una denuncia ambiental —ruidos, vertidos, microbasurales, emisiones—, con su máquina de 11 estados. Puede nacer de un reclamo de M2 (`ticketId`) o de una **detección de oficio**, que es el camino que no depende de ningún otro módulo.

| Método | Ruta                                             | Qué hace                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------ | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/environmental-reports`                         | Abrir expediente. Nace en `RECEIVED`. `description` (opcional, hasta 2000) es interna: no sale en el portal ni en eventos. La respuesta trae `caseNumber` (`EXP-2026-000123`, lo asigna la base) y `assignedCrewId` (`null`: todavía no tiene inspecciones) **`ticketId` solo si el actor es Oficina Ambiental o Admin**: un actor solo de Campo (inspector) que lo manda recibe 400; abre expedientes de oficio. |
| GET    | `/environmental-reports`                         | Listar (cada item trae `caseNumber` —`EXP-2026-000123`, número legible de M6 que también tienen los de oficio—, `escalated`, `citizenResponse` y `assignedCrewId`, igual que el alta, el detalle y las respuestas de las transiciones; ver entidad). Filtros: `status` (uno o varios, OR; formato canónico parámetro repetido `status=RECEIVED&status=UNDER_REVIEW`, también acepta comas; duplicados se ignoran; valor desconocido o vacío da 400 con los válidos; `meta.total` ya filtrado), `reportType`, `priority`, `ticketId`, `publicId` (TK-…, exacto), `crewId` (UUID; expedientes con **alguna** inspección cuyo servicio no cancelado tenga esa cuadrilla, filtrado en la base: la página y `meta.total` ya vienen recortados; 400 si no es UUID), `overdue` (`true`: solo las vencidas, `false`: el resto; mismo criterio que `incidents.reports.overdue`: no `CLOSED` con más días hábiles desde el alta hasta hoy que el plazo), `zoneId` (UUID; zona derivada de la denuncia, ver «Vencidas y riesgo alto por zona» en `indicators`), `createdFrom`/`createdTo` (YYYY-MM-DD, inclusivos, día argentino; filtran por `createdAt`, el período de los indicadores; 400 si `createdFrom` > `createdTo`), `from`/`to` (YYYY-MM-DD, inclusivos, día argentino UTC-3; filtran por `updatedAt`, la columna «Actualizado» de la cola, **pendiente de confirmar con el PO** si debe ser `createdAt`; 400 si `from` > `to`; `meta.total` ya refleja el rango), `search` |
| GET    | `/environmental-reports/:id`                     | Detalle, con su plazo de vencimiento si lo tiene y `assignedCrewId` (cuadrilla de la inspección más reciente con servicio no cancelado)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| POST   | `/environmental-reports/:id/start-review`        | `RECEIVED → UNDER_REVIEW`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| POST   | `/environmental-reports/:id/request-information` | Pide información al vecino (#169). Solo `UNDER_REVIEW` con `ticketId`. Body `{ message, requiredBy?, internalNote? }`: `message` (máx. 500) es lo que ve el vecino; `requiredBy` `YYYY-MM-DD` (vence a las 23:59:59 ART) o ISO con zona, futura; `internalNote` no la ve el vecino. Hacia M2 sale como `INFORMATION_REQUIRED`. 409 si no hay `ticketId`, si no está en `UNDER_REVIEW`, si ya hay una pendiente o si el ticket está en `PENDING_INFORMATION`/terminal. La respuesta trae `informationRequestPending` y los datos de la solicitud; se apaga con la respuesta de M2 o con un cambio de estado recibido de M2 distinto de PENDING_INFORMATION. Mientras está pendiente, `forward`, `dismiss` y `close` dan 409                                                                                                                                                                                                   |
| POST   | `/environmental-reports/:id/forward`             | `UNDER_REVIEW → FORWARDED`. Hacia M2 sale como **`RETURNED`**, no `REJECTED`: devolver lo que no es de nuestra área es distinto de desestimarlo                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| POST   | `/environmental-reports/:id/dismiss`             | `UNDER_REVIEW → DISMISSED`. Hacia M2 sale como `REJECTED`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| POST   | `/environmental-reports/:id/close`               | Cierre manual                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

**Cierre por vencimiento.** `NOTICE_ISSUED → CLOSED` lo hace el sistema solo cuando pasa `deadlineAt`, sin endpoint. No es un atajo: M4 no publica nada cuando decide que no corresponde castigo, así que sin ese cierre el expediente quedaría abierto para siempre. El plazo se configura con `SANCTION_DEADLINE_DAYS`.

## `environmental-inspections` — inspecciones y actas

| Método | Ruta                                              | Qué hace                                                                                                                                                                                                                                                     |
| ------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| POST   | `/environmental-reports/:reportId/inspections`    | Programar. Lleva el expediente a `INSPECTION_SCHEDULED`. Se ejecuta como un `Service` de modo `POINT`                                                                                                                                                        |
| GET    | `/environmental-reports/:reportId/inspections`    | Inspecciones del expediente                                                                                                                                                                                                                                  |
| GET    | `/environmental-inspections/:id`                  | Detalle con checklist y hallazgos, más `reportType`, `address`, `lat` y `lng` del expediente (solo lectura) y `allowedActions` (`repair`, `notice`, `suggestedViolationType`: la matriz por tipo de expediente cruzada con el resultado; también en el listado por expediente)                                                                                                                                                                                                                            |
| POST   | `/environmental-inspections/:id/complete`         | Cierra con su `outcome`. Lleva el expediente a `INSPECTED` y de ahí, en la misma operación, a `NO_VIOLATION` o `VIOLATION_FOUND`. Un `INCONCLUSIVE` lo deja en `INSPECTED`. 400 si `inspectedAt` está en el futuro o si `VIOLATION_FOUND` no trae `nextStep` |
| POST   | `/environmental-inspections/:id/violation-notice` | **Emitir el acta.** Solo sobre una inspección `VIOLATION_FOUND`                                                                                                                                                                                              |
| GET    | `/environmental-inspections/:id/violation-notice` | El acta emitida (`noticeNumber` es el número del acta de M6; el de la multa o clausura es `sanctionOutcome.externalRef`, el de M4; `sanctionOutcome` es `null` hasta que M4 resuelve y también viene en el `POST`); `200` con `null` (JSON literal) si la inspección no tiene acta, `404` solo si no existe. Dato Tier 2: cada lectura que entrega el acta deja una fila `READ` en `GET /audit` por el acta y otra por la resolución si la hay (#643); si no se puede auditar, `500` y no se entrega                                                                                                                                                     |

**`checklist[]`, `findings`, `conclusion`, `inspectorId` y `completedByUserId` son internos: nunca salen hacia M2.** `inspectorId` es la asignación opcional de Oficina al programar (id numérico de M1; debe tener `M6_CAMPO_INSPECTOR`, si no 400). `completedByUserId` lo llena `complete` siempre desde el token y no pisa al asignado.

**Al cerrar, `complete` acepta además `conclusion`, `violationType`, `severity` y `suggestedAction`**, todos opcionales, y el detalle los devuelve. `conclusion` es texto libre de hasta 2000 caracteres; los otros tres usan los mismos enums que el acta. Son orientativos: el acta los vuelve a pedir y lo que se deriva a M4 es lo del acta. No hay reglas cruzadas con `outcome`.

**El acta es inmutable.** No hay `PATCH` ni `DELETE`: si hay un error se emite otra sobre una inspección nueva. Una segunda acta sobre la misma inspección da 409.

**Sin `establishmentId` el acta no se deriva.** Se registra igual, pero no se publica `environmentalViolationDetected` y el expediente cierra de nuestro lado: intimar, clausurar y multar se le aplican a un comercio habilitado, que es lo único sobre lo que M4 puede actuar.

## `evidence` — adjuntos (foto/PDF)

| Método | Ruta        | Qué hace                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| POST   | `/evidence` | Sube un archivo (multipart, uno por llamada) y lo asocia a un `ownerType`/`ownerId` que ya debe existir (`CONTAINER`, `SERVICE`, `ZONE_RESULT`, `INSPECTION`). Requiere el header `Idempotency-Key`. Un archivo mayor a `MAX_EVIDENCE_SIZE_BYTES` (10 MB) da **413**: multer lo corta antes de llegar al service. Sin `R2_BUCKET` / `R2_PUBLIC_URL_BASE` configurados, el camino válido responde **503** (no 500) y no persiste nada **Rol por `ownerType`:** `INSPECTION` solo `M6_CAMPO_INSPECTOR`; `SERVICE`, `ZONE_RESULT` y `CONTAINER` solo `M6_CAMPO_CUADRILLA`; otro rol recibe 403 `ROLE_REQUIRED` (un `M6_ADMIN` no tiene Campo). |
| GET    | `/evidence` | Lista la evidencia de un `ownerType`/`ownerId`, por query params. Campo solo la de dueños que le pertenecen (403 `NOT_ASSIGNED`, 404 si no existe)                                                                                                                                                                                                                                                                                                                                                                     |

**Genérico por diseño (Issue #64).** Un solo módulo sirve a los cuatro tipos de recurso en vez de reimplementar la subida por cada uno — el modelo `Attachment` ya era polimórfico en el schema, esto le agrega el endpoint que faltaba.

**Storage: Cloudflare R2** (S3-compatible), bucket público. La respuesta (`{id, url, filename, contentType, uploadedAt}`) sigue la hipótesis ya documentada por el frontend en su `CONTRACTS.md`, distinta del shape `{fileName, contentType, url, sizeBytes?}` que espera M2 en sus eventos — ese mapeo queda para cuando se implemente el envío de `evidence` hacia M2 (ver `bloqueantes.md`).

**El backend no le cree al cliente sobre el archivo.** El `Content-Type` que llega en el multipart lo declara quien sube: Multer no inspecciona el contenido. Se verifica el tipo real por los primeros bytes y se rechaza con 400 si no coincide con lo declarado — un ejecutable renombrado a `.jpg` no entra. Es el pedido 1 del [Issue #90](https://github.com/hllous/Backend-M6-DAPS2/issues/90), donde el frontend dejó escrito que sus propios controles son defensa en profundidad y que la autoridad es el backend.

**Se quitan los metadatos antes de subir.** Una foto sacada con el teléfono de un inspector lleva coordenadas GPS, fecha y modelo del equipo, y el bucket es público. Se saca el Exif, el XMP y los comentarios de JPEG, PNG y WebP.

**Sin re-codificar la imagen.** Es evidencia: se recorta la estructura del contenedor y los píxeles quedan bit a bit idénticos. Una librería de imágenes los volvería a comprimir. Y ante cualquier estructura que el parser no entienda, **el archivo se sube entero, sin tocar**: no sacar un metadato es una fuga de privacidad, pero entregar un recorte de un archivo que no entendimos es perder la evidencia.

⚠️ **Los PDF pasan sin limpiar.** Sacarle los metadatos a un PDF necesita un parser de PDF, que es otro trabajo. El escaneo de malware, el tercer pedido de #90, tampoco existe: necesita un servicio externo que no está contratado.

**`filename` es el nombre que puso quien subió el archivo**, saneado (sin ruta, sin caracteres de control, acotado a 120). La key del bucket sí es un UUID. Es lo que hace que un inspector abriendo el acta vea `medidor-frente.jpg` y no cuatro identificadores opacos.

**Idempotencia real, no solo validada.** `Idempotency-Key` repetida para el mismo owner devuelve el `Attachment` existente en vez de subir de nuevo — respaldado por un constraint único en DB (`ownerType`, `ownerId`, `idempotencyKey`), no por una consulta previa que podría perder una carrera.

## `green-spaces` — espacios verdes

| Método | Ruta                | Qué hace                                         |
| ------ | ------------------- | ------------------------------------------------ |
| POST   | `/green-spaces`     | Registrar plaza, parque, cantero o rambla        |
| GET    | `/green-spaces`     | Listar. Filtros: `active`, `spaceType`, `zoneId` |
| GET    | `/green-spaces/:id` | Detalle                                          |
| PATCH  | `/green-spaces/:id` | Actualizar                                       |
| DELETE | `/green-spaces/:id` | Baja lógica                                      |

---

## `indicators` — tablero de indicadores

Las cuatro familias que define [`docs/README.md`](../README.md). Todos filtran por período con `from` y `to`; sin ellos, los últimos 30 días.

**Parámetros comunes (opcionales, en los cuatro):**

| Parámetro          | Qué hace                                                                                                                                                                                                                                                                                                        |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bucket`           | `day`, `week` o `month`. Suma `series`: un punto por intervalo (`from` y `to` inclusive, días argentinos UTC-3). `week` va de lunes a domingo y `month` es mes calendario; el primero y el último intervalo se recortan al período, así que **la suma de la serie es igual a `totals`**. Los intervalos vacíos van en cero. Más de **90 puntos** da 400, antes de leer la base |
| `compare=previous` | Suma `previous` (`period` y `totals` del período inmediatamente anterior, de igual duración) y `delta` (la diferencia, en puntos porcentuales, en días o en cantidades, con un decimal; `null` si alguno de los dos lados no tiene base). Sin él, la respuesta no cambia                                                       |

Cada respuesta trae `targets`: la meta de sus indicadores como `{ value, direction }`, con `direction` `min` (se cumple con un valor mayor o igual), `max` (menor o igual) o `down` (tendencia descendente: se cumple si baja de un período al otro; su `value` es `null` porque nadie definió un número). Salen de variables de entorno (`INDICATORS_TARGET_*`, ver `.env.example`) con los valores que definió el equipo el 29/10.

| Método | Ruta                     | Qué hace                                                                                                                                                                                |
| ------ | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/indicators/coverage`   | Objetivos atendidos sobre programados, con desglose por zona y por tipo de servicio. Filtros extra: `zoneId`, `serviceTypeId`. En todos los indicadores, `from` posterior a `to` da 400 |
| GET    | `/indicators/compliance` | Finalizados en término contra demorados, y ranking de zonas no atendidas con sus motivos. Filtros extra: `zoneId`, `serviceTypeId`                                                      |
| GET    | `/indicators/incidents`  | Contenedores por estado y zona (foto actual) y sus desbordes, daños y daños pendientes por período (historial), árboles por nivel de riesgo, y denuncias por tipo y estado con el tiempo medio de resolución, las resueltas dentro del plazo y las vencidas |
| GET    | `/indicators/waste`      | Kg y m³ por tipo de residuo y por destino, y porcentaje desviado del relleno                                                                                                            |

**La unidad de cobertura es el par (servicio, zona), no el servicio.** Un recorrido que pasa por cuatro zonas y atiende tres no es "un servicio a medias": son tres objetivos cumplidos y uno no. `ServiceZone` ya es ese par y `ZoneResult` es su resultado, así que el desglose por zona sale del mismo dato que el total.

**Los servicios `CANCELLED` no cuentan como incumplimiento.** Un servicio cancelado no es un objetivo fallado, es un objetivo que dejó de existir.

**"En término" se mide con el último `ZoneResult.recordedAt` contra `Service.scheduledDate`.** `Service` no tiene columna de cierre, y `updatedAt` se mueve con cualquier edición posterior: no sirve para medir puntualidad. El resultado de campo sí es la marca de cuándo se terminó el trabajo.

### Definición de cada indicador

Tabla de metas del equipo (29/10). Se calculan todos menos zonas no atendidas, que sigue pendiente de definición (ver [#461](https://github.com/hllous/Backend-M6-DAPS2/issues/461); etapa 1 en #473, etapa 2 en #475).

| Indicador | Campo | Cómo se mide | Meta |
| --------- | ----- | ------------ | ---- |
| Cobertura de servicios | `coverage.totals.coveragePct` | Pares (servicio, zona) atendidos ÷ pares programados con fecha vencida × 100 | ≥ 95 % |
| Cumplimiento de servicios | `compliance.finished.onTimePct` | Servicios finalizados en término ÷ servicios finalizados × 100 | ≥ 90 % |
| Días de resolución | `incidents.reports.avgResolutionBusinessDays` | Promedio de días hábiles entre el alta y el cierre de la denuncia (solo cerradas) | ≤ 5 días hábiles |
| Desvío de programación | `compliance.schedulingDeviation.deviatedPct` | Servicios reprogramados o con aviso de demora ÷ servicios del período × 100 | ≤ 10 % |
| Desvío del relleno sanitario | `waste.totals.divertedPct` | Kg a planta de reciclado o de compostaje ÷ kg recolectados × 100 | sin meta acordada (`null`) |
| Zonas no atendidas | — | Pendiente: hay que definir si cuenta solo "sin resultado" o también `NOT_SERVICED` | ≤ 5 % |
| Contenedores desbordados | `incidents.containers.history.overflowIncidents` | Incidentes de desborde del período: transiciones a `OVERFLOWED` con origen no nulo en el historial de estados (un contenedor que se desborda dos veces suma dos) | tendencia mensual descendente (`targets.overflowTrend`: `down`, sin valor) |
| Contenedores dañados pendientes | `incidents.containers.history.pendingDamage` | Contenedores cuyo último estado conocido al final del período es `DAMAGED` o `UNDER_REPAIR`; `null` sin historial | reducir pendientes mes a mes (`targets.pendingDamageTrend`: `down`, sin valor) |
| Resolución de reclamos dentro del plazo | `incidents.reports.withinDeadline.pct` | Reclamos `CLOSED` con días hábiles entre el alta y el cierre ≤ plazo objetivo ÷ reclamos `CLOSED` × 100; `null` sin cerrados | ≥ 85 % |
| Reclamos pendientes vencidos | `incidents.reports.overdue.pct` | Reclamos abiertos con días hábiles desde el alta hasta hoy > plazo objetivo ÷ reclamos abiertos × 100; `null` sin abiertos | ≤ 10 % |

**La cobertura solo cuenta lo vencido.** `scheduled` y `coveragePct` se calculan sobre los pares cuyo servicio tiene fecha programada de hoy o anterior (hoy es el día argentino). Lo programado a futuro va aparte en `upcoming`: todavía no es un incumplimiento. `pending` es "vencido y sin resultado cargado".

**`lowSample`.** Cada fila de `byZone` y `byServiceType` trae `lowSample: true` cuando tiene menos programados que `INDICATORS_MIN_SAMPLE` (5 por defecto): 2 de 2 es un 100 % que no dice nada. El `coveragePct` no cambia; la marca es informativa.

**Días hábiles.** Lunes a viernes, contados sobre los días argentinos del alta y del cierre: cuenta cada día hábil en `(alta, cierre]`, así que el mismo día es 0 y de viernes a lunes es 1. Los feriados no se consideran. `avgResolutionDays` sigue en días corridos; la meta se compara con `avgResolutionBusinessDays`.

**Desvío de programación.** Se mide en servicios, no en pares servicio/zona. Cuenta un servicio una sola vez si está `RESCHEDULED` o tiene al menos un aviso de demora (`ServiceDelayNotice`, vigente o reemplazado). Los `CANCELLED` no entran. No es el desvío del relleno sanitario: son indicadores distintos, con campos y metas propios.

**Qué tiene serie y comparación.** Cobertura, cumplimiento y residuos agrupan por la fecha programada del servicio. Incidencias agrupa las **denuncias** por día argentino de creación y suma, en cada punto, el historial de contenedores del intervalo (`containers`: `overflowIncidents`, `damageIncidents` y `pendingDamage` al fin del intervalo). Los **vencidos**, los conteos por estado y zona de contenedores y el arbolado no tienen serie ni `previous`.

**Contenedores: dos cosas distintas.** `containers.byStatus` y `containers.byZone` son una **foto del estado actual**: no dependen del período. `containers.history` sí es del período y sale del historial de estados (`container_status_history`, ver [entidades/container.md](../entidades/container.md#historial-de-estados-475)). El nivel de riesgo de cada árbol sale de su último relevamiento, uno por árbol.

**Historial de contenedores (#475).** `containers.history` trae `overflowIncidents`, `damageIncidents`, `pendingDamage` y `trackingSince`.

- *Incidente* = una fila del historial con destino `OVERFLOWED` (o `DAMAGED`) y **origen no nulo**, dentro del período (días argentinos). Cuenta por transición, no por contenedor. El alta y la fila base que siembra la migración (origen nulo) nunca cuentan, así que el despliegue no genera un pico falso.
- *Daño pendiente en T* = contenedores cuyo último estado conocido hasta T es `DAMAGED` o `UNDER_REPAIR` (T = último instante del último día argentino del período o intervalo). `ACTIVE`, `OVERFLOWED`, `RELOCATING` y `REMOVED` no son pendientes. Un contenedor sin filas hasta T no cuenta.
- **Sin dato no es cero:** si ningún contenedor tiene historial hasta T, `pendingDamage` es `null`. `trackingSince` es el instante de la fila más antigua (`null` si no hay ninguna): antes de esa fecha no hay datos. **No se reconstruye el pasado** anterior a la migración.
- `delta.overflowIncidents` y `delta.pendingDamage` son diferencias en **cantidades** (no porcentajes), `null` si alguno de los dos períodos no tiene historial.

**Reclamos dentro del plazo y vencidos (#475).** El **plazo objetivo** lo informa la respuesta (`reports.deadlineBusinessDays`) y sale de `INDICATORS_REPORT_DEADLINE_BUSINESS_DAYS` (5 por defecto, el mismo número que la meta del promedio de resolución). **Es un supuesto de M6, único para todos los tipos de reclamo, hasta que M2 acuerde el suyo**; no es un dato de M2. Se mide en días hábiles con la misma regla que `avgResolutionBusinessDays` (lunes a viernes, días argentinos, sin feriados, cuenta cada día hábil en `(alta, cierre]`).

- `reports.withinDeadline` = `{ resolved, withinDeadline, pct }`: resueltos (`CLOSED`) cuyo cierre (la última modificación, como en el promedio) cae dentro del plazo; justo el plazo cuenta como dentro. `pct` es `null` sin resueltos. Tiene serie (por día argentino de creación) y `previous`/`delta` (`withinDeadlinePct`, en puntos porcentuales).
- `reports.overdue` = `{ open, overdue, pct, byZone }` (`byZone` abajo, #511): **foto de hoy** de los reclamos creados en el período. *Abierto* = cualquier estado que no sea `CLOSED`; *vencido* = abierto cuyos días hábiles desde el alta hasta hoy (día argentino) superan el plazo. `pct` es `null` sin abiertos. Un reclamo cerrado nunca cuenta como abierto ni como vencido. **No tiene serie ni comparación**: el sistema no guarda el historial de estados de los reclamos.
- **Estados finales:** solo `CLOSED` es final. `DISMISSED` (desestimado), `NO_VIOLATION` (sin infracción) y `FORWARDED` (derivado) todavía pasan a `CLOSED` y se pueden reabrir (ver [`EnvironmentalReport`](../entidades/environmental-report.md#estados)), así que cuentan como abiertos. Es la lectura conservadora: no se da por resuelto lo que el modelo de estados no cerró.
- Variables nuevas, validadas al arrancar (plazo > 0; metas de 0 a 100): `INDICATORS_REPORT_DEADLINE_BUSINESS_DAYS` (5), `INDICATORS_TARGET_REPORTS_WITHIN_DEADLINE_PCT` (85, `min`) e `INDICATORS_TARGET_REPORTS_OVERDUE_PCT` (10, `max`).

**Vencidas y riesgo alto por zona, y «Ver lista» (#511).** Ninguno de los dos depende del período salvo por la fecha de alta de la denuncia.

- `reports.overdue` = foto **de hoy** de las denuncias **creadas** en `from`–`to`. `reports.overdue.byZone` la abre por zona (`zoneId`, `code`, `name`, `open`, `overdue`, `pct`), solo con zonas que tengan abiertas, y suma lo mismo que el total.
- **La denuncia no tiene zona propia.** Se usa la del servicio de su inspección más reciente (sin contar servicios `CANCELLED`), solo si ese servicio cubre **una única zona**. Las demás (sin inspección con servicio, o con un servicio de varias zonas) van juntas en una fila con `zoneId: null`, `code: null`, `name: null`: no se reparten ni se duplican. No hay filtro de listado para esa fila.
- `trees.byRiskLevel` y `trees.byZone` = foto **actual**: último relevamiento de cada árbol **activo**, sin importar `from`/`to`. La zona es la del árbol (`Tree.zoneId`, siempre informada). «Riesgo alto» es `HIGH`; `CRITICAL` es otro nivel y se cuenta aparte (para listar ambos, el frontend hace dos llamadas: `riskLevel=HIGH` y `riskLevel=CRITICAL`).
- `/indicators/incidents` no tiene `zoneId`: `byZone` ya trae todas las zonas.
- **Ver lista, con el mismo criterio que el conteo:** vencidas → `GET /environmental-reports?overdue=true&createdFrom=<from>&createdTo=<to>[&zoneId=<zona>]`; riesgo alto → `GET /trees?riskLevel=HIGH&active=true[&zoneId=<zona>]`. Ambos paginan con el formato habitual y `meta.total` es el del filtro. El filtro `overdue` lee los candidatos y decide con la misma función que el indicador (los días hábiles no se expresan en SQL).

**El tiempo medio de resolución cuenta solo los expedientes `CLOSED`**, medido de `createdAt` a `updatedAt`. Un expediente cerrado puede reabrirse (`CLOSED → UNDER_REVIEW`), pero mientras queda cerrado no se toca, así que `updatedAt` es una marca de cierre aceptable.

## `citizen-portal` — vista pública

**Los únicos endpoints de dominio que se sirven sin JWT, junto con `/health`.** El `@Public()` va endpoint por endpoint y no a nivel de clase: el guard global hace que todo endpoint nuevo nazca protegido, y abrir la clase entera haría que el próximo `GET` de acá salga público sin que nadie lo decida.

| Método | Ruta                        | Qué hace                                                                                                                                                                                                                                                                |
| ------ | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/public/reports/:ticketId` | **Público.** Seguimiento de la denuncia por el `ticketId` (UUID) del reclamo de M2; devuelve también `publicId` para mostrarlo. **No acepta el `publicId` (TK-…)**: es correlativo y el contrato de M2 prohíbe usarlo como credencial (#145). 404 exista o no el ticket |
| GET    | `/public/services`          | **Público.** Cuándo pasa el servicio. Filtros: `zoneId`, `serviceTypeId`, `from`, `to`. Sin fechas, los próximos 30 días                                                                                                                                                |
| GET    | `/public/green-points`      | **Público.** Puntos verdes activos con su ubicación y qué residuos recibe cada uno. Filtro: `zoneId`                                                                                                                                                                    |
| GET    | `/public/zones`             | **Público.** Zonas activas, para que el frontend arme el filtro de los otros dos. Sin paginar                                                                                                                                                                           |

**Límite de tasa, y solo acá.** Al no exigir token, esta es la única superficie que cualquiera en internet puede pegar: **60 consultas por minuto por dirección**, y **20 en `/public/reports/:ticketId`**, que es más estricto porque deja probar números de reclamo de a uno para averiguar cuáles tienen expediente ambiental. Devolver el mismo 404 exista o no el ticket evita confirmar uno puntual; el límite evita insistir. Pasado el límite, 429.

**Quién es "la dirección" cuando llama el BFF.** El frontend llama desde su servidor, así que por defecto el contador ve siempre la IP del BFF. Para contar por vecino, el BFF manda dos headers: `X-M6-BFF-Key: <BFF_SHARED_KEY>` (el secreto compartido, variable del backend en [deploy](../deploy.md)) y `X-Forwarded-For: <IP del vecino>` (se toma la primera IP de la lista, que debe ser una IP válida; si no, cuenta `req.ip`). **El BFF tiene que sobrescribir** este header con la IP que le entrega Vercel, nunca reenviar el que trae el navegador: si lo reenviara, la primera entrada la elegiría el vecino y podría saltearse el límite. El backend solo cree el `X-Forwarded-For` si la clave coincide (comparación en tiempo constante); sin clave, con una incorrecta, o con `BFF_SHARED_KEY` sin configurar, lo ignora y cuenta `req.ip`, de modo que un pedido directo con un `X-Forwarded-For` inventado no evita el límite. La clave nunca debe llegar al navegador.

Las rutas `/public/*` pasan por **dos guards**: el global de la app (generoso, ver abajo) y el propio del portal, con su contador cada uno; manda el más estricto. Además hay un límite global generoso (`THROTTLE_LIMIT`, 600 por minuto por IP y endpoint) y topes propios en `POST /events/inbox` (300/min) y `POST /evidence` (30/min); pasado el tope, 429. `GET /health*` no cuenta.

**Cada respuesta es una proyección explícita, no la fila de la base.** La diferencia importa: si mañana alguien agrega una columna al expediente, una proyección no la publica sola.

**Lo que no sale nunca por acá**, aunque esté en la misma fila: la identidad del inspector, los hallazgos y el checklist, el contenido del acta, la identidad del denunciante, y —en los servicios— la cuadrilla, el vehículo, las notas y el motivo interno de una reprogramación. Hay un test que lo verifica campo por campo.

**El expediente se resume a siete etapas, no a sus once estados.** `EnvironmentalReportStatus` es vocabulario de inspector: distingue cosas que le importan al supervisor, no al vecino. `VIOLATION_FOUND`, `NOTICE_ISSUED` y `SANCTIONED` son la misma etapa para el denunciante — el trámite sancionatorio sigue su curso.
