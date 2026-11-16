Sobres de ejemplo copiados del paquete de M2 v1.78 (vigente v1.79, sin cambios en ejemplos), 10/11/2026.
Criterio: uno por cada `updateType` de `ticketUpdated` con rama propia en `tickets.consumer.ts` (ROUTED, CANCELLED, PRIORITY_CHANGED, INFORMATION_PROVIDED, REOPENED, ESCALATION_CHANGED), con sus variantes de reclasificación y anónimo, más los dos `ticketCreated`.
Si agregás o quitás uno, ajustá el guard de cantidades en `m2-ejemplos.spec.ts`.
