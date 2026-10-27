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
- **Ids de otros módulos** (`// EXT Mx` en el esquema) son texto opaco y se guardan tal como llegan. Lo acordado con cada grupo: de **M1**, `user_id` y `organizationId` son **numéricos** y `citizenId` es **UUID** (catálogo v3.0); los de **M2, M3, M4 y M7** (`ticketId`, `workOrderId`, `establishmentId`, `actId`, `streetClosureId`) son **UUID**. Los códigos legibles (`OT-…`, `EST-…`, `M4-MUL-…`) son solo referencias humanas y no se usan como id.
- **Estados** como enums de Prisma, nunca strings sueltos (catálogo en [enumeraciones.md](enumeraciones.md)).
- **Producción** es Supabase (puerto 5432, `?schema=public`). El `CMD` migra solo; **el seed no corre en el deploy**.

## 2. Qué es el seed

Un dataset de demostración **realista y determinístico** de Servicios Urbanos en los **48 barrios y las 15 comunas** de CABA. Ocho barrios (Belgrano, Palermo, Colegiales, Recoleta, San Nicolás, Puerto Madero, Montserrat y Retiro) conservan las calles, recorridos e incidencias escritas a mano, con coordenadas del normalizador USIG verificadas contra los polígonos oficiales; el resto de la Ciudad se completa con recorridos regionales, inventario generado dentro de cada barrio y espacios verdes reales.

Reglas con las que está escrito:

- **Determinístico**: nada de `Math.random`. Dos corridas el mismo día dan la misma base y una falla se reproduce. Lo generado sale de un PRNG con semilla (`prng(semillaDe('inventario-<barrio>'))`). Los UUID de otros módulos se derivan de un texto con `uuidDe(semilla)` (forma v4, siempre el mismo valor para la misma semilla).
- **Relativo a hoy**: las fechas se calculan desde «hoy» en Argentina (`todayArgentina()`), no son fijas. Un seed con fechas fijas envejece y la agenda aparece vacía.
- **Idempotente por partes**: zonas y comunas van por `syncZones`; los catálogos por `upsert` (lo escrito a mano) o `createMany` con `skipDuplicates` (lo generado); los espacios verdes se crean solo si faltan. Lo operativo (servicios, expedientes, derivaciones, eventos) se crea en **una sola transacción y solo si no hay servicios cargados**. Una segunda corrida no duplica nada, y tampoco refresca las fechas (ver 5).
- **Se valida antes de escribir**: `verificar()` revisa la planificación (sin choques de vehículo ni de cuadrilla, estados coherentes con el día) y `verificarCobertura()` el reparto (toda comuna con recorridos y servicios, todo barrio con inventario dentro de su polígono, tope de 800 servicios). Si algo no cierra aborta antes de tocar la base. `prisma/seed.spec.ts` corre las mismas comprobaciones.

## 3. Qué genera

**Zonas y comunas** (`syncZones`, desde `prisma/data/m9-*.json`): 15 comunas y 48 zonas, una por barrio, con el `code` de barrio de M9 (`belgrano`, `san-nicolas`…) y el `ZoneNeighborhood` con el UUID real de M9. Desaparecen las ocho zonas viejas `Z-…`; en una base que ya las tiene quedan como *legacy* (ver sección 7).

**Catálogos y recursos**
- Tipos de servicio, sitios de disposición final y **28 recorridos** con sus paradas y frecuencias semanales: 16 escritos a mano (centro y norte) y 12 regionales de recolección domiciliaria, uno por comuna del resto de la Ciudad (Comunas 3 a 12 y 15, más San Telmo y Constitución y Núñez), con sus barrios como paradas.
- **36 vehículos** (32 originales, con días de baja para los fuera de servicio, más 4 compactadores regionales) y **16 cuadrillas**: las 12 originales y 4 regionales de recolección (Sur, Oeste, Centro-Oeste y Noroeste). Arbolado, Espacios Verdes e Inspección cubren toda la Ciudad; las demás, las zonas de su comuna.

