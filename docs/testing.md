# Testing

Dos suites separadas, con propósitos distintos:

| Suite | Comando | Qué prueba | Base de datos |
|---|---|---|---|
| **Unitaria** | `npm test` / `npm run test:cov` | Reglas de negocio de cada service, con Prisma mockeado. Es la que mide el 85% del DoD | No usa |
| **End to end** | `npm run test:e2e` | La app completa —auth, `ValidationPipe`, cabeceras de seguridad, máquinas de estado, outbox e inbox— contra Postgres | Sí, y **la trunca** |

Los unitarios viven al lado del código (`src/**/*.spec.ts`); los e2e, en `test/*.e2e-spec.ts`.

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

Las migraciones las aplica el propio arranque de jest (`test/global-setup.ts`), con la URL ya validada. Antes era un `npx prisma migrate deploy` aparte, y ese paso quedaba fuera del guard: el CLI de Prisma lee el `.env` del repo por su cuenta, así que olvidarse del `export` aplicaba migraciones contra la base desplegada.

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
| `inbox.e2e-spec.ts` | Idempotencia por `eventId` (el duplicado no reprograma un servicio creado después del primer envío), sobre v1.70 con `producer` objeto, el 400 que no deja fila y el evento sin handler |
| `environmental-flow.e2e-spec.ts` | Expediente → inspección → acta, con la derivación a M4 en el outbox. Solo el camino feliz: no prueba rollback |
| `containers-close.e2e-spec.ts` | Cerrar el servicio transiciona el contenedor. Es la única suite que prueba el rollback: un `CHECK` temporal hace fallar el `UPDATE` del contenedor dentro de la transacción y se verifica que el servicio siga `IN_PROGRESS` y que no se encole nada |

Los datos se arman por caso con los helpers, **no con `prisma/seed.ts`**: el seed monta un escenario de demo entero y ata los tests a filas que no controlan.

El `OutboxDispatcher` se reemplaza por un stub sin `@Interval`. Si no, barre la cola cada 10 s —justo lo que las suites verifican— y deja un timer abierto.

## En el CI

El job `e2e` de `.github/workflows/ci.yml` levanta `postgres:16` con `services:` y corre `npm run test:e2e`; las migraciones las aplica `global-setup.ts`, igual que en local.

**No es check obligatorio** de la protección de ramas: ahí siguen solo `build` y `test`. La cobertura de los e2e tampoco se suma al 85%, que se sigue midiendo con los unitarios.
