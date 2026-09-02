# `TreeIntervention` — poda, extracción, plantación, tratamiento

Qué hay que hacerle a uno o varios árboles. El **cuándo** y el **con qué cuadrilla** los pone el [`Service`](service.md) que la ejecuta: la intervención guarda la decisión, el servicio guarda la ejecución.

El árbol y su historial de relevamientos están en [inventario-urbano.md](inventario-urbano.md).

## Campos

| Entidad | Campos principales |
|---|---|
| `TreeIntervention` | `interventionType`, `treeIds[]`, `location`, `requiresStreetClosure`, `status`, `priority`, `serviceId`, y en las extracciones `authorizedByUserId`, `authorizedAt`, `justification` |

Enums: `interventionType` es `TreeInterventionType`, `status` es `TreeInterventionStatus` — ver [enumeraciones.md](../enumeraciones.md). La [divergencia 4](../enumeraciones.md#divergencias-con-el-acuerdo-publicado--resueltas) sobre `interventionType` quedó resuelta a favor del catálogo ([ADR-003](../decisiones/adr-003-divergencias-enums.md)).

## Estados

La extracción necesita autorización; el resto no.

```mermaid
stateDiagram-v2
    [*] --> REQUESTED
    REQUESTED --> PENDING_AUTHORIZATION : solo REMOVAL
    PENDING_AUTHORIZATION --> AUTHORIZED : autoriza el supervisor
    PENDING_AUTHORIZATION --> REJECTED : rechaza el supervisor
    AUTHORIZED --> [*] : se programa como Service
    REQUESTED --> [*] : el resto se programa directo
    REJECTED --> [*]
```

Los tres campos de autorización (`authorizedByUserId`, `authorizedAt`, `justification`) se llenan solo en el camino `REMOVAL`. El estado terminal no es "hecho": la intervención sale de esta máquina al programarse, y a partir de ahí el estado que importa es el del [`Service`](service.md#estados).

## Qué publica

- Al programarse la poda: [`treePruningScheduled`](../eventos/publicados/treePruningScheduled.md) → M7.
- Si `requiresStreetClosure = true`, además sale [`streetClosureRequested`](../eventos/publicados/streetClosureRequested.md) → M7, con `sourceRef` apuntando a esta intervención. M7 recibe primero el aviso de la poda y después la solicitud de corte.
