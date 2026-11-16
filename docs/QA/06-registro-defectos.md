# 06 · Registro de defectos y limitaciones conocidas

> Versión 2.3 · 16/11/2026, cierre de la Entrega 4. Backend del Módulo 6 (Grupo 04). Al cierre del 16/11 se re-verificaron contra `develop` de cada repo (Backend `50cfff7`, Frontend `origin/develop` del 16/11) los defectos abiertos y los cerrados ese día (DEF-14, DEF-19), y se sumaron DEF-38 a DEF-40. Los defectos de las secciones 3 y 4 salen de la medición del 10/11 (`develop` @ `142e1a3`); DEF-13 y DEF-25 a DEF-28 se cerraron con la Entrega 4 y se verificaron sobre `main` @ `78bf714` (16/11); el cierre de DEF-25 a DEF-28 se re-verificó en el código de `main` @ `72908cf` (#688). DEF-29 a DEF-37 (frontend y límites de resiliencia) se verificaron el 16/11 contra `main` de cada repo (Backend `72908cf`, Frontend `82f946a`). Lo cargamos desde GitHub Issues, [`docs/bloqueantes.md`](../bloqueantes.md), el código y la auditoría interna. Todo lo marcado como abierto se **verificó contra el código actual**.

Usamos **GitHub Issues** (`hllous/Backend-M6-DAPS2`) y Trello en lugar de Jira. El identificador de cada defecto es `DEF-nn`; si tiene Issue, se enlaza, y si no, figura como **sin issue**. La numeración no se reutiliza: DEF-04 y DEF-11 se retiraron del registro (el bus y los contratos de otros módulos no son responsabilidad del equipo) y esos números quedan vacíos.

## 1. Criterios

| Severidad | Definición | Máximo abierto |
|---|---|---|
| Bloqueante | Impide usar el flujo principal o hace caer el sistema | 0 |
| Crítica | Pérdida o corrupción de datos, falla de seguridad explotable, HU Must incumplida | 0 |
| Mayor | Funcionalidad afectada con alternativa disponible | 3, con workaround documentado |
| Menor | Impacto bajo, visual o de texto | Sin límite, registrados |

La **prioridad** (orden de corrección) es independiente de la severidad: un hallazgo Menor puede tener prioridad alta si se prueba en vivo.

## 2. Resumen

| | Cantidad |
|---|---|
| Defectos y brechas registrados | 38 (DEF-01 a DEF-40, sin DEF-04 ni DEF-11). **Abiertos: 12. Cerrados: 26** |
| Issues abiertos con etiqueta `bug` (16/11) | Backend: [#692](https://github.com/hllous/Backend-M6-DAPS2/issues/692) (DEF-14: el cambio ya se aplicó, falta cerrar el issue), [#693](https://github.com/hllous/Backend-M6-DAPS2/issues/693) (DEF-36) y [#694](https://github.com/hllous/Backend-M6-DAPS2/issues/694) (DEF-37). Frontend: [#946](https://github.com/hllous/Frontend-M6-DAPS2/issues/946) (DEF-30), [#968](https://github.com/hllous/Frontend-M6-DAPS2/issues/968) (DEF-34), [#973](https://github.com/hllous/Frontend-M6-DAPS2/issues/973) (DEF-32) y [#974](https://github.com/hllous/Frontend-M6-DAPS2/issues/974) (DEF-33). Los issues de DEF-25 a DEF-28 (#665 a #668) ya están cerrados |
| Verificaciones no realizadas o parciales (no son defectos) | En la sección 5 |

| Severidad | Abiertos | Dentro del máximo |
|---|---|---|
| Bloqueante | 0 | Sí |
| Crítica | 0 | Sí |
| Mayor | **1** (DEF-32, con workaround; **corregido en el PR FE #978, pendiente de merge**) | Sí (máximo 3, con workaround) |
| Menor | 11 (DEF-29 a DEF-31, DEF-33 a DEF-40) | Sí |
| **Total abierto** | **12** | |

**Cambios del 16/11:** se cerraron DEF-14 (el job `e2e` es check obligatorio) y DEF-19 en su parte de CSP en `/api/docs`, id de correlación y `path` sin query (#701); lo que quedaba de DEF-19 (Swagger público en producción y evidencia por URL pública) pasa a **DEF-38**. Se registraron DEF-39 (los catálogos con paginación del servidor no ordenan, BE [#703](https://github.com/hllous/Backend-M6-DAPS2/issues/703)) y DEF-40 (una ruta del BFF devolvía 500 en vez de 503). DEF-29 a DEF-31 están corregidos en el PR FE #980, y DEF-32 y DEF-33 en el PR FE #978, los dos con el CI en verde y **pendientes de merge**: siguen abiertos hasta que entren a `develop`. Se abrieron issues para los defectos que no tenían: BE #692 (DEF-14), #693 (DEF-36), #694 (DEF-37) y FE #968 (DEF-34).

**Lectura honesta:** el criterio de salida **se cumple**: 0 Bloqueantes, 0 Críticos y 1 Mayor abierto con workaround (DEF-32), dentro del máximo de 3. Con el merge de FE #978 los Mayores abiertos pasan a **0**. Quedan 11 Menores: tests inestables del frontend y el `retries` que los oculta (DEF-29 a DEF-31, corregidos en FE #980; la cátedra pide 0 flaky), el timeout del BFF (DEF-33, corregido en FE #978), brechas de resiliencia y de calidad (DEF-34 a DEF-37), Swagger y evidencia públicos (DEF-38), el orden de los catálogos paginados (DEF-39) y la ruta del BFF con 500 (DEF-40). Las severidades son una **propuesta**: las deciden el líder y el QA y las valida el PO.

## 3. Defectos y brechas abiertos (y los Mayores cerrados, con detalle)

### Críticas

Ninguna abierta.

### Mayores

#### DEF-08 · Dependencias de producción con vulnerabilidades conocidas (cerrado, mitigado por #619)

| Campo | Detalle |
|---|---|
| ID | sin issue (corrección parcial: [#566](https://github.com/hllous/Backend-M6-DAPS2/issues/566), PR #576; mitigación: [#619](https://github.com/hllous/Backend-M6-DAPS2/issues/619); residual: [#628](https://github.com/hllous/Backend-M6-DAPS2/issues/628)) |
| Severidad / prioridad | Mayor (propuesta) / Alta |
| HU | HU-31 |
| Pasos | `npm audit --omit=dev` |
| Esperado | 0 CVE críticas o altas sin mitigación documentada |
| Obtenido | Historia: tras `npm audit fix` (#566) quedaban 13 en producción (0 críticas, 6 altas, 7 moderadas; antes, 15 con 1 crítica). Con los `overrides` de #619 (`body-parser` ^1.20.9, `lodash` ^4.18.1, `js-yaml` ^4.3.2 y `multer` ^2.4.0) y `zod` ^4.6.7: **8 en producción: 0 críticas, 0 altas, 8 moderadas** (`@nestjs/core`, `file-type`, `qs`, `uuid` y dependientes `@nestjs/common`, `@nestjs/platform-express` y `@nestjs/schedule`). Versiones resueltas: body-parser 1.20.9, lodash 4.18.1, js-yaml 4.3.2, zod 4.6.7, multer 2.5.0. **Con NestJS 12 (#628): 0 en producción**, sin `overrides` (body-parser 2.4.0, js-yaml 5.5.0, multer 2.5.0; lodash ya no está en el árbol) |
| Evidencia | `npm audit --omit=dev` (detalle en [`07-informe-seguridad.md`](07-informe-seguridad.md), sección 5.1); job `audit` de `.github/workflows/ci.yml` |
| Estado | **Cerrado (#619 y [#628](https://github.com/hllous/Backend-M6-DAPS2/issues/628), 10/11/2026).** #619 dejó 0 altas y 0 críticas; NestJS 12 con TypeScript 6.0.3 (#628) resolvió las 8 moderadas: `npm audit --omit=dev` da 0. Build, lint (0 errores), 2855 tests unitarios, 343 e2e (23 suites, Postgres 16 local) y las 8 de RabbitMQ real (2 suites, 3 corridas) en verde. Sin Trivy no hay segundo SCA (DEF-13) |
| Workaround | El job `audit` corre `npm audit --omit=dev --audit-level=high` y, desde #628, es **gate** (antes informativo). Dependabot semanal, sin majors de `@nestjs/*`. Los `overrides` de #619 se quitaron en #628 |

**Triage de explotabilidad (#619, 10/11/2026).** `npm audit fix` sin `--force` solo actualizó dependencias de desarrollo (`typescript-eslint`) y no bajó ninguna CVE de producción (seguían 13: 6 altas, 7 moderadas); las bajó subir esas dependencias por `overrides` y pasar `zod` a 4. El análisis de abajo describe el estado **previo** a ese cambio.

| Paquete | Versión previa / quién lo trae | ¿Recibe input del cliente? | Veredicto |
|---|---|---|---|
| `body-parser` | 1.20.4, vía `@nestjs/platform-express` | **Sí**: corre como middleware global, antes de los guards | `main.ts` no configura `limit` ni `bodyParser`, así que usa el default y el CVE del `limit` inválido **no aplicaba**. El de bytes sobrantes tras un cuerpo comprimido **era alcanzable** por un anónimo (POST con `Content-Encoding`, antes de `JwtAuthGuard`): DoS, sin fuga de datos ni ejecución de código. **Mitigado:** el `override` lo sube a 1.20.9 y el audit ya no lo lista |
| `lodash` | 4.17.21, vía `@nestjs/config` y `@nestjs/swagger` | No: lo usan las librerías sobre la configuración del servidor y la spec generada; no se auditó cada llamada interna | No explotable en M6; además subido a 4.18.1 |
| `js-yaml` | 4.1.0, vía `@nestjs/swagger` | No: no se sirve el documento YAML (no hay `yamlDocumentUrl`) y no se parsea YAML ajeno | No explotable en M6; además subido a 4.3.2 |
| `zod` | 3.25.76, directa | Solo la respuesta de M1 (`m1-identity.client.ts`) y las variables de entorno | Los esquemas no usan colecciones (`z.array`, `z.record`, `z.set`, `z.map`), que es el caso del CVE: no explotable; además subido a 4.6.7 |

**Otras:** `multer` está en 2.5.0 por el `override`; `file-type` (moderada) no se importa en `src/` (el MIME se valida con `sniffMime`); `qs`, `uuid` y `@nestjs/core` (moderadas) siguen **sin analizar** y se resuelven con #628. Como defensa adicional, el `ThrottlerGuard` global (600 por minuto por IP) acota la frecuencia, aunque corre después del parseo y sus contadores están en memoria (ADR-010). La hipótesis del issue (solo `body-parser` tenía superficie) se confirmó por lectura del código; **no se probó con un request real**.

#### DEF-13 · Análisis de seguridad en el CI: faltaban SonarCloud, Trivy y ZAP (cerrado, #656)

| Campo | Detalle |
|---|---|
| ID | sin issue propio hasta ahora; lo cubre la spec [#656](https://github.com/hllous/Backend-M6-DAPS2/issues/656) (tickets [#657](https://github.com/hllous/Backend-M6-DAPS2/issues/657), [#658](https://github.com/hllous/Backend-M6-DAPS2/issues/658), [#659](https://github.com/hllous/Backend-M6-DAPS2/issues/659) y [#661](https://github.com/hllous/Backend-M6-DAPS2/issues/661)) |
| Severidad / prioridad | Mayor / Alta |
| HU | HU-31 |
| Pasos | Revisar `.github/workflows/` y `.github/dependabot.yml` |
| Esperado | Escaneo de dependencias, de secretos y análisis estático y dinámico, con evidencia en vivo (criterios de la Clase 15, ejes B y D) |
| Obtenido (15/11, al abrir la spec) | **Hecho:** `npm audit` (job `audit`, #571; gate desde #628), Dependabot semanal, CodeQL, gitleaks sobre el historial (job `secrets`, #494). **No hecho:** SonarCloud (sin cuenta ni configuración), Trivy y OWASP ZAP |
| Causa raíz | El análisis de seguridad se armó por capas según aparecía cada necesidad y no se planificó contra los criterios de la cátedra: no había cuenta de SonarCloud, ni segundo SCA, ni escaneo dinámico, y no se registró como defecto hasta compararlo con la Clase 15 |
| Evidencia del cierre | SonarCloud: job `sonar` (#662), gate **OK** y ratings A/A/A sobre `main` (`05`, 5.2). Trivy: job `trivy` (#663), 0 HIGH/CRITICAL en `fs`, `image` y `config`; run de `main` [43786978363](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/43786978363). ZAP: workflow `dast` (#669), run final sobre `main` [43788946357](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/43788946357): 0 High en baseline y activo (`07`, 5.2). Decisiones en [ADR-017](../decisiones/adr-017-herramientas-analisis-estatico-y-seguridad.md) |
| Estado | **Cerrado (16/11/2026).** Los hallazgos reales de las tres herramientas se corrigieron y se registraron como DEF-25 a DEF-28. El gate de Sonar pasó a bloqueante y requerido después (#700, #660 cerrado). Quedan declaradas las Medium de ZAP, justificadas una por una en `07`, 5.2. No revisamos las alertas de CodeQL (el workflow termina en `success`) |

#### DEF-32 · El frontend no envía `If-Match` ni maneja el 412 (abierto; corregido en el PR FE #978, pendiente de merge)

| Campo | Detalle |
|---|---|
| ID | [Frontend #973](https://github.com/hllous/Frontend-M6-DAPS2/issues/973) (el contrato se había avisado en [Frontend #898](https://github.com/hllous/Frontend-M6-DAPS2/issues/898), cerrado sin adoptar `If-Match`) |
| Severidad / prioridad | Mayor (propuesta) / Alta |
| HU | Las de edición (`PATCH` de servicios, contenedores, cuadrillas y demás); riesgo R21 del plan |
| Pasos | 1. Abrir el mismo recurso en dos sesiones del frontend. 2. Editar y guardar en la primera. 3. Editar otro campo y guardar en la segunda |
| Esperado | La segunda escritura manda `If-Match` con el `ETag` leído, recibe 412 y la UI avisa que el recurso cambió y pide recargar (ADR-012) |
| Obtenido (en `develop` del frontend al 16/11) | La segunda escritura se acepta sin control y pisa la primera (gana el último en escribir). El backend soporta `ETag`/`If-Match` (DEF-05, #591), pero es opcional y el frontend de `develop` no lo usa |
| Causa raíz | El backend sumó la concurrencia optimista como opcional para no romper al cliente; la adopción en el frontend quedó fuera de #898 |
| Corrección | [PR FE #978](https://github.com/hllous/Frontend-M6-DAPS2/pull/978): el BFF propaga `ETag` e `If-Match` en las transiciones versionadas (ADR-012 del Backend) y en `PATCH /containers/:id`; un 412 muestra «Otra persona modificó este registro. Recargue para ver los cambios.» con la acción Recargar y sin perder lo escrito. Lo documenta un ADR del frontend (concurrencia optimista y timeout del BFF) y `CONTRACTS.md`. Test: `e2e/optimistic-concurrency.spec.ts` (CP-382). CI del PR en verde |
| Estado | **Abierto hasta el merge de FE #978** a `develop`; con el merge se cierra y no quedan Mayores abiertos |
| Workaround | Recargar el recurso antes de editar y no editar el mismo recurso en dos sesiones a la vez (en la operación cada cuadrilla o supervisor edita lo suyo). Cualquier cliente que necesite la protección puede mandar `If-Match` y el backend responde 412. Los cambios de estado los siguen validando las máquinas de estado del backend |

### Menores

| ID | Hallazgo | Evidencia | HU / estado |
|---|---|---|---|
| DEF-29 | **Frontend, test inestable** (sin issue propio; lo cubre [Frontend #946](https://github.com/hllous/Frontend-M6-DAPS2/issues/946)): «resolves linked trees by survey code beyond the first 100…» fallaba en la corrida completa de `pnpm test` y pasaba aislado. Causa raíz (FE #980): timeouts por defecto que no alcanzaban bajo carga y compuertas `delay(ms)` de MSW que dependían del tiempo | `Frontend-M6-DAPS2/src/components/catalog/tree-interventions-panel.test.tsx` | Transversal · **abierto, corregido en el PR FE #980** (CI en verde, pendiente de merge). 3 corridas locales idénticas con el arreglo (3229 tests pasan). **PENDIENTE:** 3 corridas en el CI |
| DEF-30 | **Frontend, test inestable** ([Frontend #946](https://github.com/hllous/Frontend-M6-DAPS2/issues/946), `bug`): «filters the zone's list by the existing waste labels…» falló en el CI con `Unable to find … role "option" and name "Domiciliarios"` (run 43774705340) y pasó en el run 43774729178 con el mismo código. Misma causa raíz que DEF-29 | `Frontend-M6-DAPS2/src/components/public/green-points.test.tsx`; Frontend #946 | Transversal · **abierto, corregido en el PR FE #980** (pendiente de merge) |
| DEF-31 | **Frontend:** `retries: isCI ? 1 : 0` en Playwright reintenta en el CI todo e2e que falla: un e2e inestable queda en verde y la inestabilidad no se ve en el resultado del job | `Frontend-M6-DAPS2/playwright.config.ts:21` (en `develop`) | Transversal · **abierto, corregido en el PR FE #980** (retries en 0; pendiente de merge) |
| DEF-33 | **Frontend:** el timeout del BFF al backend es de 15 s (`DEFAULT_BACKEND_TIMEOUT_MS = 15_000`) contra la referencia de 5 s. El fallback existe: al vencer responde 503 con mensaje, pero el usuario espera hasta 15 s | `Frontend-M6-DAPS2/src/lib/bff-backend.ts:18` (en `develop`); [Frontend #974](https://github.com/hllous/Frontend-M6-DAPS2/issues/974) | Transversal · **abierto, corregido en el PR FE #978** (5 s con `AbortController`, 503 «El sistema no responde…», un reintento solo en `GET` ante una falla de red inmediata; pendiente de merge). Con 5 s, Render dormido da 503 en los primeros pedidos: despertar `/health` antes de la demo (riesgo R7) |
| DEF-34 | **Frontend:** `Idempotency-Key` solo se envía en la carga de evidencia; las demás altas no la mandan aunque el backend la acepta en 21 `POST` (DEF-06). Un reintento o doble envío de otra alta puede crear un duplicado | `grep -rln "Idempotency-Key" src` en `Frontend-M6-DAPS2`; [Frontend #968](https://github.com/hllous/Frontend-M6-DAPS2/issues/968) | Transversal · abierto. Workaround: dar de baja o anular el duplicado desde la UI |
| DEF-35 | **Frontend:** sin mutation testing y sin umbral de cobertura (Vitest la mide, SonarCloud 85,4 %, pero no exige mínimo) | `Frontend-M6-DAPS2/vitest.config.ts`; `package.json`; [Frontend #975](https://github.com/hllous/Frontend-M6-DAPS2/issues/975) | Transversal · **abierto, en curso (parcial)**: la subida de la cobertura a 90 % con umbral en el CI (#975) y Stryker están en curso al 16/11; **PENDIENTE** el dato de cobertura y de mutation. Workaround: el backend sí tiene mutation (75,39 %) y umbral de 90 % |
| DEF-36 | **Backend:** el pedido a M1 tiene timeout de 10 s y no hay circuit breaker: con M1 caído, cada alta o edición de cuadrilla espera hasta 10 s antes de fallar. Decisión documentada en DEF-15 (#642): M1 corre en Render free con arranques en frío de hasta 78 s | `src/identity/m1-identity.client.ts`; [#693](https://github.com/hllous/Backend-M6-DAPS2/issues/693) | HU de cuadrillas · abierto (riesgo aceptado). Workaround: reintentar cuando M1 responda; despertar M1 antes de la demo |
| DEF-37 | **Backend:** la DLQ está delegada al Core (M9). M6 hace `nack` sin reencolar, el Core reintenta con su backoff y después manda el mensaje a su DLQ; M6 no tiene DLQ propia ni pantalla para reprocesarla | `src/events/consumers/rabbitmq.consumer.ts`; [#694](https://github.com/hllous/Backend-M6-DAPS2/issues/694) | Transversal · abierto (decisión de arquitectura, ADR-006 y `docs/integracion/m9.md`). Workaround: consultar la DLQ por la API del Core; el inbox registra cada intento fallido |
| DEF-38 | **Backend (resto de DEF-19):** Swagger UI queda publicado en `/api/docs` también en producción, y la evidencia se sirve por URL pública del bucket (key UUID aleatoria) con los metadatos de los PDF intactos | `src/swagger-config.ts:99` (`SwaggerModule.setup('api/docs', …)` sin condición de entorno); `src/modules/attachments/storage/r2-evidence.storage.ts` | HU-31 · abierto (sin issue). Riesgo aceptado: el OpenAPI no expone datos y cada ruta exige token; las keys de evidencia no son adivinables. Mejora: ocultar `/api/docs` en producción y servir la evidencia con URLs firmadas |
| DEF-39 | **Backend:** los listados de catálogos con paginación del servidor no aceptan un parámetro de orden, así que la tabla del frontend no puede ordenarlos por columna (CA-HU01-1 queda parcial). Encontrado por la automatización del Eje A | `e2e/qa-criterios-fe.spec.ts` (FE #979); [BE #703](https://github.com/hllous/Backend-M6-DAPS2/issues/703) | HU-01 · abierto. Workaround: filtrar por texto; los catálogos chicos se ordenan en el cliente |
| DEF-40 | **Frontend:** `src/app/api/vehicles/[id]/route.ts` devolvía 500 en vez de 503 con el backend caído: `return forward(...)` sin `await` dentro del `try` deja escapar el rechazo del `catch`. Encontrado por los tests de cobertura del frontend | `Frontend-M6-DAPS2/src/app/api/vehicles/[id]/route.ts` (en `develop`, `GET` y `PATCH`) | Transversal · **abierto, corregido en la rama de cobertura de [Frontend #975](https://github.com/hllous/Frontend-M6-DAPS2/issues/975)**; PR sin mergear al 16/11 |

Un test débil, `services.service.spec.ts:875` (`resolves.toBeDefined()` como única aserción), se registra en [`05-informe-ejecucion.md`](05-informe-ejecucion.md).

## 4. Defectos cerrados

El detalle (causa raíz, PR, commit y CI) está en los issues cerrados del repositorio; acá solo el índice.

| ID | Defecto | Issue |
|---|---|---|
| DEF-01 | Login real con M1 sin probar de punta a punta (`GET /me` daba 401) | [#488](https://github.com/hllous/Backend-M6-DAPS2/issues/488) |
| DEF-02 | Contrato definitivo de M9 sin cerrar | [#257](https://github.com/hllous/Backend-M6-DAPS2/issues/257) |
| DEF-03 | Integración con el Core real sin probar | [#299](https://github.com/hllous/Backend-M6-DAPS2/issues/299), [#442](https://github.com/hllous/Backend-M6-DAPS2/issues/442) |
| DEF-05 | Sin control de concurrencia optimista: ahora `ETag` e `If-Match` con 412 (ADR-012; alcance parcial) | [#591](https://github.com/hllous/Backend-M6-DAPS2/issues/591) |
| DEF-06 | Sin `Idempotency-Key` en las altas: ahora en 21 `POST` (ADR-013; guardado no atómico) | [#592](https://github.com/hllous/Backend-M6-DAPS2/issues/592) |
| DEF-07 | Rate limiting solo en el portal ciudadano: ahora global (ADR-010) | [#568](https://github.com/hllous/Backend-M6-DAPS2/issues/568) |
| DEF-08 | Dependencias de producción con CVE: 0 críticas y 0 altas tras los `overrides` y `zod` 4 (detalle en la sección 3); las 8 moderadas, con NestJS 12: `npm audit --omit=dev` da 0 | [#619](https://github.com/hllous/Backend-M6-DAPS2/issues/619), [#628](https://github.com/hllous/Backend-M6-DAPS2/issues/628) |
| DEF-09 | Auditoría de lectura de datos Tier 2 no implementada: ahora `AuditService.recordRead` registra una fila `READ` (actor del token, sin contenido) en las lecturas exitosas de `GET /environmental-inspections/:id/violation-notice`, `GET /events/inbox/:messageId` y `GET /events/outbox/:id`; falla cerrado (500 sin entregar el dato) y 401/403/404 no registran. `GET /audit` no se audita a sí mismo (riesgo aceptado, ver `entidades/auditoria.md`) | [#643](https://github.com/hllous/Backend-M6-DAPS2/issues/643) |
| DEF-10 | Errores sin formato Problem Details RFC 9457 (ADR-011); el id de correlación se sumó después (DEF-19, #701) | [#590](https://github.com/hllous/Backend-M6-DAPS2/issues/590) |
| DEF-12 | `streetClosureRequested` con el contrato final de cortes de M7 | [#447](https://github.com/hllous/Backend-M6-DAPS2/issues/447) |
| DEF-14 | El job `e2e` corría y pasaba pero no era check obligatorio: un rojo no frenaba el merge. **Corregido el 16/11:** `e2e` y `secrets` son checks obligatorios en `develop`, `test` y `main` de los dos repos (en el Backend, además, `sonar`), verificado con la API de GitHub (`branches/<rama>/protection/required_status_checks`: Backend `build, test, e2e, secrets, sonar`; Frontend `build, test, docs, e2e, secrets`). El archivo de referencia `.github/branch-protection-rules.json` sigue listando solo `build` y `test`: está desactualizado respecto de la configuración real | [#692](https://github.com/hllous/Backend-M6-DAPS2/issues/692) (issue todavía abierto en GitHub) |
| DEF-15 | Timeout de 10 s del cliente al Core contra una referencia de 5 s. **Corregido:** `TIMEOUT_MS` de `src/core/core.client.ts` pasó a 5 s, con un test que lo fija. La mayoría de las llamadas al Core son en segundo plano (registro de suscripciones al arrancar, refresco del catálogo de barrios, ambos sin `await`), pero una sí la espera un usuario: el alta y la edición de cuadrillas y el alta de integrantes (`POST /crews`, `PATCH /crews/:id`, `POST /crews/:id/members`) validan contra M1 (`crews.service.ts` → `m1-identity.client.ts`) y antes piden el token de módulo al Core; sin token en caché (primer pedido tras arrancar o token vencido), un Core caído demoraba esos requests hasta 10 s. Sin circuit breaker, por decisión: el token se cachea y el caso es acotado. El pedido a M1 que sigue al token mantiene sus 10 s a propósito: M1 corre en Render free y sus arranques en frío llegaron a 78 s (ver `integracion/historial.md`, 2/11), así que con 5 s el alta de cuadrillas fallaría cada vez que M1 esté dormido | [#642](https://github.com/hllous/Backend-M6-DAPS2/issues/642) |
| DEF-16 y DEF-17 | `AGENTS.md` y `bloqueantes.md` desactualizados respecto del código | sin issue |
| DEF-19 | Hallazgos de revisión de código en errores y Swagger. **Corregido el 16/11 en [PR #701](https://github.com/hllous/Backend-M6-DAPS2/pull/701)** (issue [#696](https://github.com/hllous/Backend-M6-DAPS2/issues/696)): `/api/docs` tiene una CSP propia compatible con Swagger UI (era la única ruta sin CSP; también la Medium de ZAP), los errores llevan un `traceId` igual al header `X-Request-Id` y al del log, y `path`/`instance` salen sin la query. Lo comprueba `test/security-live.e2e-spec.ts` (CP-378 y CP-380). Lo que sigue abierto (Swagger público en producción y evidencia por URL pública) pasó a **DEF-38** | [#696](https://github.com/hllous/Backend-M6-DAPS2/issues/696), [PR #701](https://github.com/hllous/Backend-M6-DAPS2/pull/701) |
| DEF-18 | Sin `CORS_ORIGINS` la API aceptaba cualquier origen también en producción: ahora la validación de entorno la exige con `NODE_ENV=production` (vacía o solo comas cuenta como ausente), valida en todos los entornos que cada entrada sea un origen exacto (sin path, barra final, `*` ni `null`; `https://` en producción) y el arranque falla nombrando la variable y la entrada | [#642](https://github.com/hllous/Backend-M6-DAPS2/issues/642) |
| DEF-20 | Los `GET` con parámetros devolvían 400 sin declararlo en el OpenAPI | [#586](https://github.com/hllous/Backend-M6-DAPS2/issues/586), [#593](https://github.com/hllous/Backend-M6-DAPS2/issues/593) |
| DEF-21 | `GET /neighborhoods` daba 503 sin M9 en el CI y en el compose | [#594](https://github.com/hllous/Backend-M6-DAPS2/issues/594) |
| DEF-22 | Los logs registraban el `access_token` de la query | [#569](https://github.com/hllous/Backend-M6-DAPS2/issues/569) |
| DEF-23 | El primer `docker compose up` en frío fallaba en `rabbitmq-setup` | [#567](https://github.com/hllous/Backend-M6-DAPS2/issues/567) |
| DEF-24 | e2e intermitente por `e2e_no_active`; cerrado por decisión del equipo, **causa raíz sin confirmar** (si vuelve, se reabre) | [#554](https://github.com/hllous/Backend-M6-DAPS2/issues/554) |
| DEF-25 | ZAP (baseline contra Render) marcó 1 High: DOMPurify 3.1.4 en el `swagger-ui-bundle.js` de `/api/docs`. **Causa raíz:** el bundle viene de `swagger-ui-dist` (vía `@nestjs/swagger`) y `main` seguía con `@nestjs/swagger` 7.4.2 / `swagger-ui-dist` 5.17.14; `npm audit` no ve el JS embebido. **Corregido** en `develop` por #628, [PR #638](https://github.com/hllous/Backend-M6-DAPS2/pull/638) (NestJS 12: `swagger-ui-dist` 5.34.1, DOMPurify 3.4.17 verificada en el bundle instalado); no hizo falta tocar dependencias. **Verificado en producción el 16/11:** con `develop` en `main`, Render sirve DOMPurify 3.4.17 y el baseline final da **0 High** ([run 43788946357](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/43788946357)). Queda un aviso de severidad media de DOMPurify (GHSA-qm7q-q8h9-jg8q) que solo corrige la 3.4.18, hoy en ningún `swagger-ui-dist`. Severidad (Mayor) propuesta | [#668](https://github.com/hllous/Backend-M6-DAPS2/issues/668): [PR #638](https://github.com/hllous/Backend-M6-DAPS2/pull/638) (corrección) y [PR #671](https://github.com/hllous/Backend-M6-DAPS2/pull/671) (registro). Issue cerrado |
| DEF-26 | La imagen Docker traía 6 CVE altas con fix en el `npm` embebido de `node:24-alpine` (brace-expansion 5.0.9 y undici 6.28.0) y la etapa `runner` corría como root (Trivy DS-0002). Causa raíz: el `Dockerfile` heredaba el npm de la base sin actualizarlo y no declaraba `USER`; el escaneo `fs` del lockfile y `npm audit` no los ven. **Corregido en [PR #670](https://github.com/hllous/Backend-M6-DAPS2/pull/670):** `npm install -g npm@11.21.2` (brace-expansion 5.0.12, undici 6.29.1) en las dos etapas y `USER node` en `runner` con los `COPY --chown=node:node`; sin entradas nuevas en `.trivyignore`. **Verificado el 16/11:** Trivy `fs`, `image` y `config` en 0 HIGH/CRITICAL sobre `main`. Severidad (Mayor) propuesta | [#665](https://github.com/hllous/Backend-M6-DAPS2/issues/665), [#666](https://github.com/hllous/Backend-M6-DAPS2/issues/666): [PR #670](https://github.com/hllous/Backend-M6-DAPS2/pull/670). Issues cerrados |
| DEF-27 | Bugs reales de SonarCloud: `.sort()` sin comparador sobre strings (`typescript:S2871` ×4: `idempotency.interceptor.ts`, `inbox.service.ts` y 2 en `scripts/build-datos-ciudad.ts`) y `bootstrap()` sin `.catch` (`S9383`: un fallo de arranque quedaba como promesa rechazada). Causa raíz: el análisis estático no corría en el CI y ESLint no activa esas reglas. **Corregido en [PR #672](https://github.com/hllous/Backend-M6-DAPS2/pull/672):** comparador explícito (mismo orden UTF-16, comportamiento idéntico) y `.catch` que loguea y sale con código 1. El primer análisis de `main` contó 12 bugs y el del PR #662, 5; el líder decidió corregir en código los 5 reales (triaje en #657) y el resto eran falsos positivos o aceptables. Severidad (Menor) propuesta. **Verificado el 16/11:** 0 bugs, confiabilidad A | [#667](https://github.com/hllous/Backend-M6-DAPS2/issues/667): [PR #672](https://github.com/hllous/Backend-M6-DAPS2/pull/672); los `S6698` y `S8689` del mismo issue, en [PR #675](https://github.com/hllous/Backend-M6-DAPS2/pull/675). Issue cerrado |
| DEF-28 | Vulnerabilidades de SonarCloud: el primer análisis de `main` contó 23 (el del PR #662, 22). Ninguna Blocker o Critical real: las 3 Blocker `S6698` eran URLs de ejemplo con `usuario:usuario@localhost` (**G6 nunca estuvo en riesgo**); el resto eran `npm ci` sin `--ignore-scripts` (`S6505`), `npx` sin versión fija (`S8543`), un log de host y base (`S8689`), una entrada sin validar en un script de build (`S8707`) y `git` y `npx` invocados por PATH (`S4036`). **Corregido en código en [PR #675](https://github.com/hllous/Backend-M6-DAPS2/pull/675):** `--ignore-scripts` con `prisma generate` explícito, scripts de `package.json` en lugar de `npx`, URLs de ejemplo sin credenciales, log sin host, validación de la entrada del script y `process.execPath` en lugar de `npx`. La última (`S8707` en `scripts/build-espacios-verdes.ts:160`, script local con argumentos del propio equipo) la **aceptó el líder en SonarCloud** con su usuario. Severidad (Menor) propuesta. **Verificado el 16/11:** 0 vulnerabilidades, seguridad A | [#674](https://github.com/hllous/Backend-M6-DAPS2/issues/674) |

### Hallazgos de proceso (no son defectos del producto)

| ID | Hallazgo | Estado |
|---|---|---|
| P-1 | Secreto de juguete literal en `api-tests.yml` (#572). El job `secrets` (gitleaks) lo detectó en el CI, run [42505473347](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/42505473347); no era una credencial real. Se reescribió la rama antes de mergear y el workflow genera ahora un secreto efímero | Cerrado. Nunca llegó a `develop` |
| P-2 | Dos commits publicados con autor `scratch <scratch@local>` (`5c8c78b` y `a06b33b`, ramas de #583 y #584) por una configuración local mal puesta. Con squash, el autor en `develop` es Benjamin Martinez y `scratch` aparece solo como `Co-authored-by` | **Abierto, sin reescribir.** El alias no corresponde a ningún integrante; pendiente de decisión del equipo |
| P-3 | Test intermitente de `src/openapi-contract.spec.ts` («todo campo con @Min/@Max… declara minimum/maximum»): importa todos los DTO (~2,3 s) y superaba el timeout por defecto de Vitest (5 s) con la suite en paralelo y la máquina cargada; 1 fallo en 6 corridas tras `npm ci`, hallado al medir mutation (#617). **No es DEF-24** (ese es un e2e por `e2e_no_active`) | Cerrado: timeout propio de 30 s en ese test |

## 5. Verificaciones no realizadas (no son defectos)

No omitimos nada conocido: estas pruebas **no se hicieron** y no se presentan como hechas.

| Verificación | Estado | Motivo |
|---|---|---|
| Gate de SonarCloud **bloqueante** | HECHO en el Backend (#700, #660 cerrado); **PENDIENTE** en el Frontend | Backend: `sonar.qualitygate.wait=true` y `sonar` es check obligatorio de `develop`, `test` y `main`. Frontend: el gate bloqueante está en el PR FE #972 (pendiente de merge) y `sonar` no figura entre sus checks obligatorios |
| Job `e2e` obligatorio en la protección de ramas | HECHO (16/11) | En los dos repos; ver DEF-14 |
| OWASP ZAP baseline y activo autenticado | HECHO (#659) | Corrida final sobre `main` el 16/11 ([run 43788946357](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/43788946357)): 0 High en baseline y activo; DEF-25 cerrado. Ver `07`, 5.2 |
| Trivy | HECHO (#658) | 0 HIGH/CRITICAL en `fs`, `image` y `config`; [run de `main`](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/43786978363) |
| Éxito y error por endpoint en la colección Newman | HECHO (#702) | Éxito en 151 de 152 operaciones y error en 149 de 152; las 4 excepciones están justificadas en `test/api/PENDIENTES.md` y `npm run api:coverage` las controla |
| 3 corridas idénticas del CI del frontend con el arreglo de los tests inestables | **PENDIENTE** | Hecho en local (3 corridas, 3229 tests); falta en el CI tras el merge de FE #980 |
| Cobertura del frontend ≥ 90 % con umbral, y mutation del frontend | **PENDIENTE** | En curso al 16/11 (FE #975); ver DEF-35 |
| Mutation score: refuerzo de los 21 archivos restantes | PARCIAL | Global de los 26 archivos de dominio confirmado en el CI: 71,22 % → 75,39 % tras reforzar 5 archivos (cumple el 60 %); quedan 21 sin reforzar. Ver [`05`](05-informe-ejecucion.md) §5.1 |

El escaneo de secretos se hace en cada PR y push con dos jobs: `secrets` (gitleaks con `.gitleaks.toml`) y `secrets-default` (gitleaks con la configuración por defecto respetando `.gitleaksignore`, y trufflehog); ver [`07`](07-informe-seguridad.md) 5.4.
