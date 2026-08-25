# `streetClosureEnded` ← M7

El corte de calle terminó.

> ✅ **Typo corregido (25/08).** El documento nuevo de M7 ya escribe `streetClosureEnded` bien — ver más abajo.

## Qué hace M6 al recibirlo

Libera la dependencia de la [`StreetClosureRequest`](../../entidades/derivaciones.md#streetclosurerequest--m7) y habilita la reprogramación de lo que hubiera quedado esperando.

## Payload confirmado

```
streetClosureEnded
  streetClosureId, completionDateTime, notes
```

| Campo | Nota |
|---|---|
| `streetClosureId` | El identificador propio de M7 para el corte |
| `completionDateTime` | Cuándo terminó |

## ⚠️ La asimetría: no trae el origen

**A diferencia de [`streetClosureApproved`](streetClosureApproved.md) y [`streetClosureRejected`](streetClosureRejected.md), este evento no trae `closureRequestId` ni `requestingModule`.** Solo `streetClosureId`.

Para poder correlacionar el cierre con nuestra `StreetClosureRequest`, **persistimos el origen desde el `streetClosureApproved` anterior** — cuando llega la aprobación, guardamos `streetClosureId → closureRequestId` en una tabla propia, y usamos ese mapeo cuando llega el `streetClosureEnded`. No es algo que se le pueda pedir a M7: es una asimetría del payload que resolvemos de nuestro lado.

## El typo, ya resuelto

**En la lista anterior de M7 figuraba como `streetClousureEnded`**, con una `u` de más. El mismo error estaba en nuestra recopilación. El documento de referencia nuevo (25/08) ya lo escribe bien: **`streetClosureEnded`**, coincidiendo con lo que usamos nosotros y M3.

Un nombre mal escrito en un topic es un evento que no llega: si el Core matchea el tipo como string literal, `streetClousureEnded` y `streetClosureEnded` son dos eventos distintos. Ver [bloqueantes.md](../../bloqueantes.md#m7--tránsito-).
