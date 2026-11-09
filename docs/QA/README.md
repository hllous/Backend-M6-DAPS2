# QA — Entregables de la prueba del TP (Clase 15, 10/11/2026)

> Índice de los documentos de QA del Módulo 6 «Ambiente e Higiene» (Grupo 04), según los *Criterios de Testing y Aseguramiento de Calidad* de la cátedra (estructura de ISO/IEC/IEEE 29119-3). Origen: Issue [#494](https://github.com/hllous/Backend-M6-DAPS2/issues/494). **Actualizado el 08/11/2026** sobre `develop` @ `1d600d2` (Issue [#588](https://github.com/hllous/Backend-M6-DAPS2/issues/588)).
>
> **El Markdown de esta carpeta es la fuente.** El PDF que se entrega se regenera a partir de él; no se edita a mano.

## Documentos

| Entregable de la cátedra | Archivo | Estado al 08/11 |
|---|---|---|
| Historias de usuario con Gherkin (Eje A) | `02-historias-y-criterios.md` | Borrador completo del 03/11, **sin cambios el 08/11**; a validar por el equipo |
| 1. Plan y estrategia de pruebas | `01-plan-y-estrategia.md` | Actualizado: niveles con lo que existe, criterios de salida con resultado, riesgos R1 a R19; a validar por el equipo |
| 2. Matriz de trazabilidad | `03-matriz-trazabilidad.md` | Actualizada: resultado de la corrida del 08/11 (R08), 175 criterios (160 con test del backend, 9 solo FE, 6 huecos); a validar por el equipo |
| 3. Especificación de casos | `04-especificacion-casos.md` | Actualizada: 348 casos, 66,7 % negativos o de borde; a validar por el equipo |
| 4. Informe de ejecución | `05-informe-ejecucion.md` | Re-armado con las cifras medidas el 08/11; **Quality Gate y carga NO HECHOS** |
| 5. Registro de defectos | `06-registro-defectos.md` | Actualizado: 24 defectos, 15 abiertos (**8 Mayores: el criterio de salida no se cumple**); a validar por el equipo |
| 6. Informe de seguridad | `07-informe-seguridad.md` | Actualizado; **ZAP y Trivy NO HECHOS**; CORS y `BFF_SHARED_KEY` NO VERIFICABLES hasta verlos en Render |
| 7. Declaración y plan de IA | Gobernanza de IA (Clase 14), `Clase14_Grupo4_Ambiente_IA.pdf`: archivo entregado, no versionado en este repo | Entregado y aprobado por el profesor el 03/11. No se mantiene un documento propio en QA |
| 8. Lecciones aprendidas | `09-lecciones-aprendidas.md` | Tres lecciones del 03/11 y tres candidatas nuevas; **la validación del equipo sigue pendiente** |
| Manual de usuario (prueba «tarea al azar», Eje A) | `manual-de-usuario.md` | Borrador v0.4 (03/11); textos de UI por verificar (están marcados). Las capturas viven en `img/` (se referencian como `img/NN-nombre.png`) |

Los PDF van en `docs/QA/build/` y **no se versionan** (están en `.gitignore`).

## Cómo regenerar el PDF

Requiere Node 22 y conexión a internet la primera vez (`md-to-pdf` baja un Chromium; la versión está fija en el script).

```bash
npm run qa:pdf
```

Genera, en `docs/QA/build/`:

| Archivo | Contenido |
|---|---|
| `Clase15_Grupo04_Ambiente-e-Higiene_Testing.pdf` | Los documentos `01` a `09`, en orden, con portada y numeración de páginas. Es el PDF que pide la cátedra |
| `Manual-de-usuario-M6.pdf` | Solo el manual de usuario |
| `individuales/01-….pdf` a `09-….pdf` | Un PDF por cada documento `01` a `09`, cada uno con su portada |

El script falla si falta alguno de los `01` a `09`, para no entregar un PDF incompleto. Para una prueba local con lo que haya: `npm run qa:pdf -- --partial`. El estilo está en `pdf.css` y el script, en `scripts/build-qa-pdf.mjs`.

## Decisiones cerradas

| Tema | Resolución | Fecha y fuente |
|---|---|---|
| **G5 (Jira).** La cátedra pedía Jira actualizado con casos y defectos | **Cerrada.** Trello + GitHub Issues vale como reemplazo de Jira. Casos y defectos siguen en Issues y Trello con estado, responsable y vínculo a la HU | Confirmado por la cátedra por Teams (consulta cerrada antes del 09/11). El mensaje original no está versionado: lo informó el equipo |
| **G1 (arranque local con `docker compose`).** Aclaración de la cátedra | **Cerrada e implementada.** Se acepta `cp .env.example .env` antes de `docker compose up` si `.env.example` está comentado y sin valores reales; el arranque corta con un mensaje claro si falta una variable (`${VAR:?...}`); el README dice qué completar y con qué usuarios se ingresa (en local no hay usuario: selector de perfiles del M1 falso); `.env` está en `.gitignore` y las credenciales no se imprimen en logs | Aclaración de la cátedra informada por el equipo el 08/11. Implementado en [#584](https://github.com/hllous/Backend-M6-DAPS2/pull/584) (issue #567): `docker-compose.yml` con `${VAR:?...}`, `README.md` (sección «Con Docker») y stack `modulo-6-ambiente`. Verificado el 08/11: `docker compose up` en frío, up en 35 s, `/health/ready` 200 a los 45 s. **Sigue abierto** el frontend dentro del compose ([#560](https://github.com/hllous/Backend-M6-DAPS2/issues/560)) |
| **Manual de usuario.** Dónde vive y cómo se espeja | **Cerrada.** Vive en este repo y se espeja en el frontend (con `img/`). Issues espejo cerrados: [FE #818](https://github.com/hllous/Frontend-M6-DAPS2/issues/818) y [BE #528](https://github.com/hllous/Backend-M6-DAPS2/issues/528) (actualización por los cambios de la interfaz del 07/11) | Estado de los issues consultado con `gh` el 08/11. Que el manual quede al día con la UI **no se re-verificó** |
| **Declaración de IA.** Si hace falta un documento propio en QA además de la Gobernanza de IA | **Cerrada.** La declaración ya fue entregada y aprobada por el profesor (Clase 14); se retiró `08-declaracion-ia.md` de QA | 09/11/2026, informado por el equipo |

## Pendientes (no cerrados)

| Tema | Estado al 08/11 | Responsable |
|---|---|---|
| **Tag `v1.0-testing`** en `main`, backend y frontend, antes de las 13:30 del 10/11 | **NO HECHO** | Equipo (DevOps: Bautista Canteli Castro, según el rol del plan). Se propone hacerlo el 09/11 |
| **SonarCloud y Quality Gate** | **NO HECHO**: pide un administrador del repositorio (`hllous`) | Administrador del repositorio |
| **Job `e2e` obligatorio** en la protección de ramas | **NO HECHO**: pide administrador; el e2e corre y pasa en el CI pero no bloquea (DEF-14) | Administrador del repositorio |
| **Prueba de carga con k6** | Hay script (`test/perf/k6-criticos.js`); **cero resultados** (no se corrió) | Benjamin Martinez (Dev Backend) |
| **Frontend dentro del compose** | Issue [#560](https://github.com/hllous/Backend-M6-DAPS2/issues/560) abierto | Equipo (DevOps) |
| **ZAP y Trivy** | **NO HECHOS** (DEF-13) | Benjamin Martinez (seguridad) |
| **`CORS_ORIGINS` y `BFF_SHARED_KEY` en Render** | **NO VERIFICABLE** hasta mirar el panel (DEF-18) | DevOps (Bautista Canteli Castro) |
| **Contrato del BFF con el frontend** (`X-M6-BFF-Key` y `X-Forwarded-For`) | Falta abrir el issue al frontend | Benjamin Martinez |
| **Defectos Mayores abiertos** (8 contra un máximo de 3) | El criterio de salida **no se cumple** | Equipo y PO |
| **Validación del equipo** de los documentos `01` a `09` | Pendiente: nadie del equipo los revisó | Santiago Tomas Peralta (QA) y el equipo |

## Fuentes técnicas relacionadas

[`docs/testing.md`](../testing.md) (cómo correr unitarios y e2e), [`docs/gestion/definition-of-done.md`](../gestion/definition-of-done.md), [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml), [`docs/bloqueantes.md`](../bloqueantes.md) (integración abierta con otros módulos).
