# ADR-017: Herramientas de análisis estático y de seguridad

## Metadata

- **Status:** Accepted
- **Date:** 2026-11-15
- **Deciders:** líder del repositorio y QA (Grupo 04); severidades validadas por el PO
- **Owner:** Nicolas Facundo Llousas (líder del repositorio)
- **Related Issues:** [#656](https://github.com/hllous/Backend-M6-DAPS2/issues/656) (spec), [#657](https://github.com/hllous/Backend-M6-DAPS2/issues/657) (SonarCloud), [#658](https://github.com/hllous/Backend-M6-DAPS2/issues/658) (Trivy), [#659](https://github.com/hllous/Backend-M6-DAPS2/issues/659) (ZAP), [#660](https://github.com/hllous/Backend-M6-DAPS2/issues/660) (gate bloqueante, pendiente), [#661](https://github.com/hllous/Backend-M6-DAPS2/issues/661) (documentación)
- **Related ADRs:** [ADR-010](adr-010-rate-limit-global.md), [ADR-015](adr-015-patron-outbox-inbox.md)

> Las decisiones de esta página se acordaron con el líder del repositorio el 15/11/2026 (spec #656) y se confirmaron con las corridas finales del 16/11/2026.

---

## 1. Context and Problem Statement

### Context

Los *Criterios de Testing y Aseguramiento de Calidad* (Clase 15) piden, para la Entrega 4: Quality Gate aprobado en SonarQube o SonarCloud (0 bugs Blocker/Critical, 0 vulnerabilidades, duplicación ≤ 3 %, ratings A en confiabilidad y seguridad, 100 % de hotspots revisados), OWASP ZAP baseline y activo autenticado con 0 alertas High y cada Medium justificada, y dependencias sin CVE crítica o alta sin mitigación documentada. Además, G3 (CI en verde sobre el tag) y G9 (ningún defecto conocido omitido) son eliminatorios.

El CI ya tenía `build`, `test`, `e2e`, `audit` (`npm audit`, frena el deploy), `secrets` (gitleaks), CodeQL, mutation y `api-tests`. El deploy a Render se dispara en push a `main`. Faltaban SonarCloud, Trivy y ZAP, y el informe los declaraba **NO HECHOS** (DEF-13).

### Problem

Cómo sumar tres herramientas sin tumbar G3, sin atacar producción, sin duplicar el tiempo del pipeline (límite de 15 min) y con números que coincidan con los del informe (G9).

---

## 2. Decision Drivers

- Cumplir el Eje B (Quality Gate) y el Eje D (ZAP, dependencias) de la cátedra con evidencia en vivo.
- G3 y G9 son eliminatorios: un gate rojo sobre el tag y un número que contradiga al informe cuestan lo mismo.
- No escribir datos, ni chocar con el límite de 600 req/min ([ADR-010](adr-010-rate-limit-global.md)), ni publicar al bus del Core ([ADR-015](adr-015-patron-outbox-inbox.md)) en producción.
- Pipeline total ≤ 15 min.
- Repo público: SonarCloud es gratis.
- Todo hallazgo se corrige o se declara; nada se esconde.

---

## 3. Considered Options

### Option A: SonarCloud con Automatic Analysis

**Pros:**
- Sin configuración en el CI.

**Cons:**
- No importa la cobertura (daría 0 %), no respeta las exclusiones y no es un check del pipeline.

### Option B: SonarCloud desde el CI, gate bloqueante desde el primer día

**Pros:**
- Frena código malo desde el primer PR.

**Cons:**
- El primer análisis era desconocido (12 bugs y 23 vulnerabilidades al medirlo): un gate rojo sobre el tag tumbaría G3.

### Option C: SonarCloud desde el CI, gate no bloqueante hasta el primer verde y bloqueante después

**Pros:**
- Cubre la transición sin perder el objetivo de frenar código malo antes del merge.

**Cons:**
- Hay una ventana sin bloqueo; el paso 2 queda pendiente (#660).

### Option D: ZAP activo contra producción (Render)

**Pros:**
- Prueba el entorno exacto que ve la cátedra.

**Cons:**
- Escribe datos, choca con el rate limit y publica al bus del Core.

### Option E: ZAP baseline contra Render y activo autenticado contra un entorno efímero

**Pros:**
- Headers reales de producción, y un activo que llega a las escrituras sin tocar nada compartido.

**Cons:**
- El entorno efímero no es idéntico a producción (`NODE_ENV=development`, `THROTTLE_LIMIT` alto): algún hallazgo es artefacto del entorno.

### Option F: Solo `npm audit` como SCA

**Pros:**
- Ya existe.

**Cons:**
- No ve el sistema operativo de la imagen, ni el `npm` embebido, ni la configuración del `Dockerfile`; un único SCA no es una segunda opinión.

### Option G: Trivy (`fs`, `image` y `config`) además de `npm audit`

**Pros:**
- Lockfile y secretos, imagen construida y configuración en una sola herramienta, con SARIF a Code Scanning.

**Cons:**
- Sobre la imagen puede reportar CVE sin fix del sistema base; se documentan, no se ignoran.

---

## 4. Decision Outcome

**Chosen Option:** C + E + G, con el protocolo de hallazgos de abajo.

### Rationale

**SonarCloud desde el CI (job `sonar`).** El análisis corre en un job que depende de `test`; `test` publica el `lcov` de Vitest como artifact y `sonar` lo descarga, así no se vuelven a correr los tests. Se saltea si no hay `SONAR_TOKEN` (PR desde un fork). Corre en los PR y en el push a `main`, porque el plan gratuito solo analiza la rama principal y los PR. Configuración en `sonar-project.properties`; el alta (organización `hllous`, proyecto, secret) la hizo el líder.

**Opción C del gate.** Paso 1: `sonar.qualitygate.wait=false` y el job no es check requerido. Paso 2: cuando el gate esté verde, `wait=true` y check requerido en los PR a `develop` (#660, **pendiente**). Un gate rojo sobre el tag tumbaría G3, y la fase no bloqueante cubre solo la transición. Gate "Sonar way", que evalúa **código nuevo**; por eso el informe de ejecución reporta aparte las métricas del código total contra el criterio de la cátedra.

**Exclusiones alineadas con Vitest.** Las exclusiones de cobertura de Sonar son las de `coverage.exclude` de `vitest.config.ts`, más el complemento de `coverage.include` (lo que Vitest no mide: seed, scripts, e2e, workflows). Así el número de Sonar es comparable con el del informe: **las mismas líneas sin cubrir en las dos herramientas**. De duplicación se excluyen las migraciones de Prisma y los DTO (repetitivos por diseño) y los specs (arrange/act/assert parecidos); no se excluye nada del análisis de bugs y vulnerabilidades: `src`, `test`, `scripts`, workflows y `Dockerfile` cuentan.

**Corregir en código antes que marcar falsos positivos.** Se llegó a ratings A corrigiendo (#672, #675) y no marcando. Lo que queda como falso positivo lo marca una persona con justificación (criterio 8.1: un «cumple» dictaminado por IA no vale).

**Trivy, tres pasadas** (job `trivy`): `fs` (lockfile y secretos), `image` (la imagen construida desde el `Dockerfile`) y `config` (`Dockerfile` y compose). Cada una sube su SARIF a Code Scanning y después corre un gate que **falla con HIGH/CRITICAL con fix**. Las HIGH/CRITICAL **sin fix** no frenan, pero aparecen en el reporte y van a `.trivyignore` con justificación y mitigación, y a la tabla del informe de seguridad: la cátedra pide «sin mitigación documentada», no «ignoradas». El job **frena el deploy** (`deploy` depende de él), **no el merge**, igual que `audit`.

**ZAP activo fuera de producción, con token de prueba.** Workflow `dast.yml`, a demanda y los lunes, sin engancharse al deploy (que es asíncrono). Job 1: baseline pasivo contra Render. Job 2: API scan activo contra el `docker compose` levantado en el job (base y broker descartables, seed de demo) con el OpenAPI versionado, para recorrer las 152 operaciones. El token es de rol admin, firmado con `test/api/make-token.mjs` y un `JWT_SECRET` de prueba, e inyectado como `Authorization` con `ZAP_AUTH_HEADER_VALUE`; no depende de M1 y no es una credencial real. Un proxy de registro (`.github/dast/proxy.mjs`) cuenta los pedidos por código y es la prueba de que ZAP llegó autenticado (cero 401). El único cambio del entorno efímero es `THROTTLE_LIMIT` alto; la configuración de producción no cambia. **Ninguna regla se ignora de antemano**; una Medium o una alerta ignorada lleva su justificación escrita en el informe de seguridad.

**Protocolo de hallazgos** (vale para las tres herramientas):

1. **Triaje:** real o falso positivo. El falso positivo se marca con justificación escrita y lo revisa un humano.
2. **Severidad** según la sección 9 de los criterios: la propone el agente, la deciden el líder y QA, la valida el PO.
3. **Bloqueante o Crítico:** issue y PR `fix/` aparte, y `DEF-xx` con causa raíz. Corte: lunes 16/11 a las 20:00; lo no corregido se mitiga hasta que no sea explotable y se declara. Ningún Crítico queda abierto.
4. **Mayor:** se registra con workaround (máximo 3).
5. **Secreto:** se rota primero; reescribir el historial pide OK explícito del líder.
6. **Nada se esconde** (G9).

---

## 5. Consequences

### Positive Consequences

- Los ratings de Sonar pasaron de D/E a A/A/A; Trivy da 0 HIGH/CRITICAL en las tres pasadas; ZAP da 0 High en baseline y activo ([`docs/QA/05`](../QA/05-informe-ejecucion.md), [`07`](../QA/07-informe-seguridad.md)).
- Se encontraron y corrigieron defectos que `npm audit` y los tests no veían: 6 CVE HIGH en el `npm` embebido de la imagen y contenedor como root (DEF-26), DOMPurify del Swagger UI (DEF-25), 12 bugs y 23 vulnerabilidades de Sonar.
- El gate ya frenó código nuevo: el proxy de ZAP tenía 2 Blocker y no entró hasta corregirse.
- Pipeline total de `main` ≈ 3 min, muy por debajo de los 15.

### Negative Consequences

- El gate de Sonar **no es bloqueante** todavía (#660): un PR con un hallazgo nuevo puede mergearse con el check en rojo.
- Hay un Medium de ZAP que es artefacto del entorno efímero (CORS `*`) y otro de producción aceptado (CSP en `/api/docs`, DEF-19).
- El activo se arma con los ejemplos del OpenAPI: la mayoría de las respuestas son 4xx; no prueba ausencia de fallas de lógica de negocio.
- Trivy y ZAP no bloquean el merge: es política, no un olvido.

### Technical Implications

- `.github/workflows/ci.yml` (jobs `sonar` y `trivy`; `deploy` depende de `trivy`), `.github/workflows/dast.yml` y `.github/dast/`.
- `sonar-project.properties`, `.trivyignore` (vacío: ninguna HIGH/CRITICAL sin fix) y el reporter `lcov` de Vitest, sin tocar los umbrales.
- El job `trivy` necesita `security-events: write` para subir el SARIF.
- Las actions de seguridad van fijadas por SHA del commit.

---

## 6. Implementation and Validation

- [x] Job `sonar` con cobertura (#662).
- [x] Job `trivy` con `fs`, `image` y `config` y SARIF (#663); correcciones de la imagen (#670).
- [x] Workflow `dast`, baseline y activo autenticado (#669).
- [x] Prueba en rojo de Trivy: una dependencia con CVE HIGH conocida hizo fallar los tres gates (PR descartable #664).
- [x] Bugs y vulnerabilidades de Sonar corregidos (#672, #675); DOMPurify (#671).
- [x] Documentación de QA, `AGENTS.md`, `docs/testing.md` y este ADR (#661).
- [ ] Gate de Sonar bloqueante y requerido en los PR a `develop`, y prueba en rojo con un bug deliberado (#660).

Validación: las corridas finales sobre `main` del 16/11/2026 están enlazadas en [`docs/QA/05`](../QA/05-informe-ejecucion.md) y [`07`](../QA/07-informe-seguridad.md).

---

## 7. References

- Spec [#656](https://github.com/hllous/Backend-M6-DAPS2/issues/656) y tickets #657 a #661.
- PR #662, #663, #669, #670, #671, #672 y #675.
- [`docs/QA/06-registro-defectos.md`](../QA/06-registro-defectos.md) (DEF-13, DEF-25, DEF-26).
- Criterios de Testing y Aseguramiento de Calidad, Clase 15 (secciones 2, 5, 7 y 9).
- Spec equivalente del Frontend: [hllous/Frontend-M6-DAPS2#922](https://github.com/hllous/Frontend-M6-DAPS2/issues/922).
