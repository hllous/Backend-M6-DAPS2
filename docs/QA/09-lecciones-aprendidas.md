# 09 · Lecciones aprendidas: tres defectos que llegaron tarde

> Backend del Módulo 6 (Grupo 04). Borrador del 03/11/2026. **A validar con el equipo** antes de entregar: los hechos (fechas, issues, archivos) salen de GitHub y del código; el «por qué no se detectó antes» es una **interpretación** del QA a partir de los tests que existen, y quien participó de cada caso puede corregirla.

La cátedra pide tres defectos que se descubrieron tarde, por qué no se detectaron antes y qué prueba los habría atrapado. Se eligieron de los 55 issues `bug`, `security` y `fix` (todos cerrados): tres que **pasaron la revisión y los tests**, y que los encontró alguien o algo ajeno a la suite del backend.

| # | Defecto | Cuándo apareció | Quién o qué lo encontró |
|---|---|---|---|
| 1 | [#466](https://github.com/hllous/Backend-M6-DAPS2/issues/466): `GET /evidence` sin rol ni pertenencia | 29/10 | La revisión del frontend (FE #732), no un test |
| 2 | [#314](https://github.com/hllous/Backend-M6-DAPS2/issues/314) y [#485](https://github.com/hllous/Backend-M6-DAPS2/issues/485): `updatedBy.id` que no era UUID | 20/10 y 02/11 | Un cambio de contrato de M2 (v1.78) y luego M1 |
| 3 | [#470](https://github.com/hllous/Backend-M6-DAPS2/issues/470): el límite de tasa contaba la IP del BFF | 30/10 | La integración del portal ciudadano en el frontend (FE #743) |

---

## 1. `GET /evidence`: cualquier token válido leía la evidencia de cualquier dueño (#466)

**Qué pasó.** `GET /evidence?ownerType=&ownerId=` no tenía `@Roles` y `AttachmentsService.findByOwner` hacía solo un `findMany` por dueño. La pertenencia (`assertOwnerAccess`) se aplicaba únicamente al alta (`POST /evidence`). Cualquier JWT válido podía leer la evidencia de cualquier servicio, y un integrante de una cuadrilla leía la de otra. Se corrigió el 30/10 en el PR #468 (`@Roles` explícito y, para Campo, `403 NOT_ASSIGNED`).

**Por qué no se detectó antes** (interpretación):

- El control de pertenencia se pensó como una regla de las **acciones de Campo** y se probó con esa forma: la matriz propio, ajeno y sin cuadrilla de `test/crew-ownership.e2e-spec.ts` recorre las acciones que escriben. La lectura de evidencia no estaba en la matriz.
- El spec que protege los roles, `src/auth/route-roles.spec.ts`, garantiza que **toda escritura** declare `@Roles`. Para los `GET` fija un conjunto esperado y asume que el resto exige «cualquier rol de M6» (`:28`). Un `GET` que recibe un identificador de recurso con dueño quedaba fuera de la garantía.
- La seguridad de la Clase 11 (SEC-W02) se centró en las acciones de gestión, que eran el agujero más grande.
- El BFF del frontend ya compensaba con el mismo chequeo del lado del cliente, así que **nada fallaba en la demo**: el hueco solo se ve leyendo el backend.

**Qué prueba lo habría atrapado.**

1. Un e2e de BOLA sobre **cada lectura que recibe un identificador de recurso con dueño**: un integrante de Campo pide la evidencia de un servicio de otra cuadrilla y debe recibir 403 (hoy existe solo para el alta y, desde #468, para este endpoint: `attachments.service.spec.ts:543`).
2. Una ampliación de `route-roles.spec.ts`: todo `GET` cuyo parámetro sea `ownerId` o `:id` de un recurso con dueño debe declarar `@Roles` explícito, igual que las escrituras.

**Qué cambió.** El GET lleva `@Roles` y el chequeo de pertenencia. Queda anotado el alcance acordado: Campo puede leer un contenedor existente o una inspección sin inspector asignado.

**Lección.** Un control que se aplica en la entrada de un recurso hay que probarlo en **todas** las puertas del mismo recurso, la lectura incluida. Las defensas del cliente (el BFF) no reemplazan el control del backend.

---

## 2. `updateTicketStatus` mandaba un `updatedBy.id` que M2 rechazaba (#314 y #485)

**Qué pasó.** Desde la v1.78 de M2 (20/10), `data.updatedBy.id` tiene que ser un **UUID o `null`**. M6 mandaba el `sub` numérico del JWT (`payloads.updateTicketStatus()` armaba `updatedBy: { type: 'EXTERNAL_USER', id: params.updatedById }`). Si el `sub` no era UUID, M2 o el Core rechazaban el evento y el vecino no se enteraba de nada. El 20/10 se corrigió mandando `null` cuando no es UUID (#314, PR #318). El 02/11, cuando M1 confirmó que el token trae `actorId` (UUID), se pasó a usarlo (#485, PR #489).

**Por qué no se detectó antes** (interpretación):

- El schema del repo (`docs/eventos/publicados/updateTicketStatus.schema.json`) solo describía el campo en la descripción; no exigía `format: uuid`.
- **Los tests que validan el payload contra el paquete real de M2 se saltean en el CI.** El paquete vive en `docs/documentacion/`, que no se versiona; en el CI esos tests quedan en `skip` con un `console.warn` (12 tests saltados en el run de `main`; ver DEF-11 en `06-registro-defectos.md`). En local sí corren, pero solo si esa carpeta existe.
- El valor viene del JWT provisorio de M1 (ADR-002), cuyo `sub` es un entero. Los tests de `payloads.spec.ts` armaban el evento con `updatedById: 'user-001'` y no comprobaban que el formato fuera UUID: pasaba cualquier texto.
- Lo encontró la lectura del cambio de M2, no una prueba nuestra.

**Qué prueba lo habría atrapado.**

1. Un test de contrato **dentro del CI** que valide cada payload publicado contra schemas **versionados en el repo** (con `format: uuid`), de modo que un cambio del contrato rompa el build.
2. Un test parametrizado de `updateTicketStatus` con los formatos reales de `sub` (entero, código `USR-1`, vacío, UUID) que afirme «UUID o `null`», nunca otro valor.

**Qué cambió.** El schema exige UUID o `null` y hay tests por cada forma de `sub`. Sigue pendiente que el CI no se salte la validación contra M2 (DEF-11).

**Lección.** Un contrato que solo se valida en la máquina de quien tiene el archivo no es un contrato probado. Los schemas de otros módulos tienen que viajar con el repo o el CI tiene que fallar si faltan.

---

## 3. El límite de tasa del portal contaba la IP del BFF, no la del vecino (#470)

**Qué pasó.** El frontend consulta `/public/*` desde su BFF (un servidor en Vercel), no desde el navegador. `@nestjs/throttler` cuenta por `req.ip`, así que **todas las consultas de todos los vecinos llegaban con la misma IP** y compartían un único contador: 20 por minuto en `GET /public/reports/:ticketId` para toda la ciudad, y 60 por minuto en el resto. Con varias personas a la vez aparecía el 429 para todos. El issue se abrió el 30/10 con el origen en FE #743 y se resolvió con el PR #480 (la IP real se toma de `X-Forwarded-For` solo si el pedido trae la clave compartida `X-M6-BFF-Key`, para no abrir un bypass).

**Por qué no se detectó antes** (interpretación):

- No hay **ningún test que dispare el 429**. Los specs del portal comprueban qué datos devuelve (`citizen-portal.service.spec.ts`), no que el límite funcione.
- Los tests de integración llaman a la app directo con `supertest`, sin un proxy delante: siempre ven una IP distinta o la local. El problema nace de la **topología** (Vercel → Render), que ningún entorno de prueba reproduce.
- Un caso parecido ya se había corregido el 19/09 en #158 (`trust proxy` para el proxy de Render). Se arregló la primera capa de proxy y se asumió que no había otra.
- Recién apareció al integrar el portal en el frontend.

**Qué prueba lo habría atrapado.**

1. Un test de integración del throttler con **dos IP distintas** en `X-Forwarded-For` y la clave del BFF, que afirme dos contadores independientes; y otro sin la clave, que afirme que se ignora el encabezado.
2. Una prueba de humo contra el despliegue con dos clientes en paralelo (sirve también para la prueba de carga de la cátedra).

**Qué cambió.** El límite cuenta la IP del vecino cuando el pedido viene del BFF con la clave, y ahora `src/modules/citizen-portal/client-tracker.spec.ts` prueba que dos vecinos por el BFF tienen claves distintas y que con una clave incorrecta se ignora `X-Forwarded-For`. Sigue sin haber un test que dispare el 429 (ver DEF-07).

**Lección.** Los límites, las IP y los encabezados dependen de lo que hay entre el cliente y la app. Hay que probarlos en un entorno con la misma cadena de proxies que producción, no solo en la capa HTTP de Nest.

---

## 4. Patrón común y reglas que adoptamos

| Patrón | Reglas |
|---|---|
| Los tres los encontró **alguien ajeno a la suite del backend**: una revisión del frontend, un cambio de contrato de otro módulo y la integración de otra capa. | Antes de cerrar una HU que toca un recurso con dueño, un contrato externo o la red, agregar el test de la **frontera** (lectura, contrato, proxy) y no solo el del camino feliz. |
| Cada control se probó por **un solo lado** (la escritura, el schema local, la capa HTTP). | Para cada control, listar las puertas del mismo recurso y probar cada una. |
| Los tests que habrían servido existían en forma parcial o se saltaban en el CI. | Un test saltado en el CI debe fallar o avisar de forma visible (DEF-11). |

## 5. Otros candidatos, por si el equipo prefiere cambiarlos

| Issue | Defecto | Por qué llegó tarde (hipótesis, sin verificar) |
|---|---|---|
| [#230](https://github.com/hllous/Backend-M6-DAPS2/issues/230) | El cumplimiento comparaba el día en UTC y marcaba tarde todo cierre posterior a las 21 h | Probablemente los tests no probaban horas cercanas al cambio de día |
| [#176](https://github.com/hllous/Backend-M6-DAPS2/issues/176) | `?active=false` listaba los activos y `"false"` se guardaba como `true` | Probablemente los unit tests no pasaban por el `ValidationPipe`, que es donde ocurre la conversión |
| [#132](https://github.com/hllous/Backend-M6-DAPS2/issues/132) | Todos los deploys a Render fallaban desde #126 y nadie lo notó | Render mantenía viva la última build buena y `/health` seguía respondiendo 200 |
| [#451](https://github.com/hllous/Backend-M6-DAPS2/issues/451) | La reparación se podía derivar desde cualquier inspección | Surgió del documento de QA externo (QA-CA-002 y QA-CA-006), no de un test |
