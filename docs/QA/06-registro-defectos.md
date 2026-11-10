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
| Defectos y brechas registrados | 22 (DEF-01 a DEF-24, sin DEF-04 ni DEF-11). **Abiertos: 7. Cerrados: 15** |
| Issues con etiqueta `bug`, `security` o `fix` | Todos cerrados en GitHub (`gh issue list --state all`) |
| Verificaciones no realizadas (no son defectos) | 8, en la sección 5 |

| Severidad | Abiertos | Dentro del máximo |
|---|---|---|
| Bloqueante | 0 | Sí |
| Crítica | 0 | Sí |
| Mayor | **3** (DEF-08, DEF-09 y DEF-13) | Sí (máximo 3) |
| Menor | 4 (DEF-14, DEF-15, DEF-18 y DEF-19) | Sí |
| **Total abierto** | **7** | |

**Lectura honesta:** el criterio de salida **se cumple en cantidad, sin margen**: hay 3 Mayores abiertas contra un máximo de 3. Falta que cada Mayor tenga un workaround documentado, y DEF-09 dice «ninguno». La severidad de las Mayores es una **propuesta**: el equipo y el PO la validan antes de la entrega.

## 3. Defectos y brechas abiertos

### Críticas

Ninguna abierta.

### Mayores

#### DEF-08 · Dependencias de producción con vulnerabilidades conocidas

| Campo | Detalle |
|---|---|
| ID | sin issue (corrección parcial: [#566](https://github.com/hllous/Backend-M6-DAPS2/issues/566), PR #576) |
| Severidad / prioridad | Mayor (propuesta) / Alta |
| HU | HU-31 |
| Pasos | `npm audit --omit=dev` |
| Esperado | 0 CVE críticas o altas sin mitigación documentada |
| Obtenido | Tras `npm audit fix`: **13 en producción: 0 críticas, 6 altas, 7 moderadas** (antes, 15 con 1 crítica). Altas restantes: `@nestjs/platform-express`, `body-parser`, `multer`, `js-yaml`, `lodash` y `zod`; todas exigen un salto mayor (NestJS 12, zod 4) |
| Evidencia | `npm audit --omit=dev` (detalle en [`07-informe-seguridad.md`](07-informe-seguridad.md), sección 5.1); job `audit` de `.github/workflows/ci.yml` |
| Estado | **Riesgo aceptado y abierto.** Las 6 altas están aceptadas **sin análisis de explotabilidad**; sin Trivy no hay segundo SCA |
| Workaround | El job `audit` corre `npm audit --omit=dev --audit-level=high` y es **informativo** (termina en verde con un `::warning`). Dependabot semanal, sin majors de `@nestjs/*` ni `zod` |

Queda en Mayor hasta confirmar si alguna es explotable en M6; si lo es, pasa a Crítica.

#### DEF-09 · Auditoría de lectura de datos Tier 2 no implementada

| Campo | Detalle |
|---|---|
| ID | sin issue (quedó pendiente al cerrar [#90](https://github.com/hllous/Backend-M6-DAPS2/issues/90)) |
| Severidad / prioridad | Mayor / Media |
| HU | HU-31 (SEC-D02) |
| Pasos | Consultar `GET /environmental-reports/:id` o un acta y buscar la fila de auditoría |
| Esperado | Se registra quién, cuándo y qué recurso leyó, sin copiar el contenido |
| Obtenido | `src/common/audit` registra solo cambios de estado (#460); no hay interceptor de lecturas |
| Evidencia | `docs/decisiones/adr-005-alineacion-frontend-sesion-y-seguridad.md:22` y `:46` lo exigen para producción |
| Estado | Abierto |
| Workaround | Ninguno; la identidad del denunciante solo la ve personal de M6 con rol |

#### DEF-13 · Análisis de seguridad en el CI: parcial, faltan ZAP y Trivy

| Campo | Detalle |
|---|---|
| ID | sin issue |
| Severidad / prioridad | Mayor / Alta |
| HU | HU-31 |
| Pasos | Revisar `.github/workflows/` y `.github/dependabot.yml` |
| Esperado | Escaneo de dependencias, de secretos y análisis dinámico |
| Obtenido | **Hecho:** `npm audit` informativo (job `audit`, #571), Dependabot semanal, CodeQL (`codeql.yml`), gitleaks sobre el historial completo (job `secrets`, #494). **No hecho:** OWASP ZAP y Trivy. No revisamos las alertas de CodeQL (el workflow termina en `success`) |
| Evidencia | `.github/workflows/ci.yml` (jobs `audit` y `secrets`), `.github/workflows/codeql.yml`, `.github/dependabot.yml` |
| Estado | Abierto, **parcial** |

### Menores

| ID | Hallazgo | Evidencia | HU / estado |
|---|---|---|---|
| DEF-14 | El job `e2e` corre en cada PR y pasa, pero no es check obligatorio de la rama: un rojo no frena el merge. Exigirlo pide permisos de admin sobre `hllous/Backend-M6-DAPS2` (NO HECHO) | `.github/branch-protection-rules.json:17-19` (exige solo `build` y `test`) | Transversal · abierto. Esperado: merge bloqueado con un e2e roto; obtenido: habilitado |
| DEF-15 | El timeout del cliente al Core es de 10 s y el valor de referencia es 5 s. No hay circuit breaker ni test que dispare el timeout real | `src/core/core.client.ts:6` y `:150-151` | HU-24 · abierto. Esperado: corte a los 5 s; obtenido: a los 10 s |
| DEF-18 | `CORS_ORIGINS` es opcional: si falta, la API acepta cualquier origen (sin `credentials`). **`CORS_ORIGINS` y `BFF_SHARED_KEY` están cargadas en Render** | `src/main.ts:18-34` | HU-31 · abierto por diseño (variable opcional). Esperado sin `CORS_ORIGINS`: rechazo del `Origin` ajeno; obtenido: se acepta, sin `credentials` |
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
| DEF-10 | Errores sin formato Problem Details RFC 9457 (ADR-011; sin id de correlación en los 500) | [#590](https://github.com/hllous/Backend-M6-DAPS2/issues/590) |
| DEF-12 | `streetClosureRequested` con el contrato final de cortes de M7 | [#447](https://github.com/hllous/Backend-M6-DAPS2/issues/447) |
| DEF-16 y DEF-17 | `AGENTS.md` y `bloqueantes.md` desactualizados respecto del código | sin issue |
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

## 5. Verificaciones no realizadas (no son defectos)

No omitimos nada conocido: estas pruebas **no se hicieron** y no se presentan como hechas.

| Verificación | Estado | Motivo |
|---|---|---|
| Quality Gate de SonarCloud | NO HECHO | Pide un administrador de `hllous`; no hay cuenta ni `sonar-project.properties` |
| Job `e2e` obligatorio en la protección de ramas | NO HECHO | Pide admin. El e2e corre y pasa, pero la regla exige solo `build` y `test` (DEF-14) |
| OWASP ZAP baseline y activo autenticado | NO HECHO | No se corrió |
| Trivy | NO HECHO | No se corrió |
| Éxito por endpoint en los 91 endpoints restantes | NO HECHO | Hay caso de éxito en 61 de 152 operaciones; el resto está en `test/api/PENDIENTES.md` |
| Mutation score global | NO HECHO | Medido solo en `outbound-requests` (84,21 %) |

El escaneo de secretos se hace con gitleaks (en cada PR y push, y sobre el historial del tag).
