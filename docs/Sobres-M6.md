# Ejemplos de sobres — Módulo 6

**Ambiente, Higiene y Servicios Urbanos · Grupo 04**

Anexo del [Acuerdo de Eventos](Acuerdo-Eventos-M6.md). El Acuerdo dice **qué** campos tiene cada evento; este documento muestra **el mensaje completo**, tal como sale de M6 o tal como lo esperamos recibir, para que puedan copiarlo en sus pruebas.

| Parte | Qué hay |
|---|---|
| **1** | El sobre del Core y las reglas que M6 aplica al enviar y al recibir |
| **2** | Los 8 mensajes que **publicamos**, con un ejemplo completo cada uno |
| **3** | Los mensajes que **recibimos** (M2, M3, M4, M7), con lo que leemos de cada uno |
| **4** | Cómo respondemos a cada entrega y errores comunes |

Todos los ejemplos son del 14 de octubre de 2026 y los identificadores son inventados. Los de la Parte 2 se validan contra los `.schema.json` de M6. Los de la Parte 3 son **lo que asumimos que mandan** (el de M2, según su contrato v1.75): el payload lo define cada módulo emisor, y si el suyo difiere, avísennos.

---

# Parte 1 — El sobre

Es el sobre que M9 fijó el 7/10/2026 para toda la cohorte. Reemplaza al de M2 (`specVersion`, `producer`, `subject`).

| Campo | Tipo | Obligatorio | Qué lleva |
|---|---|---|---|
| `eventId` | string (UUID) | ✅ | Identificador único del mensaje. **Es la clave de idempotencia**: el mismo `eventId` dos veces se procesa una sola |
| `eventType` | string | ✅ | Nombre del evento en camelCase: `urbanServiceScheduled` |
| `eventVersion` | string | ✅ al publicar | `"1.0"` |
| `occurredAt` | string (ISO 8601) | ✅ | Cuándo ocurrió el hecho, **no** cuándo se publicó. Con offset; la `Z` cuenta. Se escribe con **doble r** |
| `sourceModule` | string | ✅ | Módulo emisor. El nuestro es **`ambiente`** |
| `correlationId` | string (UUID) | ✅ al publicar | El hilo del flujo entre módulos |
| `causationId` | string (UUID) | no | `eventId` del evento que causó este. **Se omite** cuando no hay causa |
| `data` | objeto | ✅ | El payload propio del evento |

## Reglas al **publicar** (somos estrictos)

- **Ningún campo fuera de esta tabla.** El Core rechaza los de más. M6 ya no manda `specVersion`, `producer` ni `subject`.
- `eventId` es el id de la fila de nuestro outbox: un reenvío por un corte sale con el mismo `eventId`.
- `correlationId` viaja siempre. Si el evento nace de una acción propia (una request HTTP, un barrido programado) abre un hilo nuevo; si nace del handler de un evento recibido, hereda el `correlationId` de ese.
- `causationId` solo aparece cuando el evento nace dentro del handler de otro que recibimos, y es el `eventId` de ese. En los demás casos la clave no está (no mandamos `null`).
- Solo propagamos UUID estrictos (versión 1-8, variante RFC). Si lo que llega no lo es, abrimos un hilo propio y el evento se procesa igual.
- `sourceModule` es `ambiente` en todos, también en `streetClosureRequested`, aunque su `data.sourceModule` valga `"M6"` (lo exige el schema acordado con M7).
- `sourceModule` es el slug del módulo en el Core (M2 §5.1): `ciudadanos` (M1), `atencion-ciudadana` (M2), `obras` (M3), `habilitaciones` (M4), `rentas` (M5), `ambiente` (M6), `transito` (M7), `desarrollo-social` (M8) y `core` (M9). Dentro de `data` los módulos siguen siendo `M1`…`M9` (`responsibleAreaId`).
- Se publica a `muni.inbox` con `persistent` y `mandatory`. La routing key es el `eventType`, pero con `fanout` no enruta nada.

## Reglas al **recibir** (somos tolerantes)

