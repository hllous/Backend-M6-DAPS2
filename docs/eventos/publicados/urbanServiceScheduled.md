# `urbanServiceScheduled` → M7

Aviso de que hay trabajo agendado en la vía pública. Para M7 es informativo: sirve para que sepan que va a haber un camión circulando.

Schema: [`urbanServiceScheduled.schema.json`](urbanServiceScheduled.schema.json).

## Cuándo se dispara

Al crear el [`Service`](../../entidades/service.md) (`POST /services`), con fecha y zona. Sale siempre, tenga o no `ticketId`, y **aunque todavía no tenga cuadrilla asignada** — `crewId` es opcional al programar.

**No se reemite.** Asignar cuadrilla (`POST /services/:id/assign-crew`) o reprogramar (`reschedule` / `confirm-reschedule`) no vuelve a publicar este evento hacia M7: sale una sola vez, al crear.

**Si el servicio nació de un reclamo, agendar también le avisa a M2** ([#303](https://github.com/hllous/Backend-M6-DAPS2/issues/303)): un `updateTicketStatus` con la fecha y la franja como texto en `publicMessage` (`STARTED` la primera vez, `PROGRESS` si el ticket ya está `IN_PROGRESS`). Se publica en la misma transacción que este evento. Reprogramar sí avisa a M2, pero en `confirm-reschedule` (cuando hay fecha nueva), no en `reschedule`. Detalle en `updateTicketStatus.md`.

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
