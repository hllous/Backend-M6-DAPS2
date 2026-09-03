# `closureOrdered` ← M4

> **Reemplazado el 24/08/2026.** M4 fusionó `closureOrdered` y `closureLifted` en un evento único, [`closureUpdate`](closureUpdate.md) con `status: ORDERED | LIFTED`. Este archivo queda como registro de lo que se acordó antes; **el handler implementado es el de `closureUpdate`**.

M4 resolvió clausurar el establecimiento del acta que les derivamos. Segunda de las tres señales de cierre.

## Qué hace M6 al recibirlo

Igual que [`commercialFineGenerated`](commercialFineGenerated.md): registra el [`SanctionOutcome`](../../entidades/control-ambiental.md#sanctionoutcome) con la clausura como resolución, pasa el [`EnvironmentalReport`](../../entidades/environmental-report.md) a `SANCTIONED` y lo cierra.

## Campos imprescindibles

| Campo | Nota |
|---|---|
| 🔴 `sourceViolationId` | El `violationId` de nuestra acta |
| `decision` | Qué resolvieron |
| `decidedAt` | Cuándo |
| `externalRef` | Su identificador de la clausura |

## Notas

El nombre coincide exacto de los dos lados y lo consumimos tal cual.

Sigue faltando `sourceViolationId`, que es el mismo pedido que en los otros dos eventos de M4: ver [bloqueantes.md](../../bloqueantes.md#tablero).
