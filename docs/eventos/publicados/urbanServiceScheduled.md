# `urbanServiceScheduled` → M7

Aviso de que hay trabajo agendado en la vía pública. Para M7 es informativo: sirve para que sepan que va a haber un camión circulando.

Schema: [`urbanServiceScheduled.schema.json`](urbanServiceScheduled.schema.json).

## Cuándo se dispara

Al agendar un [`Service`](../../entidades/service.md) con fecha, zona y cuadrilla. Sale siempre, tenga o no `ticketId`.

Si además el servicio nació de un reclamo, el mismo hecho dispara un [`updateTicketStatus / PROGRESS`](updateTicketStatus.md) hacia M2 con la fecha agendada. Son dos eventos distintos con dos destinatarios distintos.

## Payload

```
serviceId, serviceTypeCode, category, mode,
zoneIds[], routeId?, targetRef?,
scheduledDate, timeWindow { from, to },
crewId?, vehicleId?, origin, ticketId?
```

| Campo | Nota |
|---|---|
| `zoneIds[]` | Nunca vacío: una sola zona en `POINT`, las del recorrido en `ROUTE` |
| `routeId?` | Solo en `ROUTE` |
| `targetRef?` | El bien del inventario, solo en `POINT` |
| `crewId?`, `vehicleId?` | Opcionales: la cuadrilla puede asignarse después de agendar, y el vehículo depende del `ServiceType` |
| `ticketId?` | Viaja siempre que `origin = TICKET`. Es de M2 |

Enums: `category` es `ServiceCategory`, `mode` es `ServiceMode`, `origin` es `ServiceOrigin` — ver [enumeraciones.md](../../enumeraciones.md).

✅ **`origin` conserva los cinco valores del catálogo** ([ADR-003](../../decisiones/adr-003-divergencias-enums.md), divergencia 2). Además del costo de cambiarlo, `SCHEDULED` como origen colisionaba con `SCHEDULED` como estado del servicio, y los dos viajan en este mismo payload. Pendiente de avisarle a M7.

## Qué le pedimos al consumidor

Nada. M7 no responde a este evento.
