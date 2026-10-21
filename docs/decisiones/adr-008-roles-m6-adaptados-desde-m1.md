# ADR-008: Roles de M6 adaptados desde el rol único de M1 y asignados localmente

## Estado

**Aceptado** — 2026-10-21 (base implementada en el PR 1 de [#161](https://github.com/hllous/Backend-M6-DAPS2/issues/161); el corte de seguridad es el PR 2)

## Contexto

M1 emite el JWT ([ADR-004](adr-004-jwt-m1-y-puerto-identidad.md)) con **un solo rol por usuario y sin área** (`CIUDADANO`, `MESA_ENTRADAS`, `ADMINISTRATIVO`, `RESPONSABLE_AREA`, `AUDITOR`, `SERVICIO`; ver [`integracion/m1.md`](../integracion/m1.md)). Un `RESPONSABLE_AREA` de Rentas es igual a uno de Ambiente, y ningún rol distingue Oficina de Campo, que el backend tiene que mantener excluyentes ([ADR-005](adr-005-alineacion-frontend-sesion-y-seguridad.md)). El rol de M1 solo no alcanza para autorizar dentro de M6.

## Decisión

Modelo híbrido: **M1 dice quién es la persona; M6 decide qué hace dentro del módulo.**

1. **Catálogo `M6Role`** (un único enum, en Prisma y re-exportado desde `src/auth/m6-role.ts`): `M6_ADMIN`, `M6_OFICINA_OPERACIONES`, `M6_OFICINA_AMBIENTAL`, `M6_CAMPO_CUADRILLA`, `M6_CAMPO_INSPECTOR`, `M6_AUDITOR`.
2. **`M1RoleAdapter`** traduce el rol de M1 a los roles de M6 **asignables** (un techo, no una concesión):

   | Rol de M1                                                            | Asignables en M6                                                                             |
   | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
   | `CIUDADANO` (y `PERSONA`, nombre viejo), `MESA_ENTRADAS`, `SERVICIO` | ninguno                                                                                      |
   | `ADMINISTRATIVO`                                                     | `M6_OFICINA_OPERACIONES`, `M6_OFICINA_AMBIENTAL`, `M6_CAMPO_CUADRILLA`, `M6_CAMPO_INSPECTOR` |
   | `RESPONSABLE_AREA`                                                   | los de `ADMINISTRATIVO` y `M6_ADMIN`                                                         |
   | `AUDITOR`                                                            | `M6_AUDITOR`                                                                                 |
   | cualquier otro valor                                                 | ninguno, con un `warn` (denegar por defecto)                                                 |

3. **Tabla local `UserRoleAssignment`** (`userId` como **texto**, el `sub` de M1; único por `(userId, role)`), que escribe un `M6_ADMIN` por `PUT/DELETE /role-assignments/:userId`.
4. **Roles efectivos** = (filas del usuario ∪ `M6_ADMIN` si su id está en `M6_BOOTSTRAP_ADMIN_USER_IDS`) ∩ asignables por su rol de M1. `JwtStrategy.validate()` los calcula **en cada request**, sin caché: un cambio de asignación, o de rol en M1, rige en la próxima request y no cuando vence el token de 15 minutos. Se exponen en `GET /me`, junto con `userId`, `subType` y el rol de M1.
5. **Exclusividad Oficina/Campo** (ADR-005) en el backend: Oficina = `M6_ADMIN`, `M6_OFICINA_*`; Campo = `M6_CAMPO_*`. Mezclarlos es un 400. Los dos de Campo juntos, o `M6_AUDITOR` con cualquiera, son válidos.
6. **No se queda sin administradores:** quitar el último `M6_ADMIN` de la tabla es un 409 salvo que haya admins de bootstrap. Se verifica dentro de una transacción `Serializable`.
7. **Auditoría append-only** (`RoleAssignmentAudit`: quién, a quién, `GRANT`/`REVOKE`, rol, cuándo). Cada alta o baja y su fila de auditoría van en la misma transacción; un trigger de la base rechaza `UPDATE` y `DELETE` sobre la tabla.
8. **Bootstrap:** `M6_BOOTSTRAP_ADMIN_USER_IDS` (ids de M1, separados por coma) da `M6_ADMIN` sin fila para que exista alguien que asigne. Esa persona **igual necesita `RESPONSABLE_AREA` en M1**, por la intersección. Al arrancar se loguea solo **cuántos** hay, no los ids: son cuentas con poder y alcanza con saber si la variable se cargó.

## La validación contra el rol de M1 no se hace al asignar

M6 no tiene un directorio de M1: no sabe qué rol tiene un `userId` hasta que ese usuario llega con un token. Por eso `PUT /role-assignments` no rechaza un rol que el rol de M1 del destinatario no permite. Queda asignado pero **no es efectivo**, y empieza a regir solo si M1 le da el rol que lo habilita. Es una consecuencia buscada del punto 4, y la que hace que bajarle el rol a alguien en M1 le quite el acceso sin tocar la tabla.

## Límites conocidos y operación

- **Asignado vs efectivo.** `GET /role-assignments/:userId` devuelve lo **asignado** (la tabla); `GET /me` devuelve lo **efectivo** (tras la intersección con M1, el bootstrap y la regla de Oficina/Campo). La UI de administración tiene que mostrar los dos, o una fila "dormida" parecerá un acceso que no rige. En ambos los roles salen en el **orden del enum** `M6Role` (`M6_ADMIN`, `M6_OFICINA_OPERACIONES`, `M6_OFICINA_AMBIENTAL`, `M6_CAMPO_CUADRILLA`, `M6_CAMPO_INSPECTOR`, `M6_AUDITOR`), no alfabético.
- **El bootstrap no puede tener Campo.** Un admin de bootstrap es `M6_ADMIN` (Oficina) sin fila, así que `PUT` con un rol `M6_CAMPO_*` para su id es un 400. Además, si igual quedara una fila de Campo (cargada a mano), la estrategia devuelve solo los roles de Oficina: el admin no pierde acceso y nunca conviven los dos lados.
- **"Último admin" cuenta filas, no admins efectivos.** M6 no conoce el rol de M1 de los otros usuarios, así que no puede saber si el otro `M6_ADMIN` de la tabla sigue siendo `RESPONSABLE_AREA`. Con al menos un id de bootstrap el chequeo se apaga. Consecuencia: si el bootstrap está mal cargado (ids que no son `RESPONSABLE_AREA` en M1) y se borra el último admin de la tabla, nadie administra roles. **Recuperación:** corregir `M6_BOOTSTRAP_ADMIN_USER_IDS` y redesplegar. **Prevención:** el bootstrap debe tener ids que de verdad sean `RESPONSABLE_AREA` en M1; verificarlo con `GET /me` (tiene que decir `M6_ADMIN`) y con el log de arranque (la cantidad de admins).
- **Auditoría inmutable.** Triggers sobre `role_assignment_audit` rechazan `UPDATE`, `DELETE` y `TRUNCATE`. Un superusuario puede saltarlos (`session_replication_role = replica`); los e2e lo hacen en su limpieza (`test/helpers.ts`, `SET LOCAL`, el usuario del contenedor y el del CI son superusuarios). En producción el usuario de la aplicación no debería serlo.
- **Sin rate limit.** No hay `ThrottlerGuard` global: `ThrottlerModule` solo está en `citizen-portal`. `/me` y `/role-assignments` no tienen límite de pedidos; lo acota que exigen JWT de empleado y que `/role-assignments` exige `M6_ADMIN`. El rate limit general queda para después de la entrega.
- **Log de roles desconocidos.** El `warn` del adaptador sale una vez por valor distinto (hasta 50) por proceso, no por request.

## Alternativas consideradas

- **Derivar el rol de M6 directo del de M1:** descartada. Sin área, cualquier jefe de cualquier área administraría M6, y no se distingue Oficina de Campo.
- **Roles propios de M6 dentro del token (BFF):** descartada. Contradice "M6 no emite JWT" ([ADR-004](adr-004-jwt-m1-y-puerto-identidad.md)).
- **Consultar a M1 el rol del destinatario al asignar:** descartada. M1 no tiene endpoint para eso y sería una dependencia síncrona nueva.
- **Caché de la tabla:** pospuesta. Es una consulta por request sobre una tabla de decenas de filas; se agrega con invalidación si el costo lo pide.

## Consecuencias

### Positivas

- El acceso se revoca en la próxima request, sin esperar al vencimiento del token.
- La exclusividad de ADR-005 y el cierre de "no quedarse sin admin" no dependen del frontend.
- `SERVICIO`, `MESA_ENTRADAS` y un rol desconocido nunca llegan a la lógica de M6.

### Negativas

- Una consulta a la base por request autenticado.
- Hay que cargar `M6_BOOTSTRAP_ADMIN_USER_IDS` en el despliegue o nadie puede asignar roles.
- Una fila asignada que M1 no permite queda "dormida": no se ve como error, solo en `GET /me`.

### Neutras

- La pertenencia (Campo solo sobre lo suyo) es una fase aparte (#365).
- `userId` es siempre texto: los ids de M1 son numéricos pero un `bigint` pierde precisión en JSON.

## Nota 21/10/2026: corte de seguridad (PR 2 de #161)

Hecho: `RolesGuard` pasó a ser el segundo `APP_GUARD`, después de `JwtAuthGuard` (un spec fija el orden). Reglas: `@Public()` lo saltea; con `@Roles(...)` hace falta alguno de esos roles; sin `@Roles`, un GET/HEAD exige algún rol de M6 (el auditor incluido) y una escritura **falla cerrado** para todos, con un log de error de configuración. El 403 por rol lleva `code: ROLE_REQUIRED` y no dice qué rol faltaba; los 403 de `sub_type` (#359) no cambian. `GET /me` queda con `@AnyEmployee()` para que un empleado sin roles pueda enterarse de que no tiene ninguno.

- La matriz vive en `src/auth/role-groups.ts` y se aplica con `@Roles(...)` en todas las escrituras. `M6_ADMIN` entra en lo de Oficina, no en lo de Campo (ADR-005); `M6_AUDITOR` no figura en ninguna escritura. `POST /events/inbox` y la carga manual de respuestas de M3/M7 (`/repair-requests/:id/start|close`, `/street-closure-requests/:id/approve|reject|end`) son solo de `M6_ADMIN`.
- `@Roles` documenta solo el 403 en Swagger (decorador compuesto); `ErrorResponseDto` suma `code` opcional.
- `authorizedByUserId` (autorizar intervención) e `inspectorId` (relevamiento de arbolado, completar inspección) salen del token. Los campos del body siguen aceptándose, marcados deprecated en Swagger, y su valor **se ignora**. En `POST /environmental-reports/:id/inspections` el `inspectorId` también se ignora: quien programa (Oficina) no es el inspector, que queda registrado al completar.
- `src/auth/route-roles.spec.ts` recorre todos los handlers y falla si una escritura no declara `@Roles`, si usa un valor fuera de `M6Role`, si el auditor aparece en una escritura o si el inbox no es solo de `M6_ADMIN`. La columna "Rol" de `docs/api/endpoints.md` se genera de la misma metadata (`npm run docs:roles`) y el mismo spec falla si queda vieja.
- Asignar un rol que el rol de M1 del destinatario no permite **no** da 400: M6 no conoce el rol de M1 de otros al asignar, rige por la intersección al iniciar sesión (cambia respecto de la propuesta de #235).
- `test/auth-roles.e2e-spec.ts` cubre la matriz (cierra #235). Los e2e existentes siembran actores con `seedActores` y usan `Api.porRol`.

## Referencias

- Issue #161 y sus comentarios del 21/10 (decisiones del PO)
- [`integracion/m1.md`](../integracion/m1.md): contrato del JWT y lista de roles de M1
- [ADR-004](adr-004-jwt-m1-y-puerto-identidad.md), [ADR-005](adr-005-alineacion-frontend-sesion-y-seguridad.md)
