# `Container` — contenedores

Los contenedores de la vía pública, con su ciclo de desborde, daño, reparación y reubicación. Los puntos verdes de entrega voluntaria (`GreenPoint`) son otra cosa y están en [inventario-urbano.md](inventario-urbano.md).

## Campos

| Entidad | Campos principales |
|---|---|
| `Container` | `code`, `containerType`, `location`, `capacityLiters`, `zoneId`, `status`, y con el estado `DAMAGED` también `damageType`, `severity`, `requiresPublicWorks`, `damageNotes` |

Enums: `containerType` es `ContainerType`, `status` es `ContainerStatus`, `damageType` es `DamageType`, `severity` es `Severity` — ver [enumeraciones.md](../enumeraciones.md). `zoneId` → [`Zone`](configuracion-y-recursos.md#zone).

Los cuatro campos de daño se llenan solo al pasar a `DAMAGED` y se limpian al volver a `ACTIVE` (`empty`, `complete-repair` y el cierre del servicio). **`requiresPublicWorks = true` marca el componente de infraestructura civil que no nos corresponde** —la base rota, la vereda hundida— y es la señal que hace que el evento le sirva a M3.

**`damageNotes` (#453):** texto libre opcional (`observations` en `report-damage`, máx. 500, recortado) para describir el desperfecto. Es un dato **interno**: se devuelve en `ContainerResponseDto` pero **no viaja en `containerDamaged`** (ni en su payload ni en su schema).

## Estados

```mermaid
stateDiagram-v2
    [*] --> ACTIVE
    ACTIVE --> OVERFLOWED : se detecta un desborde
    OVERFLOWED --> ACTIVE : se registra el vaciado
    ACTIVE --> DAMAGED : se detecta un daño
    DAMAGED --> UNDER_REPAIR
    UNDER_REPAIR --> ACTIVE : se completa la reparación
    DAMAGED --> REMOVED : no admite reparación
    ACTIVE --> RELOCATING
    RELOCATING --> ACTIVE : nueva ubicación
    REMOVED --> [*]
```

El vaciado y la reubicación se ejecutan como [`Service`](service.md) con `mode = POINT` y `targetRef` apuntando al contenedor.

**Cerrar ese servicio *es* la transición del contenedor**, no un paso aparte: `POST /services/:id/complete` mueve los dos en la misma transacción. La transición se deriva del estado en que está el contenedor, porque es el estado el que dice qué trabajo estaba pendiente:

| Estado al cerrar | Queda | Necesita |
|---|---|---|
| `OVERFLOWED` | `ACTIVE` | nada — es el vaciado |
| `UNDER_REPAIR` | `ACTIVE` | nada — es la reparación terminada |
| `RELOCATING` | `ACTIVE` | `containerLocation` en el body: la ubicación nueva no viaja en el `Service` |
| `ACTIVE`, `DAMAGED`, `REMOVED` | sin cambio | no había trabajo pendiente que cerrar |

Un cierre `PARTIALLY_COMPLETED` no transiciona el contenedor: el trabajo no se hizo.

### Programar un vaciado o una limpieza (#453)

No hay un estado `CLEANING` ni un endpoint propio: se programa con un [`Service`](service.md) (`POST /services`) con `targetType = CONTAINER` y `targetId` = el contenedor. La zona se deriva del contenedor. El seed trae los tipos `CONT-VAC` (Vaciado de contenedor) y `CONT-LAV` (Lavado de contenedores), ambos categoría `CONTAINERS`, modo `POINT`, con vehículo.

- **Vaciado de un `OVERFLOWED`:** al completar el servicio el contenedor vuelve a `ACTIVE` (tabla de arriba) y deja su fila de historial.
- **Vaciado o lavado preventivo con el contenedor `ACTIVE`:** el servicio se planifica, asigna y cierra como cualquier otro, pero el contenedor **no cambia de estado** (no había nada pendiente). Queda registrado en el `Service`, no en el historial de estados del contenedor.
- El servicio no valida que el tipo sea de categoría `CONTAINERS` al apuntar a un contenedor.

### Quién puede cada acción

| Acción | Roles |
|---|---|
| Alta, `PATCH`, `start-repair`, `complete-repair`, `relocate`, `confirm-relocation`, `remove` | `M6_ADMIN`, `M6_OFICINA_OPERACIONES` |
| `report-overflow`, `report-damage`, `empty` | `M6_CAMPO_CUADRILLA` |
| `GET /containers`, `/:id`, `/:id/history` | cualquier rol de M6 |

No hay pertenencia: un contenedor no tiene cuadrilla dueña, así que cualquier cuadrilla puede reportar o vaciar cualquiera.

## Historial de estados (#475)

`Container` solo guarda el estado actual: cada transición pisa el anterior. Para poder contar desbordes y daños **en el tiempo** (tablero de indicadores), cada alta y cada transición deja una fila en `container_status_history`, escrita **en la misma transacción** que el cambio.

| Campo | Qué es |
|---|---|
| `containerId` | El contenedor |
| `fromStatus` | Estado de origen. **`null` en el alta y en la fila base de la migración**: esas filas sirven para reconstruir el estado y **nunca cuentan como incidente** |
| `toStatus` | Estado de destino |
| `changedAt` | Instante del cambio |

Índices: `(containerId, changedAt)` para reconstruir el último estado, y `(toStatus, changedAt)` para contar incidentes.

- **Quién lo escribe:** `ContainersService`, en las ocho acciones (`reportOverflow`, `empty`, `reportDamage`, `startRepair`, `completeRepair`, `relocate`, `confirmRelocation`, `remove`) y en el alta (`create`: origen nulo, destino `ACTIVE`). La fila va junto al `outbox` cuando lo hay (`containerDamaged`): si una falla, no queda ninguna de las dos. Se mantiene el control de concurrencia (el estado leído va en el `where` del update) y la fila se escribe solo si el update aplicó, así que un 409 no deja filas. Los endpoints no cambian: respuestas, validaciones y códigos de error son los mismos.
- **Migración** (`20261030120000_container_status_history`): crea la tabla y siembra **una fila base por contenedor existente** (origen nulo, destino su estado actual, instante de la migración). No se reconstruyen desbordes ni daños anteriores: el historial empieza el día del despliegue y antes de eso el indicador dice «sin dato» (`null`), no cero.
- **Consulta:** `GET /containers/:id/history` (paginado, del más reciente al más antiguo; 404 si el contenedor no existe) devuelve `id`, `fromStatus`, `toStatus` y `changedAt`.
- **Sin actor:** quién hizo cada cambio es el alcance de #460 y no se adelanta acá.
- **Qué se mide con esto:** incidentes de desborde (`OVERFLOWED`) y de daño (`DAMAGED`) por período, y daños pendientes (último estado `DAMAGED` o `UNDER_REPAIR`) al fin de cada período. Definiciones en [endpoints.md](../api/endpoints.md#definición-de-cada-indicador).
- **El otro camino que mueve el estado:** `POST /services/:id/complete` también lleva el contenedor a `ACTIVE` (desde `OVERFLOWED`, `UNDER_REPAIR` o `RELOCATING`) desde `ServicesService`, no desde `ContainersService`. Escribe su fila de historial en la misma transacción, con el estado leído como origen y solo si el update del contenedor aplicó. Son los únicos dos escritores de `Container.status` en `src/`; el que agregue un tercero tiene que escribir la fila también.

## Qué publica

- Al pasar a `DAMAGED`: [`containerDamaged`](../eventos/publicados/containerDamaged.md) → M3.
- Al pasar a `OVERFLOWED`: **nada sale al bus** (`containerOverflowed` está [descartado](../eventos/publicados/descartados.md)). Si el desborde lo reportó un vecino hay `ticketId` y sale un [`updateTicketStatus`](../eventos/publicados/updateTicketStatus.md) hacia M2; si lo detectamos nosotros en la recorrida, no hay reclamo al que contestarle y no sale nada.
