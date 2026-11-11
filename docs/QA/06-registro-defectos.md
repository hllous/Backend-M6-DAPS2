# 06 · Registro de defectos y limitaciones conocidas

> Versión 2.0 · 10/11/2026. Backend del Módulo 6 (Grupo 04), sobre `develop` @ `142e1a3`. Lo cargamos desde GitHub Issues, [`docs/bloqueantes.md`](../bloqueantes.md), el código y la auditoría interna. Todo lo marcado como abierto se **verificó contra el código actual**.

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
| Defectos y brechas registrados | 22 (DEF-01 a DEF-24, sin DEF-04 ni DEF-11). **Abiertos: 3. Cerrados: 19** |
| Issues con etiqueta `bug`, `security` o `fix` | Todos cerrados en GitHub (`gh issue list --state all`) |
| Verificaciones no realizadas (no son defectos) | 8, en la sección 5 |

| Severidad | Abiertos | Dentro del máximo |
|---|---|---|
| Bloqueante | 0 | Sí |
| Crítica | 0 | Sí |
| Mayor | **1** (DEF-13) | Sí (máximo 3) |
| Menor | 2 (DEF-14 y DEF-19) | Sí |
| **Total abierto** | **3** | |

**Lectura honesta:** el criterio de salida **se cumple en cantidad**: hay 1 Mayor abierta (DEF-13) contra un máximo de 3 (DEF-08 se cerró por mitigación con #619 y DEF-09 con #643). La severidad de las Mayores es una **propuesta**: el equipo y el PO la validan antes de la entrega.

## 3. Defectos y brechas abiertos

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

#### DEF-13 · Análisis de seguridad en el CI: parcial, faltan ZAP y Trivy

| Campo | Detalle |
|---|---|
| ID | sin issue |
| Severidad / prioridad | Mayor / Alta |
| HU | HU-31 |
| Pasos | Revisar `.github/workflows/` y `.github/dependabot.yml` |
| Esperado | Escaneo de dependencias, de secretos y análisis dinámico |
| Obtenido | **Hecho:** `npm audit` (job `audit`, #571; gate desde #628), Dependabot semanal, CodeQL (`codeql.yml`), gitleaks sobre el historial completo (job `secrets`, #494). **No hecho:** OWASP ZAP y Trivy. No revisamos las alertas de CodeQL (el workflow termina en `success`) |
| Evidencia | `.github/workflows/ci.yml` (jobs `audit` y `secrets`), `.github/workflows/codeql.yml`, `.github/dependabot.yml` |
| Estado | Abierto, **parcial** |

### Menores

| ID | Hallazgo | Evidencia | HU / estado |
|---|---|---|---|
| DEF-14 | El job `e2e` corre en cada PR y pasa, pero no es check obligatorio de la rama: un rojo no frena el merge. Exigirlo pide permisos de admin sobre `hllous/Backend-M6-DAPS2` (NO HECHO) | `.github/branch-protection-rules.json:17-19` (exige solo `build` y `test`) | Transversal · abierto. Esperado: merge bloqueado con un e2e roto; obtenido: habilitado |
| DEF-19 | Swagger UI queda publicado en `/api/docs` también en producción; los 500 no llevan id de correlación y `path` incluye la query (con los parámetros sensibles redactados desde #581); la evidencia se sirve por URL pública del bucket (key UUID aleatoria) y los PDF conservan sus metadatos; `/api/docs` es la única ruta sin CSP | `src/main.ts:41`; `src/common/filters/http-exception.filter.ts:131-141`; `src/modules/attachments/storage/r2-evidence.storage.ts:66` | HU-31 · abierto. Hallazgos de revisión de código, sin reproducción en vivo |

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
| Quality Gate de SonarCloud | NO HECHO | Pide un administrador de `hllous`; no hay cuenta ni `sonar-project.properties` |
| Job `e2e` obligatorio en la protección de ramas | NO HECHO | Pide admin. El e2e corre y pasa, pero la regla exige solo `build` y `test` (DEF-14) |
| OWASP ZAP baseline y activo autenticado | NO HECHO | No se corrió |
| Trivy | NO HECHO | No se corrió |
| Éxito por endpoint en los 91 endpoints restantes | NO HECHO | Hay caso de éxito en 61 de 152 operaciones; el resto está en `test/api/PENDIENTES.md` |
| Mutation score: refuerzo de los 21 archivos restantes y confirmación del global en el CI | PARCIAL | Línea base de los 26 archivos de dominio: 71,22 % (cumple el 60 %); 5 archivos reforzados. Ver [`05`](05-informe-ejecucion.md) §5.1 |

El escaneo de secretos se hace con gitleaks (en cada PR y push, y sobre el historial del tag).
