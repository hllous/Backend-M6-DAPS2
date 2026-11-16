# 06 · Registro de defectos

> Versión 2.2 · 16/11/2026

Los defectos se cargan en GitHub Issues (`hllous/Backend-M6-DAPS2`) y Trello, no en Jira. El identificador es `DEF-nn`; si tiene issue se enlaza, y si no figura como **sin issue**. La numeración no se reutiliza: DEF-04 y DEF-11 se retiraron del registro y esos números quedan vacíos.

## 1. Criterios

| Severidad | Definición | Máximo abierto |
|---|---|---|
| Bloqueante | Impide usar el flujo principal o hace caer el sistema | 0 |
| Crítica | Pérdida o corrupción de datos, falla de seguridad explotable, HU Must incumplida | 0 |
| Mayor | Funcionalidad afectada con alternativa disponible | 3, con workaround documentado |
| Menor | Impacto bajo, visual o de texto | Sin límite, registrados |

La severidad es una propuesta: la deciden el líder y el QA y la valida el PO.

## 2. Resumen

| Severidad | Abiertos | Dentro del máximo |
|---|---|---|
| Bloqueante | 0 | Sí |
| Crítica | 0 | Sí |
| Mayor | 0 | Sí |
| Menor | 7 (DEF-19, DEF-29 a DEF-31, DEF-34, DEF-35 y DEF-37) | Sí |
| **Total abierto** | **7** | |

Registrados: 35 (DEF-01 a DEF-37, sin DEF-04 ni DEF-11). Abiertos: 7. Cerrados: 28 (sección 4).

## 3. Defectos abiertos

### Mayor

Ninguno abierto.

### Menores

