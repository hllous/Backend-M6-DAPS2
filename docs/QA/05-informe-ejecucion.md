# 05 · Informe de ejecución

> Backend del Módulo 6 (Grupo 04). Corrida original del **03/11/2026**, sobre `develop` @ `f288d31`. Los números salen de una corrida real y de los runs de GitHub Actions; lo que no se midió figura como **no realizado**, con el motivo.
>
> **Re-medido el 06/11/2026** (sobre el árbol de trabajo de la rama de documentación, después de #521): unitarios con cobertura (`npm run test:cov`: 115 suites, 2650 tests, 100,2 s), cobertura global y por carpeta, tests saltados, build y lint, rutas y operaciones de `openapi.json`, cantidad de archivos e2e y CI de `develop`. **Queda de la fecha original (03/11), y así está rotulado:** los e2e del CI (tocan la base; no se corrieron el 06/11, ver [`docs/testing.md`](../testing.md)), los tiempos de la sección 4 de `main` y todo lo marcado «no realizado».

## 1. Cómo se obtuvieron los números

| Qué | Cómo | Cuándo | Dónde |
|---|---|---|---|
| Unitarios con cobertura | `npm run test:cov` (Prisma mockeado, no toca ninguna base) | 03/11/2026, 08:29, local (Windows, Node 22) | Salida completa en el log de la corrida |
| Unitarios y e2e en CI | Jobs `test` y `e2e` del run de `main` | 03/11/2026, 01:01 UTC | [run 41556929968](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/41556929968) |
| Tiempos de pipeline | Marcas de inicio y fin de los 5 últimos runs de `CI` | 02/11 y 03/11 (resultado de `develop` re-consultado el 06/11) | `gh run list` (ver sección 4) |
| Contrato OpenAPI | Spec `src/openapi-contract.spec.ts` y paso del CI | En las dos corridas anteriores | Sección 6 |
| Re-medición del 06/11 | `npm run build`, `npm run lint:check` (0 errores, 290 warnings), `npm run test:cov`; conteo de rutas y operaciones de `docs/api/openapi.json`; conteo de archivos `test/**/*.e2e-spec.ts` | 06/11/2026, local | Secciones 2, 3 y 6 |

Antes de correr el local hubo que ejecutar `npx prisma generate`: el cliente Prisma instalado estaba desactualizado y 48 suites fallaban al compilar. El comando solo escribe en `node_modules`.

Los **e2e no se corrieron en local**: truncan todas las tablas y exigen una base descartable (ver [`docs/testing.md`](../testing.md)). Se citan los resultados del CI.

El árbol de trabajo tenía cambios locales ajenos a #494 (`package.json`, `docs/integracion/` y `scripts/export-cuentas-m1.ts`). No afectan a la cobertura: los scripts no entran en `collectCoverageFrom`, salvo `migrate-crew-user-ids.ts`.

## 2. Totales por nivel

| Nivel | Suites | Ejecutados | Pasados | Fallados | Bloqueados | Saltados | Tiempo |
|---|---|---|---|---|---|---|---|
| Unitario, local (**06/11**, re-medido) | 115 | 2650 | 2650 | 0 | 0 | 0 | 100,2 s (Jest) |
| Unitario, local (03/11) | 112 | 2533 | 2533 | 0 | 0 | 0 | 897,9 s (Jest) |
| Unitario, CI de `main` | 112 | 2469 | 2469 | 0 | 0 | 12 (1 suite entera) | 43,6 s (Jest) |
| E2E con Postgres 16, CI de `main` (**03/11; no se repitió el 06/11**) | 16 | 291 | 291 | 0 | 0 | 0 | 12,1 s (Jest) |
| Integración con RabbitMQ real | — | — | — | — | — | — | **no realizado** |
| Contrato REST contra OpenAPI (Schemathesis o Pact) | — | — | — | — | — | — | **no realizado** |
| Carga (k6, Gatling o JMeter) | — | — | — | — | — | — | **no realizado** |
| Seguridad dinámica (ZAP) | — | — | — | — | — | — | **no realizado** |
| Mutation testing (Stryker o PIT) | — | — | — | — | — | — | **no realizado** |

Notas:

- **Local y CI no coinciden en el total** (2533 contra 2481 = 2469 + 12 saltados). En local existe la carpeta `docs/documentacion/` con el paquete de M2; en el CI no, y esos tests se saltean con un aviso. La diferencia de 52 tests se atribuye a eso, pero no se contó test por test.
- **El tiempo local es engañoso.** Los 897,9 s del 03/11 los midió Jest con la máquina ocupada en otras tareas; el 06/11 la misma corrida tardó 100,2 s (con cobertura). El CI tarda 43,6 s (03/11). Ninguno dimensiona por sí solo el pipeline.
- **Los e2e** cubren: ciclo de servicios, pertenencia de Campo, inbox e idempotencia, outbox con reintento, flujo ambiental, cortes de calle, cierre de contenedores con rollback, roles por endpoint, auditoría, autorización de extracciones, solicitud de información, personas de demo, migración de cuadrillas y el guard de la base. Detalle en `docs/testing.md`.
- **Bloqueados: 0** en todos los niveles. No hay casos bloqueados por dependencias externas porque lo que depende de otros módulos (M1, M9, M7) no tiene caso automatizado todavía; esa parte figura en `06-registro-defectos.md` (DEF-01 a DEF-03).

## 3. Cobertura (unitarios, `npm run test:cov`)

**Global re-medida el 06/11:** sentencias 98,59 % · ramas 93,87 % · funciones 98,09 % · líneas 99,18 % (115 suites, 2650 tests; los umbrales del 85 % se cumplen). La tabla por carpeta es de la misma corrida del 06/11.

**Global del 03/11:** sentencias 98,51 % · ramas 93,98 % · funciones 97,98 % · líneas 99,12 %. El umbral global del repo es 85 % en las cuatro métricas (`package.json`, `coverageThreshold`) y la corrida lo cumplió (`EXIT=0`). En el CI: 98,51 / 94,07 / 97,98 / 99,12 (las ramas difieren por los tests de M2 saltados).

Umbrales de la cátedra: líneas ≥ 80 %, ramas ≥ 70 % en la capa de negocio. **Cumple** (06/11): el valor más bajo de `src/modules/*` es 95,71 % de líneas y 82,92 % de ramas, ambos en `green-points`.

Cobertura por carpeta de la corrida del **06/11/2026** (115 suites, 2650 tests):

| Carpeta | Sentencias | Ramas | Funciones | Líneas |
|---|---|---|---|---|
| `src/auth` | 98,32 | 90 | 96,77 | 100 |
| `src/common/audit` | 100 | 100 | 100 | 100 |
| `src/common/decorators` | 99,07 | 90,9 | 100 | 100 |
| `src/common/filters` | 94,73 | 77,77 | 100 | 97,05 |
| `src/common/utils` | 96,73 | 86,66 | 94,44 | 98,66 |
| `src/common` (raíz), `guards`, `interceptors`, `middleware`, `pipes` | 100 | 100 | 100 | 100 |
| `src/core` | 97,98 | 98,9 | 91,56 | 100 |
| `src/events` (raíz) | 100 | 97,4 | 100 | 100 |
| `src/events/consumers` | 97,81 | 94,48 | 98,07 | 98,79 |
| `src/events/inbox` | 100 | 95,83 | 100 | 100 |
| `src/events/outbox` | 98,46 | 92,3 | 100 | 99,12 |
| `src/events/publishers` | 95,83 | 100 | 88,88 | 98,36 |
| `src/health` | 100 | 100 | 100 | 100 |
| `src/identity` | 100 | 100 | 100 | 100 |
| `src/modules/attachments` | 95,74 | 90,14 | 100 | 98,21 |
| `src/modules/attachments/storage` | 100 | 80 | 100 | 100 |
| `src/modules/citizen-portal` | 100 | 90,62 | 100 | 100 |
| `src/modules/containers` | 99,24 | 93,22 | 100 | 99,21 |
| `src/modules/crews` | 100 | 96,11 | 100 | 100 |
| `src/modules/environmental-inspections` | 100 | 97,26 | 100 | 100 |
| `src/modules/environmental-reports` | 99,46 | 91,52 | 100 | 100 |
| `src/modules/green-points` | 95,94 | 82,92 | 100 | 95,71 |
| `src/modules/green-spaces` | 98,55 | 93,33 | 100 | 98,46 |
| `src/modules/indicators` | 97,51 | 86,9 | 93,4 | 98,41 |
| `src/modules/outbound-requests` | 98,59 | 95,65 | 98 | 98,45 |
| `src/modules/role-assignments` | 100 | 95 | 100 | 100 |
| `src/modules/routes` | 100 | 88 | 100 | 100 |
| `src/modules/services` | 97,79 | 93,8 | 98,98 | 97,84 |
| `src/modules/trees` | 98,66 | 90,9 | 100 | 98,48 |
| `src/modules/trees/interventions` | 99,16 | 97,14 | 100 | 99,12 |
| `src/modules/trees/surveys` | 100 | 100 | 100 | 100 |
| `src/modules/vehicles` | 98,68 | 96 | 100 | 98,61 |
| `src/modules/zones` | 100 | 97,56 | 100 | 100 |
| `src/modules/communes`, `disposal-sites`, `neighborhoods`, `service-frequencies`, `service-types` | 100 | 100 | 100 | 100 |
**Qué excluye el cálculo** (`collectCoverageFrom`): los `*.module.ts`, los `dto/`, `index.ts`, `main.ts`, `configure-app.ts`, `config/`, `prisma/` y el helper `events/m2-contract.testing.ts`. El docente puede preguntar por estas exclusiones: son código de cableado o de configuración, y `config/` tiene su propio spec (`configuration.spec.ts`) que corre aunque no cuente.

**Qué no mide la cobertura.** La cobertura de líneas dice qué se ejecutó, no qué se verificó. Por eso la cátedra pide mutation testing; sin él, el 99 % no prueba que los tests detecten un cambio (ver sección 7).

## 4. Tiempos del pipeline

**Estado de `develop` al 06/11** (`gh run list --branch develop --limit 5`): los 5 últimos runs de `CI` terminaron en `success`.

| Run | Commit | Fecha (UTC) | Resultado |
|---|---|---|---|
| 42134125515 | `aa540be` | 06/11 00:04 | success |
| 42120751744 | `233fbb2` | 05/11 22:21 | success |
| 42120283256 | `bc6fa5b` | 05/11 22:17 | success |
| 42115666820 | `c07dcc9` | 05/11 21:46 | success |
| 42091476962 | `1885b21` | 05/11 19:11 | success |

No se re-midieron las duraciones del 06/11; la tabla siguiente es del 03/11. Pipeline de `CI` (jobs `build`, `test` y `e2e` en paralelo), de principio a fin:

| Run | Evento | Rama | Duración total |
|---|---|---|---|
| [41556929968](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/41556929968) | push | `main` | 1 min 52 s (con `deploy` a Render) |
| 41556958064 | push | `test` | 1 min 57 s |
| 41556500086 | pull request | `release/2026-11-03-test-to-main` | 1 min 49 s |
| 41551982813 | push | `develop` | 1 min 45 s |
| 41550463870 | pull request | `feature/488-seed-ids-cuentas-m1` | 1 min 51 s |

Detalle del run de `main`: `build` 58 s · `test` 1 min 43 s (43,6 s de Jest, el resto es instalación y cobertura) · `e2e` 1 min 17 s (12,1 s de Jest) · `deploy` 4 s.

**Límite de la cátedra: 15 minutos. Cumple, con mucho margen.** Los 12 últimos runs del workflow `CI` terminaron en `success` (`gh run list --workflow CI`, 03/11).

El job `e2e` **no es check obligatorio** de la protección de ramas (`.github/branch-protection-rules.json` exige solo `build` y `test`); ver DEF-14.

## 5. Calidad de los tests

**Tests anulados o saltados.** Las únicas anulaciones son condicionales a que exista el paquete de contratos de M2 (`PAQUETE_M2_PRESENTE`):

| Punto | Archivo |
|---|---|
| `describe.skip` de toda la suite | `src/events/consumers/m2-ejemplos.spec.ts:32` |
| `it.skip` | `src/events/payloads.spec.ts:427` |
| `it.skip` | `src/modules/environmental-reports/environmental-reports.service.spec.ts:923` |
| `it.skip.each` (`ROUTED`, `IN_PROGRESS`) | `src/modules/services/services.service.spec.ts:1376` |

Son 4 puntos, 12 tests saltados y 1 suite saltada en el CI. Están **justificados por escrito** en `docs/testing.md` (el paquete de M2 vive en `docs/documentacion/`, que no se versiona), pero **el CI no avisa más que con un `console.warn`**: si el paquete falta, nadie se entera de que se dejó de validar el contrato de M2. En local corren los 12. Recuento del 06/11 (`grep` de `it.skip`, `xit`, `xdescribe`, `describe.skip`, `test.skip`, `it.todo` y `.only(` en `src/` y `test/`): exactamente esos 4 puntos; **0** `it.todo`, `xit`, `xdescribe`, `test.skip` y `.only`. El log de Jest del 06/11 no informa tests saltados ni pendientes (la corrida local los ejecuta todos).

**Aserciones débiles.** `src/modules/services/services.service.spec.ts:875` verifica «se puede cancelar desde %s» solo con `resolves.toBeDefined()`. Un `cancel()` que devolviera cualquier cosa pasaría. Hay 25 usos de `toBeDefined()` o `toBeTruthy()` en todos los specs; solo se revisó el de la línea 875 y es la única verificación de ese caso.

**Tests que mockean la clase bajo prueba:** no se encontró ninguno por muestreo. No se revisaron los 111 specs uno por uno.

**Los unitarios mockean Prisma**, así que prueban llamadas más que comportamiento de base; el comportamiento real contra Postgres lo cubren los e2e (16 suites corridas el 03/11; 17 archivos al 06/11).

## 6. Contrato y API

| Qué | Estado |
|---|---|
| `docs/api/openapi.json` | 103 rutas y 152 operaciones (6/11; el 03/11 eran 102 y 150). El CI regenera el archivo con `npm run openapi:generate` y falla si queda desactualizado (`git diff --exit-code`) |
| `src/openapi-contract.spec.ts` | 4 tests: toda operación 200/201 declara el schema de su respuesta; el `openapi.json` está al día con el código; ninguna propiedad queda como `type: object` sin forma; todo campo con `@Min`, `@Max`, `@IsLatitude` o `@IsLongitude` declara `minimum` y `maximum` |
| Eventos publicados | 7 `.schema.json` en `docs/eventos/publicados/`, validados con `ajv` en `src/events/payloads.spec.ts` |
| Respuestas reales contra OpenAPI | **No realizado**: no hay Schemathesis ni Pact |
| Colección Postman, Newman o Karate | **No realizada**: los e2e usan `supertest` |
| Todos los endpoints con un caso de éxito y uno de error | **No verificado**: hay 152 operaciones y 17 archivos e2e al 06/11 (16 suites corridas en el CI el 03/11); no existe un mapeo de endpoint a caso |
| Entidad central, toda transición inválida → 409 | **Parcial**: hay tablas de transición y tests parametrizados, pero ningún test recorre todos los pares origen × destino de `ServiceStatus` |

## 7. Lo que no se realizó

| Criterio de la cátedra | Estado | Motivo |
|---|---|---|
| Mutation score ≥ 60 % | **No realizado** | No hay Stryker ni configuración ni paso en el CI |
| Quality Gate (SonarCloud): 0 bugs Blocker o Critical, 0 vulnerabilidades, duplicación ≤ 3 % | **No realizado** | No hay cuenta, `sonar-project.properties` ni paso en el CI |
| Carga: 50 usuarios, 5 min, 3 endpoints, p95 < 500 ms, error < 1 % | **No realizado** | No hay script ni reporte |
| Integración con broker y base reales en contenedor (Testcontainers) | **Parcial** | Postgres real sí, como contenedor de servicio del CI; RabbitMQ real **no** |
| Suite corrida 3 veces seguidas con el mismo resultado | **No realizado** | Hay una corrida local y una de CI, ambas verdes. Jest avisó en local de «A worker process has failed to exit gracefully» (handles abiertos), señal de posible inestabilidad |
| Captura del Quality Gate | **No realizado** | Depende de SonarCloud |
| Resultados de performance | **No realizado** | Ver carga |

## 8. Qué falta y plan

| # | Acción | Cierra | Esfuerzo |
|---|---|---|---|
| 1 | Test de la matriz completa de transiciones (`ServiceStatus`, contenedor, reparaciones y cortes, expediente), con `it.each` sobre todos los pares y 409 en los inválidos | Criterio de la entidad central | 3 a 4 h |
| 2 | Script k6 con 50 usuarios, 5 minutos y 3 `GET` críticos, con umbrales `p(95)<500` y `rate<0.01`, contra el despliegue; guardar el reporte en `docs/QA/` | Carga | medio día |
| 3 | Schemathesis contra `openapi.json` en el CI (contrato y API) | Contrato | 3 a 4 h |
| 4 | SonarCloud: `sonar-project.properties`, paso de la acción y `lcov`; resolver lo que reporte el gate | Quality Gate | 2 a 3 h más correcciones |
| 5 | Stryker acotado a `src/modules/**/*.service.ts` y a las tablas de transición; medir antes de la defensa y declarar el resultado | Mutation | medio día para configurar, 1 a 2 días si hay que reforzar tests |
| 6 | Correr la suite 3 veces seguidas y revisar los handles abiertos con `--detectOpenHandles` | Estabilidad | 2 a 3 h |
| 7 | Hacer que el CI falle o avise de forma visible si falta el paquete de M2; o versionar los schemas | Tests saltados | 1 a 2 h |
| 8 | Reemplazar las aserciones débiles (`services.service.spec.ts:875` y revisar el resto) | Tests anulados | 1 h |
| 9 | Hacer obligatorio el job `e2e` en la protección de ramas | Pipeline | 15 min |
| 10 | Ensayo manual de caída y vuelta del broker con RabbitMQ real | Resiliencia | 1 a 2 h |

Si no alcanza el tiempo, lo que no se haga se declara «no realizado» en el informe final (regla G9) y no se presenta con números sin evidencia.
