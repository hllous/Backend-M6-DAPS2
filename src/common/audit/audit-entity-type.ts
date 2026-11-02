/**
 * Entidades auditadas (#460). Un valor cerrado para que el filtro de GET /audit
 * no acepte cualquier texto; la columna es String para no migrar por cada alta.
 */
export const AUDIT_ENTITY_TYPES = [
  'CONTAINER',
  'ENVIRONMENTAL_REPORT',
  'ENVIRONMENTAL_INSPECTION',
  'VIOLATION_NOTICE',
  'REPAIR_REQUEST',
  'STREET_CLOSURE_REQUEST',
  'TREE_INTERVENTION',
  'SERVICE',
  'CREW',
  'ZONE',
  'VEHICLE',
  'ROUTE',
] as const;

export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];
