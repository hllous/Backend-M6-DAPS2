/**
 * Los ocho eventos que M6 publica. Nombres en camelCase: el Core matchea el
 * tipo como string literal, así que `UrbanServiceScheduled` y
 * `urbanServiceScheduled` serían dos eventos distintos y ninguno llegaría.
 *
 * Cada uno tiene su `.schema.json` en docs/eventos/publicados/.
 */
export const EventType = {
  /** → M2. Cambia el estado de algo nacido de un reclamo. */
  UPDATE_TICKET_STATUS: 'updateTicketStatus',
  /** → M7. Se agenda un servicio. */
  URBAN_SERVICE_SCHEDULED: 'urbanServiceScheduled',
  /** → M3. Se detecta un contenedor dañado o faltante. */
  CONTAINER_DAMAGED: 'containerDamaged',
  /** → M3, M7. Un relevamiento arroja riesgo HIGH o CRITICAL. */
  TREE_RISK_DETECTED: 'treeRiskDetected',
  /** → M7. Se programa una poda. */
  TREE_PRUNING_SCHEDULED: 'treePruningScheduled',
  /** → M4. Se emite un acta ambiental. Fase 4. */
  ENVIRONMENTAL_VIOLATION_DETECTED: 'environmentalViolationDetected',
  /** → M3. Detectamos un daño de infraestructura ajeno. Fase 5. */
  INFRASTRUCTURE_REPAIR_REQUESTED: 'infrastructureRepairRequested',
  /** → M7. Un servicio o intervención requiere cortar la calle. Fase 5. */
  STREET_CLOSURE_REQUESTED: 'streetClosureRequested',
} as const;

export type EventTypeName = (typeof EventType)[keyof typeof EventType];

/**
 * Agregado del que sale cada evento. Va en `OutboxEvent.aggregateType` y sirve
 * para rastrear de dónde salió una fila sin abrir el payload.
 */
export const AggregateType = {
  SERVICE: 'SERVICE',
  CONTAINER: 'CONTAINER',
  TREE_SURVEY: 'TREE_SURVEY',
  TREE_INTERVENTION: 'TREE_INTERVENTION',
  ENVIRONMENTAL_REPORT: 'ENVIRONMENTAL_REPORT',
  ENVIRONMENTAL_INSPECTION: 'ENVIRONMENTAL_INSPECTION',
  VIOLATION_NOTICE: 'VIOLATION_NOTICE',
  REPAIR_REQUEST: 'REPAIR_REQUEST',
  STREET_CLOSURE_REQUEST: 'STREET_CLOSURE_REQUEST',
} as const;

export type AggregateTypeName = (typeof AggregateType)[keyof typeof AggregateType];
