# ADR-014: Patrón State: máquinas de estado como tablas de transiciones

## Metadata

- **Status:** Accepted
- **Date:** 2026-11-10
- **Deciders:** equipo M6 (Grupo 04)
- **Owner:** Benjamin Martinez (DEV Backend)
- **Related Issues:** #621
- **Related ADRs:** [ADR-011](adr-011-errores-problem-details-rfc-9457.md), [ADR-012](adr-012-concurrencia-optimista-etag.md), [ADR-015](adr-015-patron-outbox-inbox.md)

---

## 1. Context and Problem Statement

### Context

Servicio, contenedor, intervención de arbolado, expediente ambiental, solicitudes derivadas y eventos del outbox tienen ciclo de vida con estados cerrados.

### Problem

Un `if` suelto por endpoint deja huecos (una acción permitida desde un estado que no corresponde) y cada servicio inventa su mensaje de error. Hace falta un lugar único por entidad que diga qué pasa de qué a qué, y un error uniforme cuando no se puede.

---

## 2. Decision Drivers

- Una sola fuente de verdad por entidad, legible contra el diagrama de estados de `docs/entidades/`.
- Error uniforme (409, Problem Details, ADR-011) ante una transición inválida.
- Los consumers de eventos tienen que poder consultar la misma regla (los eventos llegan tarde y desordenados).
- Sin dependencias nuevas para tablas de a lo sumo seis estados.

---

## 3. Considered Options

### Option A: `if` por endpoint

**Pros:**
- Cero estructura adicional.

**Cons:**
- La regla queda repartida y diverge entre endpoints y consumers.

### Option B: Clases State (una por estado, GoF estricto)

**Pros:**
- Cada estado encapsula su comportamiento.

**Cons:**
- Mucho código para transiciones que casi no tienen comportamiento propio.

### Option C: Librería de máquinas de estado (XState)

**Pros:**
- Modelo formal y herramientas de visualización.

**Cons:**
- Dependencia nueva para tablas chicas.

### Option D: Tabla de transiciones + guard único

**Pros:**
- Declarativa, testeable y legible contra el diagrama.
- Reusable por los consumers.

**Cons:**
- No expresa precondiciones ni comportamiento por estado.

---

## 4. Decision Outcome

**Chosen Option:** D, tabla de transiciones + guard único.

### Rationale

Cada entidad con estados declara una tabla `Record<Estado, Estado[]>` (estado actual → destinos válidos) y un único punto de chequeo que lanza `ConflictException` (409, Problem Details) con un mensaje que lista las transiciones válidas (en la mayoría, `No se puede pasar de 'X' a 'Y'. Transiciones válidas desde 'X': [...]`; el de intervenciones de arbolado es `Transiciones válidas: [...]`). Las acciones del controller (`start`, `suspend`, `close`, etc.) solo piden el estado destino; no deciden la regla. Los estados finales tienen lista vacía.

| Entidad | Tabla | Chequeo |
|---|---|---|
| Servicio | `VALID_TRANSITIONS` en `src/modules/services/services.service.ts` | `assertTransition` |
| Contenedor | `CONTAINER_TRANSITIONS` en `src/modules/containers/containers.service.ts` | `transition()` |
| Intervención de arbolado | `VALID_TRANSITIONS` en `src/modules/trees/interventions/tree-interventions.service.ts` | `transition()` |
| Expediente ambiental | `REPORT_TRANSITIONS` en `src/modules/environmental-reports/environmental-reports.service.ts` | `assertTransition` |
| Reparación / corte de calle | `REPAIR_TRANSITIONS`, `CLOSURE_TRANSITIONS` en `src/modules/outbound-requests/outbound-requests.transitions.ts` | `assertTransition` (genérico) |
| Evento del outbox | `OUTBOX_TRANSITIONS` en `src/events/outbox/outbox-admin.service.ts` | `assertTransition` |

Los consumers de eventos reusan las tablas: `sourcesOf` (`outbound-responses.consumer.ts`) arma el `where` de un `updateMany`, y `tickets.consumer.ts` consulta `REPORT_TRANSITIONS` para decidir si aplica el evento. Así un evento tardío no reabre un estado terminal. Los diagramas de estado de `docs/entidades/` se derivan de estas tablas.

---

## 5. Consequences

### Positive Consequences

- Una transición inválida siempre da 409 con el mismo formato.
- Agregar un estado es tocar la tabla; los consumers heredan el cambio.

