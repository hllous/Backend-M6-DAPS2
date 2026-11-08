# Módulo 6 — Ambiente, Higiene y Servicios Urbanos

> Punto de entrada de `docs/`: qué hace el módulo, glosario y mapa de la carpeta. Leer primero; el código manda ante cualquier contradicción.

> Fuente original: `fuentes/alcance-entregable.md` §1-2, en el repositorio de documentación. Esta versión es la que se mantiene viva; el entregable formal se sigue generando de la fuente original hasta que se unifique el pipeline (ver [bloqueantes.md](bloqueantes.md)).

Módulo operativo de campo de la higiene urbana y el control ambiental. Planifica y ejecuta los servicios de recolección, limpieza, arbolado y espacios verdes; administra el inventario urbano ambiental; y tramita las denuncias ambientales hasta el acta de constatación, registrando después la resolución sancionatoria que devuelve M4.

## Qué hace el módulo

| Área | Responsabilidad |
|---|---|
| **Configuración de catálogos** | Tipos de servicio, zonas operativas, frecuencias y recorridos |
| **Programación de servicios** | Agenda sobre recorridos u objetivos puntuales; reprogramación y cancelación |
| **Ejecución en campo** | Inicio, avance, suspensión y cierre; registro de lo que quedó sin atender y por qué |
| **Residuos** | Recolección domiciliaria, de reciclables, de voluminosos y de verdes; volumen, peso y destino final |
| **Limpieza viaria** | Barrido manual y mecánico, y lavado de calles, como servicio programable sobre recorrido |
| **Contenedores y puntos verdes** | Alta, ubicación, capacidad, desborde, daño, vaciado, reparación y reubicación. Puntos verdes de entrega voluntaria |
| **Arbolado** | Censo con historial de relevamientos; poda, extracción, plantación y tratamiento |
| **Espacios verdes** | Plazas y parques, con riego y corte de césped |
| **Control ambiental** | Denuncias ambientales —ruidos, vertidos, microbasurales, emisiones—, inspección, acta de constatación y violación constatada |
| **Seguimiento del ciudadano** | Publicamos el avance de la inspección para que M2 lo muestre, y servimos sin token la consulta complementaria bajo `/public`: seguimiento de la denuncia, cuándo pasa el servicio y dónde están los puntos verdes |

Detalle funcional de cada área (qué se puede hacer, no solo el título): ver `fuentes/alcance-entregable.md` §3, en el repositorio de documentación. No se migró acá porque cambia poco y no es algo que otro módulo necesite consultar — si empieza a cambiar seguido, se trocea.

## Glosario