- Leemos `eventId`, `eventType` y `data`; para la traza, también `correlationId` y `sourceModule`.
- Aceptamos `eventVersion`, `occurredAt` y `causationId` (incluso `null`).
- Mientras la cohorte migra, **seguimos aceptando el sobre viejo de M2**: `specVersion`, `producer` (string u objeto `{ moduleId, service }`) y `subject`. Se guardan o se ignoran, nunca se rechazan.
- Si viene `correlationId` o `causationId`, tiene que tener forma de UUID (o `null` en `causationId`). Uno como `M6-REQ-000045` **rechaza el mensaje**.
- El Core agrega `receivedAt` al registrar el evento (según la guía de M2 v1.75, §4; falta confirmarlo con el Core). **Por el bus lo toleramos**; por `POST /events/inbox` un campo extra del sobre da 400.
- Límites: `eventId` hasta 100 caracteres, `eventType` hasta 120, mensaje hasta 100 kB. `sourceModule` solo admite letras, números, guion y guion bajo (`atencion-ciudadana` es válido).
- Un `occurredAt` presente tiene que ser ISO 8601 válido; si no, el mensaje se rechaza.

---

# Parte 2 — Lo que publicamos

Los ocho, uno por uno. `data` sigue el schema en `docs/eventos/publicados/`. Los campos de fecha (`...At`) son fecha y hora; `scheduledDate` es solo el día.

## 2.1 `updateTicketStatus` → M2

Informamos el hecho, **M2 decide el estado**. Sin `status`, sin `sourceRef`, sin `publicId`. La correlación es solo por `ticketId`. Hay una variante por `updateType`; este es un cierre (`RESOLVED`):

```json
{
  "eventId": "6f1d2a3b-4c5d-4e6f-8a9b-0c1d2e3f4a5b",
  "eventType": "updateTicketStatus",
  "eventVersion": "1.0",
  "occurredAt": "2026-10-14T15:20:00.000Z",
  "sourceModule": "ambiente",
  "correlationId": "b7a1c3d5-e2f4-4a6b-9c8d-1e3f5a7b9c0d",
  "data": {
    "ticketId": "0d9c8b7a-6f5e-4d3c-8b2a-1f0e9d8c7b6a",
    "updateType": "RESOLVED",
    "publicMessage": "Retiramos los residuos de la esquina. Gracias por avisarnos.",
    "details": {
      "resolution": { "type": "ACTION_COMPLETED" }
    },
    "attachments": [
      {
        "fileName": "trabajo-terminado.jpg",
        "contentType": "image/jpeg",
        "url": "https://files.ejemplo.test/evidencia/trabajo-terminado.jpg",
        "sizeBytes": 245123
      }
    ],
    "updatedBy": { "type": "SYSTEM", "id": null },
    "updateOccurredAt": "2026-10-14T15:20:00.000Z"
  }
}
```

Las otras variantes cambian `updateType` y `details`:

| `updateType` | `details` | Mensaje |
|---|---|---|
| `STARTED` | no lleva | `publicMessage` opcional |
| `PROGRESS` | no lleva | exige al menos uno de `progress`, `publicMessage`, `internalMessage` o `attachments` |
| `INFORMATION_REQUIRED` | `{ "informationRequest": { "messageForCitizen": "...", "requiredBy": "2026-10-20T12:00:00.000Z" } }` | `requiredBy` opcional. **Diseñado, hoy no lo emitimos** |
| `RETURNED` | `{ "returnInfo": { "reasonCode": "REQUEST_TYPE_MISMATCH" } }` | |
| `REJECTED` | `{ "cancellation": { "reasonCode": "OUT_OF_SCOPE" } }` | |

`updatedBy` es `{ "type": "EXTERNAL_USER", "id": "<id>" }` cuando actúa una persona, y `{ "type": "SYSTEM", "id": null }` cuando es automático. Los adjuntos van en el formato de M2 (`fileName`, `contentType`, `url`, `sizeBytes?`), **sin** `attachmentId`.

