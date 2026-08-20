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

**Que devuelvan `requestId` como `sourceRequestId`** en [`workOrderScheduled`](../consumidos/workOrderScheduled.md) y [`workOrderCompleted`](../consumidos/workOrderCompleted.md). Sin ese campo hay que correlacionar por dirección, que es frágil.

Sigue abierto **cuándo** dispara M3 su `workOrderScheduled`: si es recién al ponerle fecha, entre que mandamos la solicitud y ellos la agendan no tenemos ninguna señal. Ver [bloqueantes.md](../../bloqueantes.md#m3--obras-públicas--con-una-pregunta).

M3 borró de su lista el alias `urbanServiceRepairRequested`, que era el nombre del enunciado para este mismo evento.
