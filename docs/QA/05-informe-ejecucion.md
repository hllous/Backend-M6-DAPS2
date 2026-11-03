# 05 · Informe de ejecución

> Backend del Módulo 6 (Grupo 04). Corrida del **03/11/2026**, sobre `develop` @ `f288d31`. Los números salen de una corrida real y de los runs de GitHub Actions; lo que no se midió figura como **no realizado**, con el motivo.

## 1. Cómo se obtuvieron los números

| Qué | Cómo | Cuándo | Dónde |
|---|---|---|---|
| Unitarios con cobertura | `npm run test:cov` (Prisma mockeado, no toca ninguna base) | 03/11/2026, 08:29, local (Windows, Node 22) | Salida completa en el log de la corrida |
| Unitarios y e2e en CI | Jobs `test` y `e2e` del run de `main` | 03/11/2026, 01:01 UTC | [run 41556929968](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/41556929968) |
| Tiempos de pipeline | Marcas de inicio y fin de los 5 últimos runs de `CI` | 02/11 y 03/11 | `gh run list` (ver sección 4) |
| Contrato OpenAPI | Spec `src/openapi-contract.spec.ts` y paso del CI | En las dos corridas anteriores | Sección 6 |

Antes de correr el local hubo que ejecutar `npx prisma generate`: el cliente Prisma instalado estaba desactualizado y 48 suites fallaban al compilar. El comando solo escribe en `node_modules`.

Los **e2e no se corrieron en local**: truncan todas las tablas y exigen una base descartable (ver [`docs/testing.md`](../testing.md)). Se citan los resultados del CI.

El árbol de trabajo tenía cambios locales ajenos a #494 (`package.json`, `docs/integracion/` y `scripts/export-cuentas-m1.ts`). No afectan a la cobertura: los scripts no entran en `collectCoverageFrom`, salvo `migrate-crew-user-ids.ts`.

## 2. Totales por nivel

| Nivel | Suites | Ejecutados | Pasados | Fallados | Bloqueados | Saltados | Tiempo |
|---|---|---|---|---|---|---|---|
| Unitario, local (03/11) | 112 | 2533 | 2533 | 0 | 0 | 0 | 897,9 s (Jest) |
| Unitario, CI de `main` | 112 | 2469 | 2469 | 0 | 0 | 12 (1 suite entera) | 43,6 s (Jest) |
| E2E con Postgres 16, CI de `main` | 16 | 291 | 291 | 0 | 0 | 0 | 12,1 s (Jest) |
| Integración con RabbitMQ real | — | — | — | — | — | — | **no realizado** |
| Contrato REST contra OpenAPI (Schemathesis o Pact) | — | — | — | — | — | — | **no realizado** |
| Carga (k6, Gatling o JMeter) | — | — | — | — | — | — | **no realizado** |
| Seguridad dinámica (ZAP) | — | — | — | — | — | — | **no realizado** |
| Mutation testing (Stryker o PIT) | — | — | — | — | — | — | **no realizado** |

Notas:

- **Local y CI no coinciden en el total** (2533 contra 2481 = 2469 + 12 saltados). En local existe la carpeta `docs/documentacion/` con el paquete de M2; en el CI no, y esos tests se saltean con un aviso. La diferencia de 52 tests se atribuye a eso, pero no se contó test por test.
- **El tiempo local es engañoso.** 897,9 s es lo que midió Jest con la máquina ocupada en otras tareas; el CI tarda 43,6 s. No sirve para dimensionar el pipeline.
- **Los e2e** cubren: ciclo de servicios, pertenencia de Campo, inbox e idempotencia, outbox con reintento, flujo ambiental, cortes de calle, cierre de contenedores con rollback, roles por endpoint, auditoría, autorización de extracciones, solicitud de información, personas de demo, migración de cuadrillas y el guard de la base. Detalle en `docs/testing.md`.
- **Bloqueados: 0** en todos los niveles. No hay casos bloqueados por dependencias externas porque lo que depende de otros módulos (M1, M9, M7) no tiene caso automatizado todavía; esa parte figura en `06-registro-defectos.md` (DEF-01 a DEF-03).

## 3. Cobertura (unitarios, `npm run test:cov`)

**Global:** sentencias 98,51 % · ramas 93,98 % · funciones 97,98 % · líneas 99,12 %. El umbral global del repo es 85 % en las cuatro métricas (`package.json`, `coverageThreshold`) y la corrida lo cumplió (`EXIT=0`). En el CI: 98,51 / 94,07 / 97,98 / 99,12 (las ramas difieren por los tests de M2 saltados).

Umbrales de la cátedra: líneas ≥ 80 %, ramas ≥ 70 % en la capa de negocio. **Cumple**: el valor más bajo de `src/modules/*` es 95,65 % de líneas (`green-points`) y 82,92 % de ramas (`green-points`).

