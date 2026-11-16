# 06 · Registro de defectos y limitaciones conocidas

> Versión 2.2 · 16/11/2026. Backend del Módulo 6 (Grupo 04). Los defectos de las secciones 3 y 4 salen de la medición del 10/11 (`develop` @ `142e1a3`); DEF-13 y DEF-25 a DEF-28 se cerraron con la Entrega 4 y se verificaron sobre `main` @ `78bf714` (16/11); el cierre de DEF-25 a DEF-28 se re-verificó en el código de `main` @ `72908cf` (#688). DEF-29 a DEF-37 (frontend y límites de resiliencia) se verificaron el 16/11 contra `main` de cada repo (Backend `72908cf`, Frontend `82f946a`). Lo cargamos desde GitHub Issues, [`docs/bloqueantes.md`](../bloqueantes.md), el código y la auditoría interna. Todo lo marcado como abierto se **verificó contra el código actual**.

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
| Defectos y brechas registrados | 35 (DEF-01 a DEF-37, sin DEF-04 ni DEF-11). **Abiertos: 11. Cerrados: 24** |
| Issues abiertos con etiqueta `bug` (16/11) | Backend: [#665](https://github.com/hllous/Backend-M6-DAPS2/issues/665), [#666](https://github.com/hllous/Backend-M6-DAPS2/issues/666), [#667](https://github.com/hllous/Backend-M6-DAPS2/issues/667) y [#668](https://github.com/hllous/Backend-M6-DAPS2/issues/668), **corregidos en código** (DEF-25 a DEF-28) pero sin cerrar en GitHub: sus PR se mergearon a `develop`, donde `Closes #N` no cierra el issue. Frontend: [#946](https://github.com/hllous/Frontend-M6-DAPS2/issues/946) (DEF-30) |
| Verificaciones no realizadas o parciales (no son defectos) | 4, en la sección 5 |

| Severidad | Abiertos | Dentro del máximo |
|---|---|---|
| Bloqueante | 0 | Sí |
| Crítica | 0 | Sí |
| Mayor | **1** (DEF-32; DEF-13 se cerró con #656) | Sí (máximo 3, con workaround) |
| Menor | 10 (DEF-14, DEF-19, DEF-29 a DEF-31 y DEF-33 a DEF-37) | Sí |
| **Total abierto** | **11** | |

**Lectura honesta:** el criterio de salida **se cumple**: 0 Bloqueantes, 0 Críticos y 1 Mayor abierto con workaround (DEF-32, el frontend no usa `If-Match`), dentro del máximo de 3 (DEF-08 se cerró por mitigación con #619 y #628, DEF-09 con #643 y DEF-13 con #656). Quedan 10 Menores: DEF-14 (e2e no obligatorio, pide admin), DEF-19 (Swagger UI público y sin CSP), dos tests inestables del frontend y el `retries` que los oculta (DEF-29 a DEF-31; la cátedra pide 0 flaky) y brechas de resiliencia y de calidad (DEF-33 a DEF-37). Las severidades son una **propuesta** (por ejemplo, DEF-25 y DEF-26 como Mayor): las deciden el líder y el QA y las valida el PO. **Pendiente declarado:** el gate de SonarCloud todavía no es bloqueante ([#660](https://github.com/hllous/Backend-M6-DAPS2/issues/660)); no es un defecto del producto, es la fase 2 de la Opción C de [ADR-017](../decisiones/adr-017-herramientas-analisis-estatico-y-seguridad.md).

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
| Estado | **Cerrado (16/11/2026).** Los hallazgos reales de las tres herramientas se corrigieron y se registraron como DEF-25 a DEF-28. Quedan declarados: el gate de Sonar no bloqueante (#660) y las Medium de ZAP, justificadas una por una en `07`, 5.2. No revisamos las alertas de CodeQL (el workflow termina en `success`) |

#### DEF-32 · El frontend no envía `If-Match` ni maneja el 412 (abierto)

| Campo | Detalle |
|---|---|
| ID | sin issue (el contrato se avisó en [Frontend #898](https://github.com/hllous/Frontend-M6-DAPS2/issues/898), cerrado sin adoptar `If-Match`) |
| Severidad / prioridad | Mayor (propuesta) / Media |
| HU | Las de edición (`PATCH` de servicios, contenedores, cuadrillas y demás); riesgo R21 del plan |
| Pasos | 1. Abrir el mismo recurso en dos sesiones del frontend. 2. Editar y guardar en la primera. 3. Editar otro campo y guardar en la segunda |
| Esperado | La segunda escritura manda `If-Match` con el `ETag` leído, recibe 412 y la UI avisa que el recurso cambió y pide recargar (ADR-012) |
| Obtenido | La segunda escritura se acepta sin control y pisa la primera (gana el último en escribir). El backend soporta `ETag`/`If-Match` (DEF-05, #591), pero es opcional y el frontend no lo usa: `grep -rn "If-Match" src` en `Frontend-M6-DAPS2` no da resultados y ningún código de producción trata el 412 |
| Causa raíz | El backend sumó la concurrencia optimista como opcional para no romper al cliente; la adopción en el frontend quedó fuera de #898 |
| Evidencia | Lectura de código, sin reproducción en vivo: `Frontend-M6-DAPS2/src` sin `If-Match`; ADR-012 |
| Estado | **Abierto** |
| Workaround | Recargar el recurso antes de editar y no editar el mismo recurso en dos sesiones a la vez (en la operación cada cuadrilla o supervisor edita lo suyo). Cualquier cliente que necesite la protección puede mandar `If-Match` y el backend responde 412. Los cambios de estado los siguen validando las máquinas de estado del backend |

### Menores

| ID | Hallazgo | Evidencia | HU / estado |
|---|---|---|---|
| DEF-14 | El job `e2e` corre en cada PR y pasa, pero no es check obligatorio de la rama: un rojo no frena el merge. Exigirlo pide permisos de admin sobre `hllous/Backend-M6-DAPS2` (NO HECHO) | `.github/branch-protection-rules.json:17-19` (exige solo `build` y `test`) | Transversal · abierto. Esperado: merge bloqueado con un e2e roto; obtenido: habilitado |
| DEF-19 | Swagger UI queda publicado en `/api/docs` también en producción; los 500 no llevan id de correlación y `path` incluye la query (con los parámetros sensibles redactados desde #581); la evidencia se sirve por URL pública del bucket (key UUID aleatoria) y los PDF conservan sus metadatos; `/api/docs` es la única ruta sin CSP | `src/main.ts:41`; `src/common/filters/http-exception.filter.ts:131-141`; `src/modules/attachments/storage/r2-evidence.storage.ts:66` | HU-31 · abierto. Hallazgos de revisión de código, sin reproducción en vivo |
| DEF-29 | **Frontend, test inestable** (sin issue): «resolves linked trees by survey code beyond the first 100…» falla en la corrida completa de `pnpm test` y pasa aislado. Pasos: `pnpm test` (suite entera) y después `pnpm exec vitest run src/components/catalog/tree-interventions-panel.test.tsx`. Esperado: pasa siempre; obtenido: falla solo con la suite completa. Aislado pasa (36/36, 16/11). Causa raíz sin identificar (probable dependencia de tiempo o de carga de la máquina) | `Frontend-M6-DAPS2/src/components/catalog/tree-interventions-panel.test.tsx:44` | Transversal · abierto. No afecta al producto; la cátedra pide 0 flaky. Workaround: re-correr el shard |
| DEF-30 | **Frontend, test inestable** ([Frontend #946](https://github.com/hllous/Frontend-M6-DAPS2/issues/946), `bug`): «filters the zone's list by the existing waste labels…» falló en el CI con `Unable to find … role "option" and name "Domiciliarios"` (run 43774705340, shard 3/4) y pasó en el run 43774729178 con el mismo código. Esperado: pasa siempre; obtenido: intermitente. Causa probable: carrera entre abrir el select y montar las opciones | `Frontend-M6-DAPS2/src/components/public/green-points.test.tsx`; Frontend #946 | Transversal · abierto. Workaround: re-correr el shard |
| DEF-31 | **Frontend:** `retries: isCI ? 1 : 0` en Playwright reintenta en el CI todo e2e que falla: un e2e inestable queda en verde y la inestabilidad no se ve en el resultado del job (solo en el reporte, como *flaky*). Esperado: 0 reintentos, o los *flaky* tratados como fallo; obtenido: ocultos | `Frontend-M6-DAPS2/playwright.config.ts:21` | Transversal · abierto. Workaround: revisar la sección *flaky* del reporte de Playwright en cada corrida |
| DEF-33 | **Frontend:** el timeout del BFF al backend es de 15 s (`DEFAULT_BACKEND_TIMEOUT_MS = 15_000`) contra la referencia de 5 s. El fallback existe: al vencer responde 503 con mensaje (`BackendUnavailableError`), pero el usuario espera hasta 15 s | `Frontend-M6-DAPS2/src/lib/bff-backend.ts:18`, `:117`, `:151` | Transversal · abierto. Workaround: despertar Render (`/health`) antes de la demo (riesgo R7) |
| DEF-34 | **Frontend:** `Idempotency-Key` solo se envía en la carga de evidencia (la exige `src/app/api/evidence/route.ts:129-133`); las demás altas no la mandan aunque el backend la acepta en 21 `POST` (DEF-06). Un reintento o doble envío de otra alta puede crear un duplicado. No se verificó si cada formulario deshabilita el botón mientras envía | `grep -rln "Idempotency-Key" src` en `Frontend-M6-DAPS2` (solo evidencia y sus tests) | Transversal · abierto. Workaround: dar de baja o anular el duplicado desde la UI |
| DEF-35 | **Frontend:** sin mutation testing (no hay Stryker ni script `mutation` en `package.json`) y sin umbral de cobertura: Vitest la mide (SonarCloud: 85,4 %) pero no exige mínimo (#923) | `Frontend-M6-DAPS2/vitest.config.ts:24-27`; `package.json` | Transversal · abierto. Brecha de calidad, no de producto. Workaround: el backend sí tiene mutation (75,39 %) y umbral de 85 % |
| DEF-36 | **Backend:** el pedido a M1 tiene timeout de 10 s y no hay circuit breaker: con M1 caído, cada alta o edición de cuadrilla espera hasta 10 s antes de fallar. Decisión documentada en DEF-15 (#642): M1 corre en Render free con arranques en frío de hasta 78 s | `src/identity/m1-identity.client.ts:13`, `:101` | HU de cuadrillas · abierto (riesgo aceptado). Workaround: reintentar cuando M1 responda; despertar M1 antes de la demo |
| DEF-37 | **Backend:** la DLQ está delegada al Core (M9). M6 hace `nack` sin reencolar, el Core reintenta con su backoff y después manda el mensaje a su DLQ; M6 no tiene DLQ propia | `src/events/consumers/rabbitmq.consumer.ts:133-139`, `:148-156` | Transversal · abierto (decisión de arquitectura, ADR-006 y `docs/integracion/m9.md`). Workaround: consultar la DLQ por la API del Core; el inbox registra cada intento fallido |

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
| DEF-10 | Errores sin formato Problem Details RFC 9457 (ADR-011; sin id de correlación en los 500) | [#590](https://github.com/hllous/Backend-M6-DAPS2/issues/590) |
| DEF-12 | `streetClosureRequested` con el contrato final de cortes de M7 | [#447](https://github.com/hllous/Backend-M6-DAPS2/issues/447) |
| DEF-15 | Timeout de 10 s del cliente al Core contra una referencia de 5 s. **Corregido:** `TIMEOUT_MS` de `src/core/core.client.ts` pasó a 5 s, con un test que lo fija. La mayoría de las llamadas al Core son en segundo plano (registro de suscripciones al arrancar, refresco del catálogo de barrios, ambos sin `await`), pero una sí la espera un usuario: el alta y la edición de cuadrillas y el alta de integrantes (`POST /crews`, `PATCH /crews/:id`, `POST /crews/:id/members`) validan contra M1 (`crews.service.ts` → `m1-identity.client.ts`) y antes piden el token de módulo al Core; sin token en caché (primer pedido tras arrancar o token vencido), un Core caído demoraba esos requests hasta 10 s. Sin circuit breaker, por decisión: el token se cachea y el caso es acotado. El pedido a M1 que sigue al token mantiene sus 10 s a propósito: M1 corre en Render free y sus arranques en frío llegaron a 78 s (ver `integracion/historial.md`, 2/11), así que con 5 s el alta de cuadrillas fallaría cada vez que M1 esté dormido | [#642](https://github.com/hllous/Backend-M6-DAPS2/issues/642) |
| DEF-16 y DEF-17 | `AGENTS.md` y `bloqueantes.md` desactualizados respecto del código | sin issue |
| DEF-18 | Sin `CORS_ORIGINS` la API aceptaba cualquier origen también en producción: ahora la validación de entorno la exige con `NODE_ENV=production` (vacía o solo comas cuenta como ausente), valida en todos los entornos que cada entrada sea un origen exacto (sin path, barra final, `*` ni `null`; `https://` en producción) y el arranque falla nombrando la variable y la entrada | [#642](https://github.com/hllous/Backend-M6-DAPS2/issues/642) |
| DEF-20 | Los `GET` con parámetros devolvían 400 sin declararlo en el OpenAPI | [#586](https://github.com/hllous/Backend-M6-DAPS2/issues/586), [#593](https://github.com/hllous/Backend-M6-DAPS2/issues/593) |
| DEF-21 | `GET /neighborhoods` daba 503 sin M9 en el CI y en el compose | [#594](https://github.com/hllous/Backend-M6-DAPS2/issues/594) |
| DEF-22 | Los logs registraban el `access_token` de la query | [#569](https://github.com/hllous/Backend-M6-DAPS2/issues/569) |
| DEF-23 | El primer `docker compose up` en frío fallaba en `rabbitmq-setup` | [#567](https://github.com/hllous/Backend-M6-DAPS2/issues/567) |
| DEF-24 | e2e intermitente por `e2e_no_active`; cerrado por decisión del equipo, **causa raíz sin confirmar** (si vuelve, se reabre) | [#554](https://github.com/hllous/Backend-M6-DAPS2/issues/554) |
| DEF-25 | ZAP (baseline contra Render) marcó 1 High: DOMPurify 3.1.4 en el `swagger-ui-bundle.js` de `/api/docs`. **Causa raíz:** el bundle viene de `swagger-ui-dist` (vía `@nestjs/swagger`) y `main` seguía con `@nestjs/swagger` 7.4.2 / `swagger-ui-dist` 5.17.14; `npm audit` no ve el JS embebido. **Corregido** en `develop` por #628, [PR #638](https://github.com/hllous/Backend-M6-DAPS2/pull/638) (NestJS 12: `swagger-ui-dist` 5.34.1, DOMPurify 3.4.17 verificada en el bundle instalado); no hizo falta tocar dependencias. **Verificado en producción el 16/11:** con `develop` en `main`, Render sirve DOMPurify 3.4.17 y el baseline final da **0 High** ([run 43788946357](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/43788946357)). Queda un aviso de severidad media de DOMPurify (GHSA-qm7q-q8h9-jg8q) que solo corrige la 3.4.18, hoy en ningún `swagger-ui-dist`. Severidad (Mayor) propuesta | [#668](https://github.com/hllous/Backend-M6-DAPS2/issues/668): [PR #638](https://github.com/hllous/Backend-M6-DAPS2/pull/638) (corrección) y [PR #671](https://github.com/hllous/Backend-M6-DAPS2/pull/671) (registro). Issue todavía abierto en GitHub |
| DEF-26 | La imagen Docker traía 6 CVE altas con fix en el `npm` embebido de `node:24-alpine` (brace-expansion 5.0.9 y undici 6.28.0) y la etapa `runner` corría como root (Trivy DS-0002). Causa raíz: el `Dockerfile` heredaba el npm de la base sin actualizarlo y no declaraba `USER`; el escaneo `fs` del lockfile y `npm audit` no los ven. **Corregido en [PR #670](https://github.com/hllous/Backend-M6-DAPS2/pull/670):** `npm install -g npm@11.21.2` (brace-expansion 5.0.12, undici 6.29.1) en las dos etapas y `USER node` en `runner` con los `COPY --chown=node:node`; sin entradas nuevas en `.trivyignore`. **Verificado el 16/11:** Trivy `fs`, `image` y `config` en 0 HIGH/CRITICAL sobre `main`. Severidad (Mayor) propuesta | [#665](https://github.com/hllous/Backend-M6-DAPS2/issues/665), [#666](https://github.com/hllous/Backend-M6-DAPS2/issues/666): [PR #670](https://github.com/hllous/Backend-M6-DAPS2/pull/670). Issues todavía abiertos en GitHub |
| DEF-27 | Bugs reales de SonarCloud: `.sort()` sin comparador sobre strings (`typescript:S2871` ×4: `idempotency.interceptor.ts`, `inbox.service.ts` y 2 en `scripts/build-datos-ciudad.ts`) y `bootstrap()` sin `.catch` (`S9383`: un fallo de arranque quedaba como promesa rechazada). Causa raíz: el análisis estático no corría en el CI y ESLint no activa esas reglas. **Corregido en [PR #672](https://github.com/hllous/Backend-M6-DAPS2/pull/672):** comparador explícito (mismo orden UTF-16, comportamiento idéntico) y `.catch` que loguea y sale con código 1. El primer análisis de `main` contó 12 bugs y el del PR #662, 5; el líder decidió corregir en código los 5 reales (triaje en #657) y el resto eran falsos positivos o aceptables. Severidad (Menor) propuesta. **Verificado el 16/11:** 0 bugs, confiabilidad A | [#667](https://github.com/hllous/Backend-M6-DAPS2/issues/667): [PR #672](https://github.com/hllous/Backend-M6-DAPS2/pull/672); los `S6698` y `S8689` del mismo issue, en [PR #675](https://github.com/hllous/Backend-M6-DAPS2/pull/675). Issue todavía abierto en GitHub |
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
| Gate de SonarCloud **bloqueante** | NO HECHO (análisis y gate HECHOS, #657) | Gate OK y ratings A/A/A sobre `main` el 16/11. Pasar a bloqueante y requerido en los PR a `develop` queda en [#660](https://github.com/hllous/Backend-M6-DAPS2/issues/660) (Opción C, paso 2). Ver `05`, 5.2 |
| Job `e2e` obligatorio en la protección de ramas | NO HECHO | Pide admin. El e2e corre y pasa, pero la regla exige solo `build` y `test` (DEF-14) |
| OWASP ZAP baseline y activo autenticado | HECHO (#659) | Corrida final sobre `main` el 16/11 ([run 43788946357](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/43788946357)): 0 High en baseline y activo; DEF-25 cerrado. Ver `07`, 5.2 |
| Trivy | HECHO (#658) | 0 HIGH/CRITICAL en `fs`, `image` y `config`; [run de `main`](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/43786978363) |
| Éxito por endpoint en los 91 endpoints restantes | NO HECHO | Hay caso de éxito en 61 de 152 operaciones; el resto está en `test/api/PENDIENTES.md` |
| Mutation score: refuerzo de los 21 archivos restantes | PARCIAL | Global de los 26 archivos de dominio confirmado en el CI: 71,22 % → 75,39 % tras reforzar 5 archivos (cumple el 60 %); quedan 21 sin reforzar. Ver [`05`](05-informe-ejecucion.md) §5.1 |

El escaneo de secretos se hace con gitleaks (en cada PR y push, y sobre el historial del tag).
