# Eventos que publica M6

**Seis, y los seis tienen consumidor declarado.** No publicamos nada que nadie escuche.

| Evento | Va a | Se dispara cuando |
|---|---|---|
| [`updateTicketStatus`](updateTicketStatus.md) | **M2** | Cambia el estado de algo nacido de un reclamo |
| [`containerDamaged`](containerDamaged.md) | **M3** | Se detecta un contenedor dañado o faltante |
| [`treeRiskDetected`](treeRiskDetected.md) | **M3** | Un relevamiento arroja riesgo `HIGH` o `CRITICAL` |
| [`environmentalViolationDetected`](environmentalViolationDetected.md) | **M4** | Se emite un acta ambiental |
| [`infrastructureRepairRequested`](infrastructureRepairRequested.md) | **M3** | Detectamos un daño de infraestructura ajeno |
| [`streetClosureRequested`](streetClosureRequested.md) | **M7** | Un servicio o una poda requiere cortar la calle. **Es lo único que M7 consume de nosotros** |

Los nueve que se cayeron del contrato están en [descartados.md](descartados.md), con su payload ya diseñado. Los dos últimos, `urbanServiceScheduled` y `treePruningScheduled`, los dejamos de emitir el 21/10 porque M7 no los consume.

## Qué se emite hoy

**Los seis se emiten**, por el patrón outbox: el dominio encola la fila en la misma transacción que su escritura, y un dispatcher la publica.

| Evento | Estado | Dónde se dispara |
|---|---|---|
| `updateTicketStatus` | ✅ emitido | `start`, `complete` y `cancel` de un servicio con `ticketId` |
| `containerDamaged` | ✅ emitido | `POST /containers/:id/report-damage` |
| `treeRiskDetected` | ✅ emitido | un relevamiento con `riskLevel` `HIGH` o `CRITICAL` |
| `environmentalViolationDetected` | ✅ emitido | `POST /environmental-inspections/:id/violation-notice`, **solo si el acta tiene `establishmentId`** |
| `infrastructureRepairRequested` | ✅ emitido | `POST /repair-requests` |
| `streetClosureRequested` | ✅ emitido | `POST /street-closure-requests`, con `sourceModule = "M6"` |

🔴 **Sin `RABBITMQ_URL` no hay bus.** El bus es el del Core (M9): publicamos al exchange fanout `muni.inbox`, que crea el Core (la app solo verifica que exista; el fanout ignora la routing key, que igual es el nombre del evento). Sin la variable el adaptador por defecto solo deja rastro en el log, y las filas de `outbox_event` —con su payload, su `status` y su `publishedAt`— son la evidencia de qué se habría publicado. Enchufar el broker no toca el dominio. Estado del broker en [bloqueantes.md](../../bloqueantes.md).

**Si la publicación falla, la fila no se pierde ni se reintenta para siempre.** `outbox_event.attempts` cuenta los intentos y `last_error` guarda por qué falló el último; a los cinco intentos la fila pasa a `FAILED` y deja de barrerse, para que un broker caído no genere una cola infinita de reintentos. Del lado entrante, `inbox_event.error` deja el rastro: un handler que falla deja la fila **sin** `processed_at` y con el error. El reintento lo hace el Core, que reentrega con su backoff (escalones de 5 s, 30 s, 2 min y 10 min según el intento, ver [m9.md](../../integracion/m9.md)) hasta la DLQ, y reenviar el mismo `eventId` vuelve a correr el handler; ver [consumidos](../consumidos/README.md#qué-se-consume-hoy).

⚠️ **`location.neighborhoodId` viaja ausente** en `containerDamaged` y `treeRiskDetected`: es el `id` UUID del catálogo de barrios de M9, que M9 ya expone por REST (22/10, datos ficticios hasta que cargue los de CABA) pero M6 todavía no consume ([#376](https://github.com/hllous/Backend-M6-DAPS2/issues/376)). Era un campo requerido de `_shared.location` y pasó a opcional hasta la adopción. Hay que avisarle a M3.

## Los schemas

Cada evento tiene un `.schema.json` hermano: es la fuente para validar y generar tipos, no para leer. Los objetos que se repiten —`location`, `attachments[]`, `evidence[]`— están en [`_shared.schema.json`](_shared.schema.json) y se referencian con `$ref`.

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
- Los campos que terminan en `At` son fecha y hora.
- **El sobre es el del Core (M9, mensaje del 7/10/2026)** y vale para toda la cohorte: `{ eventId, eventType, eventVersion: "1.0", occurredAt, sourceModule: "ambiente", correlationId?, causationId?, data }`, sin campos extra (el Core rechaza los de más). Reemplaza al de M2: ya no mandamos `specVersion`, `producer` ni `subject`. Lo que está acá es el `data`, no el mensaje completo. El mensaje completo de cada evento, listo para copiar, está en [Sobres-M6.md](../../Sobres-M6.md).
- **Trazabilidad (#267), con la regla de M9:** `correlationId` agrupa los eventos de un mismo flujo entre módulos y se hereda; `causationId` es el `eventId` del evento que causó este. Nuestro sobre lleva **siempre** `correlationId` y lleva `causationId` **solo** cuando el evento sale de consumir otro; si no hay causa, la clave se omite (el Core la acepta ausente o `null`).
  - Evento derivado de uno consumido: hereda su `correlationId` (si no trae, su `eventId` abre el hilo) y cita su `eventId` como `causationId`. Solo se propaga la forma 8-4-4-4-12 en hex (el Core acepta cualquier UUID y lo entrega normalizado; #296); lo que generamos sigue siendo v4. Si no tiene esa forma, el hilo arranca en M6 sin causa, y el evento consumido se procesa igual.
  - Acción directa (un endpoint): **un hilo por request HTTP**. Todo lo que encola un mismo request comparte `correlationId`, aunque salga de transacciones o `enqueue` distintos (por ejemplo, el acta hacia M4 y su `updateTicketStatus` hacia M2).
  - Barridos `@Interval`/`@Cron`: cada `enqueue`/`enqueueMany` abre un hilo propio.
  - Código en `src/events/event-context.ts` (AsyncLocalStorage), `EventTraceInterceptor` e `InboxService.ingest`.

**Quién genera cada identificador:**

| Dueño | IDs |
|---|---|
| M6 | `serviceId`, `inspectionId`, `reportId`, `violationId`, `requestId`, `interventionId`, `containerId`, `treeId`, `zoneId`, `crewId`, `vehicleId` |
| M2 | `ticketId`, `publicId` |
| M4 | `establishmentId` |
| M9 | `neighborhoodId` |
| M1 | `citizenId`, `organizationId` |
