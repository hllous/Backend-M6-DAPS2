# Seed y Prisma

> Qué es el seed de demostración (`prisma/seed.ts`), qué genera, cómo se corre y cómo se usa Prisma en el módulo. Leer antes de tocar el seed, el esquema o las migraciones.

## 1. Prisma en el módulo

| Pieza | Dónde | Para qué |
|---|---|---|
| Esquema | `prisma/schema.prisma` | Modelos, enums y relaciones. Fuente de verdad de la base y de los tipos TypeScript |
| Migraciones | `prisma/migrations/` | Una carpeta SQL por cambio de esquema, versionada en git (33 al 06/11). Nunca se editan una vez mergeadas |
| Cliente | `@prisma/client` (generado) | Lo usan los services vía `PrismaService` (`src/prisma/`) |
| Seed | `prisma/seed.ts` | Datos de demostración (ver abajo) |

| Comando | Qué hace |
|---|---|
| `npm run prisma:generate` | Regenera el cliente desde el esquema. Hay que correrlo después de cambiar `schema.prisma` o de bajar cambios que lo tocaron; sin eso `tsc` falla con «no exported member» |
| `npm run prisma:migrate:dev` | Crea y aplica una migración en la base local a partir del esquema (solo desarrollo) |
| `npm run prisma:migrate:deploy` | Aplica las migraciones pendientes sin generar nada nuevo. En producción lo corre solo el `CMD` del Dockerfile (`prisma migrate deploy && node dist/main.js`) |
| `npm run prisma:seed` | Corre el seed contra la base de `DATABASE_URL`. **Se niega si el host no es `localhost`, `127.0.0.1` o `::1`** (se parsea la URL) salvo `SEED_CONFIRM_REMOTE=1` |
| `npm run prisma:studio` | Explorador web de la base |

Convenciones del esquema:

- **Ids propios de M6**: `uuid` (`@id @default(uuid()) @db.Uuid`). Los genera la base, no el seed.
- **Ids de otros módulos** (`// EXT Mx` en el esquema) son texto opaco y se guardan tal como llegan. Lo acordado con cada grupo: de **M1**, `user_id` y `organizationId` son **numéricos** y `citizenId` es **UUID** (catálogo v3.0); los de **M2, M3, M4 y M7** (`ticketId`, `workOrderId`, `establishmentId`, `actId`, `streetClosureId`) son **UUID**. Los códigos legibles (`OT-…`, `EST-…`, `M4-MUL-…`) son solo referencias humanas y no se usan como id.
- **Estados** como enums de Prisma, nunca strings sueltos (catálogo en [enumeraciones.md](enumeraciones.md)).
- **Producción** es Supabase (puerto 5432, `?schema=public`). El `CMD` migra solo; **el seed no corre en el deploy**.

## 2. Qué es el seed

Un dataset de demostración **realista y determinístico** de Servicios Urbanos en los **48 barrios y las 15 comunas** de CABA. Ocho barrios (Belgrano, Palermo, Colegiales, Recoleta, San Nicolás, Puerto Madero, Montserrat y Retiro) conservan las calles, recorridos e incidencias escritas a mano, con coordenadas del normalizador USIG verificadas contra los polígonos oficiales; el resto de la Ciudad se completa con recorridos regionales, contenedores, puntos verdes y arbolado reales de IDECABA (una muestra) y espacios verdes reales.

Reglas con las que está escrito:

- **Determinístico**: nada de `Math.random`. Dos corridas el mismo día dan la misma base y una falla se reproduce. La muestra de IDECABA se sortea una vez con un PRNG con semilla (`npm run datos-ciudad:build`) y queda versionada en `prisma/data/`; el seed solo la lee. Los UUID de otros módulos se derivan de un texto con `uuidDe(semilla)` (forma v4, siempre el mismo valor para la misma semilla).
- **Relativo a hoy**: las fechas se calculan desde «hoy» en Argentina (`todayArgentina()`), no son fijas. Un seed con fechas fijas envejece y la agenda aparece vacía.
- **Idempotente por partes**: zonas y comunas van por `syncZones`; los catálogos por `upsert` (lo escrito a mano) o `createMany` con `skipDuplicates` (lo generado); los espacios verdes se crean solo si faltan. Lo operativo (servicios, expedientes, derivaciones, eventos) se crea en **una sola transacción y solo si no hay servicios cargados**. Una segunda corrida no duplica nada, y tampoco refresca las fechas (ver 5).
- **Se valida antes de escribir**: `verificar()` revisa la planificación (sin choques de vehículo ni de cuadrilla, estados coherentes con el día) y `verificarCobertura()` el reparto (toda comuna con recorridos y servicios, todo barrio con inventario dentro de su polígono, tope de 800 servicios). Si algo no cierra aborta antes de tocar la base. `prisma/seed.spec.ts` corre las mismas comprobaciones.

## 3. Qué genera

