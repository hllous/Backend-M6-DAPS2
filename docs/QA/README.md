# QA — Entregables de la prueba del TP (Clase 15)

> Versión 2.2 · 16/11/2026

Índice de los documentos de QA del Módulo 6 «Ambiente e Higiene» (Grupo 04), según los *Criterios de Testing y Aseguramiento de Calidad* (ISO/IEC/IEEE 29119-3). Medido sobre `develop` @ `53cde64`. El Markdown de esta carpeta es la fuente: el PDF se regenera a partir de él.

## Documentos

| Entregable | Archivo | Contenido |
|---|---|---|
| Historias de usuario con Gherkin (Eje A) | `02-historias-y-criterios.md` | 33 HU y 181 criterios; los propuestos por nosotros (†) se validan con el PO |
| 1. Plan y estrategia de pruebas | `01-plan-y-estrategia.md` | Alcance, niveles, entornos, criterios de entrada y salida, riesgos |
| 2. Matriz de trazabilidad | `03-matriz-trazabilidad.md` | 181 criterios: 177 ejecutados y pasados (167 con test del backend y 10 con test del frontend) y 4 huecos |
| 3. Especificación de casos | `04-especificacion-casos.md` | 394 casos, 67,8 % negativos o de borde |
| 4. Informe de ejecución | `05-informe-ejecucion.md` | 3056 unitarios, 410 e2e y 8 de RabbitMQ real; cobertura 98,71 % de líneas; mutation 76,11 %; pipeline 2 min 23 s; Quality Gate OK. Frontend (sección 9): Eje A, cobertura 90,20 % con umbral, `retries: 0`, If-Match/412 y timeout de 5 s, 429 en el login |
| 5. Registro de defectos | `06-registro-defectos.md` | 2 abiertos (0 Bloqueantes, 0 Críticos, 0 Mayores y 2 Menores) y 36 cerrados |
| 6. Informe de seguridad | `07-informe-seguridad.md` | Matriz SEC, pruebas generales (BOLA en vivo y decisión de ADR-008), Trivy, ZAP, gitleaks, SonarCloud |
| 7. Declaración y plan de IA | Gobernanza de IA (Clase 14), `Clase14_Grupo4_Ambiente_IA.pdf`; no versionada en este repo | Se entrega en Teams junto con este paquete |
| 8. Lecciones aprendidas | `08-lecciones-aprendidas.md` | Tres defectos tardíos y seis más de la semana de testing |
| Manual de usuario (prueba «tarea al azar») | `manual-de-usuario.md` | Capturas en `img/` |

Los PDF van en `docs/QA/build/` y no se versionan.

## Cómo regenerar el PDF

Requiere Node 24 y conexión a internet la primera vez (`md-to-pdf` baja un Chromium).

```bash
npm run qa:pdf
```

| Archivo generado en `docs/QA/build/` | Contenido |
|---|---|
| `Clase15_Grupo04_Ambiente-e-Higiene_Testing.pdf` | Los documentos `01` a `08`, con portada, índice y numeración. Es el que se entrega |
| `Manual-de-usuario-M6.pdf` | Solo el manual de usuario |
| `individuales/01-….pdf` a `08-….pdf` | Un PDF por documento |

El script falla si falta alguno de los `01` a `08`; `npm run qa:pdf -- --partial` genera con lo que haya. Estilo en `pdf.css`; script en `scripts/build-qa-pdf.mjs`.

## Decisiones

| Tema | Resolución |
|---|---|
| **Jira (G5)** | Trello + GitHub Issues reemplazan a Jira: casos y defectos con estado, responsable y vínculo a la HU |
| **Arranque local (G1)** | `docker compose up --build` sin `.env` levanta base, broker, backend, seed, M1 falso y frontend; `cp .env.example .env` para cambiar los valores de ejemplo |
| **Herramientas de análisis** | SonarCloud con gate bloqueante, Trivy con gate sobre HIGH/CRITICAL con fix y ZAP activo solo contra un entorno efímero ([ADR-017](../decisiones/adr-017-herramientas-analisis-estatico-y-seguridad.md)) |
| **Declaración de IA** | Entregada y aprobada en la Clase 14; no se mantiene un documento propio en QA |

## Fuentes técnicas

[`docs/testing.md`](../testing.md), [`docs/gestion/definition-of-done.md`](../gestion/definition-of-done.md), [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml), [`.github/workflows/dast.yml`](../../.github/workflows/dast.yml), [ADR-017](../decisiones/adr-017-herramientas-analisis-estatico-y-seguridad.md) y [`docs/bloqueantes.md`](../bloqueantes.md).
