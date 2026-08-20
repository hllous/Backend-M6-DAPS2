# Los siete que no publicamos

Estos hechos **existen en nuestro modelo** y son los que disparan cada [`updateTicketStatus`](updateTicketStatus.md), pero no salen al bus.

## Por qué se cayeron

Estaban en el contrato porque se los ofrecíamos a M2 como detalle del avance de un reclamo. **Cuando M2 definió que todo lo suyo entra por `updateTicketStatus`, los siete se quedaron sin ningún consumidor.** Un evento que nadie escucha es schema, publisher, test y documentación para nadie.

Eran quince eventos publicados; quedaron ocho, y los ocho tienen consumidor declarado.

**El dato no se pierde.** El contrato v1.2 de M2 hace viajar lo importante: la fecha agendada como `progress.estimatedCompletionAt`, el cierre como `resolution.publicMessage`, la evidencia como `attachments[]`. Lo que queda afuera son nuestros identificadores internos, que el propio contrato de M2 prohíbe transportar.

**Si alguno hace falta, se pide y se publica.** El payload ya está diseñado y no hay que rediseñar nada. Lo que no hacemos es publicarlo por las dudas.

No llevan `.schema.json`: no se publican, no hay nada que validar todavía.

## Los payloads

### `urbanServiceStarted`

```
serviceId, serviceTypeCode, mode,
startedAt, crewId, zoneIds[]
```

Dispara `updateTicketStatus / STARTED`.

### `urbanServiceDelayed`

```
serviceId, delayType, delayMinutes,
reason, newEstimatedEnd, detectedAt
```

Se publicaría **una sola vez por servicio**. `DELAYED` no es un estado: el servicio sigue en `SCHEDULED` o `IN_PROGRESS`. `delayType` es `DelayType` — ver [enumeraciones.md](../../enumeraciones.md).

Dispara `updateTicketStatus / PROGRESS` con la nueva estimación.

### `urbanServiceCompleted`

```
serviceId, serviceTypeCode, mode, outcome,
startedAt, completedAt,
zoneResults[] { zoneId, status, reason? },
collection? { wasteType, volumeM3, weightKg, disposalSiteId },
attachments[], notes?, ticketId?
```

`zoneResults[]` solo en `mode = ROUTE`; `collection` solo en los servicios de recolección.

Dispara `updateTicketStatus / RESOLVED`.

### `zoneNotServiced`

```
serviceId, zoneId, neighborhoodIds[],
reason, notes?, proposedDate?, recordedAt
```

`neighborhoodIds[]` iba explícito para que M2 pudiera ubicar a los vecinos afectados sin conocer nuestras zonas. `reason` es `NotServicedReason`.

**No tiene traducción uno a uno**: una zona sin atender no es un reclamo, son *n*. Lo que sale es un `updateTicketStatus / PROGRESS` **por cada reclamo abierto de esa zona** — el abanico lo abrimos nosotros.

### `containerOverflowed`

```
containerId, containerCode, containerType,
zoneId, location,
detectedAt, ticketId?
```

Depende del origen: si el desborde lo reportó un vecino hay `ticketId` y sale el `updateTicketStatus`; si lo detectamos en la recorrida, no hay reclamo al que contestarle y hacia M2 no sale nada.

### `environmentalInspectionScheduled`

```
inspectionId, serviceId, reportId, ticketId?,
reportType, zoneId, location,
scheduledDate, timeWindow { from, to }
```

Dispara `updateTicketStatus / STARTED`.

### `environmentalInspectionCompleted`

```
inspectionId, reportId, ticketId?,
inspectedAt, outcome, publicSummary, nextStep
```

Dispara `RESOLVED` si no hubo irregularidad, o `PROGRESS` si se emitió acta —el caso sigue en M4—. `outcome` es `InspectionOutcome`, `nextStep` es `InspectionNextStep`.

Los dos de inspección llevan la **proyección pública**: sin identidad del inspector, checklist, hallazgos internos ni contenido del acta. `publicSummary` es el texto que lee el vecino y `nextStep` dice qué sigue —acta, reinspección o cierre— sin adelantar la sanción.

## Otros cuatro que nunca estuvieron

Descartados por diseño, no por falta de consumidor:

| Evento | Por qué no |
|---|---|
| `environmentalFineIssued` | No generamos cargos económicos. Nuestra acta llega a M5 a través de M4, convertida en `commercialFineGenerated` |
| `environmentalReportCreated` | El dueño de la denuncia es M2; que abramos un expediente interno no le agrega nada |
| `citizenNotificationRequested` | Las notificaciones las resuelve M9, y todavía falta definir qué las dispara |
| Evento genérico de riesgo con `hazardType` | M3 aceptó [`treeRiskDetected`](treeRiskDetected.md) tal cual, así que no hizo falta |
