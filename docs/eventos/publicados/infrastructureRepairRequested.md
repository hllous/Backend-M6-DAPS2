# `infrastructureRepairRequested` → M3

Un daño de infraestructura que detectamos pero que no nos corresponde arreglar: pavimento roto, vereda hundida, luminaria caída, sumidero tapado.

Schema: [`infrastructureRepairRequested.schema.json`](infrastructureRepairRequested.schema.json).

## Cuándo se dispara

Al crear una [`RepairRequest`](../../entidades/derivaciones.md#repairrequest--m3), sea desde un servicio en campo o desde una inspección.

## Payload

```
requestId, damageType, severity, location,
detectedIn, ticketId?,
publicSafetyRisk, requestedAt
```

| Campo | Nota |
|---|---|
| `requestId` | Nuestro. **Es el que le pedimos a M3 que devuelva** |
| `detectedIn` | El `serviceId` o `inspectionId` nuestro que originó la detección |
| `publicSafetyRisk` | Booleano: marca lo que no puede esperar |
| `ticketId?` | Solo si el daño lo reportó un vecino |

Enums: `damageType` es `RepairDamageType`, `severity` es `Severity` — ver [enumeraciones.md](../../enumeraciones.md).

## Qué le pedimos al consumidor

**Que devuelvan `requestId` como `sourceRequestId`** (uuid, obligatorio) en [`workOrderScheduled`](../consumidos/workOrderScheduled.md) y [`workOrderCompleted`](../consumidos/workOrderCompleted.md). Es el único de los tres eventos hacia M3 con respuesta: la `RepairRequest` se cierra con `workOrderCompleted`, sin esperar `workOrderValidated`. Cuándo dispara M3 su `workOrderScheduled` (al abrir o al agendar) no nos cambia nada: cerrado el 5 oct 2026, ver [bloqueantes.md](../../bloqueantes.md#m3--obras-públicas).

`ticketId` (opcional) es el nombre que usa la cohorte; M3 lo llamaba `complaintId`.

El alias `urbanServiceRepairRequested` está descartado: el nombre del evento es solo `infrastructureRepairRequested`.
