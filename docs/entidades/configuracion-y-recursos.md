# Configuración y recursos

Los catálogos sobre los que se programa un [`Service`](service.md) y los recursos que lo ejecutan. Ninguna de estas entidades tiene máquina de estados propia: `status` acá es alta/baja, no un ciclo de vida.

## Configuración y planificación

| Entidad | Campos principales |
|---|---|
| `ServiceType` | `code`, `name`, `category`, `mode`, `requiresVehicle` |
| `Zone` | Zona **operativa** propia. `code`, `name`, `neighborhoodIds[]`, `status` |
| `Route` | `code`, `name`, y la secuencia de `RouteStop` (`sequence`, `zoneId`, `estimatedDurationMin`) |
| `ServiceFrequency` | `serviceTypeId`, `routeId`, `weekdays[]`, `shift`, `validFrom`, `validTo` |

Enums: `category` es `ServiceCategory`, `mode` es `ServiceMode`, `shift` es `Shift` — ver [enumeraciones.md](../enumeraciones.md).

### `ServiceType`

Define de qué tipo puede ser un servicio y en qué modo se ejecuta. `requiresVehicle` decide si la programación exige asignar un [`Vehicle`](#vehicle).

### `Zone`

**Zona operativa nuestra**: agrupa uno o más barrios (`neighborhoodIds[]`, del catálogo de M9) para armar recorridos y asignar cuadrillas. No es la "zona" de M9 — es el mismo sustantivo para dos cosas distintas, y está sin resolver: ver [bloqueantes.md](../bloqueantes.md#m9--core-). Si M9 se queda con la palabra, renombramos la nuestra.

`neighborhoodId` depende del catálogo de barrios que M9 todavía no expuso, que es también lo que bloquea el ruteo de los reclamos de M2.

### `Route`

Secuencia ordenada de zonas. Un `Service` con `mode = ROUTE` copia `zoneIds[]` del recorrido **al programarse y no lo recalcula**: editar un `Route` no altera lo ya ejecutado.

### `ServiceFrequency`

La regla que genera los servicios planificados (`origin = PLANNED`), del tipo "recolección domiciliaria en la ruta R-03, martes y viernes, turno mañana". Estos servicios **no tienen `ticketId` y no proyectan nada hacia M2**.

## Recursos

| Entidad | Campos principales |
|---|---|
| `Crew` | `name`, `crewType`, `leaderUserId`, `memberUserIds[]`, `organizationId`, `defaultShift`, `status` |
| `Vehicle` | `plate`, `vehicleType`, `capacity`, `status` |

Enums: `crewType` es `CrewType`, `vehicleType` es `VehicleType`, `defaultShift` es `Shift` — ver [enumeraciones.md](../enumeraciones.md).

### `Crew`

Equipo de trabajo, municipal o de cooperativa. `organizationId` es de M1: **las cooperativas existen acá como cuadrillas, no como beneficiarias de un programa social** — su registro como organización es de M1, no de M8. Para mostrar el nombre de la cooperativa en pantalla hace falta la consulta REST a M1, que sigue [pendiente de confirmar](../bloqueantes.md#m1--ciudadanos--sin-eventos).

`leaderUserId` y `memberUserIds[]` son usuarios de **M1**, que es quien los gestiona y emite el JWT. No los replicamos: guardamos el id y nada más.

### `Vehicle`

Camión, barredora, tanque o grúa. Se asigna al `Service` cuando el `ServiceType` lo exige.