⚠️ **Pendiente con M2:** no hay campo para la fecha y franja agendadas de un servicio. Su paquete de schemas trae un ejemplo de `PROGRESS` con la programación como texto en `publicMessage` (`progress: 10`, sin `details`); falta que lo confirmen como la forma oficial. Hoy no las mandamos.

## 2.2 `urbanServiceScheduled` → M7

```json
{
  "eventId": "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
  "eventType": "urbanServiceScheduled",
  "eventVersion": "1.0",
  "occurredAt": "2026-10-14T13:05:10.000Z",
  "sourceModule": "ambiente",
  "correlationId": "c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f",
  "data": {
    "serviceId": "7e8f9a0b-1c2d-4e3f-a4b5-c6d7e8f9a0b1",
    "serviceTypeCode": "WASTE_COLLECTION_RESIDENTIAL",
    "category": "WASTE_COLLECTION",
    "mode": "ROUTE",
    "zoneIds": ["2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e"],
    "routeId": "3c4d5e6f-7a8b-4c9d-8e1f-2a3b4c5d6e7f",
    "scheduledDate": "2026-10-16",
    "timeWindow": { "from": "06:00", "to": "10:00" },
    "crewId": "4d5e6f7a-8b9c-4d0e-9f2a-3b4c5d6e7f80",
    "vehicleId": "5e6f7a8b-9c0d-4e1f-a03b-4c5d6e7f8091",
    "origin": "PLANNED"
  }
}
```

`mode: "POINT"` lleva `targetRef` en vez de `routeId`; `origin: "TICKET"` lleva `ticketId`. `timeWindow`, `crewId` y `vehicleId` pueden faltar.

## 2.3 `containerDamaged` → M3

```json
{
  "eventId": "a1b2c3d4-0001-4b8c-9d0e-1f2a3b4c5d01",
  "eventType": "containerDamaged",
  "eventVersion": "1.0",
  "occurredAt": "2026-10-14T11:40:00.000Z",
  "sourceModule": "ambiente",
  "correlationId": "d2e3f4a5-b6c7-4d8e-9f0a-1b2c3d4e5f60",
  "data": {
    "containerId": "8f9a0b1c-2d3e-4f4a-b5c6-d7e8f9a0b1c2",
    "containerCode": "CT-0457",
    "zoneId": "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e",
    "location": { "street": "Av. Libertador 1200", "lat": -34.5875, "lng": -58.4101 },
    "damageType": "WHEELS_BROKEN",
    "severity": "MEDIUM",
    "requiresPublicWorks": false,
    "detectedAt": "2026-10-14T11:40:00.000Z"
  }
}
```

Es un aviso: no esperamos respuesta. `damageType` viaja como texto (`STRUCTURAL`, `BURNT`, `LID_BROKEN`, `WHEELS_BROKEN`, `VANDALIZED`, `MISSING`). `ticketId` solo si lo reportó un vecino.

## 2.4 `treeRiskDetected` → M3 y M7

Solo se publica con `riskLevel` `HIGH` o `CRITICAL`.

```json
{
  "eventId": "a1b2c3d4-0002-4c9d-8e1f-2a3b4c5d6e02",
  "eventType": "treeRiskDetected",
  "eventVersion": "1.0",
  "occurredAt": "2026-10-14T09:15:00.000Z",
  "sourceModule": "ambiente",
  "correlationId": "e3f4a5b6-c7d8-4e9f-8a1b-2c3d4e5f6071",
  "data": {
    "treeId": "9a0b1c2d-3e4f-4a5b-86c7-e8f9a0b1c2d3",
    "surveyCode": "REL-2026-0132",
    "species": "Fraxinus pennsylvanica",
    "zoneId": "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e",
    "location": { "street": "Calle Mitre 845" },
    "riskLevel": "HIGH",
    "riskType": "FALLING_BRANCH",
    "healthStatus": "WEAKENED",
    "suggestedIntervention": "SAFETY_PRUNING",
    "requiresStreetClosure": true,
    "requiresPublicWorks": false,
    "surveyedAt": "2026-10-14T09:15:00.000Z"
  }
}
```

`species` y `suggestedIntervention` son opcionales (sin intervención sugerida solo corresponde monitorear). Con `requiresStreetClosure: true`, M7 recibe después un `streetClosureRequested`.

