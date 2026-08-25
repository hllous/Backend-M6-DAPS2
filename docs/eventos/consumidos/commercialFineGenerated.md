# `commercialFineGenerated` ← M4

M4 resolvió multar al establecimiento del acta que les derivamos. Es una de las tres señales de cierre del expediente ambiental.

## Qué hace M6 al recibirlo

Registra la resolución en un [`SanctionOutcome`](../../entidades/control-ambiental.md#sanctionoutcome), pasa el [`EnvironmentalReport`](../../entidades/environmental-report.md) a `SANCTIONED` y lo cierra.

El `SanctionOutcome` es un **espejo de solo lectura**: no lo editamos, existe para poder cerrar y para mostrar en qué terminó.

## Campos imprescindibles

| Campo | Nota |
|---|---|
| ✅ `sourceViolationId` | El `violationId` que mandamos en [`environmentalViolationDetected`](../publicados/environmentalViolationDetected.md). **Confirmado (24/08)** en el payload de ejemplo. Era nuestro bloqueante principal, queda cerrado |
| `actId` | Nuevo en el documento vigente. 🟡 A confirmar si es el mismo dato que `externalRef` o dos identificadores distintos |
| `decision` | Qué resolvieron |
| ⚠️ `decidedAt` | Confirmado verbalmente (24/08) que lo reincorporan — el ejemplo publicado todavía no lo muestra |
| ⚠️ `externalRef` | Su identificador de la multa. Mismo caso que `decidedAt`: confirmado, no publicado todavía |

Nice to have: `establishmentId`, que ya tienen — lo aprovechamos, pero no reemplaza a `sourceViolationId`.

## Lo que falta confirmar

⚠️ **Sigue rotulado solo "M4 → Core → Rentas"** en su documento vigente. Falta que confirmen que **también nos lo rutean a nosotros**: sin este evento no cerramos el expediente por la vía de la multa. Ver [bloqueantes.md](../../bloqueantes.md#m4--habilitaciones--con-dos-preguntas-abiertas).

🟡 **¿`actId` es lo mismo que `externalRef`?** Si es el mismo número con otro nombre, conviene decírselo para no duplicar el campo.

## Nota de vocabulario

Lo llamábamos `commercialFineIssued`. **Adoptamos su nombre**, que es el que M5 ya consume.

Este es el camino por el que nuestra acta ambiental llega a Rentas: no les publicamos nada directo, M4 la convierte en cargo. Con M5 no tenemos integración.
