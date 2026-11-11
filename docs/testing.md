# Testing

> Cómo correr los tests unitarios y e2e, y qué cubre cada suite de `test/`. Leer antes de tocar la base de pruebas o el job `e2e` del CI.

Dos suites separadas, con propósitos distintos:

| Suite | Comando | Qué prueba | Base de datos |
|---|---|---|---|
| **Unitaria** | `npm test` / `npm run test:cov` | Reglas de negocio de cada service, con Prisma mockeado. Es la que mide el 85% del DoD | No usa |
| **End to end** | `npm run test:e2e` | La app completa —auth, `ValidationPipe`, cabeceras de seguridad, máquinas de estado, outbox e inbox— contra Postgres | Sí, y **la trunca** |

Los unitarios viven al lado del código (`src/**/*.spec.ts`; también `scripts/migrate-crew-user-ids.spec.ts`, vía el `include` de `vitest.config.ts`); los e2e, en `test/*.e2e-spec.ts`.

## Runner: Vitest

El runner es **Vitest** (#628; antes Jest, que no carga los paquetes solo-ESM de NestJS 12). Dos configs: `vitest.config.ts` (unitarios, cobertura v8 y umbrales en `coverage.thresholds`) y `vitest.e2e.config.ts` (e2e: `globalSetup`, timeout de 30 s para tests y hooks, y un archivo a la vez porque comparten la base).

- `describe`/`it`/`expect`/`vi` son globales (`globals: true`); los tipos salen de `test/vitest-globals.d.ts`. Los tipos de mocks se importan: `import type { Mock, Mocked, MockInstance } from 'vitest'`.
- El transform es SWC (`unplugin-swc`), no el de Vite: NestJS necesita `emitDecoratorMetadata`. Va con `useDefineForClassFields: false` para que las clases salgan igual que con `tsc` (target ES2021). SWC no chequea tipos (ts-jest sí): los specs los chequea el paso `Typecheck specs` del job `test` del CI, `npx tsc --noEmit -p tsconfig.json`.
- Diferencias con Jest que ya mordieron: `vi.mock` se hoistea y su factory solo ve variables de `vi.hoisted`; un mock que el código llama con `new` necesita una implementación `function`, no flecha; un `beforeEach(() => mock.mockReset())` devuelve el mock y Vitest lo ejecuta como teardown (usar llaves); `require()` de un `.ts` no pasa por el transform (usar `await import()`); `import * as request from 'supertest'` no es invocable (usar `import request from 'supertest'`).
- SWC no chequea tipos: `npm run typecheck` (lo corre el CI en el job `test`) revisa los specs como lo hacía `ts-jest`.
- Un archivo: `npx vitest run src/auth/jwt.strategy.spec.ts`. Por nombre de archivo: `npm test -- jwt.strategy`.
- El umbral `global` cuenta **todos** los archivos, también los que tienen umbral propio (Jest los restaba).

## Correr los e2e en local

> **Los e2e truncan todas las tablas.** Usá una base descartable, nunca la que tengas con datos de QA ni la desplegada. El helper de `test/helpers.ts` se niega a arrancar si `DATABASE_URL` no apunta a `localhost`, pero eso no te salva de apuntar a la base local equivocada.

Levantar un Postgres solo para esto:

```bash
docker run -d --name m6-e2e-db \
  -e POSTGRES_USER=m6 -e POSTGRES_PASSWORD=m6local -e POSTGRES_DB=m6_e2e \
  -p 5433:5432 postgres:16
```

Aplicar el esquema y correr las suites, pasando `DATABASE_URL` **por proceso**: el `.env` del repo apunta a la base desplegada y no hay que tocarlo.

```bash
export DATABASE_URL='postgresql://m6:m6local@localhost:5433/m6_e2e?schema=public'
npm run test:e2e
```

Las migraciones las aplica el propio arranque de Vitest (`test/global-setup.ts`), con la URL ya validada. Antes era un `npx prisma migrate deploy` aparte, y ese paso quedaba fuera del guard: el CLI de Prisma lee el `.env` del repo por su cuenta, así que olvidarse del `export` aplicaba migraciones contra la base desplegada.

`JWT_SECRET` no hace falta, y además se ignora: los e2e **pisan** el valor del entorno con uno de juguete. Es a propósito — si tomaran el del `.env`, cada corrida local estaría acuñando tokens válidos contra la API desplegada.

Una suite sola:

```bash
npm run test:e2e -- services-lifecycle
```

## Qué hay en `test/`

| Archivo | Cubre |
|---|---|
| `guard-database-url.ts` | Se niega a correr si `DATABASE_URL` no apunta a `localhost`, `127.0.0.1` o `::1` (parsea el host; no busca la subcadena) |
| `guard-database-url.e2e-spec.ts` | El guard de arriba, incluida una URL con `localhost` antes del último `@`. No toca la base |
| `global-setup.ts` | Aplica `prisma migrate deploy` con la URL ya validada |
| `helpers.ts` | Levanta la app con `configureApp()` —la misma configuración que `main.ts`—, firma tokens, trunca la base y arma los datos mínimos de cada caso |
| `services-lifecycle.e2e-spec.ts` | Programar → asignar cuadrilla → iniciar → resultado por zona → cerrar, con el 409 de transición inválida y las filas del outbox. También el 401 sin token, el 400 del `ValidationPipe` ante una propiedad no declarada, `X-Content-Type-Options: nosniff` y la ausencia de `X-Powered-By` |
| `crew-ownership.e2e-spec.ts` | Pertenencia de Campo (#365): matriz propio / ajeno / sin cuadrilla (o sin inspector) por cada acción de Campo —servicio, resultados, recolección, demoras, inspección y evidencia—, con `403 NOT_ASSIGNED` y Oficina con acceso total. La evidencia corre con un storage en memoria (`EVIDENCE_STORAGE` pisado vía `createTestApp(customize)`), así que la subida del dueño es un 201 exacto |
| `crew-user-id-migration.e2e-spec.ts` | `npm run crews:migrate-user-ids` (#394): simulacro de solo lectura, mapeo aplicado con normalización, choque de PK por fusión, filas sin mapeo que no se borran e idempotencia |
| `inbox.e2e-spec.ts` | Idempotencia por `eventId` (el duplicado no reprograma un servicio creado después del primer envío), el sobre del Core (con `causationId` nulo) y el de M2 con `producer` objeto, el reintento de un handler fallido (vuelve a correr y queda procesado; otro `eventType` sale `duplicate`), el 400 que no deja fila y el evento sin handler. Trazabilidad (#267): lo que publica un handler hereda el `correlationId` del consumido y lleva su `eventId` como `causationId` (el contexto de `ingest()` pisa al del request), el inbox guarda `correlationId` y `sourceModule`, y lo que publica un endpoint abre un hilo sin causa |
| `environmental-flow.e2e-spec.ts` | Expediente → inspección → acta, con la derivación a M4 en el outbox (el acta hacia M4 y el `updateTicketStatus` hacia M2 comparten `correlationId`: un hilo por request, #267), y la vuelta de M4 por el inbox (`commercialFineGenerated` cierra el expediente; sin `sourceViolationId` válido da 400 y no deja fila). No prueba rollback |
| `street-closure-expiry.e2e-spec.ts` | Corte aprobado con ventana ya vencida (#321): el barrido lo pasa a `EXPIRED` y reprograma el servicio `SCHEDULED` (uno `IN_PROGRESS`, uno vigente o uno dentro de la gracia no se tocan), es idempotente, no publica nada hacia M7, y un `streetClosureEnded` posterior sobre `EXPIRED` lo pasa a `ENDED` |
| `containers-close.e2e-spec.ts` | Cerrar el servicio transiciona el contenedor. Es la única suite que prueba el rollback: un `CHECK` temporal hace fallar el `UPDATE` del contenedor dentro de la transacción y se verifica que el servicio siga `IN_PROGRESS` y que no se encole nada |
| `security-input.e2e-spec.ts` | Seguridad de entrada (#569): payloads SQL (`'; DROP TABLE--`, `' OR 1=1--`) y XSS en zonas, expedientes ambientales y servicios (se guardan como texto, sin 500); mass assignment (`status`/`role`/`id` en `PATCH /services/:id` y `/zones/:id` dan 400 y no persisten); 413 por archivo de más de 10 MB; CSP en la API y ausente en `/api/docs` |
| `outbox-rabbitmq-real.e2e-spec.ts` | Publicación del outbox contra un RabbitMQ real (#618): el `OutboxDispatcher` y el `RabbitMqEventPublisher` reales publican las filas PENDING a `muni.inbox` (se verifica consumiendo de una cola propia enlazada) y las marcan SENT. La caída del broker se simula apuntando el publisher a un puerto sin broker y luego a RabbitMQ real (corre igual en el CI): las filas quedan PENDING con el intento contado, al volver se reenvían sin pérdida ni `eventId` repetido, agotados `MAX_ATTEMPTS` pasan a FAILED y no se reintentan solas (es diseño: el reintento de una fila FAILED es manual; «al volver el broker se reenvían» vale dentro del margen de `MAX_ATTEMPTS`), y un publisher con conexión viva al que se le cierra la conexión (API de management, solo la que abrió el publisher; se saltea con aviso si `RABBITMQ_MGMT_URL` no apunta a localhost) se recupera y reenvía sin pérdida ni `eventId` repetido. Los asserts de "sin duplicados" esperan a que la cola se estabilice (ventana de 600 ms sin mensajes nuevos). Mismo salto y mismo comando que `rabbitmq-real` (el nombre contiene `rabbitmq-real`, así que el CI ya la corre en su paso aparte). No hay variante con `docker stop` del broker Las dos suites `rabbitmq-real` comparten el broker y una cierra conexiones ajenas: corren **en serie** (`--no-file-parallelism`, #634; la config e2e ya corre un archivo a la vez); el publisher se identifica con `connection_name` `m6-outbox-publisher`. |
| `rabbitmq-real.e2e-spec.ts` | Consumer del bus contra un RabbitMQ real (#575): mensaje válido, mismo `eventId` dos veces (una sola fila), JSON/sobre inválido (sin fila, no traba la cola) y recuperación cuando el broker cierra la conexión (vía API de management, `DELETE /api/connections`). Se saltea con aviso si no hay `RABBITMQ_URL` o no apunta a localhost. Local: `docker run -d -p 5672:5672 -p 15672:15672 rabbitmq:3-management` y `RABBITMQ_URL=amqp://guest:guest@localhost:5672 npm run test:e2e -- rabbitmq-real --no-file-parallelism`. El caso de recuperación cierra **todas** las conexiones del broker local salvo la suya (incluido un backend del compose, que reconectaría) y se saltea si `RABBITMQ_MGMT_URL` no apunta a localhost. Apagar el broker de verdad no es viable en un service container del CI; cerrar la conexión ejercita la misma reconexión (`recovery`) |
| `etag-if-match.e2e-spec.ts` | ETag / If-Match (#591, ADR-012): el GET devuelve `ETag`; con el vigente la transición o el `PATCH` de edición da 200 y un ETag nuevo; con uno viejo, 412 sin cambios (ni estado, ni historial, ni outbox); sin header o con `*`, como siempre; dos pedidos con el mismo ETag terminan en `[200, 412]`. Contenedores, servicios, intervenciones de arbolado y expedientes |
| `idempotency.e2e-spec.ts` | `Idempotency-Key` (#592): replay con un solo recurso y `Idempotency-Replayed`, 422 con otro cuerpo, carrera de dos requests, sin clave como antes, 400 por clave inválida, error no guardado, retoma de un «en curso» viejo y un solo evento en el outbox tras el replay |
| `audit.e2e-spec.ts` | Auditoría de dominio |
| `auth-roles.e2e-spec.ts` | Roles de M6: matriz por rol |
| `demo-personas.e2e-spec.ts` | Personas de demostración |
| `environmental-notice-ticket.e2e-spec.ts` | Acta ambiental: aviso a M2 según el estado del ticket |
| `information-request.e2e-spec.ts` | Solicitud de información al vecino |
| `outbox-retry.e2e-spec.ts` | Outbox: consulta y reintento |
| `overdue-risk-counts.e2e-spec.ts` | Conteos de vencidas y riesgo alto |
| `role-assignments.e2e-spec.ts` | Asignación de roles de M6 |
| `tree-intervention-authorization.e2e-spec.ts` | Autorización de intervenciones sobre árboles |

Los datos se arman por caso con los helpers, **no con `prisma/seed.ts`**: el seed monta un escenario de demo entero y ata los tests a filas que no controlan.

El `OutboxDispatcher` se reemplaza por un stub sin `@Interval`. Si no, barre la cola cada 10 s —justo lo que las suites verifican— y deja un timer abierto.

## En el CI

El job `e2e` de `.github/workflows/ci.yml` levanta `postgres:16` y `rabbitmq:3-management` con `services:` y corre `npm run test:e2e -- --exclude '**/*rabbitmq-real*'` y, en un paso aparte con `RABBITMQ_URL` (para no activar el consumer en las demás), `npm run test:e2e -- rabbitmq-real --no-file-parallelism`; las migraciones las aplica `global-setup.ts`, igual que en local.

**No es check obligatorio** de la protección de ramas: ahí siguen solo `build` y `test`. La cobertura de los e2e tampoco se suma al 85%, que se sigue midiendo con los unitarios.

**Contratos de M2 (v1.78).** `updateTicketStatus` se valida en `payloads.spec.ts` y en los specs de los services contra nuestro schema versionado (`docs/eventos/publicados/`, helper `src/events/update-ticket-status-schema.testing.ts`), siempre, también en el CI. El otro sentido (ejemplos de M2 contra nuestro inbox) lo cubre `src/events/consumers/m2-ejemplos.spec.ts` con una selección mínima de sobres en `test/fixtures/m2/`. La comprobación contra el paquete oficial de M2 (que vive en `docs/documentacion/`, sin versionar) es manual y local, cuando M2 publique una versión nueva; la v1.78/v1.79 vigente no cambió schemas ni ejemplos. **Límite:** lo que nuestro schema no declara ya no se valida en CI; en concreto `ticketId` es `string` libre acá, así que dejó de comprobarse que sea UUID como exige M2. Agregarle `format: uuid` es un cambio de contrato que decide el equipo.

## Tests de API (Newman + Schemathesis, #572)

Workflow aparte, `.github/workflows/api-tests.yml` (no es check obligatorio): levanta Postgres, migra, siembra el seed de demo, arranca `node dist/main` con un `JWT_SECRET` de juguete declarado en el workflow y corre:

- **Newman** con `test/api/m6.postman_collection.json` (generada desde `docs/api/openapi.json` con `npm run api:collection`; regenerarla y commitearla si cambia el OpenAPI). Casos de éxito (GET), 401, 403 (AUDITOR en escrituras) y 400/404 por endpoint. `test/api/PENDIENTES.md` lista los endpoints sin caso de éxito (las escrituras, que necesitan estado de dominio). Los tokens no se versionan: `JWT_SECRET=<base64> node test/api/make-token.mjs admin|auditor` los firma, y se pasan con `--env-var token=… auditorToken=…`.
- **Rate limit:** el backend arranca con `THROTTLE_LIMIT=100000`. El `ThrottlerGuard` global (#568, 600 req/min por IP) devolvería 429 a Newman y sobre todo a Schemathesis (miles de casos desde una sola IP). Es inocuo mientras la variable no exista. El `JWT_SECRET` se genera por corrida (`openssl rand -base64 32`, enmascarado); las versiones de Newman y de la imagen de Schemathesis están fijadas.
- **Schemathesis** (solo GET) contra el OpenAPI: `response_schema_conformance` y `not_a_server_error` bloqueantes; `status_code_conformance` informativo porque hoy falla (hallazgo: ~40 GET devuelven un 400 del ValidationPipe que el OpenAPI no declara). `GET /neighborhoods` queda excluido: da 503 sin el catálogo de M9.
## Mutation testing (Stryker, #573)

`npm run test:mutation` (config en `stryker.config.json`, runner `@stryker-mutator/vitest-runner` con `vitest.config.ts`, ~15 min en local; corre también en Windows) muta `outbound-requests.transitions.ts` y `street-closure-expiry.sweeper.ts`; umbral `break: 60`. Reporte en `reports/mutation/` (ignorado por git). El workflow `.github/workflows/mutation.yml` corre solo a mano o semanal, no en cada push.

En el workflow, el modo incremental de Stryker se conserva entre corridas con `actions/cache` (`reports/mutation/incremental.json`, una clave por run y se restaura la más reciente): la corrida semanal solo re-prueba los mutantes de lo que cambió. La primera corrida con el alcance ampliado del #617 es completa.

Primera medición: transitions 100 %, sweeper 79,07 % (total 84,21 %). Los 9 mutantes sobrevivientes del sweeper eran todos del contador y el log final (`expired -= 1`, la condición `expired > 0`, el texto del log, y `return false`/`return true` de `expireOne` en las líneas 88 y 103), porque ningún test miraba el log. Se cerraron afirmando en el spec el log `1 corte/s ...` cuando vence uno y su ausencia cuando la carrera con `streetClosureEnded` deja `count: 0`. Remedición solo del sweeper: 100 %, 0 sobrevivientes.
