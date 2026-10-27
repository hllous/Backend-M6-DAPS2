# Seed y Prisma

> Qué es el seed de demostración (`prisma/seed.ts`), qué genera, cómo se corre y cómo se usa Prisma en el módulo. Leer antes de tocar el seed, el esquema o las migraciones.

## 1. Prisma en el módulo

| Pieza | Dónde | Para qué |
|---|---|---|
| Esquema | `prisma/schema.prisma` | Modelos, enums y relaciones. Fuente de verdad de la base y de los tipos TypeScript |
| Migraciones | `prisma/migrations/` | Una carpeta SQL por cambio de esquema, versionada en git. Nunca se editan una vez mergeadas |
| Cliente | `@prisma/client` (generado) | Lo usan los services vía `PrismaService` (`src/prisma/`) |
| Seed | `prisma/seed.ts` | Datos de demostración (ver abajo) |

| Comando | Qué hace |
|---|---|
| `npm run prisma:generate` | Regenera el cliente desde el esquema. Hay que correrlo después de cambiar `schema.prisma` o de bajar cambios que lo tocaron; sin eso `tsc` falla con «no exported member» |
| `npm run prisma:migrate:dev` | Crea y aplica una migración en la base local a partir del esquema (solo desarrollo) |
| `npm run prisma:migrate:deploy` | Aplica las migraciones pendientes sin generar nada nuevo. En producción lo corre solo el `CMD` del Dockerfile (`prisma migrate deploy && node dist/main.js`) |
| `npm run prisma:seed` | Corre el seed contra la base de `DATABASE_URL` |
| `npm run prisma:studio` | Explorador web de la base |

Convenciones del esquema:

- **Ids propios de M6**: `uuid` (`@id @default(uuid()) @db.Uuid`). Los genera la base, no el seed.
- **Ids de otros módulos** (`// EXT Mx` en el esquema) son texto opaco y se guardan tal como llegan. Lo acordado con cada grupo: los de **M1** (`user_id`, `citizenId`, `organizationId`) son **numéricos**; los de **M2, M3, M4 y M7** (`ticketId`, `workOrderId`, `establishmentId`, `actId`, `streetClosureId`) son **UUID**. Los códigos legibles (`OT-…`, `EST-…`, `M4-MUL-…`) son solo referencias humanas y no se usan como id.
- **Estados** como enums de Prisma, nunca strings sueltos (catálogo en [enumeraciones.md](enumeraciones.md)).
- **Producción** es Supabase (puerto 5432, `?schema=public`). El `CMD` migra solo; **el seed no corre en el deploy**.

## 2. Qué es el seed

Un dataset de demostración **realista y determinístico** de Servicios Urbanos en ocho barrios de CABA: Belgrano, Palermo, Colegiales, Recoleta, San Nicolás, Puerto Madero, Montserrat y Retiro. Las calles son reales y las coordenadas salen del normalizador USIG, verificadas contra los polígonos oficiales de barrios.

Reglas con las que está escrito:

- **Determinístico**: nada de `Math.random`. Dos corridas el mismo día dan la misma base y una falla se reproduce. Los UUID de otros módulos se derivan de un texto con `uuidDe(semilla)` (forma v4, siempre el mismo valor para la misma semilla).
- **Relativo a hoy**: las fechas se calculan desde «hoy» en Argentina (`todayArgentina()`), no son fijas. Un seed con fechas fijas envejece y la agenda aparece vacía.
- **Idempotente por partes**: los catálogos van por `upsert` sobre su clave natural. Lo operativo (servicios, expedientes, derivaciones, eventos) se crea en **una sola transacción y solo si no hay servicios cargados**. Una segunda corrida no duplica nada, y tampoco refresca las fechas (ver 5).
- **Se valida antes de escribir**: `verificar()` revisa la planificación (sin choques de vehículo ni de cuadrilla, estados coherentes con el día) y aborta antes de tocar la base.

## 3. Qué genera

**Catálogos y recursos** (upsert)
- Tipos de servicio, 8 zonas y sus barrios, 16 recorridos con sus paradas y frecuencias semanales, sitios de disposición final.
- 32 vehículos (con días de baja para los fuera de servicio) y **12 cuadrillas**: municipales y 3 cooperativas de recuperadores, con su turno, tipos de servicio y zonas.

**Inventario urbano**
- Contenedores (domiciliarios y de reciclables), puntos verdes, arbolado con sus relevamientos y espacios verdes.