**Inventario urbano** (por barrio)
- **Espacios verdes**: los 1366 plazas, parques, plazoletas y paseos del dataset de BA Data, cada uno en la zona de su barrio, con nombre, tipo (`PLAZA` y `PLAZOLETA` → `SQUARE`; `PARQUE`, `PARQUE SEMIPÚBLICO` y `JARDÍN BOTÁNICO` → `PARK`; `PASEO` → `PROMENADE`), coordenadas y superficie. **Nombre = el del dataset, o la ubicación (con el tipo adelante) si falta**: 557 llevan el nombre derivado de la ubicación.
- **Contenedores, puntos verdes y arbolado**: los escritos a mano para los ocho barrios originales y, en todos los barrios, lo que falta hasta el mínimo (4 a 6 contenedores y 3 a 4 árboles por barrio, un punto verde por barrio). Cada punto cae dentro del polígono oficial del barrio (`docs/geojson/caba_barrios.geojson`) y, cuando se puede, a decenas de metros de una plaza real del barrio; el punto verde se ubica en la plaza más grande.
- Relevamientos de arbolado con sus estados sanitarios.

**Operación** (solo en base sin servicios)
- Servicios planificados desde **hace 14 días hasta el 16/12/2026** (fin de la cursada): pasado `COMPLETED`, hoy según el turno, futuro `SCHEDULED`. Unos 790 servicios (el seed anterior tenía 710), repartidos entre las 15 comunas: los recorridos del centro y el norte se espaciaron para dejar lugar a los de las otras comunas, y cada comuna suma un recorrido semanal y servicios puntuales (vaciado, riego o mantenimiento de una plaza real, inspección, poda). Incluye incidencias reales (parciales, suspendidos, demoras).
- Resultados por zona, registros de recolección y avisos de demora.
- Intervenciones de arbolado en distintos estados, con relevamientos y pedidos también en las otras comunas.
- Control ambiental: expedientes en todos los estados, inspecciones, actas, resoluciones de M4; varios con ubicación en otras comunas (referencia a una plaza real del barrio).
- Derivaciones: pedidos de reparación a M3 y cortes de calle a M7, con las respuestas ya recibidas, y otros en comunas del sur, el oeste y el noroeste.
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
| 61 líderes e integrantes de las 16 cuadrillas (`101`–`104`, `111`–`115`, `151`–`154`, `161`–`164`, `171`–`174`, `181`–`184`, `201`–`204`, …) | `ADMINISTRATIVO` | `M6_CAMPO_CUADRILLA` |
| `601`, `602` (cuadrilla de inspección) | `ADMINISTRATIVO` | `M6_CAMPO_CUADRILLA` y `M6_CAMPO_INSPECTOR` |