## 2.5 `treePruningScheduled` → M7

Se publica recién cuando el servicio ya tiene cuadrilla y franja horaria.

```json
{
  "eventId": "a1b2c3d4-0003-4d0e-9f2a-3b4c5d6e7f03",
  "eventType": "treePruningScheduled",
  "eventVersion": "1.0",
  "occurredAt": "2026-10-14T14:00:00.000Z",
  "sourceModule": "ambiente",
  "correlationId": "f4a5b6c7-d8e9-4f0a-9b2c-3d4e5f607182",
  "data": {
    "interventionId": "0b1c2d3e-4f5a-4b6c-97d8-f9a0b1c2d3e4",
    "serviceId": "7e8f9a0b-1c2d-4e3f-a4b5-c6d7e8f9a0b1",
    "interventionType": "SAFETY_PRUNING",
    "treeIds": ["9a0b1c2d-3e4f-4a5b-86c7-e8f9a0b1c2d3"],
    "zoneId": "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e",
    "location": { "street": "Calle Mitre 845" },
    "scheduledDate": "2026-10-20",
    "timeWindow": { "from": "08:00", "to": "12:00" },
    "crewId": "4d5e6f7a-8b9c-4d0e-9f2a-3b4c5d6e7f80",
    "requiresStreetClosure": true
  }
}
```

## 2.6 `environmentalViolationDetected` → M4

Solo se publica si el acta tiene `establishmentId`.

```json
{
  "eventId": "a1b2c3d4-0004-4e1f-a03b-4c5d6e7f8004",
  "eventType": "environmentalViolationDetected",
  "eventVersion": "1.0",
  "occurredAt": "2026-10-14T16:30:00.000Z",
  "sourceModule": "ambiente",
  "correlationId": "a5b6c7d8-e9f0-4a1b-8c3d-4e5f60718293",
  "data": {
    "violationId": "1c2d3e4f-5a6b-4c7d-88e9-a0b1c2d3e4f5",
    "noticeNumber": "ACTA-2026-00421",
    "issuedAt": "2026-10-14T16:30:00.000Z",
    "reportId": "2d3e4f5a-6b7c-4d8e-99fa-b1c2d3e4f5a6",
    "inspectionId": "3e4f5a6b-7c8d-4e9f-8a0b-c2d3e4f5a6b7",
    "ticketId": "0d9c8b7a-6f5e-4d3c-8b2a-1f0e9d8c7b6a",
    "violationType": "ILLEGAL_DUMPING",
    "severity": "HIGH",
    "location": { "street": "Av. San Martín 3300" },
    "establishmentId": "EST-004512",
    "priorNoticeCount": 1,
    "evidence": [
      {
        "url": "https://files.ejemplo.test/evidencia/acta-421-foto1.jpg",
        "mimeType": "image/jpeg",
        "description": "Residuos en la vereda"
      }
    ],
    "suggestedAction": "FORMAL_NOTICE"
  }
}
```

`suggestedAction` no es vinculante. `violationType` viaja como texto (`NOISE_LIMIT`, `ILLEGAL_DUMPING`, `UNTREATED_DISCHARGE`, `HAZARDOUS_WASTE`, `AIR_EMISSION`, `NO_WASTE_MANAGEMENT`, `INSPECTION_OBSTRUCTION`). `evidence[]` usa el formato de M6 (`url`, `mimeType`, `description?`), no el de M2. `violationId` es el que esperamos de vuelta como `sourceViolationId`.

## 2.7 `infrastructureRepairRequested` → M3

```json
{
  "eventId": "6f7a8b9c-0d1e-4f2a-b14c-5d6e7f8091a2",
  "eventType": "infrastructureRepairRequested",
  "eventVersion": "1.0",
  "occurredAt": "2026-10-14T10:10:00.000Z",
  "sourceModule": "ambiente",
  "correlationId": "b6c7d8e9-f0a1-4b2c-9d4e-5f60718293a4",
  "data": {
    "requestId": "4f5a6b7c-8d9e-4f0a-9b1c-d3e4f5a6b7c8",
    "damageType": "BLOCKED_DRAIN",
    "severity": "HIGH",
    "location": { "street": "Calle Belgrano 560" },
    "detectedIn": "7e8f9a0b-1c2d-4e3f-a4b5-c6d7e8f9a0b1",
    "publicSafetyRisk": true,
    "requestedAt": "2026-10-14T10:10:00.000Z"
  }
}
```

