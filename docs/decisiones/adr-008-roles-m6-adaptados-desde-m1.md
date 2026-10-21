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

- Este PR no activa el `RolesGuard` global ni pone `@Roles` en los demás endpoints (PR 2): hoy solo `role-assignments` exige `M6_ADMIN`. La pertenencia (Campo solo sobre lo suyo) es una fase aparte.
- `userId` es siempre texto: los ids de M1 son numéricos pero un `bigint` pierde precisión en JSON.

## Referencias

- Issue #161 y sus comentarios del 21/10 (decisiones del PO)
- [`integracion/m1.md`](../integracion/m1.md): contrato del JWT y lista de roles de M1
- [ADR-004](adr-004-jwt-m1-y-puerto-identidad.md), [ADR-005](adr-005-alineacion-frontend-sesion-y-seguridad.md)
