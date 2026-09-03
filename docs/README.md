# Módulo 6 — Ambiente, Higiene y Servicios Urbanos

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
| **Zona operativa** (`Zone`) | Agrupación propia que junta uno o más barrios para armar recorridos y asignar cuadrillas. No confundir con "zona" en el sentido de M9 — ver [bloqueantes.md](bloqueantes.md) |
| **Servicio** (`Service`) | Unidad de trabajo programable: tipo, fecha, cuadrilla y estado. Puede ser `ROUTE` o `POINT`. Ver [entidades/service.md](entidades/service.md) |
| **Ticket** | El reclamo que el vecino presenta en M2, dueño del registro. Se llamaba `complaint` en los documentos viejos de este módulo — **migrado a `ticket`**, que es el nombre que usa toda la cohorte, antes de la primera entrega para no arrastrar un rename de esquema después |
| **Acta** (`ViolationNotice`) | Lo que emitimos al constatar una violación. Inmutable una vez emitida. Ver [entidades/control-ambiental.md](entidades/control-ambiental.md) |
| **Cuadrilla** (`Crew`) | Equipo de trabajo, municipal o de cooperativa, que ejecuta servicios |

## Tablero de indicadores

Cuatro familias, una por endpoint bajo `/indicators` — ver [api/endpoints.md](api/endpoints.md).

- **Cobertura**: objetivos atendidos sobre programados, por período, zona y tipo de servicio.
- **Cumplimiento**: servicios finalizados en término, demorados, y ranking de zonas no atendidas con sus motivos.
- **Incidencias**: contenedores desbordados y dañados por zona, árboles por nivel de riesgo, denuncias por tipo y estado, y tiempo medio de resolución.
- **Residuos**: kilos y metros cúbicos por tipo y destino, y porcentaje desviado a reciclaje.

**El objetivo es el par (servicio, zona), no el servicio.** Un recorrido que pasa por cuatro zonas y atiende tres son tres objetivos cumplidos y uno no; medirlo por servicio perdería justamente la zona que quedó sin atender.

## Mapa de esta carpeta

- [entidades/](entidades/) — modelo de datos y estados
- [eventos/publicados/](eventos/publicados/) — lo que este módulo emite
- [eventos/consumidos/](eventos/consumidos/) — lo que este módulo escucha
- [bloqueantes.md](bloqueantes.md) — estado vivo de la integración
- [enumeraciones.md](enumeraciones.md) — catálogo de valores cerrados
