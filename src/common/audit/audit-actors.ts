/**
 * Actor con el que el consumidor de M4 escribe la auditoría. Vive acá, y no junto a
 * `sistema()`, porque `AuditService` lo necesita para no entregar el `note` de M4
 * (decisión de la sanción, Tier 2) y la capa común no depende de `events/`.
 */
export const M4_ACTOR_ID = 'system:m4';
