# `streetClosureEnded` ← M7

El corte de calle terminó.

> ✅ **Payload actualizado (30/08).** M7 ahora incluye `closureRequestId`, cerrando la asimetría que tenía este evento frente a `streetClosureApproved` y `streetClosureRejected`.

## Qué hace M6 al recibirlo

Libera la dependencia de la [`StreetClosureRequest`](../../entidades/derivaciones.md#streetclosurerequest--m7) y habilita la reprogramación de lo que hubiera quedado esperando.

## Payload confirmado

```
streetClosureEnded
  streetClosureId, closureRequestId, completionDateTime, notes
```

| Campo | Nota |
|---|---|
| `streetClosureId` | El identificador propio de M7 para el corte |
| ✅ `closureRequestId` | El `closureRequestId` que mandamos en [`streetClosureRequested`](../publicados/streetClosureRequested.md), de ida y vuelta. Ya no hace falta correlacionar por otra vía |
| `completionDateTime` | Cuándo terminó |

## La asimetría, ya resuelta

**Hasta el 25/08, este evento no traía el origen de la solicitud** — a diferencia de [`streetClosureApproved`](streetClosureApproved.md) y [`streetClosureRejected`](streetClosureRejected.md), que sí lo traían. Persistíamos el mapeo `streetClosureId → closureRequestId` desde el `streetClosureApproved` anterior para poder correlacionar el cierre.

**El documento de referencia nuevo de M7 (30/08) agrega `closureRequestId` directamente en `streetClosureEnded`.** Ya no necesitamos ese mapeo propio como única vía de correlación; se puede mantener como fallback, pero no es imprescindible.

## El typo, ya resuelto

**En la lista anterior de M7 figuraba como `streetClousureEnded`**, con una `u` de más. El documento de referencia (25/08) ya lo escribe bien: **`streetClosureEnded`**, coincidiendo con lo que usamos nosotros y M3.