Abre una solicitud con seguimiento: M3 nos devuelve `requestId` como `sourceRequestId` en `workOrderScheduled` y `workOrderCompleted`. `damageType`: `BROKEN_PAVEMENT`, `BROKEN_SIDEWALK`, `BROKEN_STREETLIGHT`, `BLOCKED_DRAIN`, `DAMAGED_STRUCTURE`.

## 2.8 `streetClosureRequested` → M7

```json
{
  "eventId": "7a8b9c0d-1e2f-4a3b-925d-6e7f8091a2b3",
  "eventType": "streetClosureRequested",
  "eventVersion": "1.0",
  "occurredAt": "2026-10-14T14:05:00.000Z",
  "sourceModule": "ambiente",
  "correlationId": "c7d8e9f0-a1b2-4c3d-8e5f-60718293a4b5",
  "data": {
    "closureRequestId": "5a6b7c8d-9e0f-4a1b-8c2d-e4f5a6b7c8d9",
    "sourceModule": "M6",
    "sourceRef": "0b1c2d3e-4f5a-4b6c-97d8-f9a0b1c2d3e4",
    "reason": "Poda de seguridad de un fresno con riesgo de caída de ramas",
    "affectedSections": ["Calle Mitre entre Av. Belgrano y Calle Sarmiento"],
    "requestedFrom": "2026-10-20T08:00:00.000Z",
    "requestedTo": "2026-10-20T12:00:00.000Z",
    "closureType": "PARTIAL",
    "requestedAt": "2026-10-14T14:05:00.000Z"
  }
}
```

⚠️ **Dos `sourceModule` distintos y los dos son intencionales.** El del sobre es `ambiente` (el módulo ante el Core); el de `data` es `"M6"`, que es lo que dice la tabla de campos de M7. **M7: confirmen cuál leen.** Las respuestas nos tienen que devolver `closureRequestId`.

---

# Parte 3 — Lo que recibimos

Estos son los eventos que M6 procesa. Los sobres de los ejemplos son los del Core. El payload de cada uno **lo define el módulo emisor**: acá figura el que asumimos y cuáles campos leemos.

## 3.1 `ticketUpdated` ← M2

Es nuestro único disparador de entrada. Llega a todos los módulos: **filtramos por `responsibleAreaId`** y solo actuamos si vale `"M6"`. De los trece `updateType` actuamos sobre seis (`ROUTED`, `INFORMATION_PROVIDED`, `CANCELLED`, `REOPENED`, `PRIORITY_CHANGED`, `ESCALATION_CHANGED`); los otros siete se aceptan y no hacen nada.

```json
{
  "eventId": "8b9c0d1e-2f3a-4b4c-9d6e-7f8091a2b3c4",
  "eventType": "ticketUpdated",
  "eventVersion": "1.0",
  "occurredAt": "2026-10-13T18:42:10.000Z",
  "sourceModule": "atencion-ciudadana",
  "correlationId": "0d9c8b7a-6f5e-4d3c-8b2a-1f0e9d8c7b6a",
  "causationId": null,
  "data": {
    "ticketId": "0d9c8b7a-6f5e-4d3c-8b2a-1f0e9d8c7b6a",
    "publicId": "TK-2026-004871",
    "citizenId": "8f14e45f-ea5e-4e5d-bd3f-1c71f4f6a001",
    "isAnonymous": false,
    "responsibleAreaId": "M6",
    "updateType": "ROUTED",
    "currentStatus": "ROUTED",
    "currentPriority": "MEDIUM",
    "updatedAt": "2026-10-13T18:42:10.000Z",
    "details": {
      "routing": {
        "requestType": "Basura acumulada en la vía pública",
        "ticketType": "COMPLAINT",
        "summary": "Basura acumulada en la esquina",
        "description": "Hace tres días que no pasan a recoger los residuos de la esquina.",
        "location": {
          "addressLine": "Av. San Martín 3300",
          "street": "Av. San Martín",
          "streetNumber": "3300",
          "neighborhoodId": "d9428888-122b-4f4f-a8a4-78c1f23c6d01"
        }
      }
    }
  }
}
```