**Zonas y comunas** (`syncZones`, desde `prisma/data/m9-*.json`): 15 comunas y 48 zonas, una por barrio, con el `code` de barrio de M9 (`belgrano`, `san-nicolas`…) y el `ZoneNeighborhood` con el UUID real de M9. Desaparecen las ocho zonas viejas `Z-…`; en una base que ya las tiene quedan como *legacy* (ver sección 7).

**Catálogos y recursos**
- Tipos de servicio, sitios de disposición final y **28 recorridos** con sus paradas y frecuencias semanales: 16 escritos a mano (centro y norte) y 12 regionales de recolección domiciliaria, uno por comuna del resto de la Ciudad (Comunas 3 a 12 y 15, más San Telmo y Constitución y Núñez), con sus barrios como paradas.
- **36 vehículos** (32 originales, con días de baja para los fuera de servicio, más 4 compactadores regionales) y **496 cuadrillas**: las 16 operativas (12 originales y 4 regionales de recolección: Sur, Oeste, Centro-Oeste y Noroeste), que conducen los servicios planificados, y **480 generadas por cobertura** (#455), 10 por barrio. Cada generada tiene una única zona (`homeZoneId`) y una especialidad, así `GET /crews?zoneId=&specialty=` encuentra candidatas en los 48 barrios para las 7 especialidades. Composición por barrio, y por qué: recolección ×3 (uno por turno, la recolección es la que más se refuerza), barrido ×2 (mañana y noche), y una de limpieza (tarde), de reciclables (cooperativa, tarde), de arbolado (mañana), de espacios verdes (mañana) y de inspección (tarde): 3+2+1+1+1+1+1 = 10, 480 en total. Cada una tiene un responsable y 1 a 3 integrantes más (2 a 4 personas, ~1.500 `crew_member` en total). Las generadas no tienen servicios: son capacidad para asignar. El modelo no ata un vehículo a la cuadrilla (se elige al asignar el servicio, entre los tipos aptos), por eso los 36 vehículos alcanzan; los servicios planificados siguen usando solo las 16 operativas, que respetan zona, especialidad y turnos sin superposición (`verificar`).

**Inventario urbano** (por barrio)
- **Espacios verdes**: los 1366 plazas, parques, plazoletas y paseos del dataset de BA Data, cada uno en la zona de su barrio, con nombre, tipo (`PLAZA` y `PLAZOLETA` → `SQUARE`; `PARQUE`, `PARQUE SEMIPÚBLICO` y `JARDÍN BOTÁNICO` → `PARK`; `PASEO` → `PROMENADE`), coordenadas y superficie. **Nombre = el del dataset, o la ubicación (con el tipo adelante) si falta**: 557 llevan el nombre derivado de la ubicación.
- **Contenedores, puntos verdes y arbolado** (500 contenedores, 28 puntos verdes y 442 árboles en total): los escritos a mano para los ocho barrios originales (52, 9 y 34; los escenarios de servicios, derivaciones y relevamientos los referencian por código) más la **muestra real de IDECABA** en los 48 barrios: **448 contenedores** (325 negros `HOUSEHOLD` + 123 verdes `RECYCLABLE`), de modo que la base tiene **exactamente 500** (356 `HOUSEHOLD`, 139 `RECYCLABLE` y 5 `GREEN`/`BULKY` de los escritos a mano), 9 a 13 por barrio (13 en Belgrano y Palermo) y 2 a 3 verdes de la muestra real en cada uno, **los 19 puntos verdes** de la Ciudad y **408 árboles** (8 a 9 por barrio) con especie y vitalidad del censo. El barrio de cada punto se decide por geometría contra `docs/geojson/caba_barrios.geojson`; todo cae dentro de su polígono. De los árboles que el censo marca «En Observación» (`DISEASED`, 12), «Escasa Foliación» (`WEAKENED`, 9), «Tocón» o «Cepa» (`DEAD`, 1) se siembra un relevamiento con el estado mapeado; los que ya llevan un relevamiento de demostración no se duplican.
- Relevamientos de arbolado con sus estados sanitarios.
- **Contenedores reales en distintos estados** (#439): 11 contenedores de IDECABA con estado de demostración, uno por barrio y todos fuera de las comunas originales (1, 2, 13, 14): 5 `OVERFLOWED` (Balvanera c3, Almagro c5, Caballito c6, Flores c7, Villa Crespo c15), 3 `DAMAGED` (Barracas c4 tapa rota, Villa Lugano c8 daño estructural con obra pública, Liniers c9 vandalizado; cada uno emite `containerDamaged` hacia M3), 2 `UNDER_REPAIR` (Monte Castro c10, Villa Urquiza c12) y 1 `RELOCATING` (Villa Devoto c11). Hay **12 servicios de vaciado** sobre ellos, con la cuadrilla regional de su comuna: 5 agendados por reclamo de vecinos, uno por cada desbordado (Balvanera, con un aviso de demora de inicio levantado ayer a la noche; Almagro, Caballito, Flores y Villa Crespo), de modo que los 5 siguen `OVERFLOWED` con su vaciado pendiente; 1 completado sobre un contenedor activo de Almagro; 2 completados con la nota «último vaciado antes de llevarlo al taller» (Monte Castro, Villa Urquiza); y 4 cancelados con motivo (dañados y en reubicación). Los vaciados completados tienen su registro de recolección. Los servicios sembrados hoy son 743 (el 2/11), por debajo del tope de 800 (`TOPE_SERVICIOS`). `verificar()` exige que un vaciado completado de un contenedor que no está `ACTIVE` lleve una nota que lo explique, y que un aviso de demora no esté en el futuro. No hay lavados (`CONT-LAV`): solo lo hace la cuadrilla de Recoleta. Los códigos de estos contenedores son `CT-<barrio>-0001`, el negro de menor `id` de IDECABA del barrio.
- **Historial de estados de los contenedores** (#475, tabla `container_status_history`; ver [entidades/container.md](entidades/container.md#historial-de-estados-475)). Se siembra con lo operativo (solo en base sin servicios), con `historialDeContenedores()`, una función pura y determinística (hash del código, sin azar) que `prisma/seed.spec.ts` verifica: cada uno de los 500 contenedores nace hace 180 días con una fila de alta (origen nulo) y, en los últimos 5 meses, algunos se desbordan y se vacían o se dañan y se reparan (alrededor de 1500 filas). Hay **más desbordes y daños en los meses viejos que en los recientes** (por ejemplo, 79 desbordes en junio contra 44 en octubre), así que el tablero muestra una tendencia descendente; algunas reparaciones duran hasta 29 días y cruzan el fin de mes, así que hay daños pendientes en cada corte. **Nunca contradice el estado de hoy**: los 11 de `CONTENEDORES_DEMO` y los escritos a mano que no están `ACTIVE` terminan con su transición abierta hace 2 a 7 días (un `UNDER_REPAIR` pasó antes por `DAMAGED`, un `REMOVED` también) y todo ciclo anterior se cierra antes. Respeta la máquina de estados de `CONTAINER_TRANSITIONS`. No se genera historial para una base que ya tiene servicios (mismo criterio que lo operativo). En una base que viene de la migración, las filas base (una por contenedor, instante de la migración, origen nulo) conviven con estas sin contradecirlas: el seed no las pisa.
- > **Nota (#439):** `TreeSurvey` suma hasta 22 filas sembradas para los árboles de la muestra de IDECABA que no están sanos, con un riesgo **inventado** (la fuente no lo trae): `LOW` para `WEAKENED` (copa rala), `MEDIUM` para `DISEASED` (en seguimiento) y para `DEAD` (tocón o cepa: no queda copa que caiga). Se evitó `HIGH` y `CRITICAL` porque emiten `treeRiskDetected` al outbox. No generan eventos. Un árbol que ya lleva un relevamiento de demo no se duplica, así que pueden ser algunas menos.

**Operación** (solo en base sin servicios)
- Servicios planificados desde **hace 14 días hasta el 16/12/2026** (fin de la cursada): pasado `COMPLETED`, hoy según el turno, futuro `SCHEDULED`. 743 servicios al 2/11 (el seed anterior tenía 710; 800 es solo el tope, `TOPE_SERVICIOS`, y la cifra baja con los días porque la ventana arranca hace 14 días y termina en una fecha fija), repartidos entre las 15 comunas: los recorridos del centro y el norte se espaciaron para dejar lugar a los de las otras comunas, y cada comuna suma un recorrido semanal y servicios puntuales (vaciado, riego o mantenimiento de una plaza real, inspección, poda). Incluye incidencias reales (parciales, suspendidos, demoras).
- Resultados por zona, registros de recolección y avisos de demora.
- Intervenciones de arbolado en distintos estados, con relevamientos y pedidos también en las otras comunas.
- Control ambiental: expedientes en todos los estados, inspecciones, actas, resoluciones de M4; varios con ubicación en otras comunas (referencia a una plaza real del barrio).
- Derivaciones: pedidos de reparación a M3 y cortes de calle a M7, con las respuestas ya recibidas, y otros en comunas del sur, el oeste y el noroeste.
- Eventos: filas del **outbox** (lo que M6 publicó) y del **inbox** (lo que llegó de otros módulos).

**Personas y roles** (siempre, también si la operación ya estaba)

| Ids | Rol de M1 en el token | Roles de M6 que asigna el seed |
|---|---|---|
| `1` | `RESPONSABLE_AREA` | `M6_ADMIN` por `M6_BOOTSTRAP_ADMIN_USER_IDS`; **sin fila** (cuenta compartida de M1, sigue valiendo) |
| `10000`, `10001` | `RESPONSABLE_AREA` | `M6_ADMIN` |
| `10002`, `10003` | `ADMINISTRATIVO` | `M6_OFICINA_OPERACIONES` |
| `10004`, `10005` | `ADMINISTRATIVO` | `M6_OFICINA_AMBIENTAL` |
| `10006` | `ADMINISTRATIVO` | Operaciones y Ambiental |
| `10007`, `10008` | `AUDITOR` | `M6_AUDITOR` |
| `10009` (líder) y `10010` (integrante) de la cuadrilla de recolección de Belgrano y Colegiales; `10011` (líder de la de inspección) | `ADMINISTRATIVO` | `M6_CAMPO_CUADRILLA`; `10011` además `M6_CAMPO_INSPECTOR` |
| Resto de las personas de las 496 cuadrillas, **sin login**: `10100 + 10 × posición de la cuadrilla en CREWS + n` (`BASE_PERSONAS`; las 16 operativas ocupan `10100`–`10253`, las generadas desde `10260`; el último es ~`15051`) | `ADMINISTRATIVO` | `M6_CAMPO_CUADRILLA` (~1.500 filas con las de Oficina) |
| Integrantes de toda cuadrilla con especialidad de inspección (`10011`, `10171` y las 48 generadas) | `ADMINISTRATIVO` | `M6_CAMPO_CUADRILLA` y `M6_CAMPO_INSPECTOR` |

**Las 12 cuentas de M1 (#488).** El 02/11 a las 19:38 se le pidió a M1 un lote de 12 cuentas de empleado con `user_id` `10000`–`10011` (`10000`–`10001` `RESPONSABLE_AREA`; `10002`–`10006` `ADMINISTRATIVO`, personal de oficina; `10007`–`10008` `AUDITOR`; `10009`–`10010` `ADMINISTRATIVO`, líder e integrante de una cuadrilla de campo; `10011` `ADMINISTRATIVO`, inspector). El seed se adaptó a ese pedido: quién es quién lo decide esta tabla, y los nombres son fijos (`NOMBRES_FIJOS` en `prisma/seed.ts`; son los que ya usa el frontend).

| `user_id` | Rol de M1 | Roles de M6 | Nombre | Cuadrilla |
|---|---|---|---|---|
| `10000` | `RESPONSABLE_AREA` | `M6_ADMIN` | Carlos Rodríguez (persona **Admin**) | no |
| `10001` | `RESPONSABLE_AREA` | `M6_ADMIN` | Marta Gómez | no |
| `10002` | `ADMINISTRATIVO` | `M6_OFICINA_OPERACIONES` | Julián López (persona **Operaciones**) | no |
| `10003` | `ADMINISTRATIVO` | `M6_OFICINA_OPERACIONES` | Lucía Fernández | no |
| `10004` | `ADMINISTRATIVO` | `M6_OFICINA_AMBIENTAL` | Diego Sosa (persona **Ambiental**) | no |
| `10005` | `ADMINISTRATIVO` | `M6_OFICINA_AMBIENTAL` | Valeria Acosta | no |
| `10006` | `ADMINISTRATIVO` | Operaciones y Ambiental | Mateo Benítez | no |
| `10007` | `AUDITOR` | `M6_AUDITOR` | Camila Medina (persona **Auditoría**) | no |
| `10008` | `AUDITOR` | `M6_AUDITOR` | Héctor Ríos | no |
| `10009` | `ADMINISTRATIVO` | `M6_CAMPO_CUADRILLA` | Sofía López (persona **Líder**) | Cuadrilla Municipal Belgrano y Colegiales — Recolección (`LEADER`) |
| `10010` | `ADMINISTRATIVO` | `M6_CAMPO_CUADRILLA` | Diego Martínez (persona **Integrante**) | La misma (`MEMBER`) |
| `10011` | `ADMINISTRATIVO` | `M6_CAMPO_CUADRILLA` y `M6_CAMPO_INSPECTOR` | Carlos Medina (persona **Inspector**) | Cuadrilla Municipal Control Ambiental — Inspección (`LEADER`; también figura como integrante) |

Los dos `RESPONSABLE_AREA` son `M6_ADMIN` (es el único rol de M6 que ese rol de M1 habilita de más: ADR-008) y quedan dos admins con fila. Los nombres de Oficina y auditoría son solo documentación: M6 no los guarda.

**Personas de demostración** (#458). Se entra con el login real de M1 (cuentas `10000`–`10011`, correos en [`cuentas-empleado-m1.csv`](integracion/cuentas-empleado-m1.csv); contraseña inicial por privado). `GET /me` devuelve sus roles y sus cuadrillas (id, nombre y si es `LEADER` o `MEMBER`).

| Persona | `sub` | Rol de M1 | Roles de M6 | Cuadrilla | Puede | No puede |
|---|---|---|---|---|---|---|
| Admin | `10000` | `RESPONSABLE_AREA` | `M6_ADMIN` | no | Todo: catálogos, cuadrillas, asignar roles, autorizar extracciones de arbolado | Operar servicios en terreno (es de Campo) |
| Operaciones | `10002` | `ADMINISTRATIVO` | `M6_OFICINA_OPERACIONES` | no | Planificar servicios, contenedores, intervenciones de arbolado, derivaciones | Autorizar una extracción (403 `ROLE_REQUIRED`), expedientes ambientales, administrar catálogos |
| Ambiental | `10004` | `ADMINISTRATIVO` | `M6_OFICINA_AMBIENTAL` | no | Expedientes, inspecciones (programarlas) y resoluciones ambientales | Planificar servicios o intervenciones de arbolado, administrar catálogos |
| Auditoría | `10007` | `AUDITOR` | `M6_AUDITOR` | no | Leer todo | Cualquier escritura |
| Líder de cuadrilla | `10009` | `ADMINISTRATIVO` | `M6_CAMPO_CUADRILLA` | Cuadrilla Municipal Belgrano y Colegiales — Recolección (`LEADER`) | Iniciar, suspender, reanudar y completar los servicios de su cuadrilla, cargar resultados, residuos y demoras | Operar servicios de otra cuadrilla o sin cuadrilla (403 `NOT_ASSIGNED`), escribir en Oficina |
| Integrante | `10010` | `ADMINISTRATIVO` | `M6_CAMPO_CUADRILLA` | La misma (`MEMBER`) | Lo mismo que el líder, sobre su cuadrilla | Lo mismo que el líder |
| Inspector | `10011` | `ADMINISTRATIVO` | `M6_CAMPO_CUADRILLA` y `M6_CAMPO_INSPECTOR` | Cuadrilla Municipal Control Ambiental — Inspección (`LEADER`; también figura como integrante). `isAssignedInspector: true` | Cerrar las inspecciones ambientales que se le asignaron o que no tienen asignado | Cerrar una inspección asignada a otro (403 `NOT_ASSIGNED`), escribir en Oficina |
| Empleado sin rol | `900` | `ADMINISTRATIVO` | ninguno (**sin fila** en `user_role_assignment`) | no | Entrar a `GET /me` y ver que no tiene roles | Cualquier otro endpoint, también de lectura (403 `ROLE_REQUIRED`) |
| Ciudadano | `901` | `CIUDADANO` (`sub_type`) | no se persiste | no | Solo el portal ciudadano público | Todo lo demás, `GET /me` incluido (403) |

> **Remapeo (#488):** la versión anterior (#490) usaba `2`/`3`/`5`/`8` para Oficina y auditoría y `10000`/`10001`/`10070` para las personas de Campo; antes de #455 eran `101`/`102`/`601`. **Todos esos ids quedan obsoletos**: `10000`–`10011` son las cuentas de M1 (tabla de arriba) y el resto de las personas de cuadrilla arranca en `10100`, sin login. Los ids de integrante de las 16 operativas se corrieron +100 (por ejemplo `PAL-REC` pasó de `10010` a `10110`), salvo los de `BEL-REC` e `INSP`, que usan las cuentas de M1. `900` y `901` no existen en el seed a propósito. **El vaciado previo es obligatorio** (sección 5): una base sembrada con #490 conserva `user_role_assignment` con `2`–`9` y con `10000`+ de Campo (así `10000` quedaría con Campo y Admin a la vez, y el ADR-005 los excluye), y la desplegada tiene el seed del 27/10 (ids `101`…). De las 16 operativas, el seed solo quita los integrantes con ids legados (`IDS_LEGADOS`: `101`-`104`, `111`-`115`, …, `181`-`184` y los bloques `10000 + 10 × i + n` de #490); un integrante cargado a mano no se toca.

Las 496 cuadrillas se persisten con los datos del modelo de #454 y #455: `specialty` (la de sus tipos de servicio si todos pertenecen a una misma; **`null` si la cuadrilla atiende varias especialidades**, para que sus servicios sembrados no disparen avisos de desencaje), `homeZoneId` (**solo las cuadrillas de una única zona**; las que cubren varias quedan sin zona base) y nombres de ejemplo: `leaderName` y `CrewMember.displayName` salen de dos listas cortas según el id (el mismo id da siempre el mismo nombre) y `organizationName` de las cooperativas es el nombre de la cuadrilla antes del " — ". Son datos de demostración, no los de M1.

Los ids son los `sub` numéricos del token de M1 (las 12 cuentas `10000`–`10011` las creó M1 a pedido nuestro; el resto son ficticios) y **no cambian** con el catálogo v3.0 (lo que pasa a UUID es el `citizenId` de los eventos). Las 12 cuentas existen en M1 (hosteado) desde el 3/11 y se verificó el login real y `GET /me` con `10000`, `10007` y `10011`; el script de tokens de demo se retiró (#488). Las filas se insertan directo en `user_role_assignment`, **sin auditoría**: es dato de arranque, no una asignación hecha por un admin. Oficina y Campo no se mezclan (ADR-005), y los ids de cuadrilla coinciden con `crew.leader_user_id` y `crew_member.user_id`, que es lo que exige la pertenencia de Campo (#365).

## 4. Qué es auténtico y qué no

**Auténtico**
- Las **zonas, comunas y sus UUID** (snapshot de M9 del 27/10/2026) y los polígonos de barrios y comunas (`docs/geojson/`).
- Los **espacios verdes**: dataset abierto «Espacios verdes» de BA Data (https://data.buenosaires.gob.ar/dataset/espacios-verdes), descargado el 27/10/2026. Nombres, clasificación y superficie son del dataset; el punto es uno representativo que cae dentro del polígono. La licencia se confirma en el portal (ver `prisma/data/README.md`). Se regenera con `npm run espacios-verdes:build`.
- **Contenedores, puntos verdes y arbolado** (#439): muestra de las capas `contenedores_negros`, `contenedores_verdes`, `puntos_verdes` y `arbolado_publico` (censo 2017-2018) del WFS de IDECABA (https://geoserver.buenosaires.gob.ar/geoserver/catalogo_og_130/wfs), descargada el 27/10/2026. Direcciones, coordenadas, especie, medidas y vitalidad son de la fuente; el mapeo a nuestros enums, la licencia por capa y los parámetros exactos están en `prisma/data/README.md`. Se regenera con `npm run datos-ciudad:build` (necesita red; el seed no).
- Las calles y coordenadas escritas a mano de los ocho barrios originales (USIG).
- **Cuatro espacios verdes que nombran los servicios escritos a mano son aproximados**, porque el dataset no trae uno equivalente exacto:
  - «Parque Tres de Febrero (Bosques de Palermo)» → id 1537, *Lago de Regatas Ernesto Jaimovich* (Palermo; el dataset no trae el parque como tal y el lago es parte de él).
  - «Plaza de Mayo» → id 883, *Plaza 25 de Mayo* (Montserrat).
  - «Paseo de la Costanera Sur» → id 1274, *Reserva Ecológica* (Puerto Madero).
  - «Plaza Vicente López» → id 481, *Plaza V. López y Planes* (Recoleta).

**No auténtico**
- **Atributos de la muestra de IDECABA que no existen en la fuente**: la capacidad de los contenedores (se alterna 2400/3200 L), su estado (`ACTIVE`, salvo los 11 de demostración de `CONTENEDORES_DEMO` y los escritos a mano) y el riesgo de los relevamientos (`LOW` para `WEAKENED`, `MEDIUM` para `DISEASED` y `DEAD`). Los puntos verdes no se exigen por barrio (la Ciudad publica solo 19; faltan, p. ej., en la comuna 11). Los puntos verdes escritos a mano (9) siguen ahí porque los servicios los referencian; también los contenedores y árboles escritos a mano.
- Los códigos los arma el seed por barrio y orden estable de `id` de IDECABA (negros antes que verdes), así que no dependen de la posición en el barrio de M9: `CT-<codigo>-NNNN`, `GP-<codigo>-NN`, `ARB-<codigo>-9NNNN`.
- Servicios, recorridos regionales, cuadrillas, vehículos (patentes ficticias), personas, expedientes, actas y derivaciones.
- Los `ticketId`, `workOrderId`, `establishmentId` y `streetClosureId` son UUID derivados con `uuidDe`: no existen en M2, M3, M4 ni M7.
- Los `citizenId` son UUID derivados con `uuidDe` (M1 v3.0 los emite UUIDv4); no existen en M1.
- Los `organizationId` de las cooperativas (`3301`–`3303`) siguen numéricos: la v3.0 de M1 no define su formato (solo cambia el del `citizenId`). Si M1 lo cambia, es `CREWS`.
- El **historial de estados de los contenedores** (#475) es inventado: no existe un registro real de desbordes ni daños anteriores. Los 5 meses de actividad son una simulación para que el tablero muestre tendencias; en producción el historial empieza el día de la migración.
- Los eventos del outbox/inbox sembrados **no se publicaron al bus**; son historia para el tablero.

## 5. Cómo correrlo

> **Base con el inventario viejo (previo a #439): el vaciado es OBLIGATORIO.** Contenedores, puntos verdes y árboles se siembran con `createMany` + `skipDuplicates` y los códigos `CT-<barrio>-NNNN`, `GP-<barrio>-01` y `ARB-<barrio>-9NNNN` coinciden con los del generador anterior. Sin vaciar, quedan las coordenadas pseudoaleatorias viejas mezcladas con las reales y huérfanos los códigos que ya no existen. Usar el bloque de vaciado de más abajo.

```bash
# Contra una base LOCAL (nunca la desplegada sin querer)
export DATABASE_URL='postgresql://user:password@localhost:5432/m6_ambiente?schema=public'
npm run prisma:migrate:deploy
npm run prisma:seed
```

Para **refrescar las fechas** de una base que ya tiene servicios hay que vaciarla primero, porque el seed no toca lo operativo si encuentra servicios. En local: `npx prisma migrate reset` (borra todo, migra y siembra solo).

**Aplicar esta versión a una base que ya tiene el seed anterior no actualiza lo operativo.** El seed agrega zonas, comunas, espacios verdes e inventario, pero no recrea servicios ni derivaciones, porque ve servicios cargados y se detiene. Para tener el reparto nuevo hay que vaciar lo operativo y volver a sembrar: es un paso **aparte y destructivo** (borra servicios, expedientes, derivaciones y eventos) que no se hace en la base desplegada sin acordarlo con el equipo; el seed no pisa el trabajo que alguien cargó a mano.

**Base desplegada (Supabase): aplicado el 27/10 con confirmación del PO, dos veces:** primero el seed de las zonas por barrio y esa misma noche el de IDECABA (#439), cada vez con copia previa y vaciado. Se hizo así:
1. `pg_dump` del esquema `public` como copia (fuera del repo). Supabase corre PostgreSQL 17: el `pg_dump` tiene que ser de la misma versión.
2. `prisma migrate status`: las 23 migraciones ya estaban aplicadas (Render corre `migrate deploy` al arrancar). Dato histórico del 27/10: al 06/11 `prisma/migrations/` tiene 33 carpetas (el `migration_lock.toml` no cuenta).
3. Vaciado: `TRUNCATE ... RESTART IDENTITY CASCADE` de las 38 tablas de `public` salvo `_prisma_migrations`, `role_assignment_audit` y `domain_audit_log`, en una sola transacción (`psql -1`, `ON_ERROR_STOP`). `role_assignment_audit` y `domain_audit_log` (#460) son de solo agregado y un trigger bloquea el `TRUNCATE` a propósito: no se saltean; quedan como están.
4. `SEED_CONFIRM_REMOTE=1 npm run prisma:seed` con `DATABASE_URL` apuntando a Supabase (sin esa variable el seed aborta: es la confirmación explícita de que se quiere escribir en una base remota): **16 min 20 s** con 788 servicios (primera vez) y **16 min 23 s** con 800 (segunda, con el inventario de IDECABA). El seed hace su propio `syncZones`, así que no hace falta correr antes `zones:sync-from-core`.
5. Verificado con SQL y contra la API desplegada tras la segunda vez: 15 comunas, 48 zonas (ninguna `Z-…`, todas con comuna y barrio UUID), 800 servicios, 1412 `service_zone`, 1366 espacios verdes, 500 contenedores (356 `HOUSEHOLD`, 139 `RECYCLABLE`, 5 de otros tipos; 9 a 13 por barrio, sin códigos repetidos), 28 puntos verdes, 442 árboles, 72 roles, 0 eventos `PENDING`.

Para repetirlo, el vaciado es este bloque (no hay script). Desde #460 hay otra tabla de solo agregado, `domain_audit_log`, que también hay que dejar afuera (su trigger bloquea el vaciado):
```sql
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
           AND tablename NOT IN ('_prisma_migrations', 'role_assignment_audit', 'domain_audit_log') LOOP
    EXECUTE format('TRUNCATE TABLE public.%I RESTART IDENTITY CASCADE', r.tablename);
  END LOOP;
END $$;
```
Es destructivo: borra también `user_role_assignment` (el seed regenera los roles de la demo; hasta que termina, solo entra el admin de `M6_BOOTSTRAP_ADMIN_USER_IDS`) y los eventos del outbox y del inbox. El seed los siembra como `SENT` o `FAILED`, nunca `PENDING`, para que el despachador no mande nada al bus.

La transacción de lo operativo vence a la hora; con 800 servicios (el conteo de entonces; hoy son 743, el tope sigue en 800) tardó 16 min 23 s contra Supabase (medido el 27/10; con 788 fueron 16 min 20 s), muy lejos de la hora. `verificarCobertura()` fija un tope de 800: antes de subirlo, medir de nuevo.

Si la base ya tenía el seed anterior a #455 (o el de #490, antes de #488) y no se vacía, sus roles de Campo con los ids viejos quedan huérfanos (el vaciado de arriba ya los borra). Ejemplo de limpieza, a mano y con acuerdo (**con una base sembrada por #490 vale solo el vaciado completo**: allí `10000`–`10011` ya tenían roles de Campo y quedarían mezclados con los de Oficina; el primer bloque cubre los ids de antes de #455 y el segundo los de #490 y la Oficina vieja):
```sql
DELETE FROM user_role_assignment WHERE user_id IN ('101','102','103','104','111','112','113','114','115','121','122','123','124','131','132','133','134','141','142','143','144','145','151','152','153','154','161','162','163','164','171','172','173','174','181','182','183','184','201','202','203','204','211','212','213','221','222','223','224','301','302','303','401','402','403','501','502','503','504','601','602')
  AND role IN ('M6_CAMPO_CUADRILLA', 'M6_CAMPO_INSPECTOR');
-- #490: Oficina vieja (2 a 9) y Campo desde 10000. Quita todo rol de ese rango (también 10000–10011) y deja
-- que el seed vuelva a asignar los de #488; el id 1 y 900/901 no tienen fila.
DELETE FROM user_role_assignment
 WHERE user_id IN ('2','3','4','5','6','7','8','9')
    OR (user_id ~ '^[0-9]+$' AND user_id::bigint BETWEEN 10000 AND 15100);
```

**Riesgos aceptados y limitaciones de las cuadrillas (#455):**
- **Rango de Campo (#488):** `10000`–`10011` son las 12 cuentas reales de M1 (ver arriba); `10100`–`~15051` son integrantes **sin login**, ficticios. Si M1 emite alguna vez en ese rango a alguien que no es de Campo, hay que quitarle el rol de Campo o reubicar `BASE_PERSONAS`. Los ids `10012`–`10099` quedan libres a propósito, por si M1 amplía el lote. El pedido a M1 decía que `10009`–`10011` son de campo: si M1 no los crea tal cual, hay que cambiar el seed y la demo.
- **Base ya sembrada:** el vaciado previo (bloque SQL de arriba) es obligatorio también para las bases locales de #490. La desplegada tiene el seed del 27/10, así que al aplicar esta versión se vacía igual.
- **Admins atados al id (#488):** `10000` y `10001` son `M6_ADMIN` por su fila, y el techo de ADR-008 (`ASIGNABLES`) hace que un `ADMINISTRATIVO` con ese `sub` no llegue a admin. El único camino es que M1 emita `10000` o `10001` con `RESPONSABLE_AREA` a otra persona, y esa persona sería admin al instante. Hay que confirmar con M1 que son los dos únicos `RESPONSABLE_AREA` y que sus ids no se reasignan, y que `10009`–`10011` no cambian de rol.
- **Inspectores de más:** unas 150 personas (las de las 48 cuadrillas generadas de inspección y las dos de `INSP`, entre ellas `10011`) tienen `M6_CAMPO_INSPECTOR` y pueden cerrar inspecciones sin asignar. Es un efecto de la demo.
- **Las generadas no se actualizan en una segunda corrida** (`createMany` con `skipDuplicates`, identificadas por nombre): si cambia `CREWS` o `RUBROS_GENERADOS` hay que resembrar vaciando. Las 16 operativas sí se corrigen (upsert).

**Limitaciones conocidas:** dos espacios verdes con el mismo nombre en un barrio se emparejan por orden de creación (no hay desempate real), y las `ServiceFrequency` ya creadas no se actualizan en una segunda corrida (se identifican por tipo, recorrido y turno).

## 6. Cómo mantenerlo

- Cambiar el esquema → migración nueva + `prisma:generate` + ajustar el seed si el modelo lo usa.
- Cambió el catálogo de M9 → bajar de nuevo `prisma/data/m9-*.json` (ver sección 7). Cambió el dataset de espacios verdes → `npm run espacios-verdes:build`.
- Agregar una cuadrilla o un integrante → `CREWS` (o `REGIONES` para las de recolección regional; las 480 por cobertura salen de `RUBROS_GENERADOS`); sus roles de Campo salen solos. Personal de Oficina → `PERSONAL_DE_OFICINA` (ids `10000`–`10008`, cuentas de M1; ver la tabla de la sección 3). Las personas nuevas de cuadrilla toman ids desde `BASE_PERSONAS` (`10100`), nunca en `10000`–`10011`.
- Todo id de otro módulo nuevo respeta el formato de la sección 1: `user_id` de M1 numérico; `citizenId` y los ids de M2, M3, M4 y M7 UUID con `uuidDe`.
- Si cambia la fecha de fin de la cursada, es `FIN_DE_CURSADA`.

## 7. Zonas y comunas desde M9 (#421, #422)

El seed crea las zonas con `syncZones` y el snapshot versionado `prisma/data/m9-barrios.json` y `m9-zonas.json` (64 barrios, 48 activos de CABA; 20 zonas administrativas, 15 comunas activas; los ids UUID no son secretos). El snapshot es una foto del 27/10: si M9 cambia el catálogo hay que volver a bajarlo. Para sincronizar contra el catálogo vivo del Core está `npm run zones:sync-from-core` (ver [deploy.md](deploy.md#sincronizar-zonas-y-comunas-con-el-catálogo-de-m9-421)); el orden es migrar, sync, seed.

Una base con el seed viejo conserva sus ocho zonas `Z-…` (y sus `caba-…`) como *legacy*: el sync las reporta y no las toca si tienen datos. Se limpian al vaciar lo operativo (sección 5) o con `--clean-legacy`.
