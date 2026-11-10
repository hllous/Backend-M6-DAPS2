# ADR-014: Patrón State: máquinas de estado como tablas de transiciones

## Estado

**Aceptado** — 2026-11-10

## Contexto

Servicio, contenedor, intervención de arbolado, expediente ambiental, solicitudes derivadas y eventos del outbox tienen ciclo de vida con estados cerrados. Un `if` suelto por endpoint deja huecos (una acción permitida desde un estado que no corresponde) y cada servicio inventa su mensaje de error. Hace falta un lugar único por entidad que diga qué pasa de qué a qué, y un error uniforme cuando no se puede.

## Decisión

Cada entidad con estados declara una tabla `Record<Estado, Estado[]>` (estado actual → destinos válidos) y un único punto de chequeo que lanza `ConflictException` (409, Problem Details, ADR-011) con un mensaje que lista las transiciones válidas (en la mayoría, `No se puede pasar de 'X' a 'Y'. Transiciones válidas desde 'X': [...]`; el de intervenciones de arbolado es `Transiciones válidas: [...]`). Las acciones del controller (`start`, `suspend`, `close`, etc.) solo piden el estado destino; no deciden la regla. Los estados finales tienen lista vacía.

| Entidad | Tabla | Chequeo |
|---|---|---|
| Servicio | `VALID_TRANSITIONS` en `src/modules/services/services.service.ts` | `assertTransition` |
| Contenedor | `CONTAINER_TRANSITIONS` en `src/modules/containers/containers.service.ts` | `transition()` |
| Intervención de arbolado | `VALID_TRANSITIONS` en `src/modules/trees/interventions/tree-interventions.service.ts` | `transition()` |
| Expediente ambiental | `REPORT_TRANSITIONS` en `src/modules/environmental-reports/environmental-reports.service.ts` | `assertTransition` |
| Reparación / corte de calle | `REPAIR_TRANSITIONS`, `CLOSURE_TRANSITIONS` en `src/modules/outbound-requests/outbound-requests.transitions.ts` | `assertTransition` (genérico) |
| Evento del outbox | `OUTBOX_TRANSITIONS` en `src/events/outbox/outbox-admin.service.ts` | `assertTransition` |

Los consumers de eventos reusan las tablas: `sourcesOf` (`outbound-responses.consumer.ts`) arma el `where` de un `updateMany`, y `tickets.consumer.ts` consulta `REPORT_TRANSITIONS` para decidir si aplica el evento. Así un evento tardío no reabre un estado terminal. Los diagramas de estado de `docs/entidades/` se derivan de estas tablas.

## Alternativas consideradas

- **`if` por endpoint**: descartada, la regla queda repartida y diverge.
- **Clases State (una por estado, GoF estricto)**: descartada, mucho código para transiciones que casi no tienen comportamiento propio.
- **Librería de máquinas de estado (XState)**: descartada, dependencia nueva para tablas de a lo sumo seis estados.
- **Tabla de transiciones + guard único** (elegida): declarativa, testeable y legible contra el diagrama.

## Consecuencias

### Positivas

- Una transición inválida siempre da 409 con el mismo formato.
- Agregar un estado es tocar la tabla; los consumers heredan el cambio.

### Negativas

- Solo `outbound-requests` tiene archivo `*.transitions.ts`; el resto vive dentro del service. Moverlas a archivos propios queda como mejora.
- La tabla dice qué se puede; las precondiciones de cada acción (cuadrilla, vehículo, motivo) siguen en el service.

### Neutras

- Cambiar una tabla exige actualizar el diagrama de la entidad en `docs/entidades/` y `docs/enumeraciones.md`.

## Referencias

- Issue #621. [ADR-011](adr-011-errores-problem-details-rfc-9457.md), [ADR-012](adr-012-concurrencia-optimista-etag.md) (el `If-Match` hace atómico el cambio de estado).
