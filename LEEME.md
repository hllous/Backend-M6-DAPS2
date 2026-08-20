# Módulo 6 — Ambiente, Higiene y Servicios Urbanos · Grupo 04

Contenido de la carpeta de trabajo. Estado al 17 de agosto de 2026.

## Dos conjuntos de documentación

Desde el 18 de agosto de 2026 esta carpeta tiene **dos cosas distintas**, y conviene no confundirlas:

| | Para qué | Dónde |
|---|---|---|
| **Entregables y contratos** | Lo que se entrega a la cátedra y lo que circula a los otros grupos. Se escribe en Markdown y se compila a PDF | Todo lo que describe este archivo: raíz, `fuentes/`, `M6-por-modulo/` |
| **Documentación interna** | Para el equipo y para las sesiones de IA que ayuden a programar el módulo. Markdown que se lee directo, sin compilar | [`docs/`](docs/) y [`AGENTS.md`](AGENTS.md) |

[`AGENTS.md`](AGENTS.md) es el mapa de entrada del repo. [`docs/`](docs/) tiene el modelo de datos con sus diagramas de estado, los eventos publicados con su JSON Schema, los consumidos con los campos que necesitamos, el catálogo de enumeraciones y el estado vivo de la integración.

**Los dos conjuntos pueden decir cosas ligeramente distintas por un tiempo**: no están unificados y unificarlos es una mejora pendiente, no un bug. Si difieren en el estado de la integración, vale [`docs/bloqueantes.md`](docs/bloqueantes.md).

## Qué entregamos / qué circula

Los tres PDF están en [`docs/`](docs/) para tenerlos junto al resto de la documentación técnica:

| Archivo | Qué es |
|---|---|
| [`docs/Documento de Alcance - Grupo 04 (Modulo 6).pdf`](docs/Documento%20de%20Alcance%20-%20Grupo%2004%20%28Modulo%206%29.pdf) | **El entregable de la cátedra.** Alcance completo del módulo |
| [`docs/Diagrama de Eventos - Grupo 04 (Modulo 6).pdf`](docs/Diagrama%20de%20Eventos%20-%20Grupo%2004%20%28Modulo%206%29.pdf) | Diagrama de integración M6 ↔ resto vía Core |
| [`docs/Acuerdo-Eventos-M6.pdf`](docs/Acuerdo-Eventos-M6.pdf) | **El documento que circula a los otros grupos.** Los 8 eventos que publicamos con sus payloads, lo que consumimos, y las incongruencias abiertas |
| `Cruce-Eventos-M6.md` | Análisis interno: cruce de las listas de eventos de M1–M9 contra la nuestra |
| `M6-por-modulo/M6-para-M{1..9}.md` | Una ficha por módulo, para mandarle a cada grupo la suya |

## Fuentes editables

Todo se escribe en Markdown. **Los PDF entregables se regeneran fuera del repo**: el pipeline de generación (scripts Python + HTML intermedios) no vive acá para no ensuciar el repo del backend con herramientas de otro proceso.

| Archivo fuente | Entregable que produce |
|---|---|
| `Acuerdo-Eventos-M6.md` | `docs/Acuerdo-Eventos-M6.pdf` (circula a otros grupos) |
| `Cruce-Eventos-M6.md` | análisis interno, no se entrega |
| `fuentes/alcance.md` | versión larga de trabajo, no se entrega |
| `fuentes/alcance-entregable.md` | `docs/Documento de Alcance - Grupo 04 (Modulo 6).pdf` (entregable cátedra) |
| `M6-por-modulo/M6-para-M{1..9}.md` | Las ocho fichas por módulo (circulan una a una) |
| `fuentes/informacion-para-modulos-Modulo6.md` | Las ocho fichas concatenadas en un solo PDF |

Para regenerar los PDF hay que pedir al mantenedor del pipeline (ver `AGENTS.md`).

## Dónde está cada cosa

```
.
├── README.md                        portada del repo (GitHub)
├── CONTRIBUTING.md                  cómo trabajar en el repo
├── LEEME.md                         este archivo
├── AGENTS.md                        mapa del repo para el equipo y para IA
├── Acuerdo-Eventos-M6.md            fuente editable del contrato
├── Cruce-Eventos-M6.md              análisis interno del cruce de listas
├── docs/                            documentación interna + entregables PDF
│   ├── README.md                    qué hace M6 + glosario
│   ├── Documento de Alcance ...pdf  entregable de la cátedra
│   ├── Diagrama de Eventos ...pdf   entregable de la cátedra
│   ├── Acuerdo-Eventos-M6.pdf       contrato que circula a los otros grupos
│   ├── entidades/                   modelo de datos + estados
│   ├── eventos/                     publicados y consumidos
│   ├── bloqueantes.md               fuente única del estado de integración
│   ├── enumeraciones.md             catálogo de valores cerrados
│   ├── DER.md / DER.puml            diagrama entidad-relación
│   ├── api/                         estándar Swagger + endpoints REST
│   ├── decisiones/                  ADRs (decisiones técnicas)
│   └── gestion/                     Scrum: DoD
├── enunciado/                       el TPO de la cátedra
├── referencias/                     documentos que nos pasaron otros grupos
├── fuentes/                         .md de las versiones largas del alcance
└── M6-por-modulo/                   una ficha .md por módulo
```

En cuanto se cree el proyecto NestJS, se suman en la raíz: `src/`, `prisma/`, `test/`, `package.json`, `nest-cli.json`, etc.

## Estado de la integración

> **Versión resumida.** El estado vivo, con el detalle por contraparte y la fecha de cada pedido, está en [`docs/bloqueantes.md`](docs/bloqueantes.md). Si los dos difieren, vale ese.

**Publicamos 8 eventos y los ocho tienen consumidor confirmado.** Eran 15: los siete que le ofrecíamos a M2 como detalle del avance se quedaron sin consumidor cuando M2 definió que todo lo suyo entra por `updateTicketStatus`, y los sacamos del contrato. El diseño de esos siete queda escrito en `fuentes/alcance.md`, sección 7.2.

**Consumimos 10 eventos, de cinco módulos.** De M1, M5 y M8 no consumimos nada.

Bloqueantes abiertos:

| Con quién | Qué falta |
|---|---|
| **M2** | Que `ticketUpdated / ROUTED` diga a qué módulo va —o el catálogo de `requestTypeId` que nos corresponden— y que `location` traiga `neighborhoodId` en vez de texto libre |
| **M4** | Que devuelvan `sourceViolationId` en `commercialFineGenerated`, `closureOrdered` y `closureLifted` |
| **M9** | No aparece en la recopilación. Falta el claim set del JWT y el catálogo de barrios |

M3, M4 y M7 ya confirmaron todo lo que les mandamos.

## Referencia importante

`referencias/Documentacion_Eventos_Modulo_2_v1.2_unificado.docx` es la guía de integración de M2. **Es el documento de contrato más completo de la cohorte** —sobre común, JSON Schema, matriz de transiciones, reglas de idempotencia y DLQ— y el único que define un envelope. Nuestro `updateTicketStatus` adopta su payload tal cual.