| ID | Hallazgo | Evidencia | Issue / workaround |
|---|---|---|---|
| DEF-19 | Swagger UI público en `/api/docs` también en producción; la evidencia se sirve por URL pública del bucket (key UUID aleatoria) y los PDF conservan sus metadatos | `src/swagger-config.ts`; `src/modules/attachments/storage/r2-evidence.storage.ts` | Sin issue. Workaround: la key aleatoria de la evidencia |
| DEF-29 | Frontend: test inestable «resolves linked trees by survey code beyond the first 100…»: falla con `pnpm test` completo y pasa aislado | `src/components/catalog/tree-interventions-panel.test.tsx` | [Frontend #946](https://github.com/hllous/Frontend-M6-DAPS2/issues/946). Re-correr el shard |
| DEF-30 | Frontend: test inestable «filters the zone's list by the existing waste labels…» (`Unable to find … role "option"`) | `src/components/public/green-points.test.tsx` | [Frontend #946](https://github.com/hllous/Frontend-M6-DAPS2/issues/946). Re-correr el shard |
| DEF-31 | Frontend: `retries: isCI ? 1 : 0` en Playwright deja en verde un e2e inestable | `playwright.config.ts:21` | [Frontend #946](https://github.com/hllous/Frontend-M6-DAPS2/issues/946). Revisar la sección *flaky* del reporte |
| DEF-34 | Frontend: `Idempotency-Key` solo se envía en la carga de evidencia; las demás altas no la mandan aunque el backend la acepta en 21 `POST` | `src/app/api/evidence/route.ts`; `src/lib/containers.ts` y `services.ts` (solo evidencia) | Sin issue. Anular el duplicado desde la UI |
| DEF-35 | Frontend: sin mutation testing y sin umbral de cobertura (Sonar: 85,4 %) | `vitest.config.ts:24-27`; `package.json` | [Frontend #975](https://github.com/hllous/Frontend-M6-DAPS2/issues/975). El backend sí tiene ambos |
| DEF-37 | Backend: la DLQ es del Core (M9); M6 hace `nack` sin reencolar y no tiene DLQ propia ni forma de verla o reprocesarla | `src/events/consumers/rabbitmq.consumer.ts` | [#694](https://github.com/hllous/Backend-M6-DAPS2/issues/694). Consultar la DLQ por la API del Core; el inbox registra cada intento fallido |

### Hallazgo de proceso abierto

| ID | Hallazgo |
|---|---|
| P-2 | Dos commits publicados con autor `scratch <scratch@local>` (`5c8c78b` y `a06b33b`, ramas de #583 y #584) por una configuración local mal puesta. Con squash, el autor en `develop` es Benjamin Martinez y `scratch` queda como `Co-authored-by`. Sin reescribir; decisión del equipo |

## 4. Defectos cerrados

| ID | Defecto | Issue |
|---|---|---|
| DEF-01 | Login real con M1 sin probar de punta a punta | [#488](https://github.com/hllous/Backend-M6-DAPS2/issues/488) |
| DEF-02 | Contrato definitivo de M9 sin cerrar | [#257](https://github.com/hllous/Backend-M6-DAPS2/issues/257) |
| DEF-03 | Integración con el Core real sin probar | [#299](https://github.com/hllous/Backend-M6-DAPS2/issues/299), [#442](https://github.com/hllous/Backend-M6-DAPS2/issues/442) |
| DEF-05 | Sin control de concurrencia optimista: `ETag` e `If-Match` con 412 (ADR-012) | [#591](https://github.com/hllous/Backend-M6-DAPS2/issues/591) |
| DEF-06 | Sin `Idempotency-Key` en las altas: ahora en 21 `POST` (ADR-013) | [#592](https://github.com/hllous/Backend-M6-DAPS2/issues/592) |
| DEF-07 | Rate limiting solo en el portal ciudadano: ahora global (ADR-010) | [#568](https://github.com/hllous/Backend-M6-DAPS2/issues/568) |
| DEF-08 | Dependencias de producción con CVE: `npm audit --omit=dev` da 0 con NestJS 12 | [#566](https://github.com/hllous/Backend-M6-DAPS2/issues/566), [#619](https://github.com/hllous/Backend-M6-DAPS2/issues/619), [#628](https://github.com/hllous/Backend-M6-DAPS2/issues/628) |
| DEF-09 | Sin auditoría de lectura de datos Tier 2: `AuditService.recordRead` en tres `GET` | [#643](https://github.com/hllous/Backend-M6-DAPS2/issues/643) |
| DEF-10 | Errores sin formato Problem Details RFC 9457 (ADR-011) | [#590](https://github.com/hllous/Backend-M6-DAPS2/issues/590) |
| DEF-12 | `streetClosureRequested` con el contrato final de cortes de M7 | [#447](https://github.com/hllous/Backend-M6-DAPS2/issues/447) |
| DEF-13 | Faltaban SonarCloud, Trivy y ZAP en el CI: integrados y con 0 hallazgos HIGH/CRITICAL | [#656](https://github.com/hllous/Backend-M6-DAPS2/issues/656), [#657](https://github.com/hllous/Backend-M6-DAPS2/issues/657), [#658](https://github.com/hllous/Backend-M6-DAPS2/issues/658), [#659](https://github.com/hllous/Backend-M6-DAPS2/issues/659), [#660](https://github.com/hllous/Backend-M6-DAPS2/issues/660) |
| DEF-14 | El job `e2e` pasaba pero no era check obligatorio: ahora lo son `e2e`, `sonar` y `secrets` en la protección de ramas | [#692](https://github.com/hllous/Backend-M6-DAPS2/issues/692) |
| DEF-15 | Timeout de 10 s del cliente al Core contra una referencia de 5 s: ahora 5 s | [#642](https://github.com/hllous/Backend-M6-DAPS2/issues/642) |
| DEF-16, DEF-17 | `AGENTS.md` y `bloqueantes.md` desactualizados respecto del código | sin issue |
| DEF-18 | Sin `CORS_ORIGINS` la API aceptaba cualquier origen en producción: ahora el arranque falla | [#642](https://github.com/hllous/Backend-M6-DAPS2/issues/642) |
| DEF-20 | Los `GET` con parámetros devolvían 400 sin declararlo en el OpenAPI | [#586](https://github.com/hllous/Backend-M6-DAPS2/issues/586), [#593](https://github.com/hllous/Backend-M6-DAPS2/issues/593) |
| DEF-21 | `GET /neighborhoods` daba 503 sin M9 en el CI y en el compose | [#594](https://github.com/hllous/Backend-M6-DAPS2/issues/594) |
| DEF-22 | Los logs registraban el `access_token` de la query | [#569](https://github.com/hllous/Backend-M6-DAPS2/issues/569) |
| DEF-23 | El primer `docker compose up` en frío fallaba en `rabbitmq-setup` | [#567](https://github.com/hllous/Backend-M6-DAPS2/issues/567) |
| DEF-24 | e2e intermitente por `e2e_no_active`; cerrado por decisión del equipo | [#554](https://github.com/hllous/Backend-M6-DAPS2/issues/554) |
| DEF-25 | DOMPurify 3.1.4 en el Swagger UI (High de ZAP): `swagger-ui-dist` actualizado con NestJS 12 | [#668](https://github.com/hllous/Backend-M6-DAPS2/issues/668) |
| DEF-26 | Imagen Docker con 6 CVE altas del `npm` embebido y contenedor como root | [#665](https://github.com/hllous/Backend-M6-DAPS2/issues/665), [#666](https://github.com/hllous/Backend-M6-DAPS2/issues/666) |
| DEF-27 | Bugs de SonarCloud: `.sort()` sin comparador y `bootstrap()` sin `.catch` | [#667](https://github.com/hllous/Backend-M6-DAPS2/issues/667) |
| DEF-28 | Vulnerabilidades de SonarCloud (`npm ci` sin `--ignore-scripts`, `npx` sin versión, URLs de ejemplo con credenciales) | [#674](https://github.com/hllous/Backend-M6-DAPS2/issues/674) |
| DEF-32 | El frontend no enviaba `If-Match` ni manejaba el 412: el BFF propaga `ETag` e `If-Match` y la interfaz avisa que el registro cambió | [Frontend #973](https://github.com/hllous/Frontend-M6-DAPS2/issues/973) |
| DEF-33 | El timeout del BFF al backend era de 15 s: ahora 5 s con aborto real | [Frontend #974](https://github.com/hllous/Frontend-M6-DAPS2/issues/974) |
| DEF-36 | El pedido a M1 esperaba hasta 10 s con M1 caído: ahora 4 s (`M1_TIMEOUT_MS`), menos que el corte del BFF, y el 503 llega a tiempo | [#693](https://github.com/hllous/Backend-M6-DAPS2/issues/693), [#713](https://github.com/hllous/Backend-M6-DAPS2/issues/713) |
| P-1 | Secreto de juguete literal en `api-tests.yml`, detectado por gitleaks; nunca llegó a `develop` | sin issue |
| P-3 | Test intermitente de `openapi-contract.spec.ts` por el timeout de 5 s de Vitest; timeout propio de 30 s | sin issue |
