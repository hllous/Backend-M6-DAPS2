import {
  Attachment,
  ClosureStreet,
  Container,
  EnvironmentalInspection,
  EnvironmentalReport,
  RepairRequest,
  StreetClosureRequest,
  Tree,
  TreeSurvey,
  ViolationNotice,
} from '@prisma/client';

/**
 * Los payloads de los eventos publicados, en un solo lugar.
 *
 * Están acá y no dentro de cada servicio de dominio para poder validarlos
 * contra los `.schema.json` de docs/eventos/publicados/ en un test, que es la
 * única forma de saber que lo que emitimos es lo que documentamos.
 */

/**
 * La ubicación tal como la podemos armar hoy.
 *
 * `neighborhoodId` sale del catálogo de M9, que sigue sin exponerse, así que
 * viaja ausente. `street` lleva la dirección sin partir, porque el modelo la
 * guarda como texto libre. Ver la descripción en `_shared.schema.json`.
 */
function location(source: {
  address: string | null;
  lat: unknown;
  lng: unknown;
}): Record<string, unknown> {
  const loc: Record<string, unknown> = {};
  if (source.address) loc.street = source.address;
  if (source.lat !== null && source.lat !== undefined) loc.lat = Number(source.lat);
  if (source.lng !== null && source.lng !== undefined) loc.lng = Number(source.lng);
  return loc;
}

/**
 * Los adjuntos nuestros, en la forma que define el contrato para `evidence`.
 *
 * `_shared.schema.json` tiene dos objetos que se parecen y no son lo mismo:
 * `evidence` —`{url, mimeType}`, lo que consume M4 en el acta— y
 * `m2Attachment` —`{attachmentId, fileName, contentType, url, sizeBytes}`, lo
 * que consume M2 en `updateTicketStatus`. Este mapea al primero.
 */
function evidence(attachments: Attachment[]): Record<string, unknown>[] {
  return attachments.map((a) => ({ url: a.url, mimeType: a.contentType }));
}

/** Saca las claves en undefined: los schemas usan `additionalProperties: false`. */
function compact<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

// ─── containerDamaged → M3 ────────────────────────

export function containerDamaged(container: Container, ticketId?: string): Record<string, unknown> {
  return compact({
    containerId: container.id,
    containerCode: container.code,
    zoneId: container.zoneId,
    location: location(container),
    damageType: container.damageType as string,
    severity: container.severity as string,
    requiresPublicWorks: container.requiresPublicWorks ?? false,
    detectedAt: new Date().toISOString(),
    ticketId,
  });
}

// ─── treeRiskDetected → M3 ────────────────────

export function treeRiskDetected(tree: Tree, survey: TreeSurvey): Record<string, unknown> {
  return compact({
    treeId: tree.id,
    surveyCode: tree.surveyCode,
    species: tree.species ?? undefined,
    zoneId: tree.zoneId,
    location: location(tree),
    riskLevel: survey.riskLevel,
    riskType: survey.riskType as string,
    healthStatus: survey.healthStatus,
    suggestedIntervention: survey.suggestedIntervention ?? undefined,
    requiresStreetClosure: survey.requiresStreetClosure,
    requiresPublicWorks: survey.requiresPublicWorks,
    surveyedAt: survey.surveyedAt.toISOString(),
  });
}

// ─── environmentalViolationDetected → M4 ──────────

/**
 * El acta que se le deriva a M4.
 *
 * `priorNoticeCount` les adelanta la reincidencia del establecimiento.
 *
 * `evidence` son las fotos que el inspector cargó **en la inspección**, no en
 * el acta: el acta no tiene adjuntos propios, formaliza lo que la inspección
 * encontró. El campo es requerido por el schema, así que una inspección sin
 * fotos manda una lista vacía, no omite la clave.
 *
 * Solo se construye cuando hay `establishmentId`: sin establecimiento el acta
 * no se deriva.
 */
export function environmentalViolationDetected(
  notice: ViolationNotice,
  inspection: EnvironmentalInspection,
  report: EnvironmentalReport,
  attachments: Attachment[] = [],
): Record<string, unknown> {
  return compact({
    violationId: notice.id,
    noticeNumber: notice.noticeNumber,
    issuedAt: notice.issuedAt.toISOString(),
    reportId: report.id,
    inspectionId: inspection.id,
    ticketId: report.ticketId ?? undefined,
    violationType: notice.violationType,
    severity: notice.severity,
    location: location(report),
    establishmentId: notice.establishmentId as string,
    priorNoticeCount: notice.priorNoticeCount,
    evidence: evidence(attachments),
    suggestedAction: notice.suggestedAction,
  });
}

