# QA — Entregables de la prueba del TP (Clase 15, 10/11/2026)

> Índice de los documentos de QA del Módulo 6 «Ambiente e Higiene» (Grupo 04), según los *Criterios de Testing y Aseguramiento de Calidad* de la cátedra (estructura de ISO/IEC/IEEE 29119-3). Origen: Issue [#494](https://github.com/hllous/Backend-M6-DAPS2/issues/494).
>
> **El Markdown de esta carpeta es la fuente.** El PDF que se entrega se regenera a partir de él; no se edita a mano.

## Documentos

| Entregable de la cátedra | Archivo | Estado al 03/11 |
|---|---|---|
| Historias de usuario con Gherkin (Eje A) | `02-historias-y-criterios.md` | Borrador completo; a validar por el equipo |
| 1. Plan y estrategia de pruebas | `01-plan-y-estrategia.md` | Borrador completo |
| 2. Matriz de trazabilidad | `03-matriz-trazabilidad.md` | Borrador completo; a validar por el equipo |
| 3. Especificación de casos | `04-especificacion-casos.md` | Borrador completo; a validar por el equipo |
| 4. Informe de ejecución | `05-informe-ejecucion.md` | Borrador completo; a validar por el equipo |
| 5. Registro de defectos | `06-registro-defectos.md` | Borrador completo; a validar por el equipo |
| 6. Informe de seguridad | `07-informe-seguridad.md` | Borrador completo; a validar por el equipo |
| 7. Declaración y plan de IA | `08-declaracion-ia.md` | Borrador completo; faltan datos del equipo (firmas, prompts exactos) |
| 8. Lecciones aprendidas | `09-lecciones-aprendidas.md` | Borrador completo; a validar por el equipo |
| Manual de usuario (prueba «tarea al azar», Eje A) | `manual-de-usuario.md` | Borrador v0.2; textos de UI por verificar (están marcados) |

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

## Decisiones abiertas

| Tema | Estado |
|---|---|
| **G5 (Jira).** La cátedra pide Jira actualizado con casos de prueba y defectos, con estado real, responsable y vínculo a la HU, y acceso de lectura para el docente. El equipo trabaja con **GitHub Issues y un tablero de Trello**, no con Jira | **Abierta.** Hay que consultar por el Teams de la cátedra si alcanza como equivalente (las consultas cierran el **09/11**). Hasta que respondan, se mantienen casos y defectos en Issues y Trello con estado, responsable y vínculo a la HU, y se prepara el acceso de lectura para el docente |
| **Manual de usuario.** Vive en este repo y se espeja en el frontend | Issue espejo: [FE #818](https://github.com/hllous/Frontend-M6-DAPS2/issues/818) |
| **Firma de tests generados con IA** | Pendiente de cada integrante (ver `08-declaracion-ia.md`) |
| **Tag `v1.0-testing`** en `main`, antes de las 13:30 del 10/11, en backend y frontend | Pendiente; se propone hacerlo el 09/11 |

## Fuentes técnicas relacionadas

[`docs/testing.md`](../testing.md) (cómo correr unitarios y e2e), [`docs/gestion/definition-of-done.md`](../gestion/definition-of-done.md), [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml), [`docs/bloqueantes.md`](../bloqueantes.md) (integración abierta con otros módulos).
