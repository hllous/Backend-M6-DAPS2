# `commercialFineGenerated` ← M4

M4 resolvió multar al establecimiento del acta que les derivamos. Es una de las tres señales de cierre del expediente ambiental.

## Qué hace M6 al recibirlo

Registra la resolución en un [`SanctionOutcome`](../../entidades/control-ambiental.md#sanctionoutcome), pasa el [`EnvironmentalReport`](../../entidades/environmental-report.md) a `SANCTIONED` y lo cierra.

El `SanctionOutcome` es un **espejo de solo lectura**: no lo editamos, existe para poder cerrar y para mostrar en qué terminó.

## Campos imprescindibles

| Campo | Nota |
|---|---|
| ✅ `sourceViolationId` | El `violationId` que mandamos en [`environmentalViolationDetected`](../publicados/environmentalViolationDetected.md). **Confirmado (24/08)** en el payload de ejemplo. Era nuestro bloqueante principal, queda cerrado |
| `actId` | ✅ Confirmado (21/10): es distinto de `externalRef`. Es el identificador interno del acta de M4 que fundamenta la sanción. No lo persistimos: queda como dato del evento |
| `decision` | Qué resolvieron |
| ✅ `decidedAt` | Confirmado por M4 (27/10), ya en su contrato. Opcional: M4 lo envía al formalizar la decisión |
| ✅ `externalRef` | La referencia administrativa visible de la resolución, disposición o multa (es lo que guardamos en `SanctionOutcome.externalRef`). Confirmado por M4 (27/10), ya en su contrato. Opcional: M4 lo envía al formalizar la decisión |

Nice to have: `establishmentId`, que ya tienen — lo aprovechamos, pero no reemplaza a `sourceViolationId`.

## Ruteo y suscripción

✅ **Confirmado (21/10):** M4 lo manda además a Rentas cuando la multa se origina en una infracción ambiental. Hay que estar suscripto en el Core: `commercialFineGenerated` ya figura entre las 8 suscripciones del registro de #266 (`ConsumedEvent` en `src/events/inbox/consumed-events.ts`, consumido por `src/core/core-registry.service.ts`). Ver [m4.md](../../integracion/m4.md#acordado-el-2110).

## Nota de vocabulario

Lo llamábamos `commercialFineIssued`. **Adoptamos su nombre**, que es el que M5 ya consume.

Este es el camino por el que nuestra acta ambiental llega a Rentas: no les publicamos nada directo, M4 la convierte en cargo. Con M5 no tenemos integración.