El `sourceModule` de M2 es `atencion-ciudadana`; `responsibleAreaId` va con el código `M6`. Lo que **leemos**: `ticketId` y `updateType` (obligatorios: sin ellos el mensaje se rechaza), `responsibleAreaId`, `citizenId`, `isAnonymous` y, en `ROUTED`, `details.routing` (`requestType`, `summary`, `description`, `location`). Si `details.routing` no está, caemos al nivel raíz.

Otros `updateType`, solo los campos que cambian:

| `updateType` | Exigimos |
|---|---|
| `PRIORITY_CHANGED` | `currentPriority` |
| `ESCALATION_CHANGED` | `details.escalation.active` (boolean) |
| `INFORMATION_PROVIDED` | `details.informationResponse.message` o `attachments[]` (al menos uno) |
| `CANCELLED`, `REOPENED` | solo `ticketId` y `updateType` |

**Orden:** no está garantizado. Los cambios de un mismo dato se ordenan por `occurredAt`, así que **es importante que sea el del hecho y no el de la publicación**. Un `occurredAt` más de 5 minutos en el futuro se ignora.

## 3.2 `workOrderScheduled` ← M3

```json
{
  "eventId": "9c0d1e2f-3a4b-4c5d-8e7f-8091a2b3c4d5",
  "eventType": "workOrderScheduled",
  "eventVersion": "1.0",
  "occurredAt": "2026-10-15T09:00:00.000Z",
  "sourceModule": "obras",
  "correlationId": "d8e9f0a1-b2c3-4d4e-9f6a-718293a4b5c6",
  "causationId": "6f7a8b9c-0d1e-4f2a-b14c-5d6e7f8091a2",
  "data": {
    "sourceRequestId": "4f5a6b7c-8d9e-4f0a-9b1c-d3e4f5a6b7c8",
    "workOrderId": "OT-2026-0098",
    "estimatedDuration": "PT4H"
  }
}
```

Leemos `sourceRequestId` (obligatorio, UUID: el `requestId` de nuestro `infrastructureRepairRequested`) y `workOrderId`. Pasa la solicitud a en curso.

## 3.3 `workOrderCompleted` ← M3

```json
{
  "eventId": "0d1e2f3a-4b5c-4d6e-9f8a-91a2b3c4d5e6",
  "eventType": "workOrderCompleted",
  "eventVersion": "1.0",
  "occurredAt": "2026-10-17T15:30:00.000Z",
  "sourceModule": "obras",
  "correlationId": "d8e9f0a1-b2c3-4d4e-9f6a-718293a4b5c6",
  "data": {
    "sourceRequestId": "4f5a6b7c-8d9e-4f0a-9b1c-d3e4f5a6b7c8",
    "workOrderId": "OT-2026-0098",
    "outcome": "Se destapó el sumidero y se verificó el escurrimiento",
    "completedAt": "2026-10-17T15:30:00.000Z",
    "attachments": [
      {
        "fileName": "sumidero-destapado.jpg",
        "contentType": "image/jpeg",
        "url": "https://files.ejemplo.test/obras/sumidero-destapado.jpg"
      }
    ]
  }
}
```

Leemos `sourceRequestId` (obligatorio, UUID). `outcome` y `attachments[]` no se interpretan. Solo para `infrastructureRepairRequested`: M3 **no** debe emitirlo por `containerDamaged` ni `treeRiskDetected`.

## 3.4 `commercialFineGenerated` ← M4

