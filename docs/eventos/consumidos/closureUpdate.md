# `closureUpdate` ← M4

M4 resolvió sobre la clausura del establecimiento del acta que les derivamos. Segunda y tercera señal de cierre del expediente, ahora en un solo evento.

> 🔄 **Cambio de forma (24/08).** En la lista anterior de M4 esto eran dos eventos separados, `closureOrdered` y `closureLifted`. En su documento vigente (`Modulo_4_Eventos.docx`) los fusionaron en uno solo, discriminado por `status`. No es un pedido nuestro — es cómo lo publican ahora, y actualizamos el lado consumidor para escucharlo así.

## Qué hace M6 al recibirlo

Depende de `status`:

| `status` | Qué hacemos |
|---|---|
| `ORDERED` | Registra el [`SanctionOutcome`](../../entidades/control-ambiental.md#sanctionoutcome) con la clausura como resolución, pasa el [`EnvironmentalReport`](../../entidades/environmental-report.md) a `SANCTIONED` y lo cierra |
| `LIFTED` | Registra el levantamiento en el `SanctionOutcome` y cierra el `EnvironmentalReport` |

⚠️ **Pendiente: un `LIFTED` posterior a un `ORDERED` ya registrado se descarta hoy.** `SanctionOutcome` es 1:1 con el acta: si el `ORDERED` ya creó el registro, el `LIFTED` que levanta esa misma clausura encuentra `sanctionOutcome` ya cargado y se descarta con log, en vez de actualizar la resolución existente.

## Campos imprescindibles

| Campo | Nota |
|---|---|
| `status` | `ORDERED` \| `LIFTED`. Discrimina cuál de los dos comportamientos aplicar |
| ✅ `sourceViolationId` | El `violationId` de nuestra acta. **Confirmado (24/08)** en el payload de ejemplo. Era nuestro bloqueante principal, queda cerrado |
| `actId` | ✅ Confirmado (21/10): es distinto de `externalRef`. Es el identificador interno del acta de M4 que fundamenta la sanción. No lo persistimos: queda como dato del evento |
| `establishmentId` | Ya lo tienen, lo aprovechamos |
| `decision` | Qué resolvieron |
| ✅ `decidedAt` | Confirmado por M4 (27/10), ya en su contrato |
| ✅ `externalRef` | La referencia administrativa visible de la clausura (se guarda en `SanctionOutcome.externalRef`). Confirmado por M4 (27/10), ya en su contrato |

## Por qué adoptamos `LIFTED` como señal de cierre

**Es una decisión nuestra, no un pedido a M4.** Este módulo tenía diseñado un `violationDismissed` que M4 nunca publicó; en vez de pedirles un evento nuevo, adoptamos la señal que ya publican.

Conviene tener claro qué cubre y qué no, porque no son sinónimos exactos:

| M4 decide | Evento | ¿Nos llega? |
|---|---|---|
| Multa | [`commercialFineGenerated`](commercialFineGenerated.md) | ✅ |
| Clausura | `closureUpdate / status: ORDERED` | ✅ |
| Levantar una clausura ya dispuesta | `closureUpdate / status: LIFTED` | ✅ |
| **No hacer nada** | *ningún evento* | ❌ |

**El caso "M4 decide que no corresponde castigo" no lo cubre nadie**, porque simplemente no se dispara nada. Ese caso lo cierra el **vencimiento de un plazo configurable**: pasado el plazo sin respuesta de M4, el expediente pasa a `CLOSED` sin `SanctionOutcome`.

Es menos preciso que un evento —una desestimación y una demora de M4 se ven igual— pero evita el expediente eterno y **no depende de que otro grupo agregue nada**. Ese es el argumento a favor: una dependencia menos.

## Ruteo y suscripción

✅ **Confirmado (21/10):** M4 nos manda `closureUpdate` cuando corresponda. Ya figura entre las 8 suscripciones del registro de #266 (`src/events/inbox/consumed-events.ts`, `src/core/core-registry.service.ts`).

Ver el resto de M4 en [m4.md](../../integracion/m4.md#acordado-el-2110).