| Carpeta | Sentencias | Ramas | Funciones | Líneas |
|---|---|---|---|---|
| `src/modules/services` | 97,79 | 93,80 | 98,98 | 97,83 |
| `src/modules/containers` | 99,23 | 93,22 | 100 | 99,21 |
| `src/modules/crews` | 100 | 95,89 | 100 | 100 |
| `src/modules/environmental-reports` | 100 | 90,90 | 100 | 100 |
| `src/modules/environmental-inspections` | 100 | 97,18 | 100 | 100 |
| `src/modules/outbound-requests` | 98,58 | 95,65 | 98 | 98,44 |
| `src/modules/trees` | 98,57 | 90,74 | 100 | 98,38 |
| `src/modules/trees/interventions` | 99,15 | 97,14 | 100 | 99,11 |
| `src/modules/vehicles` | 98,66 | 96 | 100 | 98,59 |
| `src/modules/routes` | 100 | 88 | 100 | 100 |
| `src/modules/zones` | 100 | 97,56 | 100 | 100 |
| `src/modules/indicators` | 97,28 | 90,64 | 92,68 | 98,24 |
| `src/modules/green-points` | 95,89 | 82,92 | 100 | 95,65 |
| `src/modules/green-spaces` | 98,52 | 93,33 | 100 | 98,43 |
| `src/modules/attachments` | 95,74 | 90,14 | 100 | 98,21 |
| `src/modules/citizen-portal` | 100 | 90,62 | 100 | 100 |
| `src/modules/role-assignments` | 100 | 95 | 100 | 100 |
| `src/modules/communes`, `disposal-sites`, `neighborhoods`, `service-frequencies`, `service-types` | 100 | 100 | 100 | 100 |
| `src/events/consumers` | 97,34 | 93,93 | 97,64 | 98,52 |
| `src/events/inbox` | 100 | 94,02 | 100 | 100 |
| `src/events/outbox` | 98,46 | 92,30 | 100 | 99,12 |
| `src/events/publishers` | 95,83 | 100 | 88,88 | 98,36 |
| `src/core` | 97,98 | 98,90 | 91,56 | 100 |
| `src/auth` | 98,32 | 90 | 96,77 | 100 |
| `src/common/filters` | 94,73 | 77,77 | 100 | 97,05 |
| `src/common/guards`, `interceptors`, `middleware`, `pipes`, `audit` | 100 | 100 | 100 | 100 |

**Qué excluye el cálculo** (`collectCoverageFrom`): los `*.module.ts`, los `dto/`, `index.ts`, `main.ts`, `configure-app.ts`, `config/`, `prisma/` y el helper `events/m2-contract.testing.ts`. El docente puede preguntar por estas exclusiones: son código de cableado o de configuración, y `config/` tiene su propio spec (`configuration.spec.ts`) que corre aunque no cuente.

**Qué no mide la cobertura.** La cobertura de líneas dice qué se ejecutó, no qué se verificó. Por eso la cátedra pide mutation testing; sin él, el 99 % no prueba que los tests detecten un cambio (ver sección 7).

## 4. Tiempos del pipeline

Pipeline de `CI` (jobs `build`, `test` y `e2e` en paralelo), de principio a fin:

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
| `it.skip` | `src/modules/environmental-reports/environmental-reports.service.spec.ts:862` |
| `it.skip.each` (`ROUTED`, `IN_PROGRESS`) | `src/modules/services/services.service.spec.ts:1376` |

Son 4 puntos, 12 tests saltados y 1 suite saltada en el CI. Están **justificados por escrito** en `docs/testing.md` (el paquete de M2 vive en `docs/documentacion/`, que no se versiona), pero **el CI no avisa más que con un `console.warn`**: si el paquete falta, nadie se entera de que se dejó de validar el contrato de M2. En local corren los 12. No hay `it.todo`, `xit`, `xdescribe` ni `.only`.

**Aserciones débiles.** `src/modules/services/services.service.spec.ts:875` verifica «se puede cancelar desde %s» solo con `resolves.toBeDefined()`. Un `cancel()` que devolviera cualquier cosa pasaría. Hay 25 usos de `toBeDefined()` o `toBeTruthy()` en todos los specs; solo se revisó el de la línea 875 y es la única verificación de ese caso.

**Tests que mockean la clase bajo prueba:** no se encontró ninguno por muestreo. No se revisaron los 111 specs uno por uno.

**Los unitarios mockean Prisma**, así que prueban llamadas más que comportamiento de base; el comportamiento real contra Postgres lo cubren los 16 e2e.

## 6. Contrato y API

| Qué | Estado |
|---|---|
| `docs/api/openapi.json` | 102 rutas y 150 operaciones. El CI regenera el archivo con `npm run openapi:generate` y falla si queda desactualizado (`git diff --exit-code`) |
| `src/openapi-contract.spec.ts` | 4 tests: toda operación 200/201 declara el schema de su respuesta; el `openapi.json` está al día con el código; ninguna propiedad queda como `type: object` sin forma; todo campo con `@Min`, `@Max`, `@IsLatitude` o `@IsLongitude` declara `minimum` y `maximum` |
| Eventos publicados | 7 `.schema.json` en `docs/eventos/publicados/`, validados con `ajv` en `src/events/payloads.spec.ts` |
| Respuestas reales contra OpenAPI | **No realizado**: no hay Schemathesis ni Pact |
| Colección Postman, Newman o Karate | **No realizada**: los e2e usan `supertest` |
| Todos los endpoints con un caso de éxito y uno de error | **No verificado**: hay 150 operaciones y 16 suites e2e; no existe un mapeo de endpoint a caso |
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