```json
{
  "eventId": "1e2f3a4b-5c6d-4e7f-8a9b-a2b3c4d5e6f7",
  "eventType": "commercialFineGenerated",
  "eventVersion": "1.0",
  "occurredAt": "2026-10-22T13:00:00.000Z",
  "sourceModule": "habilitaciones",
  "correlationId": "e9f0a1b2-c3d4-4e5f-8a7b-8293a4b5c6d7",
  "data": {
    "sourceViolationId": "1c2d3e4f-5a6b-4c7d-88e9-a0b1c2d3e4f5",
    "actId": "ACT-2026-1187",
    "establishmentId": "EST-004512",
    "decision": "FINE",
    "decidedAt": "2026-10-22T12:55:00.000Z",
    "externalRef": "MULTA-2026-0310"
  }
}
```

Leemos `sourceViolationId` (obligatorio, UUID: el `violationId` de nuestra acta). Registra la resolución y cierra el expediente como `SANCTIONED`. ⚠️ Falta que M4 confirme que nos rutean este evento, y si `actId` y `externalRef` son el mismo dato.

## 3.5 `closureUpdate` ← M4

```json
{
  "eventId": "2f3a4b5c-6d7e-4f8a-9b0c-b3c4d5e6f708",
  "eventType": "closureUpdate",
  "eventVersion": "1.0",
  "occurredAt": "2026-10-22T13:10:00.000Z",
  "sourceModule": "habilitaciones",
  "correlationId": "f0a1b2c3-d4e5-4f6a-9b8c-93a4b5c6d7e8",
  "data": {
    "status": "ORDERED",
    "sourceViolationId": "1c2d3e4f-5a6b-4c7d-88e9-a0b1c2d3e4f5",
    "actId": "ACT-2026-1188",
    "establishmentId": "EST-004512",
    "decision": "CLOSURE",
    "decidedAt": "2026-10-22T13:05:00.000Z",
    "externalRef": "CLAUSURA-2026-0072"
  }
}
```

`status` es `ORDERED` o `LIFTED` (obligatorio). Con `ORDERED` registramos la clausura como resolución y cerramos; con `LIFTED`, registramos el levantamiento y cerramos. Leemos además `sourceViolationId` (obligatorio, UUID).

## 3.6 `streetClosureApproved` ← M7

```json
{
  "eventId": "3a4b5c6d-7e8f-4a9b-8c1d-c4d5e6f70819",
  "eventType": "streetClosureApproved",
  "eventVersion": "1.0",
  "occurredAt": "2026-10-15T11:00:00.000Z",
  "sourceModule": "transito",
  "correlationId": "c7d8e9f0-a1b2-4c3d-8e5f-60718293a4b5",
  "causationId": "7a8b9c0d-1e2f-4a3b-925d-6e7f8091a2b3",
  "data": {
    "streetClosureId": "CL-2026-0210",
    "closureRequestId": "5a6b7c8d-9e0f-4a1b-8c2d-e4f5a6b7c8d9",
    "requestingModule": "ambiente",
    "startDate": "2026-10-20T08:00:00.000Z",
    "endDate": "2026-10-20T12:00:00.000Z",
    "affectedStreet": ["Calle Mitre entre Av. Belgrano y Calle Sarmiento"],
    "detours": [{ "street": "Calle Mitre", "alternateRoute": "Por Calle Sarmiento" }],
    "conditions": ["Señalización con conos"]
  }
}
```

Leemos `closureRequestId` (obligatorio, UUID: el `closureRequestId` que mandamos) y `streetClosureId`. No leemos `requestingModule`. Habilita el trabajo que estaba bloqueado; si la ventana autorizada difiere de la pedida, reprogramamos dentro de ella.

## 3.7 `streetClosureRejected` ← M7

```json
{
  "eventId": "4b5c6d7e-8f9a-4b0c-9d2e-d5e6f708192a",
  "eventType": "streetClosureRejected",
  "eventVersion": "1.0",
  "occurredAt": "2026-10-15T11:05:00.000Z",
  "sourceModule": "transito",
  "correlationId": "c7d8e9f0-a1b2-4c3d-8e5f-60718293a4b5",
  "data": {
    "closureRequestId": "5a6b7c8d-9e0f-4a1b-8c2d-e4f5a6b7c8d9",
    "rejectionReason": "Obra vial en la misma calle esa semana",
    "requestingModule": "ambiente"
  }
}
```

