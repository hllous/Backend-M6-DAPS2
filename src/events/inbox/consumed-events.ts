/**
 * Los eventos que M6 escucha.
 *
 * Nueve de la cohorte más `weatherAlertIssued`, que **no lo publica nadie** y
 * simulamos internamente (docs/eventos/consumidos/weatherAlertIssued.md).
 *
 * `notificationSent` está documentado como consumido pero **no tiene handler**:
 * ningún módulo de la cohorte lo publica, así que implementarlo sería escribir
 * código para un evento que no existe. Es candidato a sacarse de lo consumido.
 */
export const ConsumedEvent = {
  /** ← M2. El único suyo que escuchamos, y nuestro disparador de entrada. */
  TICKET_UPDATED: 'ticketUpdated',
  /** ← M3. La orden de trabajo se agendó. */
  WORK_ORDER_SCHEDULED: 'workOrderScheduled',
  /** ← M3. La orden de trabajo se completó. */
  WORK_ORDER_COMPLETED: 'workOrderCompleted',
  /** ← M4. Multa emitida sobre un acta nuestra. */
  COMMERCIAL_FINE_GENERATED: 'commercialFineGenerated',
  /** ← M4. Clausura ordenada o levantada. Fusionó closureOrdered y closureLifted. */
  CLOSURE_UPDATE: 'closureUpdate',
  /** ← M7. Corte aprobado. */
  STREET_CLOSURE_APPROVED: 'streetClosureApproved',
  /** ← M7. Corte rechazado. */
  STREET_CLOSURE_REJECTED: 'streetClosureRejected',
  /** ← M7. Corte finalizado. */
  STREET_CLOSURE_ENDED: 'streetClosureEnded',
  /** Simulado internamente. Dispara la reprogramación masiva por zona. */
  WEATHER_ALERT_ISSUED: 'weatherAlertIssued',
} as const;

export type ConsumedEventName = (typeof ConsumedEvent)[keyof typeof ConsumedEvent];

/**
 * Los `updateType` de `ticketUpdated` que disparan acción.
 *
 * La v1.5 define trece; los otros siete se ignoran **a propósito** y el doc
 * pide explícitamente no implementarles handler
 * (docs/eventos/consumidos/ticketUpdated.md).
 */
export const TicketUpdateType = {
  ROUTED: 'ROUTED',
  INFORMATION_PROVIDED: 'INFORMATION_PROVIDED',
  CANCELLED: 'CANCELLED',
  REOPENED: 'REOPENED',
  PRIORITY_CHANGED: 'PRIORITY_CHANGED',
  ESCALATION_CHANGED: 'ESCALATION_CHANGED',
} as const;
