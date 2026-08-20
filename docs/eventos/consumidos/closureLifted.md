# `closureLifted` ← M4

M4 levantó una clausura ya dispuesta. Tercera y última señal de cierre del expediente.

## Qué hace M6 al recibirlo

Registra el levantamiento en el [`SanctionOutcome`](../../entidades/control-ambiental.md#sanctionoutcome) y cierra el [`EnvironmentalReport`](../../entidades/environmental-report.md).

## Campos imprescindibles

| Campo | Nota |
|---|---|
| 🔴 `sourceViolationId` | El `violationId` de nuestra acta |
| `decision`, `decidedAt`, `externalRef` | Igual que las otras dos resoluciones |

## Por qué lo adoptamos

**Es una decisión nuestra, no un pedido a M4.** Este módulo tenía diseñado un `violationDismissed` que M4 nunca publicó; en vez de pedirles un evento nuevo, adoptamos la señal que ya publican.

Conviene tener claro qué cubre y qué no, porque no son sinónimos exactos:

| M4 decide | Evento | ¿Nos llega? |
|---|---|---|
| Multa | [`commercialFineGenerated`](commercialFineGenerated.md) | ✅ |
| Clausura | [`closureOrdered`](closureOrdered.md) | ✅ |
| Levantar una clausura ya dispuesta | `closureLifted` | ✅ |
| **No hacer nada** | *ningún evento* | ❌ |

**El caso "M4 decide que no corresponde castigo" no lo cubre nadie**, porque simplemente no se dispara nada. Ese caso lo cierra el **vencimiento de un plazo configurable**: pasado el plazo sin respuesta de M4, el expediente pasa a `CLOSED` sin `SanctionOutcome`.

Es menos preciso que un evento —una desestimación y una demora de M4 se ven igual— pero evita el expediente eterno y **no depende de que otro grupo agregue nada**. Ese es el argumento a favor: una dependencia menos.

Con esta decisión M4 dejó de ser bloqueante; lo único que queda con ellos es `sourceViolationId`.
