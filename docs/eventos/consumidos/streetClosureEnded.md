# `streetClosureEnded` ← M7

El corte de calle terminó.

## Qué hace M6 al recibirlo

Libera la dependencia de la [`StreetClosureRequest`](../../entidades/derivaciones.md#streetclosurerequest--m7) y habilita la reprogramación de lo que hubiera quedado esperando.

## Campos imprescindibles

| Campo | Nota |
|---|---|
| `sourceRequestId` | El `requestId` que mandamos |

## ⚠️ El typo

**En la lista de M7 figura como `streetClousureEnded`**, con una `u` de más. El mismo error estaba en nuestra recopilación y ya lo corregimos; **falta avisarles**.

Un nombre mal escrito en un topic es un evento que no llega: si el Core matchea el tipo como string literal, `streetClousureEnded` y `streetClosureEnded` son dos eventos distintos. Anotado en [bloqueantes.md](../../bloqueantes.md#tablero).

El nombre correcto —el que usamos y el que M3 también adoptó— es **`streetClosureEnded`**.
