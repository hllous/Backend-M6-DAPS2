# ADR-016: Patrón Adapter: puerto de identidad hacia M1

## Estado

**Aceptado** — 2026-11-10

## Contexto

ADR-004 decidió que la identidad es de M1 y que M6 la consulta detrás de un puerto; ADR-009 fijó el REST a M1 con el module-token del Core. Falta rotularlo como patrón y dejar su ubicación en el código. El contrato de M1 todavía puede moverse y los tests no deben depender de una red.

## Decisión

Adapter (puertos y adaptadores): el dominio depende de la clase abstracta `IdentityPort` (`src/identity/identity.port.ts`: `IdentityRecord`, `findEmployeeBySub`, `findCitizenById`, `findOrganizationById`, `findOrganizationByCuit`; `null` es "no existe") y no de HTTP. `M1IdentityClient` (`src/identity/m1-identity.client.ts`) es el adaptador que traduce al REST de M1 y se cablea en `src/identity/identity.module.ts` con `{ provide: IdentityPort, useExisting: M1IdentityClient }`. Si falta `M1_BASE_URL` el puerto lo informa y quien llama decide si omite la consulta. Mismo criterio, con otra frontera, en `EventPublisher` (ADR-015).

## Alternativas consideradas

- **Llamar a M1 con `fetch` desde cada service**: descartada, acopla el dominio al contrato y complica los tests.
- **Copiar el directorio de identidad a la base de M6**: descartada, prohibido el acceso directo entre bases y quedaría desactualizado.
- **Puerto + adaptador** (elegida).

## Consecuencias

### Positivas

- Si cambia el contrato de M1 se toca un solo archivo; los tests inyectan un fake del puerto.

### Negativas

- Una capa más para una sola implementación real.

### Neutras

- La validación del JWT sigue en `src/auth` (ADR-004); el puerto es solo para consultas.

## Referencias

- Issue #621. [ADR-004](adr-004-jwt-m1-y-puerto-identidad.md), [ADR-009](adr-009-rest-m6-a-m1-consultas-de-identidad.md), [ADR-015](adr-015-patron-outbox-inbox.md).
