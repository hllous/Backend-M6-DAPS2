# `workOrderCompleted` ← M3

La reparación terminó. Es el cierre de nuestra derivación hacia Obras Públicas. **Contrato cerrado con M3 el 5 oct 2026** ([bloqueantes.md](../../bloqueantes.md#m3--obras-públicas)).

## Qué hace M6 al recibirlo

Cierra la [`RepairRequest`](../../entidades/derivaciones.md#repairrequest--m3) asociada. No esperamos `workOrderValidated`: este evento es el cierre.

No toca ningún [`Container`](../../entidades/container.md): el consumer solo actualiza la `RepairRequest`. Devolver un contenedor de `UNDER_REPAIR` a `ACTIVE` es una transición manual de su endpoint.

## Campos

| Campo | Nota |
|---|---|
| ✅ `sourceRequestId` | **Obligatorio**, uuid. Es el `requestId` de nuestro [`infrastructureRepairRequested`](../publicados/infrastructureRepairRequested.md). Confirmado (25/08) |
| `outcome` | String libre: **no lo interpretamos** (hoy tampoco lo persistimos) |
| `attachments[]` | Evidencia del trabajo, con la forma de adjunto de M2 (§5.3, v1.73): `{fileName, contentType, url, sizeBytes?}`, sin `attachmentId`. `fileName`, `contentType` y `url` obligatorios. Reemplaza al `evidence` que M3 había mandado |
| `workOrderId`, `completedAt`, `consumedMaterials` | Se toleran. No los usamos |

## Notas

**Solo para `infrastructureRepairRequested`.** M3 **no** debe emitir `workOrderCompleted` hacia M6 por [`containerDamaged`](../publicados/containerDamaged.md) ni por [`treeRiskDetected`](../publicados/treeRiskDetected.md): son avisos sin `requestId`, no abren una `RepairRequest` nuestra y no esperamos respuesta. Si llegara uno, el `sourceRequestId` no corresponde a nada y se descarta con log.

**`workOrderCreated` y `workOrderValidated` no los consumimos.**

**`workOrderUpdated` va solo hacia M2 y no lo necesitamos.** Nuestra solicitud de reparación tiene tres estados —pedida, en curso, cerrada— y con `workOrderScheduled` + este alcanza.

El nombre del evento coincide exacto de los dos lados: no hubo que renombrar nada.

## Evento tardío o repetido

Se acepta desde `REQUESTED` (cierre directo: M3 puede disparar `workOrderScheduled` al abrir o al agendar, o no llegar antes que este; ver [`workOrderScheduled`](workOrderScheduled.md)) y desde `IN_PROGRESS`. Sobre una solicitud ya `CLOSED` se descarta con un `warn`, sin error: el inbox lo responde `processed`.
