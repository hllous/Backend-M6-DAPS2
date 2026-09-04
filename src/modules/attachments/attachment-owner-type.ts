/**
 * Tipos de recurso que pueden llevar evidencia adjunta.
 *
 * `Attachment.ownerType` en `schema.prisma` sigue siendo un `String` simple
 * (no un enum de Prisma) para no migrar esa columna todavía — ver Issue #64.
 * Este enum de aplicación es la única fuente de verdad de qué valores son
 * válidos hasta que se decida formalizarlo en el schema.
 */
export const AttachmentOwnerType = {
  SERVICE: 'SERVICE',
  ZONE_RESULT: 'ZONE_RESULT',
  INSPECTION: 'INSPECTION',
  CONTAINER: 'CONTAINER',
} as const;

export type AttachmentOwnerType = (typeof AttachmentOwnerType)[keyof typeof AttachmentOwnerType];
