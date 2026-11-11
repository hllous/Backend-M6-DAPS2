# QA — Entregables de la prueba del TP (Clase 15)

> Versión 2.0 · 10/11/2026. Índice de los documentos de QA del Módulo 6 «Ambiente e Higiene» (Grupo 04), según los *Criterios de Testing y Aseguramiento de Calidad* (estructura de ISO/IEC/IEEE 29119-3). Origen: Issue [#494](https://github.com/hllous/Backend-M6-DAPS2/issues/494). Medido sobre `develop` @ `142e1a3`, el merge de [#597](https://github.com/hllous/Backend-M6-DAPS2/pull/597). **Versión entregada:** `main` @ `6333ecb`, con el tag `v1.0-testing` (PR [#602](https://github.com/hllous/Backend-M6-DAPS2/pull/602) y [#603](https://github.com/hllous/Backend-M6-DAPS2/pull/603)); desde `142e1a3` hasta ese commit solo entraron documentación, el README y `.env.example`, así que las cifras medidas siguen valiendo. La medición de mutation testing es posterior (10-11/11/2026, #617, sobre otra base: Vitest, NestJS 12, Node 24); ver `05-informe-ejecucion.md` §5.1.
>
> **El Markdown de esta carpeta es la fuente.** El PDF que se entrega se regenera a partir de él; no se edita a mano.

## Documentos

| Entregable | Archivo | Estado |
|---|---|---|
| Historias de usuario con Gherkin (Eje A) | `02-historias-y-criterios.md` | 33 HU y 175 criterios; los propuestos por nosotros (†) se validan con el PO |
| 1. Plan y estrategia de pruebas | `01-plan-y-estrategia.md` | Niveles, entornos, criterios de salida con resultado y riesgos de prioridad 4 o más |
| 2. Matriz de trazabilidad | `03-matriz-trazabilidad.md` | 175 criterios: 160 con test del backend, 9 solo FE y 6 huecos |
| 3. Especificación de casos | `04-especificacion-casos.md` | 372 casos, 67,5 % negativos o de borde |
| 4. Informe de ejecución | `05-informe-ejecucion.md` | Cifras medidas en la corrida R09 (2854 unitarios, cobertura 98,58 % de sentencias); **Quality Gate NO HECHO** |
| 5. Registro de defectos | `06-registro-defectos.md` | 22 defectos, 4 abiertos (2 Mayores: DEF-09 y DEF-13; DEF-15 y DEF-18 cerrados con #642) |
| 6. Informe de seguridad | `07-informe-seguridad.md` | **ZAP y Trivy NO HECHOS**; el resto con evidencia |
| 7. Declaración y plan de IA | Gobernanza de IA (Clase 14), `Clase14_Grupo4_Ambiente_IA.pdf`: entregado y aprobado, no versionado en este repo | No se mantiene un documento propio en QA |
| 8. Lecciones aprendidas | `08-lecciones-aprendidas.md` | Ocho casos; proponemos presentar los tres primeros |
| Manual de usuario (prueba «tarea al azar», Eje A) | `manual-de-usuario.md` | Textos de UI por verificar (están marcados). Las capturas viven en `img/` |

Los PDF van en `docs/QA/build/` y **no se versionan** (están en `.gitignore`).

## Cómo regenerar el PDF

Requiere Node 24 y conexión a internet la primera vez (`md-to-pdf` baja un Chromium; la versión está fija en el script).

```bash
npm run qa:pdf
```

Genera, en `docs/QA/build/`:

| Archivo | Contenido |
|---|---|
| `Clase15_Grupo04_Ambiente-e-Higiene_Testing.pdf` | Los documentos `01` a `08`, en orden, con portada, índice y numeración de páginas. Es el PDF que se entrega |
| `Manual-de-usuario-M6.pdf` | Solo el manual de usuario |
| `individuales/01-….pdf` a `08-….pdf` | Un PDF por cada documento `01` a `08`, cada uno con su portada |

El script falla si falta alguno de los `01` a `08`, para no entregar un PDF incompleto. Para una prueba local con lo que haya: `npm run qa:pdf -- --partial`. El estilo está en `pdf.css` y el script, en `scripts/build-qa-pdf.mjs`.

## Decisiones cerradas

| Tema | Resolución |
|---|---|
| **G5 (Jira)** | Trello + GitHub Issues vale como reemplazo de Jira. Casos y defectos siguen en Issues y Trello con estado, responsable y vínculo a la HU |
| **G1 (arranque local con `docker compose`)** | Se acepta `cp .env.example .env` antes de `docker compose up` si `.env.example` está comentado y sin valores reales; el arranque corta con un mensaje claro si falta una variable (`${VAR:?...}`); el README dice qué completar y con qué usuarios se ingresa; `.env` está en `.gitignore` y las credenciales no se imprimen en logs. Implementado en [#584](https://github.com/hllous/Backend-M6-DAPS2/pull/584) (issue #567) y verificado con `docker compose up` en frío |
| **Manual de usuario** | Vive en este repo y se espeja en el frontend (con `img/`). Issues espejo cerrados: [FE #818](https://github.com/hllous/Frontend-M6-DAPS2/issues/818) y [BE #528](https://github.com/hllous/Backend-M6-DAPS2/issues/528). Que el manual esté al día con la UI no se re-verificó |
| **Declaración de IA** | Ya fue entregada y aprobada (Clase 14); no se mantiene un documento propio en QA |

## Lo no realizado

| Tema | Estado | Responsable |
|---|---|---|
| **SonarCloud y Quality Gate** | **NO HECHO**: pide un administrador del repositorio (`hllous`) | Administrador del repositorio |
| **Job `e2e` obligatorio** en la protección de ramas | **NO HECHO**: pide administrador; el e2e corre y pasa pero no bloquea (DEF-14) | Administrador del repositorio |
| **ZAP y Trivy** | **NO HECHOS** (DEF-13) | Benjamin Martinez (seguridad) |
| **Contrato del BFF y formato de error con el frontend** | Issue abierto: [Frontend #898](https://github.com/hllous/Frontend-M6-DAPS2/issues/898) (parser de Problem Details, `Content-Type`, ETag, `Idempotency-Key`) | Benjamin Martinez |
| **Éxito en los 91 endpoints restantes** de la colección Newman | `test/api/PENDIENTES.md` | Equipo |
| **Mutation score global** | **Parcial**: línea base de los 26 archivos de dominio 71,22 % (cumple el 60 %), 5 archivos reforzados; quedan 21 y confirmar el global en el CI. Ver `05-informe-ejecucion.md` §5.1 | Benjamin Martinez |

## Fuentes técnicas relacionadas

[`docs/testing.md`](../testing.md) (cómo correr unitarios y e2e), [`docs/gestion/definition-of-done.md`](../gestion/definition-of-done.md), [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml), [`docs/bloqueantes.md`](../bloqueantes.md) (integración abierta con otros módulos).
