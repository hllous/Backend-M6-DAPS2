# `urbanServiceScheduled` → M7

Aviso de que hay trabajo agendado en la vía pública. Para M7 es informativo: sirve para que sepan que va a haber un camión circulando.

Schema: [`urbanServiceScheduled.schema.json`](urbanServiceScheduled.schema.json).

## Cuándo se dispara

Al crear el [`Service`](../../entidades/service.md) (`POST /services`), con fecha y zona. Sale siempre, tenga o no `ticketId`, y **aunque todavía no tenga cuadrilla asignada** — `crewId` es opcional al programar.

**No se reemite.** Asignar cuadrilla (`POST /services/:id/assign-crew`) o reprogramar (`reschedule` / `confirm-reschedule`) no vuelve a publicar este evento: sale una sola vez, al crear.

**No dispara nada hacia M2.** A pesar de que el diseño original preveía un [`updateTicketStatus / PROGRESS`](updateTicketStatus.md) con la fecha agendada, hoy `POST /services` no proyecta nada hacia M2 — ver el bloqueante en `updateTicketStatus.md`.

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
