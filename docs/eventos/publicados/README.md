# Eventos que publica M6

**Ocho, y los ocho tienen consumidor declarado.** No publicamos nada que nadie escuche.

| Evento | Va a | Se dispara cuando |
|---|---|---|
| [`updateTicketStatus`](updateTicketStatus.md) | **M2** | Cambia el estado de algo nacido de un reclamo |
| [`urbanServiceScheduled`](urbanServiceScheduled.md) | **M7** | Se agenda un servicio |
| [`containerDamaged`](containerDamaged.md) | **M3** | Se detecta un contenedor dañado o faltante |
| [`treeRiskDetected`](treeRiskDetected.md) | **M3**, **M7** | Un relevamiento arroja riesgo `HIGH` o `CRITICAL` |
| [`treePruningScheduled`](treePruningScheduled.md) | **M7** | Se programa una poda |
| [`environmentalViolationDetected`](environmentalViolationDetected.md) | **M4** | Se emite un acta ambiental |
| [`infrastructureRepairRequested`](infrastructureRepairRequested.md) | **M3** | Detectamos un daño de infraestructura ajeno |
| [`streetClosureRequested`](streetClosureRequested.md) | **M7** | Un servicio o intervención requiere cortar la calle |

Los siete que se cayeron del contrato están en [descartados.md](descartados.md), con su payload ya diseñado.

## Qué se emite hoy

**Los ocho se emiten**, por el patrón outbox: el dominio encola la fila en la misma transacción que su escritura, y un dispatcher la publica.

| Evento | Estado | Dónde se dispara |
|---|---|---|
| `urbanServiceScheduled` | ✅ emitido | `POST /services` |
| `updateTicketStatus` | ✅ emitido | `start`, `complete` y `cancel` de un servicio con `ticketId` |
| `containerDamaged` | ✅ emitido | `POST /containers/:id/report-damage` |
| `treeRiskDetected` | ✅ emitido | un relevamiento con `riskLevel` `HIGH` o `CRITICAL` |
| `treePruningScheduled` | ⚠️ emitido, con reserva | `POST /tree-interventions/:id/assign-service`, **solo si el servicio ya tiene cuadrilla y franja horaria**: M7 los declara requeridos y en nuestro modelo son opcionales. Si faltan, el evento se difiere y queda un warning en el log |
| `environmentalViolationDetected` | ✅ emitido | `POST /environmental-inspections/:id/violation-notice`, **solo si el acta tiene `establishmentId`** |
| `infrastructureRepairRequested` | ✅ emitido | `POST /repair-requests` |
| `streetClosureRequested` | ✅ emitido | `POST /street-closure-requests`, con `sourceModule = "M6"` |

🔴 **No hay bus.** M9 nunca expuso un Kafka, así que sin `KAFKA_BROKERS` configurado el adaptador por defecto solo deja rastro en el log. Las filas de `outbox_event` —con su payload, su `status` y su `publishedAt`— son la evidencia de qué se habría publicado. Enchufar el broker no toca el dominio.

⚠️ **`location.neighborhoodId` viaja ausente** en `containerDamaged`, `treeRiskDetected` y `treePruningScheduled`: sale del catálogo de barrios de M9, que sigue sin exponerse. Era un campo requerido de `_shared.location` y pasó a opcional hasta que exista. Hay que avisarle a M3 y M7.

## Los schemas

Cada evento tiene un `.schema.json` hermano: es la fuente para validar y generar tipos, no para leer. Los objetos que se repiten —`location`, `timeWindow`, `attachments[]`, `evidence[]`— están en [`_shared.schema.json`](_shared.schema.json) y se referencian con `$ref`.

✅ **Los cinco enums que estaban en conflicto** entre el catálogo de [enumeraciones.md](../../enumeraciones.md) y el [acuerdo que ya circuló](../../Acuerdo-Eventos-M6.md) quedaron resueltos por [ADR-003](../../decisiones/adr-003-divergencias-enums.md): manda el catálogo y se corrige el acuerdo. Falta avisarle a M3, M4 y M7 — ver [bloqueantes.md](../../bloqueantes.md).

## Qué pedimos de vuelta

| A quién | Qué | Para qué |
|---|---|---|
| M3 | `sourceRequestId` | Correlacionar la reparación con nuestra `RepairRequest` |
| M4 | `sourceViolationId` | Saber cuál de nuestras actas resolvieron |
| M7 | ✅ `closureRequestId` + `requestingModule` | Saber cuál de nuestras solicitudes de corte contestaron — devuelto en los tres eventos desde el 25/08 |

M3 y M4 siguen abiertos: ver [bloqueantes.md](../../bloqueantes.md#tablero).

## Convenciones

- Nombres de evento y de campo en **camelCase**.
- `?` es opcional o puede venir en nulo, `[]` es lista, `{ }` es un objeto anidado.
- Los campos que terminan en `At` son fecha y hora; `scheduledDate` es solo el día y la franja la da `timeWindow`.
- **El sobre lo define M9**, y todavía no lo hizo. Lo que está acá es el `data`, no el mensaje completo.

**Quién genera cada identificador:**

| Dueño | IDs |
|---|---|
| M6 | `serviceId`, `inspectionId`, `reportId`, `violationId`, `requestId`, `interventionId`, `containerId`, `treeId`, `zoneId`, `crewId`, `vehicleId` |
| M2 | `ticketId`, `publicId` |
| M4 | `establishmentId` |
| M9 | `neighborhoodId` |
| M1 | `citizenId`, `organizationId` |