| Término | Qué es en M6 |
|---|---|
| **Zona operativa** (`Zone`) | Agrupación propia que junta uno o más barrios para armar recorridos y asignar cuadrillas. Hoy se define una por barrio (decisión del 27/10, #376). No confundir con las zonas de M9, que son administrativas (las 15 comunas) y solo agrupan barrios — ver [m9.md](integracion/m9.md#catálogos-globales-del-core-2010) |
| **Servicio** (`Service`) | Unidad de trabajo programable: tipo, fecha, cuadrilla y estado. Puede ser `ROUTE` o `POINT`. Ver [entidades/service.md](entidades/service.md) |
| **Ticket** | El reclamo que el vecino presenta en M2, dueño del registro. Se llamaba `complaint` en los documentos viejos de este módulo — **migrado a `ticket`**, que es el nombre que usa toda la cohorte, antes de la primera entrega para no arrastrar un rename de esquema después |
| **Acta** (`ViolationNotice`) | Lo que emitimos al constatar una violación. Inmutable una vez emitida. Ver [entidades/control-ambiental.md](entidades/control-ambiental.md) |
| **Cuadrilla** (`Crew`) | Equipo de trabajo, municipal o de cooperativa, que ejecuta servicios |
| **Resultado de zona** (`ZoneResult`) | Resultado de la atención de una zona específica dentro de un servicio: `SERVICED`, `PARTIAL` o `NOT_SERVICED`, con motivo y observaciones si no fue atendida |
| **Evidencia** (`Evidence` / `Attachment`) | Archivo adjunto (foto o documento) subido a Cloudflare R2 vía `POST /evidence` con `Idempotency-Key`, asociado a `SERVICE`, `ZONE_RESULT`, `INSPECTION` o `CONTAINER` |
| **Actores: Oficina y Campo** (`Office` / `Field`) | Separación estricta de responsabilidades (ADR-0002 frontend). Oficina programa, asigna, reprograma y emite actas; Campo (líder y miembros) ejecuta e inspecciona en calle |

## Tablero de indicadores

Cuatro familias, una por endpoint bajo `/indicators` — ver [api/endpoints.md](api/endpoints.md).

- **Cobertura**: objetivos atendidos sobre programados, por período, zona y tipo de servicio.
- **Cumplimiento**: servicios finalizados en término, demorados, y ranking de zonas no atendidas con sus motivos.
- **Incidencias**: contenedores desbordados y dañados por zona, árboles por nivel de riesgo, denuncias por tipo y estado, y tiempo medio de resolución.
- **Residuos**: kilos y metros cúbicos por tipo y destino, y porcentaje desviado a reciclaje.

**El objetivo es el par (servicio, zona), no el servicio.** Un recorrido que pasa por cuatro zonas y atiende tres son tres objetivos cumplidos y uno no; medirlo por servicio perdería justamente la zona que quedó sin atender.

## Mapa de esta carpeta

- [api/](api/) — estándar Swagger y 152 endpoints REST del backend
- [entidades/](entidades/) — modelo conceptual de datos y máquinas de estados
- [DER.md](DER.md) — modelo relacional entidad-relación (diagrama Mermaid y reglas de esquema)
- [eventos/publicados/](eventos/publicados/) — los 6 eventos que este módulo emite (con sus `.schema.json`)
- [eventos/consumidos/](eventos/consumidos/) — los 10 eventos que este módulo escucha
- [Acuerdo-Eventos-M6.md](Acuerdo-Eventos-M6.md) — contrato de eventos que circula a las otras cohortes (fuente del PDF; ver [ADR-003](decisiones/adr-003-divergencias-enums.md) por los enums que ya divergen)
- [Cruce-Eventos-M6.md](Cruce-Eventos-M6.md) — análisis interno del 17/08 que contrasta las listas de eventos de la cohorte; histórico, no se mantiene
- [arquitectura/](arquitectura/README.md) — vistas C4 (contexto y contenedores) y secuencias de publicar, consumir y login
- [bloqueantes.md](bloqueantes.md) — tablero de lo abierto en la integración inter-módulo (fuente única)
- [integracion/](integracion/README.md) — fichas por módulo (M1, M2, M3, M4, M7, M9), historial, resueltos, riesgos y mensajes enviados
- [enumeraciones.md](enumeraciones.md) — catálogo de valores cerrados
- [decisiones/](decisiones/) — ADRs (decisiones técnicas de arquitectura)
- [QA/README.md](QA/README.md) — entregables de QA de la prueba del 10/11 (plan, matriz, casos, informe de ejecución, defectos, seguridad, declaración de IA, lecciones)
- [QA/manual-de-usuario.md](QA/manual-de-usuario.md) — manual para el usuario final (Oficina y Campo), clasificado según Diátaxis; capturas en `QA/img/`
- [deploy.md](deploy.md) — despliegue, URLs, variables de entorno y estado operativo
- [testing.md](testing.md) — tests unitarios y e2e contra Postgres: cómo correrlos y qué cubre cada suite
- [gestion/](gestion/) — proceso Scrum: DoD, sprints y bitácoras
- [agents/](agents/README.md) — andamiaje para agentes de IA (cómo leer estos docs, tracker de issues, labels de triage); no documenta el producto

## Repositorio de documentación

Este repo tiene la documentación **interna** (equipo + IA que programe el módulo). Lo que se entrega a la cátedra y lo que circula a otros grupos se produce en el **repositorio de documentación**: `<URL_REPO_DOCUMENTACION>` *(placeholder: falta la URL)*. Si ambos difieren en el estado de la integración, vale [bloqueantes.md](bloqueantes.md). Los dos conjuntos no están unificados todavía: es una mejora pendiente, no un bug.

| Fuente (repositorio de documentación) | Qué produce |
|---|---|
| `Acuerdo-Eventos-M6.md` | `Acuerdo-Eventos-M6.pdf` (circula a otros grupos; también hay copia editable en [Acuerdo-Eventos-M6.md](Acuerdo-Eventos-M6.md)) |
| `Sobres-M6.md` | `Sobres-M6.pdf` (circula junto al Acuerdo; copia en [Sobres-M6.md](Sobres-M6.md)) |
| `Cruce-Eventos-M6.md` | análisis interno, no se entrega ([copia](Cruce-Eventos-M6.md)) |
| `fuentes/alcance-entregable.md` | `Documento de Alcance - Grupo 04 (Modulo 6).pdf` (entregable de la cátedra, versionado en esta carpeta) |
| `fuentes/alcance.md` | versión larga de trabajo, no se entrega |
| `M6-por-modulo/M6-para-M{1..9}.md` | una ficha por módulo, que circula una a una |
| `fuentes/informacion-para-modulos-Modulo6.md` | las fichas concatenadas en un solo PDF |

Los PDF de esta carpeta (`Documento de Alcance`, `Diagrama de Eventos`) son entregables compilados: no se regeneran desde este repo.

**Qué no se puede verificar desde este repo:** el contenido de los PDF compilados, de las fichas por módulo, de las versiones largas del alcance y del enunciado del TPO. Los conteos y las rutas de esta documentación sí se contrastan con el código.

`docs/documentacion/` puede existir como copia local del repositorio de documentación, para consultas cruzadas. Está ignorada por git (`.gitignore`), así que no existe en CI ni en un clon nuevo: ningún documento versionado debe enlazarla.
