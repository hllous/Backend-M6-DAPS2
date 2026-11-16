# ADR-016: Patrón Adapter: puerto de identidad hacia M1

## Metadata

- **Status:** Accepted
- **Date:** 2026-11-10
- **Deciders:** equipo M6 (Grupo 04)
- **Owner:** Benjamin Martinez (DEV Backend)
- **Related Issues:** #621
- **Related ADRs:** [ADR-004](adr-004-jwt-m1-y-puerto-identidad.md), [ADR-009](adr-009-rest-m6-a-m1-consultas-de-identidad.md), [ADR-015](adr-015-patron-outbox-inbox.md)

---

## 1. Context and Problem Statement

### Context

ADR-004 decidió que la identidad es de M1 y que M6 la consulta detrás de un puerto; ADR-009 fijó el REST a M1 con el module-token del Core.

### Problem

Falta rotularlo como patrón y dejar su ubicación en el código. El contrato de M1 todavía puede moverse y los tests no deben depender de una red.

---

## 2. Decision Drivers

- Aislar el dominio del contrato REST de M1, que puede cambiar.
- Tests sin red.
- Prohibido el acceso directo entre bases.
- Poder operar sin M1 configurada (`M1_BASE_URL` ausente).

---

## 3. Considered Options

### Option A: Llamar a M1 con `fetch` desde cada service

**Pros:**
- Sin capa intermedia.

**Cons:**
- Acopla el dominio al contrato y complica los tests.

### Option B: Copiar el directorio de identidad a la base de M6

**Pros:**
- Consultas locales y rápidas.

**Cons:**
- Prohibido el acceso directo entre bases y quedaría desactualizado.

### Option C: Puerto + adaptador

**Pros:**
- Un solo archivo conoce el contrato de M1; los tests inyectan un fake.

**Cons:**
- Una capa más para una sola implementación real.

---

## 4. Decision Outcome

**Chosen Option:** C, puerto + adaptador.

### Rationale

El dominio depende de la clase abstracta `IdentityPort` (`src/identity/identity.port.ts`: `IdentityRecord`, `findEmployeeBySub`, `findCitizenById`, `findOrganizationById`, `findOrganizationByCuit`; `null` es "no existe") y no de HTTP. `M1IdentityClient` (`src/identity/m1-identity.client.ts`) es el adaptador que traduce al REST de M1 y se cablea en `src/identity/identity.module.ts` con `{ provide: IdentityPort, useExisting: M1IdentityClient }`. El getter `get enabled()` (`identity.port.ts:31`) es `false` si falta `M1_BASE_URL`: quien llama decide si omite la consulta. Mismo criterio, con otra frontera, en `EventPublisher` (ADR-015).

---

## 5. Consequences

### Positive Consequences

- Si cambia el contrato de M1 se toca un solo archivo; los tests inyectan un fake del puerto.

### Negative Consequences

- Una capa más para una sola implementación real.

### Technical Implications

- La validación del JWT sigue en `src/auth` (ADR-004); el puerto es solo para consultas.
- Los fallos de M1 (deshabilitada, 401, 5xx, timeout, red) salen como `IdentityUnavailableError`, sin token ni body de M1.

---

## 6. Implementation and Validation

- [x] `IdentityPort`, `M1IdentityClient` e `IdentityModule` implementados.
- [x] Test del adaptador: `src/identity/m1-identity.client.spec.ts`.
- [x] Los consumidores del puerto dependen de `IdentityPort`, no de `M1IdentityClient`.

---

## 7. References

- Issue #621. [ADR-004](adr-004-jwt-m1-y-puerto-identidad.md), [ADR-009](adr-009-rest-m6-a-m1-consultas-de-identidad.md), [ADR-015](adr-015-patron-outbox-inbox.md).
