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

## Los schemas

Cada evento tiene un `.schema.json` hermano: es la fuente para validar y generar tipos, no para leer. Los objetos que se repiten —`location`, `timeWindow`, `attachments[]`, `evidence[]`— están en [`_shared.schema.json`](_shared.schema.json) y se referencian con `$ref`.

⚠️ **Cinco enums que salen al bus están en conflicto** entre el catálogo de [enumeraciones.md](../../enumeraciones.md) y el [acuerdo que ya circuló](../../../Acuerdo-Eventos-M6.md). Los schemas siguen el catálogo y lo marcan en la `description` del campo. Hay que resolverlo antes de implementar: ver [las divergencias](../../enumeraciones.md#divergencias-con-el-acuerdo-publicado).

## Qué pedimos de vuelta

| A quién | Qué | Para qué |
|---|---|---|
| M3 | `sourceRequestId` | Correlacionar la reparación con nuestra `RepairRequest` |
| M4 | `sourceViolationId` | Saber cuál de nuestras actas resolvieron |
| M7 | `sourceRequestId` + `sourceModule` | Saber cuál de nuestras solicitudes de corte contestaron |

Los tres siguen abiertos: ver [bloqueantes.md](../../bloqueantes.md#tablero).

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