### Negative Consequences

- Solo `outbound-requests` tiene archivo `*.transitions.ts`; el resto vive dentro del service. Moverlas a archivos propios queda como mejora.
- La tabla dice qué se puede; las precondiciones de cada acción (cuadrilla, vehículo, motivo) siguen en el service.
- Cambiar una tabla exige actualizar el diagrama de la entidad en `docs/entidades/` y `docs/enumeraciones.md`.

### Technical Implications

- Componentes afectados: los cinco services de la tabla, `src/events/outbox/outbox-admin.service.ts` y los consumers `outbound-responses.consumer.ts` y `tickets.consumer.ts`.
- Sin dependencias ni infraestructura nuevas.

---

## 6. Implementation and Validation

- [x] Tablas y guard en los services listados arriba.
- [x] Consumers reusando las tablas (`sourcesOf`, `REPORT_TRANSITIONS`).
- [x] Tests de transiciones: `services-transitions.spec.ts`, `tree-interventions-transitions.spec.ts`, `outbound-requests.transitions.spec.ts` y `outbound-requests-transitions.spec.ts`; el 409 también se ejercita en `containers.service.spec.ts` y `consumers.spec.ts`.
- [ ] Hueco conocido: en `environmental-reports.service.spec.ts` hay referencias a las transiciones, pero no se verificó que cubran cada una; `outbox-admin.service.spec.ts` no menciona `OUTBOX_TRANSITIONS` ni el mensaje de transición inválida.
- [ ] Hueco conocido: sin `If-Match` (ADR-012) hay carreras entre dos pedidos concurrentes sobre el mismo recurso; la tabla valida contra el estado leído, no contra el vigente al escribir.
- [x] Documentación: diagramas en `docs/entidades/` y valores en `docs/enumeraciones.md`.

---

## Nota de corrección (2026-11-17)

El patrón State se implementa como **tabla de transiciones declarativa más una función guard**, no como una clase por estado. La tabla es un `Record<Estado, Estado[]>` (`VALID_TRANSITIONS`, `CONTAINER_TRANSITIONS`, `REPORT_TRANSITIONS`, `REPAIR_TRANSITIONS`, `CLOSURE_TRANSITIONS`, `OUTBOX_TRANSITIONS`) y el guard (`assertTransition` / `transition()`) lanza `ConflictException` (409) si el destino no figura en la lista del estado actual. Es el patrón State sin la jerarquía de clases, y es una decisión deliberada (Opción D contra B):

- **Pocos estados, sin comportamiento propio:** cada enum de estado de `prisma/schema.prisma` tiene entre 3 y 11 valores (7 el de servicio, ver `VALID_TRANSITIONS` en `services.service.ts`). Lo que cambia entre estados es qué destinos se permiten; la lógica de cada acción (cuadrilla, vehículo, motivo, eventos al outbox) es la misma sin importar el estado de origen y vive en el service, así que una clase por estado quedaría casi vacía.
- **Fuente única legible contra el diagrama:** cada tabla se compara línea a línea con el diagrama de `docs/entidades/`; con clases, la regla quedaría repartida en N archivos.
- **Reusable fuera del service:** los consumers consultan la misma tabla (`sourcesOf` en `outbound-responses.consumer.ts`, `REPORT_TRANSITIONS` en `tickets.consumer.ts`); una jerarquía de clases atada a la entidad cargada no sirve para eso.
- **Testeable con casos parametrizados:** una tabla se recorre completa en un test (`services-transitions.spec.ts`, `tree-interventions-transitions.spec.ts`, `outbound-requests.transitions.spec.ts`), incluidos los estados finales con lista vacía.
- **409 uniforme:** el mensaje se arma en un único punto con las transiciones válidas desde el estado actual (ADR-011).

Costo asumido: la tabla no expresa precondiciones ni comportamiento por estado (ya figura en Consecuencias negativas). Si algún estado ganara comportamiento propio, se reevalúa la Opción B para esa entidad. La frase «tablas de a lo sumo seis estados» de Consecuencias quedó corta: el expediente ambiental tiene 11 y el servicio 7; el argumento no cambia, porque lo que crece es la tabla y no el comportamiento.

---

## 7. References

- Issue #621. [ADR-011](adr-011-errores-problem-details-rfc-9457.md), [ADR-012](adr-012-concurrencia-optimista-etag.md) (el `If-Match` hace atómico el cambio de estado).
