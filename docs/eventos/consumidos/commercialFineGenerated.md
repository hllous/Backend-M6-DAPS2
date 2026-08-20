# `commercialFineGenerated` ← M4

M4 resolvió multar al establecimiento del acta que les derivamos. Es una de las tres señales de cierre del expediente ambiental.

## Qué hace M6 al recibirlo

Registra la resolución en un [`SanctionOutcome`](../../entidades/control-ambiental.md#sanctionoutcome), pasa el [`EnvironmentalReport`](../../entidades/environmental-report.md) a `SANCTIONED` y lo cierra.

El `SanctionOutcome` es un **espejo de solo lectura**: no lo editamos, existe para poder cerrar y para mostrar en qué terminó.

## Campos imprescindibles

| Campo | Nota |
|---|---|
| 🔴 `sourceViolationId` | El `violationId` que mandamos en [`environmentalViolationDetected`](../publicados/environmentalViolationDetected.md). **Sin él el expediente queda en `NOTICE_ISSUED` para siempre** |
| `decision` | Qué resolvieron |
| `decidedAt` | Cuándo |
| `externalRef` | Su identificador de la multa, para poder referenciarla |

Nice to have: `establishmentId`, que ya tienen — lo aprovechamos, pero no reemplaza a `sourceViolationId`.

## Lo que falta confirmar

⚠️ **Está rotulado solo "(rentas)".** En su lista figura dirigido a M5, que lo consume como cargo. Falta que confirmen que **también nos lo rutean a nosotros**: sin este evento no cerramos el expediente. Ver [bloqueantes.md](../../bloqueantes.md#m4--habilitaciones-).

## Nota de vocabulario

Lo llamábamos `commercialFineIssued`. **Adoptamos su nombre**, que es el que M5 ya consume.

Este es el camino por el que nuestra acta ambiental llega a Rentas: no les publicamos nada directo, M4 la convierte en cargo. Con M5 no tenemos integración.