Leemos `closureRequestId` (obligatorio, UUID) y `rejectionReason` (se copia al servicio, que queda marcado para reprogramar).

## 3.8 `streetClosureEnded` ← M7

```json
{
  "eventId": "5c6d7e8f-9a0b-4c1d-8e3f-e6f708192a3b",
  "eventType": "streetClosureEnded",
  "eventVersion": "1.0",
  "occurredAt": "2026-10-20T12:15:00.000Z",
  "sourceModule": "transito",
  "correlationId": "c7d8e9f0-a1b2-4c3d-8e5f-60718293a4b5",
  "data": {
    "streetClosureId": "CL-2026-0210",
    "closureRequestId": "5a6b7c8d-9e0f-4a1b-8c2d-e4f5a6b7c8d9",
    "completionDateTime": "2026-10-20T12:10:00.000Z",
    "notes": "Corte levantado sin novedades"
  }
}
```

Leemos `closureRequestId` (obligatorio, UUID). Sin él no podemos correlacionar y el mensaje se rechaza.

## 3.9 Los que no procesamos

| Evento | Estado |
|---|---|
| `notificationSent` (M9) | Nadie lo publica en la cohorte. No tenemos handler: si llega, se acepta y se ignora |
| `weatherAlertIssued` | Simulado internamente, no lo manda ningún módulo |
| `ticketCreated` (M2) | No lo consumimos |
| `citizenUpdated`, `organizationRegistered`, `representationGranted`, `representationExpired`, `citizenInfoDelivered`, `organizationInfoDelivered` (M1) | No los consumimos. Los dos `...InfoDelivered` son respuestas a una consulta de M6 que M1 todavía no definió; y M1 sigue en el sobre viejo de M2 |

---

# Parte 4 — Cómo respondemos y errores comunes

Cada entrega por `q.ambiente` se contesta así:

| Resultado | Qué pasa | Qué hace el Core |
|---|---|---|
| Procesado, duplicado (mismo `eventId`) o ignorado (tipo sin handler) | `ack` | Nada más |
| El handler falló, o el mensaje es inválido, o pesa más de 100 kB | `nack` **sin reencolar** | Reintenta (15 s → 1 m → 5 m → 15 m) y termina en la DLQ |

- Reenviar el `eventId` de un evento **cuyo handler falló** vuelve a correr el handler. Uno ya procesado o en curso sale como duplicado.
- Un mensaje inválido no se guarda: no ocupa el `eventId` y se puede reenviar corregido con el mismo.
- Los campos extra dentro de `data` se toleran al recibir. Los del sobre se toleran por el bus (por ejemplo `receivedAt`) y se rechazan por `POST /events/inbox`.

**Errores comunes**

| Qué | Consecuencia |
|---|---|
| `occuredAt` (una sola `r`) | El Core lo rechaza o el `occurredAt` queda ausente |
| Un `eventId` repetido para eventos distintos | El segundo se descarta como duplicado |
| `correlationId` o `causationId` que no tiene forma de UUID (por ejemplo `M6-REQ-000045`) | Rechazo del mensaje |
| `correlationId` con forma de UUID pero sin versión o variante válida (por ejemplo todo ceros) | Lo aceptamos pero no lo propagamos: abrimos un hilo propio |
| Mandar `specVersion`, `producer` o `subject` | El Core lo rechaza; nosotros lo toleramos al recibir |
| Un id de correlación mal formado (`sourceRequestId`, `closureRequestId`, `sourceViolationId`) | Rechazo del mensaje |
| Un id de correlación bien formado que no es nuestro | Se descarta con log, sin error |

---

*Fuentes de este documento: los `.schema.json` de los ocho eventos de M6 y la decisión técnica ADR-007 (contrato de integración del Core, 7/10/2026). El estado de cada pedido abierto con cada módulo está en la Parte 3 del [Acuerdo de Eventos](Acuerdo-Eventos-M6.md).*
