# QA — Entregables de la prueba del TP (Clase 15)

> Versión 2.2 · 16/11/2026, cierre de la Entrega 4. Índice de los documentos de QA del Módulo 6 «Ambiente e Higiene» (Grupo 04), según los *Criterios de Testing y Aseguramiento de Calidad* (estructura de ISO/IEC/IEEE 29119-3). Origen: Issue [#494](https://github.com/hllous/Backend-M6-DAPS2/issues/494). **Base del cierre:** `develop` @ `50cfff7` del Backend (CI [run 43908234945](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/43908234945)) y `develop` del Frontend del 16/11. Las mediciones anteriores siguen citadas con su base: R09 sobre `develop` @ `142e1a3` (10/11, tag `v1.0-testing` en `main` @ `6333ecb`), mutation testing del 10-11/11 (#617) y SonarCloud, Trivy y ZAP sobre `main` @ `78bf714` (16/11).
>
> **PR del Frontend al cierre:** FE #972 (gate de Sonar bloqueante), #977 (límite de intentos de login) y #978 (`If-Match` y timeout de 5 s) están **mergeados** a `develop` el 16/11; **pendientes de merge** (CI en verde): FE #979 (criterios solo-FE y recorrido responsive y de accesibilidad) y #980 (tests inestables). Lo que depende de estos dos está marcado en cada documento.
>
> **El Markdown de esta carpeta es la fuente.** El PDF que se entrega se regenera a partir de él; no se edita a mano.

## Documentos

| Entregable | Archivo | Estado |
|---|---|---|
| Historias de usuario con Gherkin (Eje A) | `02-historias-y-criterios.md` | 33 HU y 175 criterios; los propuestos por nosotros (†) se validan con el PO. El 16/11 se corrigieron CA-HU26-1 (formato con coma), CA-HU30-4 (el login corta a 90 s) y CA-HU31-5 (`traceId`); ninguna HU Must con trabajo abierto |
| 1. Plan y estrategia de pruebas | `01-plan-y-estrategia.md` | Niveles, entornos, criterios de salida con resultado y riesgos de prioridad 4 o más. Declara lo que no aplica: SOAP/WSDL y XXE, e IA integrada (8.3) |
| 2. Matriz de trazabilidad | `03-matriz-trazabilidad.md` | 175 criterios: 161 con test del backend, 10 con test del frontend ejecutado (Eje A) y 4 huecos de backend declarados (CA-HU10-2, CA-HU24-2, CA-HU33-1, CA-HU33-4). **171 de 175 pasan (97,7 %, umbral 95 %)** |
| 3. Especificación de casos | `04-especificacion-casos.md` | 383 casos, 68,1 % negativos o de borde |
| 4. Informe de ejecución | `05-informe-ejecucion.md` | Cierre del 16/11: 3010 unitarios y 404 e2e en verde; cobertura del backend 97,98 % de sentencias con **umbral de 90 %**; Newman con éxito en 151/152 operaciones y error en 149/152 (excepciones justificadas); 58 pruebas de seguridad en vivo; G1 en 149 s; G6 en 0; gates bloqueantes. **PENDIENTE:** cobertura y mutation del frontend y 3 corridas del CI del frontend |
| 5. Registro de defectos | `06-registro-defectos.md` | 38 defectos (DEF-01 a DEF-40), **10 abiertos: 0 Bloqueantes, 0 Críticos, 0 Mayores y 10 Menores**. DEF-14, DEF-19, DEF-32 y DEF-33 cerrados el 16/11 |
| 6. Informe de seguridad | `07-informe-seguridad.md` | Clase 11: 8 CUMPLE y 2 mixtos, ninguno NO CUMPLE. Pruebas en vivo (JWT, BFLA, BOLA, mass assignment, inyección, cabeceras, CORS, errores), fuerza bruta en el login (429), Trivy 0 HIGH/CRITICAL, ZAP 0 High, secretos en 0. Declara la decisión de diseño de los `GET` de servicios (ADR-008) |
| 7. Declaración y plan de IA | Gobernanza de IA (Clase 14), `Clase14_Grupo4_Ambiente_IA.pdf`, no versionada en este repo. 8.1 (uso de IA en testing) y 8.2 (plan de IA) se actualizan en el documento de Drive (lo hace el líder). **8.3 (IA integrada en el sistema): no aplica**, el sistema no incorpora funcionalidad de IA | Se entrega en Teams junto con este paquete |
| 8. Lecciones aprendidas | `08-lecciones-aprendidas.md` | Once casos; proponemos presentar los tres primeros |
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
| **G5 (Jira)** | Trello + GitHub Issues vale como reemplazo de Jira. Casos y defectos siguen en Issues y Trello con estado, responsable y vínculo a la HU. El 16/11 se abrieron issues para los defectos que no tenían (BE #692, #693, #694; FE #968) y un workflow cierra los issues al integrar a `develop` o `test` (#705) |
| **G1 (arranque con un único comando)** | `docker compose up --build` desde un clon limpio y **sin `.env`** levanta el sistema completo: Postgres, RabbitMQ, backend con migraciones, seed automático e idempotente, M1 falso y frontend (#698, PR #699). Lo verifica en el CI `g1-arranque.yml`: login de punta a punta a los 149 s ([run 43893616309](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/43893616309)). La primera carga de cada pantalla del frontend es lenta (`next dev`) |
| **G6 (secretos)** | gitleaks con la configuración por defecto y trufflehog sobre todo el historial en el CI (job `secrets-default`, #695 y FE #971): 0 hallazgos y 0 credenciales verificadas; los valores de juguete del historial están en `.gitleaksignore` por huella ([`07`](07-informe-seguridad.md) 5.4) |
| **Manual de usuario** | Vive en este repo y se espeja en el frontend (con `img/`). Issues espejo cerrados: [FE #818](https://github.com/hllous/Frontend-M6-DAPS2/issues/818) y [BE #528](https://github.com/hllous/Backend-M6-DAPS2/issues/528). Que el manual esté al día con la UI no se re-verificó |
| **Herramientas de análisis** | SonarCloud con gate **bloqueante y requerido** en el Backend (#700; #660 cerrado), Trivy con gate sobre HIGH/CRITICAL con fix que frena el deploy, y ZAP activo solo contra un entorno efímero. Registrado en [ADR-017](../decisiones/adr-017-herramientas-analisis-estatico-y-seguridad.md) |
| **Protección de ramas** | Checks obligatorios en `develop`, `test` y `main`: Backend `build`, `test`, `e2e`, `secrets` y `sonar`; Frontend `build`, `test`, `docs`, `e2e` y `secrets` (verificado con la API de GitHub el 16/11) |
| **SOAP/WSDL y XXE** | **No aplica:** el módulo es REST/JSON más mensajes JSON por RabbitMQ; no expone ni consume SOAP y no parsea XML |
| **IA integrada (Clase 14, 8.3)** | **No aplica:** el sistema no incorpora funcionalidad de IA. La declaración de IA (Clase 14) ya fue entregada y aprobada; 8.1 y 8.2 se actualizan en el documento de Drive |

## Lo no realizado o pendiente

| Tema | Estado | Responsable |
|---|---|---|
| **Merge de los PR del Frontend** #979 y #980 | **PENDIENTE**: CI en verde; de ellos dependen DEF-29 a DEF-31 y 6 de los 10 criterios del Eje A | Líder del repositorio del Frontend |
| **Cobertura del frontend ≥ 90 % con umbral** | **PENDIENTE** (en curso, Frontend #975, DEF-35) | Nicolas Facundo Llousas |
| **Mutation testing del frontend** | **PENDIENTE** (Stryker en curso, DEF-35) | Nicolas Facundo Llousas |
| **3 corridas del CI del frontend** con el arreglo de los tests inestables | **PENDIENTE** (3 corridas locales idénticas hechas) | Nicolas Facundo Llousas |
| **`sonar` como check obligatorio del Frontend** | **PENDIENTE**: el gate ya es bloqueante (FE #972, mergeado el 16/11), pero `sonar` no figura entre los checks obligatorios del Frontend | Líder del repositorio |
| **Re-correr ZAP y `scripts/security-live.mjs` contra Render** con #701 en `main` | **PENDIENTE**: Render sirve `main`, sin #701 | Equipo |
| **Reporte final de ZAP** archivado en `evidencia/` | **NO HECHO**: la corrida final ([run 43788946357](https://github.com/hllous/Backend-M6-DAPS2/actions/runs/43788946357)) vive como artifact (90 días); en el repo están los reportes de la del 15/11 | Equipo |
| **Cerrar el issue BE #692** (DEF-14) | El cambio ya se aplicó (e2e obligatorio); el issue sigue abierto | Líder del repositorio |
| **Mutation score global del backend** | **Parcial**: 75,39 % confirmado en el CI (cumple el 60 %); quedan 21 archivos sin reforzar. Ver `05-informe-ejecucion.md` §5.1 | Benjamin Martinez |

## Fuentes técnicas relacionadas

[`docs/testing.md`](../testing.md) (cómo correr unitarios y e2e), [`docs/gestion/definition-of-done.md`](../gestion/definition-of-done.md), [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml), [`.github/workflows/dast.yml`](../../.github/workflows/dast.yml), [ADR-017](../decisiones/adr-017-herramientas-analisis-estatico-y-seguridad.md), [`docs/bloqueantes.md`](../bloqueantes.md) (integración abierta con otros módulos).
