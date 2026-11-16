# Testing

> Cómo correr los tests unitarios y e2e, y qué cubre cada suite de `test/`. Leer antes de tocar la base de pruebas o el job `e2e` del CI.

Dos suites separadas, con propósitos distintos:

| Suite | Comando | Qué prueba | Base de datos |
|---|---|---|---|
| **Unitaria** | `npm test` / `npm run test:cov` | Reglas de negocio de cada service, con Prisma mockeado. Es la que mide la cobertura: umbral **90%** en las cuatro métricas (#660; el mínimo del TPO es 85%) | No usa |
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
| `security-input.e2e-spec.ts` | Seguridad de entrada (#569): payloads SQL (`'; DROP TABLE--`, `' OR 1=1--`) y XSS en zonas, expedientes ambientales y servicios (se guardan como texto, sin 500); mass assignment (`status`/`role`/`id` en `PATCH /services/:id` y `/zones/:id` dan 400 y no persisten); 413 por archivo de más de 10 MB; CSP restrictiva en la API y la propia de Swagger UI en `/api/docs` |
| `security-live.e2e-spec.ts` | Las pruebas de seguridad que la cátedra corre en vivo (#696), con Swagger y CORS montados como en `main.ts` (`createTestApp(customize, beforeInit)`). **JWT** (401): vencido, payload editado con la firma vieja, otra clave, `alg=none`, otro `iss`, sin `iss`, `typ=refresh`, sin `exp`, `nbf` futuro y basura; tokens armados a mano en el test. **BFLA** (403 `ROLE_REQUIRED`, sin nombrar el rol y sin filas nuevas). **BOLA** (403 `NOT_ASSIGNED`): un integrante de otra cuadrilla lee o sube evidencia, suspende, cierra o informa zona de un servicio ajeno; otro inspector cierra una inspección asignada; `/me` ignora un `userId` en la query; la base no cambia. **Mass assignment** (400 y nada persistido) en `POST /zones`, `/services`, `/environmental-reports`, `PATCH /services/:id` y `PUT /role-assignments`. **Inyección**: SQL en el id y en el filtro, SQL y XSS en texto libre (se guarda literal y vuelve como JSON con CSP), operadores NoSQL y carácter nulo. **Cabeceras y CORS**: CSP, `nosniff`, `X-Frame-Options`, `Permissions-Policy`, HSTS en producción, `/api/docs` con su CSP y sin scripts en línea, origen ajeno sin `Access-Control-Allow-Origin` y nunca credenciales. **Errores y logs**: 500 forzado sin stack, con `traceId` igual al header y al log; 404 y JSON roto sin stack; el log no tiene el `Authorization` ni tokens de la query |
| `outbox-rabbitmq-real.e2e-spec.ts` | Publicación del outbox contra un RabbitMQ real (#618): el `OutboxDispatcher` y el `RabbitMqEventPublisher` reales publican las filas PENDING a `muni.inbox` (se verifica consumiendo de una cola propia enlazada) y las marcan SENT. La caída del broker se simula apuntando el publisher a un puerto sin broker y luego a RabbitMQ real (corre igual en el CI): las filas quedan PENDING con el intento contado, al volver se reenvían sin pérdida ni `eventId` repetido, agotados `MAX_ATTEMPTS` pasan a FAILED y no se reintentan solas (es diseño: el reintento de una fila FAILED es manual; «al volver el broker se reenvían» vale dentro del margen de `MAX_ATTEMPTS`), y un publisher con conexión viva al que se le cierra la conexión (API de management, solo la que abrió el publisher; se saltea con aviso si `RABBITMQ_MGMT_URL` no apunta a localhost) se recupera y reenvía sin pérdida ni `eventId` repetido. Los asserts de "sin duplicados" esperan a que la cola se estabilice (ventana de 600 ms sin mensajes nuevos). Mismo salto y mismo comando que `rabbitmq-real` (el nombre contiene `rabbitmq-real`, así que el CI ya la corre en su paso aparte). No hay variante con `docker stop` del broker Las dos suites `rabbitmq-real` comparten el broker y una cierra conexiones ajenas: corren **en serie** (`--no-file-parallelism`, #634; la config e2e ya corre un archivo a la vez); el publisher se identifica con `connection_name` `m6-outbox-publisher`. |
| `rabbitmq-real.e2e-spec.ts` | Consumer del bus contra un RabbitMQ real (#575): mensaje válido, mismo `eventId` dos veces (una sola fila), JSON/sobre inválido (sin fila, no traba la cola) y recuperación cuando el broker cierra la conexión (vía API de management, `DELETE /api/connections`). Se saltea con aviso si no hay `RABBITMQ_URL` o no apunta a localhost. Local: `docker run -d -p 5672:5672 -p 15672:15672 rabbitmq:4.4-management` y `RABBITMQ_URL=amqp://guest:guest@localhost:5672 npm run test:e2e -- rabbitmq-real --no-file-parallelism`. El caso de recuperación cierra **todas** las conexiones del broker local salvo la suya (incluido un backend del compose, que reconectaría) y se saltea si `RABBITMQ_MGMT_URL` no apunta a localhost. Apagar el broker de verdad no es viable en un service container del CI; cerrar la conexión ejercita la misma reconexión (`recovery`) |
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

El job `e2e` de `.github/workflows/ci.yml` levanta `postgres:16` y `rabbitmq:4.4-management` con `services:` y corre `npm run test:e2e -- --exclude '**/*rabbitmq-real*'` y, en un paso aparte con `RABBITMQ_URL` (para no activar el consumer en las demás), `npm run test:e2e -- rabbitmq-real --no-file-parallelism`; las migraciones las aplica `global-setup.ts`, igual que en local.

**No es check obligatorio** de la protección de ramas: ahí siguen solo `build` y `test`. La cobertura de los e2e tampoco se suma al 90%, que se sigue midiendo con los unitarios.

**Contratos de M2 (v1.78).** `updateTicketStatus` se valida en `payloads.spec.ts` y en los specs de los services contra nuestro schema versionado (`docs/eventos/publicados/`, helper `src/events/update-ticket-status-schema.testing.ts`), siempre, también en el CI. El otro sentido (ejemplos de M2 contra nuestro inbox) lo cubre `src/events/consumers/m2-ejemplos.spec.ts` con una selección mínima de sobres en `test/fixtures/m2/`. La comprobación contra el paquete oficial de M2 (que vive en `docs/documentacion/`, sin versionar) es manual y local, cuando M2 publique una versión nueva; la v1.78/v1.79 vigente no cambió schemas ni ejemplos. **Límite:** lo que nuestro schema no declara ya no se valida en CI; en concreto `ticketId` es `string` libre acá, así que dejó de comprobarse que sea UUID como exige M2. Agregarle `format: uuid` es un cambio de contrato que decide el equipo.

## Guion de seguridad en vivo (#696)

`scripts/security-live.mjs` corre los casos de `security-live.e2e-spec.ts` contra una URL base cualquiera e imprime una tabla caso → esperado → obtenido → OK/FALLA. Sale con código 1 si un caso falla. No usa dependencias (Node 18+, `fetch`).

```bash
# Local (npm run start:dev con el seed de demo)
JWT_SECRET='<el del .env, base64>' node scripts/security-live.mjs

# Render
JWT_SECRET='<el de Render>' node scripts/security-live.mjs --base-url https://m6-backend-m64k.onrender.com
```

- **Sin `JWT_SECRET`** corren solo los casos que no necesitan un token válido (JWT trucho, cabeceras, CORS, errores); el resto sale `SALTEADO`. Con el secreto, firma tokens de los usuarios del seed (`10000` admin, `10002` operaciones, `10007` auditor, `10010` integrante de Belgrano; [`seed.md`](seed.md)). El secreto y los tokens no se imprimen.
- **No deja cambios** si la API se porta bien: todo caso que escribe espera 400/401/403, y BOLA y mass assignment releen el servicio con admin para confirmar que no cambió. El XSS guardado crea un expediente de verdad: solo corre con `--writes` (no usarlo contra Render salvo que se quiera dejar ese dato).
- BOLA busca solo un servicio `SCHEDULED` o `IN_PROGRESS` de una cuadrilla que no es la de `10010`; si la base no tiene ninguno, el caso falla con ese motivo.
- Un 500 no se puede provocar desde afuera: el 500 sin stack y con `traceId` en el log lo prueba el e2e.
- Corrida del 16/11/2026 contra Render **antes** de desplegar #696: los casos sin token dieron 401/404/400 en Problem Details y sin stack; fallaron los que dependen de este cambio (CSP en `/api/docs`, `path` sin query y `traceId`).

## Tests de API (Newman + Schemathesis, #572)

Workflow aparte, `.github/workflows/api-tests.yml` (no es check obligatorio): levanta Postgres, migra, siembra el seed de demo, arranca `node dist/main` con un `JWT_SECRET` de juguete declarado en el workflow y corre:

- **Newman** con `test/api/m6.postman_collection.json` (generada desde `docs/api/openapi.json` y los flujos de `scripts/api-flujos.mjs` con `npm run api:collection`; regenerarla y commitearla si cambia el OpenAPI). Cada operación tiene al menos un caso de éxito (2xx con aserciones sobre el cuerpo; las escrituras con flujos encadenados que crean su propio recurso) y uno de error (401, 403, 400/404). `npm run api:coverage` (también spec de `npm test` y primer paso del job) falla si una operación queda sin caso y sin excepción justificada en `test/api/excepciones.json`. Detalle y excepciones en `test/api/README.md`. Los tokens no se versionan: `JWT_SECRET=<base64> node test/api/make-token.mjs admin|auditor|campo` los firma, y se pasan con `--env-var token=… auditorToken=… campoToken=…`.
- **Rate limit:** el backend arranca con `THROTTLE_LIMIT=100000`. El `ThrottlerGuard` global (#568, 600 req/min por IP) devolvería 429 a Newman y sobre todo a Schemathesis (miles de casos desde una sola IP). Es inocuo mientras la variable no exista. El `JWT_SECRET` se genera por corrida (`openssl rand -base64 32`, enmascarado); las versiones de Newman y de la imagen de Schemathesis están fijadas.
- **Schemathesis** (solo GET) contra el OpenAPI: `response_schema_conformance` y `not_a_server_error` bloqueantes; `status_code_conformance` informativo porque hoy falla (hallazgo: ~40 GET devuelven un 400 del ValidationPipe que el OpenAPI no declara). `GET /neighborhoods` queda excluido: da 503 sin el catálogo de M9.

## Mutation testing (Stryker, #573, #577 y #617)

`npm run test:mutation` (config en `stryker.config.json`, runner `@stryker-mutator/vitest-runner` con `vitest.config.ts`, checker TypeScript) muta los 26 `src/modules/**/*.service.ts`, `*.transitions.ts` y `*.sweeper.ts`; umbral `break: 60`. Reporte en `reports/mutation/` (ignorado por git). Duración en el CI (Linux, `concurrency: 3`): **57 min** con el cache incremental (corrida del 75,39 %); la primera, sin cache, tardó **2 h 26 min**. En local, 5 archivos tardaron 44 min. El workflow `.github/workflows/mutation.yml` corre solo a mano o semanal, no en cada push.

En el workflow, el modo incremental de Stryker se conserva entre corridas con `actions/cache` (`reports/mutation/incremental.json`, una clave por run y se restaura la más reciente): la corrida semanal solo re-prueba los mutantes de lo que cambió.

**Medir un archivo:** `npx stryker run --mutate src/modules/trees/trees.service.ts --force --incrementalFile <tmp>/trees.inc.json --reporters clear-text,json` (`--force` re-prueba todo; el incremental temporal no toca el del repo).

**Windows:** si Stryker termina con «No tests were executed», el `vitest.related` por defecto del runner no encontró los tests relacionados; se corre con `"vitest": { "configFile": "vitest.config.ts", "related": false }` en una copia de la config fuera del repo (`-c <copia>`). El CI de Linux no lo necesita.

Resultados (global en CI 71,22 % → 75,39 % tras el refuerzo, score por archivo, antes y después de los 5 archivos reforzados, lo que queda sin cubrir y por qué): [`QA/05-informe-ejecucion.md`](QA/05-informe-ejecucion.md) §5.1. Antecedente (#577): `outbound-requests.transitions.ts` y `street-closure-expiry.sweeper.ts` fueron los primeros en medirse, con 100 % tras sumar aserciones al log del sweeper.

## Escaneo de seguridad dinámico (OWASP ZAP, #659)

Workflow [`dast.yml`](../.github/workflows/dast.yml): `workflow_dispatch` y corrida semanal (lunes 06:00 UTC); no se engancha al deploy. Dos jobs:

- **baseline**: `zaproxy/action-baseline` pasivo contra Render (`/api/docs`). La URL sale de la variable de Actions `RENDER_HEALTH_URL` (la misma de `keepalive.yml`, sin el `/health`).
- **active**: `zaproxy/action-api-scan` activo contra un `docker compose` efímero (base y broker descartables, `JWT_SECRET` de prueba, seed de demo) con `docs/api/openapi.json`. Autentica con un token admin de `test/api/make-token.mjs` (`ZAP_AUTH_HEADER_VALUE`). El override `.github/dast/compose.dast.yml` sube `THROTTLE_LIMIT` solo ahí; un proxy de registro (`.github/dast/proxy.mjs`) deja el recuento de códigos de respuesta como prueba de autenticación.

**El activo nunca va contra Render**: escribe datos, choca con el límite de 600 req/min y publicaría al bus del Core. Ambos jobs fallan ante una alerta High; las Medium se justifican una por una en [`QA/07-informe-seguridad.md`](QA/07-informe-seguridad.md) §5.2. Sin reglas ignoradas. Los reportes son artifacts (90 días); la corrida final se archiva en `docs/QA/evidencia/`. Para correrlo en una rama hace falta que el workflow esté en `main` (límite de `workflow_dispatch`) o un `push` temporal.

**Cómo leer el resultado.** Los reportes (HTML y JSON) son artifacts del run. El activo trae además `pedidos-por-codigo.txt`, el recuento de códigos de respuesta del proxy: si aparece un 401 generalizado, ZAP no llegó autenticado y la corrida no vale. Corrida final sobre `main` (16/11/2026): [run 43788946357](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/43788946357), baseline 0 High y 1 Medium, activo 0 High y 1 Medium; el detalle y la justificación de cada Medium están en `QA/07` §5.2. Para correrlo: pestaña Actions → `dast` → *Run workflow*.

## SonarCloud (#657)

El job `sonar` de `ci.yml` descarga el `lcov` que publica `test` (no vuelve a correr los tests) y analiza con `sonar-project.properties`. Corre en PR y en push a `main` (el plan gratuito no analiza otras ramas) y se saltea sin `SONAR_TOKEN`. Dashboard: [hllous_Backend-M6-DAPS2](https://sonarcloud.io/summary/overall?id=hllous_Backend-M6-DAPS2).

- **El gate es bloqueante para el job** (Opción C, paso 2, #660): el scanner corre con `sonar.qualitygate.wait=true` (espera hasta 5 min) y el job `sonar` falla si el gate da rojo. Que eso impida el merge depende de que `sonar` figure como check requerido en la protección de `develop`, que configura el líder.
- El gate «Sonar way» evalúa **código nuevo**. Las métricas del código total (las que pide la cátedra) se leen en el dashboard o con la API pública: `curl -s "https://sonarcloud.io/api/measures/component?component=hllous_Backend-M6-DAPS2&metricKeys=coverage,bugs,vulnerabilities,duplicated_lines_density,reliability_rating,security_rating,security_hotspots_reviewed"` (ratings: 1 = A).
- La cobertura de Sonar viene de `npm run test:cov` y sus exclusiones son las de `vitest.config.ts` (ver el comentario de `sonar-project.properties`): si cambiás `coverage.exclude`, cambiá también `sonar.coverage.exclusions`.
- Un hallazgo se corrige en código. Marcar uno como falso positivo o aceptado lo hace una persona, en Sonar, con justificación escrita.

## Trivy (#658)

Job `trivy` de `ci.yml`, tres pasadas: `fs` (lockfile y secretos), `image` (la imagen del `Dockerfile`) y `config` (`Dockerfile` y compose). Cada una sube su SARIF a Code Scanning (categorías `trivy-fs`, `trivy-image` y `trivy-config`; HIGH y CRITICAL, también las sin fix) y después corre un gate que **falla con HIGH/CRITICAL con fix**. Frena el deploy, no el merge.

- Local, con Docker: `docker run --rm -v "$PWD:/w" aquasec/trivy:latest fs --severity HIGH,CRITICAL --ignore-unfixed /w`.
- Una HIGH/CRITICAL **sin fix** va a `.trivyignore` (una línea por CVE con justificación y mitigación) y a la tabla de `QA/07` §5.2. Hoy el archivo está vacío. Las que tienen fix no se ignoran: se corrigen.
- Cuando cambies el `Dockerfile`, levantá el compose y verificá `/health/ready`: el CI lo hizo tras cada cambio de la imagen.