// ─── infrastructureRepairRequested → M3 ───────────

/**
 * El daño de infraestructura que no nos corresponde arreglar.
 *
 * `requestId` es el que le pedimos a M3 que nos devuelva como
 * `sourceRequestId`: sin él habría que correlacionar por dirección, que es
 * frágil. Ya confirmaron que lo mandan (bloqueantes.md, 25/08).
 */
export function infrastructureRepairRequested(
  request: RepairRequest,
  ticketId?: string,
): Record<string, unknown> {
  return compact({
    requestId: request.id,
    damageType: request.damageType,
    severity: request.severity,
    location: location({ address: request.address, lat: null, lng: null }),
    detectedIn: request.detectedInId,
    ticketId,
    publicSafetyRisk: request.publicSafetyRisk,
    requestedAt: request.requestedAt.toISOString(),
  });
}

// ─── streetClosureRequested → M7 ──────────────────

/** Un tramo, como texto plano: `affectedSections` es un array de strings. */
function seccion(s: ClosureStreet): string {
  return `${s.streetName} entre ${s.fromCross} y ${s.toCross}`;
}

/**
 * La solicitud de corte, en el esquema unificado con la de M3 (30/08).
 *
 * `sourceModule` va como `"M6"`, que es lo que dice la tabla de campos de M7
 * y lo que M7 confirmó leer el 20/10. Sus respuestas devuelven `requestingModule`
 * ("ambiente" para nosotros) dentro de `data`: son dos campos distintos, no se
 * mezclaron. Ver bloqueantes.md.
 */
export function streetClosureRequested(
  request: StreetClosureRequest & { streets: ClosureStreet[] },
): Record<string, unknown> {
  return compact({
    closureRequestId: request.id,
    sourceModule: 'M6' as const,
    sourceRef: request.sourceId,
    reason: request.reason,
    affectedSections: request.streets.map(seccion),
    requestedFrom: request.closureFrom?.toISOString(),
    requestedTo: request.closureTo?.toISOString(),
    closureType: request.closureType ?? undefined,
    requestedAt: request.createdAt.toISOString(),
  });
}

// ─── updateTicketStatus → M2 ──────────────────────

export type TicketUpdateType =
  'STARTED' | 'PROGRESS' | 'INFORMATION_REQUIRED' | 'RETURNED' | 'RESOLVED' | 'REJECTED';

/**
 * El actor que originó el hecho, en el vocabulario de M2 (§5.2, vigente en la v1.75).
 *
 * Su regla de clasificación es explícita: una persona que actúa desde otro
 * módulo y cuyo hecho llega a M2 por integración es **`EXTERNAL_USER`**,
 * cualquiera sea el rol que tenga acá; un hecho generado automáticamente es
 * **`SYSTEM`**. El `AREA_USER` que usábamos con la v1.5 nunca existió en su
 * enum.
 */
const ACTOR_SISTEMA = 'sistema';

/**
 * M2 v1.78 exige que `updatedBy.id` sea UUID o null. El `sub` del JWT provisorio
 * puede ser un código o un entero, y ahí mandamos null (la persona sigue siendo
 * EXTERNAL_USER). Laxo como el Core: 8-4-4-4-12 hex, sin mirar versión.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Payload del contrato v1.78 de M2 (desde la v1.6 solo cambió `updatedBy.id`), adoptado tal cual.
 *
 * La fecha y la franja agendadas viajan como **texto en `publicMessage`** (M2,
 * 20/10; #303): `progress` es un entero de porcentaje y §8.2 dice "details
 * obligatorio: Ninguno" para `STARTED` y `PROGRESS`, así que no hay otro lugar.
 */
export function updateTicketStatus(params: {
  ticketId: string;
  updateType: TicketUpdateType;
  updatedById: string;
  publicMessage?: string;
  internalMessage?: string;
  details?: Record<string, unknown>;
}): Record<string, unknown> {
  const esAutomatico = params.updatedById === ACTOR_SISTEMA;

  return compact({
    ticketId: params.ticketId,
    updateType: params.updateType,
    publicMessage: params.publicMessage,
    internalMessage: params.internalMessage,
    details: params.details,
    updatedBy: esAutomatico
      ? { type: 'SYSTEM' as const, id: null }
      : {
          type: 'EXTERNAL_USER' as const,
          id: UUID.test(params.updatedById) ? params.updatedById : null,
        },
    // Antes `statusChangedAt` en la v1.5. Renombrado en la v1.6 (§8.1).
    updateOccurredAt: new Date().toISOString(),
  });
}