Los ids son los `sub` numéricos del token de M1 y **no cambian** con el catálogo v3.0 (lo que pasa a UUID es el `citizenId` de los eventos). No existen usuarios reales: M1 no está hosteado, así que los tokens de demo los firma `scripts/generate-demo-jwt.mjs` (ver [deploy.md](deploy.md)). Las filas se insertan directo en `user_role_assignment`, **sin auditoría**: es dato de arranque, no una asignación hecha por un admin. Oficina y Campo no se mezclan (ADR-005), y los ids de cuadrilla coinciden con `crew.leader_user_id` y `crew_member.user_id`, que es lo que exige la pertenencia de Campo (#365).

## 4. Qué es auténtico y qué no

**Auténtico**
- Las **zonas, comunas y sus UUID** (snapshot de M9 del 27/10/2026) y los polígonos de barrios y comunas (`docs/geojson/`).
- Los **espacios verdes**: dataset abierto «Espacios verdes» de BA Data (https://data.buenosaires.gob.ar/dataset/espacios-verdes), descargado el 27/10/2026. Nombres, clasificación y superficie son del dataset; el punto es uno representativo que cae dentro del polígono. La licencia se confirma en el portal (ver `prisma/data/README.md`). Se regenera con `npm run espacios-verdes:build`.
- Las calles y coordenadas escritas a mano de los ocho barrios originales (USIG).
- **Cuatro espacios verdes que nombran los servicios escritos a mano son aproximados**, porque el dataset no trae uno equivalente exacto:
  - «Parque Tres de Febrero (Bosques de Palermo)» → id 1537, *Lago de Regatas Ernesto Jaimovich* (Palermo; el dataset no trae el parque como tal y el lago es parte de él).
  - «Plaza de Mayo» → id 883, *Plaza 25 de Mayo* (Montserrat).
  - «Paseo de la Costanera Sur» → id 1274, *Reserva Ecológica* (Puerto Madero).
  - «Plaza Vicente López» → id 481, *Plaza V. López y Planes* (Recoleta).

**No auténtico**
- **Contenedores, puntos verdes y arbolado generados**: posiciones pseudoaleatorias dentro del barrio; la dirección es «Frente a <plaza real>», no una dirección postal. Códigos atados al barrio (no a su posición, así no se corren si M9 suma o baja uno): `CT-<codigo>-NNNN`, `GP-<codigo>-01`, `ARB-<codigo>-9NNNN`.
- Servicios, recorridos regionales, cuadrillas, vehículos (patentes ficticias), personas, expedientes, actas y derivaciones.
- Los `ticketId`, `workOrderId`, `establishmentId` y `streetClosureId` son UUID derivados con `uuidDe`: no existen en M2, M3, M4 ni M7.
- Los `citizenId` son UUID derivados con `uuidDe` (M1 v3.0 los emite UUIDv4); no existen en M1.
- Los `organizationId` de las cooperativas (`3301`–`3303`) siguen numéricos: la v3.0 de M1 no define su formato (solo cambia el del `citizenId`). Si M1 lo cambia, es `CREWS`.
- Los eventos del outbox/inbox sembrados **no se publicaron al bus**; son historia para el tablero.

## 5. Cómo correrlo

```bash
# Contra una base LOCAL (nunca la desplegada sin querer)
export DATABASE_URL='postgresql://user:password@localhost:5432/m6_ambiente?schema=public'
npm run prisma:migrate:deploy
npm run prisma:seed
```

Para **refrescar las fechas** de una base que ya tiene servicios hay que vaciarla primero, porque el seed no toca lo operativo si encuentra servicios. En local: `npx prisma migrate reset` (borra todo, migra y siembra solo).

**Aplicar esta versión a una base que ya tiene el seed anterior no actualiza lo operativo.** El seed agrega zonas, comunas, espacios verdes e inventario, pero no recrea servicios ni derivaciones, porque ve servicios cargados y se detiene. Para tener el reparto nuevo hay que vaciar lo operativo y volver a sembrar: es un paso **aparte y destructivo** (borra servicios, expedientes, derivaciones y eventos) que no se hace en la base desplegada sin acordarlo con el equipo; el seed no pisa el trabajo que alguien cargó a mano.

La transacción de lo operativo tardó ~17 min contra Supabase con 710 servicios y vence a la hora; por eso `verificarCobertura()` fija un tope de 800. Antes de subirlo, medir de nuevo.

**Limitaciones conocidas:** dos espacios verdes con el mismo nombre en un barrio se emparejan por orden de creación (no hay desempate real), y las `ServiceFrequency` ya creadas no se actualizan en una segunda corrida (se identifican por tipo, recorrido y turno).

## 6. Cómo mantenerlo

- Cambiar el esquema → migración nueva + `prisma:generate` + ajustar el seed si el modelo lo usa.
- Cambió el catálogo de M9 → bajar de nuevo `prisma/data/m9-*.json` (ver sección 7). Cambió el dataset de espacios verdes → `npm run espacios-verdes:build`.
- Agregar una cuadrilla o un integrante → `CREWS` (o `REGIONES` para las de recolección regional); sus roles de Campo salen solos. Personal de Oficina → `PERSONAL_DE_OFICINA`.
- Todo id de otro módulo nuevo respeta el formato de la sección 1: `user_id` de M1 numérico; `citizenId` y los ids de M2, M3, M4 y M7 UUID con `uuidDe`.
- Si cambia la fecha de fin de la cursada, es `FIN_DE_CURSADA`.

## 7. Zonas y comunas desde M9 (#421, #422)

El seed crea las zonas con `syncZones` y el snapshot versionado `prisma/data/m9-barrios.json` y `m9-zonas.json` (64 barrios, 48 activos de CABA; 20 zonas administrativas, 15 comunas activas; los ids UUID no son secretos). El snapshot es una foto del 27/10: si M9 cambia el catálogo hay que volver a bajarlo. Para sincronizar contra el catálogo vivo del Core está `npm run zones:sync-from-core` (ver [deploy.md](deploy.md#sincronizar-zonas-y-comunas-con-el-catálogo-de-m9-421)); el orden es migrar, sync, seed.

Una base con el seed viejo conserva sus ocho zonas `Z-…` (y sus `caba-…`) como *legacy*: el sync las reporta y no las toca si tienen datos. Se limpian al vaciar lo operativo (sección 5) o con `--clean-legacy`.
