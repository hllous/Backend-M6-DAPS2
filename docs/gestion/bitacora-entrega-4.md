# Bitácora del sprint: Entrega 4 (herramientas de análisis y cierre de QA)

> Bitácora de equipo del Backend (Módulo 6, Grupo 04), del 15 al 16/11/2026, con la entrega el martes 17/11. Qué se hizo, cuándo y con qué evidencia. Las bitácoras individuales de la cátedra no viven en este repo.

## Objetivo

Cerrar los dos eliminatorios de alto riesgo del checklist de la Entrega 4 que dependían de herramientas (Quality Gate de SonarCloud y escaneo OWASP ZAP), sumar Trivy como segundo SCA y cerrar **DEF-13**. Spec: [#656](https://github.com/hllous/Backend-M6-DAPS2/issues/656). Decisiones: [ADR-017](../decisiones/adr-017-herramientas-analisis-estatico-y-seguridad.md).

## Cronología

| Fecha | Qué pasó | Evidencia |
|---|---|---|
| 15/11 | Sesión de grilling con el líder: Opción C del gate, ZAP activo fuera de producción, política de Trivy y protocolo de hallazgos. Se escribe la spec y se abren tres tickets de herramienta y uno de documentación | #656, #657 a #661 |
| 15/11 | SonarCloud en el CI con cobertura (job `sonar`). Primer análisis: 12 bugs, 23 vulnerabilidades, confiabilidad D y seguridad E; duplicación 1,2 % y hotspots 100 % | #662 |
| 15/11 | Trivy `fs`, `image` y `config`. La primera corrida da 6 HIGH en la imagen y el contenedor como root; prueba en rojo con una CVE plantada en un PR descartable | #663, #664 (descartado), #665, #666 |
| 15/11 | ZAP: baseline contra Render y activo autenticado contra un entorno efímero. 46 577 pedidos, cero 401. El baseline marca 1 High: DOMPurify del Swagger UI | #669, #668 |
| 15/11 al 16/11 | El gate de Sonar frena el proxy de ZAP (2 Blocker) y se corrige antes de mergear | #669 |
| 16/11 | Correcciones: imagen Docker (npm 11.21.2 y `USER node`), cierre de DOMPurify, bugs y vulnerabilidades de Sonar en código | #670, #671, #672, #675 |
| 16/11 | Promoción `develop → test → main`; CI de `main` en verde con deploy. ZAP final sobre `main`: 0 High en baseline y activo | [run 43786978363](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/43786978363), [run 43788946357](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/43788946357) |
| 16/11 | El líder acepta en SonarCloud el último `S8707`; gate OK y A/A/A | Dashboard de SonarCloud |
| 16/11 | Cierre documental: ADR-017, documentos de QA 01, 03, 05, 06 y 07, README de QA, `AGENTS.md`, `docs/testing.md` y esta bitácora. DEF-13 cerrado | #661 |

## Resultado

| Herramienta | Antes | Después (`main`, 16/11) |
|---|---|---|
| SonarCloud | gate rojo, 12 bugs, 23 vulnerabilidades, D/E | gate OK, 0 bugs, 0 vulnerabilidades, A/A/A, duplicación 1,2 %, hotspots 100 %, cobertura 97,3 % |
| Trivy | imagen 6 HIGH, `config` 1 HIGH | 0 HIGH/CRITICAL en `fs`, `image` y `config` |
| ZAP | 1 High (baseline) | 0 High en baseline y activo; 1 Medium en cada uno, justificadas |

Cifras al día (16/11, `develop` @ `6fe2614`): 2992 tests unitarios, cobertura 98,71 % de líneas, lint 0 errores y 343 warnings, pipeline de `main` en 3 min 5 s.

## Lo que aprendimos

- **El análisis de seguridad se prueba con la herramienta, no con el criterio:** `npm audit` daba 0 mientras la imagen traía 6 HIGH y un High en el JS embebido del Swagger UI.
- **Corregir en código antes que marcar falsos positivos:** llegar a A sin depender de marcas manuales se defiende mejor.
- **Un gate rojo sobre el tag tumba G3:** por eso la Opción C, con una fase no bloqueante que cubre solo la transición.
- **Las exclusiones de cobertura de Sonar tienen que ser las de Vitest**, o los dos números se contradicen (G9).

## Pendientes

- Gate de SonarCloud bloqueante y requerido en los PR a `develop`, con su prueba en rojo ([#660](https://github.com/hllous/Backend-M6-DAPS2/issues/660)).
- Archivar en `docs/QA/evidencia/` los reportes de la corrida final de ZAP (el artifact vence a los 90 días).
- Las severidades de DEF-25 a DEF-28 son propuestas: las deciden el líder y el QA y las valida el PO.
- Tag `v2.0-entrega4` sobre `main`.