**Operación** (solo en base sin servicios)
- Servicios planificados desde **hace 14 días hasta el 16/12/2026** (fin de la cursada): pasado `COMPLETED`, hoy según el turno, futuro `SCHEDULED`. Incluye incidencias reales (parciales, suspendidos, demoras) y servicios puntuales (vaciado, lavado, voluminosos, poda, espacios verdes, inspecciones).
- Resultados por zona, registros de recolección y avisos de demora.
- Intervenciones de arbolado en distintos estados.
- Control ambiental: expedientes en todos los estados, inspecciones, actas, resoluciones de M4.
- Derivaciones: pedidos de reparación a M3 y cortes de calle a M7, con las respuestas ya recibidas.
- Eventos: filas del **outbox** (lo que M6 publicó) y del **inbox** (lo que llegó de otros módulos).

**Personas y roles** (siempre, también si la operación ya estaba)

| Ids | Rol de M1 en el token | Roles de M6 que asigna el seed |
|---|---|---|
| `1` | `RESPONSABLE_AREA` | `M6_ADMIN` por `M6_BOOTSTRAP_ADMIN_USER_IDS`; **sin fila** |
| `2` | `RESPONSABLE_AREA` | `M6_ADMIN` |
| `3`, `4` | `ADMINISTRATIVO` | `M6_OFICINA_OPERACIONES` |
| `5`, `6` | `ADMINISTRATIVO` | `M6_OFICINA_AMBIENTAL` |
| `7` | `ADMINISTRATIVO` | Operaciones y Ambiental |
| `8`, `9` | `AUDITOR` | `M6_AUDITOR` |
| 45 líderes e integrantes de las 12 cuadrillas (`101`–`104`, `111`–`115`, `201`–`204`, …) | `ADMINISTRATIVO` | `M6_CAMPO_CUADRILLA` |
| `601`, `602` (cuadrilla de inspección) | `ADMINISTRATIVO` | `M6_CAMPO_CUADRILLA` y `M6_CAMPO_INSPECTOR` |

Los ids son los `sub` numéricos del token de M1. No existen usuarios reales: M1 no está hosteado, así que los tokens de demo los firma `scripts/generate-demo-jwt.mjs` (ver [deploy.md](deploy.md)). Las filas se insertan directo en `user_role_assignment`, **sin auditoría**: es dato de arranque, no una asignación hecha por un admin. Oficina y Campo no se mezclan (ADR-005), y los ids de cuadrilla coinciden con `crew.leader_user_id` y `crew_member.user_id`, que es lo que exige la pertenencia de Campo (#365).

## 4. Qué NO es auténtico

- `neighborhoodId` de zonas y barrios: slugs `caba-…`. El catálogo de barrios es de M9 y todavía no carga los reales; cuando lo publique hay que reemplazarlos (ver [bloqueantes.md](bloqueantes.md)).
- Los `ticketId`, `workOrderId`, `establishmentId` y `streetClosureId` son UUID derivados con `uuidDe`: no existen en M2, M3, M4 ni M7.
- Los `citizenId` (`88421`, `90112`) y los `organizationId` de las cooperativas (`3301`–`3303`) son numéricos inventados con la forma de M1.
- Los eventos del outbox/inbox sembrados **no se publicaron al bus**; son historia para el tablero.

## 5. Cómo correrlo

```bash
# Contra una base LOCAL (nunca la desplegada sin querer)
export DATABASE_URL='postgresql://user:password@localhost:5432/m6_ambiente?schema=public'
npm run prisma:migrate:deploy
npm run prisma:seed
```

Para **refrescar las fechas** de una base que ya tiene servicios hay que vaciarla primero, porque el seed no toca lo operativo si encuentra servicios. En local: `npx prisma migrate reset` (borra todo, migra y siembra solo). En la base desplegada no se hace sin acordarlo con el equipo; el seed no pisa el trabajo que alguien cargó a mano.

## 6. Cómo mantenerlo

- Cambiar el esquema → migración nueva + `prisma:generate` + ajustar el seed si el modelo lo usa.
- Agregar una cuadrilla o un integrante → `CREWS`; sus roles de Campo salen solos. Personal de Oficina → `PERSONAL_DE_OFICINA`.
- Todo id de otro módulo nuevo respeta el formato de la sección 1 (M1 numérico, el resto UUID con `uuidDe`).
- Si cambia la fecha de fin de la cursada, es `FIN_DE_CURSADA`.
