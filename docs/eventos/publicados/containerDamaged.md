# `containerDamaged` → M3

Un contenedor dañado o faltante. Le sirve a M3 cuando el arreglo incluye un componente de infraestructura civil que no nos corresponde.

Schema: [`containerDamaged.schema.json`](containerDamaged.schema.json).

## Cuándo se dispara

Al pasar un [`Container`](../../entidades/container.md) al estado `DAMAGED`, sea por reporte de un vecino o por detección propia en la recorrida.

El desborde (`OVERFLOWED`) **no** publica nada: `containerOverflowed` está [descartado](descartados.md).

## Payload

```
containerId, containerCode, zoneId, location,
damageType, severity, requiresPublicWorks,
detectedAt, ticketId?
```

| Campo | Nota |
|---|---|
| `requiresPublicWorks` | Booleano. **En `true` el arreglo le corresponde a M3**: es la señal que hace accionable el evento |
| `damageType` | Sale de nuestro catálogo y **viaja como texto**: M3 no tiene por qué validar contra un enum nuestro |
| `location` | Con `neighborhoodId` del catálogo de M9 |
| `ticketId?` | Solo si el daño lo reportó un vecino |

Enums: `severity` es `Severity`, `damageType` es `DamageType` — ver [enumeraciones.md](../../enumeraciones.md).

## Qué le pedimos al consumidor

Es un aviso: no lleva `requestId`, no abre una `RepairRequest` nuestra y **no esperamos respuesta**. M3 correlaciona por `containerId` y **no debe emitir `workOrderCompleted` hacia M6** para este caso; el pedido de correlación aplica a [`infrastructureRepairRequested`](infrastructureRepairRequested.md), que sí es una derivación con seguimiento.

Se emite con `requiresPublicWorks` en `true` o en `false`; M3 procesa solo los `true`.

`ticketId` (opcional) es el nombre que usa la cohorte; M3 lo llamaba `complaintId`.
