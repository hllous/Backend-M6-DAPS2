# `environmentalViolationDetected` → M4

El acta de constatación ambiental derivada a Habilitaciones. Es la salida formal del tramo sancionatorio: nosotros constatamos, M4 decide la sanción.

Schema: [`environmentalViolationDetected.schema.json`](environmentalViolationDetected.schema.json).

## Cuándo se dispara

Al emitirse un [`ViolationNotice`](../../entidades/control-ambiental.md#violationnotice--el-acta). **Solo si tiene `establishmentId`**: sin establecimiento el acta no se deriva y el expediente cierra de nuestro lado.

## Payload

```
violationId, noticeNumber, issuedAt,
reportId, inspectionId, ticketId?,
violationType, severity, location,
establishmentId,
priorNoticeCount,
evidence[], suggestedAction
```

| Campo | Nota |
|---|---|
| `establishmentId` | **Obligatorio.** Es de M4, y es lo único sobre lo que pueden actuar: intimar, clausurar y multar se le aplican a un comercio habilitado |
| `priorNoticeCount` | Entero: cuántas actas previas tiene ese establecimiento en nuestro histórico. Les adelanta la reincidencia |
| `suggestedAction` | **No es vinculante.** La decisión es de M4 |
| `violationType` | Sale de nuestro catálogo y **viaja como texto** |
| `evidence[]` | Prueba documental del acta |
| `ticketId?` | Solo si el expediente nació de un reclamo |

Enums: `severity` es `Severity`, `violationType` es `ViolationType`, `suggestedAction` es `SuggestedAction` — ver [enumeraciones.md](../../enumeraciones.md).

⚠️ **`suggestedAction` está en conflicto** con el acuerdo publicado, que no incluye `FORMAL_NOTICE` ([divergencia 5](../../enumeraciones.md#divergencias-con-el-acuerdo-publicado)).

## Qué le pedimos al consumidor

🔴 **Que devuelvan `violationId` como `sourceViolationId`** en [`commercialFineGenerated`](../consumidos/commercialFineGenerated.md), [`closureOrdered`](../consumidos/closureOrdered.md) y [`closureLifted`](../consumidos/closureLifted.md). Sin ese campo no sabemos cuál de nuestras actas resolvieron y el expediente queda en `NOTICE_ISSUED` para siempre. Es un [pedido abierto](../../bloqueantes.md#tablero).

**No les pedimos un evento de desestimación.** El caso "M4 decide que no corresponde castigo" no dispara nada, ni siquiera `closureLifted`, y lo cerramos por vencimiento de un plazo configurable. Una dependencia menos.

## Nota para M1

Este evento **no** se le publica a M1. Su expediente digital recibe actuaciones de M4, M5, M7 y M8, y el hecho les llega igual —por M4, que reporta la sanción— en vez de entrarles dos veces. Falta que lo confirmen: ver [bloqueantes.md](../../bloqueantes.md#m1--ciudadanos--sin-eventos).
