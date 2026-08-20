# Control ambiental — inspección, acta y resolución

Las tres entidades del tramo sancionatorio, aguas abajo del [`EnvironmentalReport`](environmental-report.md): qué encontró el inspector, qué constatamos formalmente y qué resolvió M4.

| Entidad | Campos principales |
|---|---|
| `EnvironmentalInspection` | `reportId`, `serviceId`, `inspectorId`, `inspectedAt`, `checklist[]`, `findings`, `attachments[]`, `outcome` |
| `ViolationNotice` | El acta. `noticeNumber`, `inspectionId`, `issuedAt`, `establishmentId`, `violationType`, `severity`, `suggestedAction`. **Inmutable** |
| `SanctionOutcome` | La resolución de M4, espejada de solo lectura para poder cerrar el expediente. `violationNoticeId`, `decision`, `decidedAt`, `externalRef`, `dismissalReason` |

Enums: `outcome` es `InspectionOutcome`, `violationType` es `ViolationType`, `severity` es `Severity`, `suggestedAction` es `SuggestedAction`, `decision` es `SanctionDecision` — ver [enumeraciones.md](../enumeraciones.md).

## `EnvironmentalInspection`

La inspección se **ejecuta como un [`Service`](service.md)**: `serviceId` dice cuándo se hizo y con qué cuadrilla, la inspección dice qué se buscó y qué se encontró. Es el mismo patrón que [`TreeIntervention`](tree-intervention.md).

`checklist[]`, `findings` e `inspectorId` son internos: **nunca salen hacia M2**. Lo que el vecino ve es la proyección pública, sin identidad del inspector ni contenido del acta.

## `ViolationNotice` — el acta

**Inmutable una vez emitida.** Es un acto administrativo formal: si hay un error, se emite otra, no se corrige esta.

**`establishmentId` es obligatorio.** Intimar, clausurar y multar se le aplican a un comercio habilitado, que es lo único sobre lo que M4 puede actuar: un acta sin establecimiento no les sirve. Si no identificamos el establecimiento **no derivamos el acta** y el expediente cierra de nuestro lado. Para completarlo antes de emitir necesitamos la búsqueda REST de establecimiento de M4, [pendiente](../bloqueantes.md#m4--habilitaciones-).

`suggestedAction` **no es vinculante**: la decisión es de M4.

Al emitirse sale [`environmentalViolationDetected`](../eventos/publicados/environmentalViolationDetected.md) → M4, con `priorNoticeCount` —cuántas actas previas tiene ese mismo establecimiento en nuestro histórico— para adelantarles la reincidencia.

## `SanctionOutcome`

**Espejo de solo lectura de lo que decidió M4.** No lo editamos: existe para poder cerrar el expediente y para mostrar en qué terminó.

Se llena al recibir [`commercialFineGenerated`](../eventos/consumidos/commercialFineGenerated.md), [`closureOrdered`](../eventos/consumidos/closureOrdered.md) o [`closureLifted`](../eventos/consumidos/closureLifted.md). Los tres tienen que traer `sourceViolationId` —el `violationId` que mandamos en el acta— y **eso es lo que hoy no devuelven**: sin ese campo no sabemos cuál de nuestras actas resolvieron y el expediente queda en `NOTICE_ISSUED` para siempre. Es uno de los [pedidos abiertos](../bloqueantes.md#tablero).

`dismissalReason` no llega por evento: **M4 no publica nada cuando decide que no corresponde castigo.** Ese caso se cierra por vencimiento de plazo, sin `SanctionOutcome` — ver [`EnvironmentalReport`](environmental-report.md#estados).
