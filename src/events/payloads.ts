import {
  Container,
  EnvironmentalInspection,
  EnvironmentalReport,
  Service,
  ServiceType,
  Tree,
  TreeIntervention,
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

/** `HH:mm` desde el DateTime que Prisma usa para las columnas @db.Time. */
function hhmm(value: Date | null): string | undefined {
  return value ? value.toISOString().slice(11, 16) : undefined;
}

/** `YYYY-MM-DD` desde una columna @db.Date. */
function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

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

function timeWindow(from: Date | null, to: Date | null): Record<string, string> | undefined {
  const f = hhmm(from);
  const t = hhmm(to);
  return f && t ? { from: f, to: t } : undefined;
}

/** Saca las claves en undefined: los schemas usan `additionalProperties: false`. */
function compact<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

// ─── urbanServiceScheduled → M7 ───────────────────

export function urbanServiceScheduled(
  service: Service & { zones: { zoneId: string }[] },
  serviceType: ServiceType,
): Record<string, unknown> {
  return compact({
    serviceId: service.id,
    serviceTypeCode: serviceType.code,
    category: serviceType.category,
    mode: service.mode,
    zoneIds: service.zones.map((z) => z.zoneId),
    routeId: service.routeId ?? undefined,
    targetRef: service.targetId ?? undefined,
    scheduledDate: isoDate(service.scheduledDate),
    timeWindow: timeWindow(service.windowFrom, service.windowTo),
    crewId: service.crewId ?? undefined,
    vehicleId: service.vehicleId ?? undefined,
    origin: service.origin,
    ticketId: service.ticketId ?? undefined,
  });
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

// ─── treeRiskDetected → M3, M7 ────────────────────

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

// ─── treePruningScheduled → M7 ────────────────────

/**
 * Devuelve `null` si el servicio todavía no tiene cuadrilla o franja horaria.
 *
 * M7 declara los dos campos como requeridos y en nuestro modelo son opcionales
 * hasta que se asignan, así que el evento se difiere en vez de emitirse
 * incompleto. Es el desajuste que salió de su tabla del 02/09.
 */
export function treePruningScheduled(
  intervention: TreeIntervention & { trees: { treeId: string }[] },
  service: Service & { zones: { zoneId: string }[] },
  anyTree: Tree | null,
): Record<string, unknown> | null {
  const window = timeWindow(service.windowFrom, service.windowTo);
  if (!service.crewId || !window) return null;

  return compact({
    interventionId: intervention.id,
    serviceId: service.id,
    interventionType: intervention.interventionType,
    treeIds: intervention.trees.map((t) => t.treeId),
    zoneId: service.zones[0]?.zoneId,
    location: anyTree
      ? location(anyTree)
      : location({ address: intervention.address, lat: null, lng: null }),
    scheduledDate: isoDate(service.scheduledDate),
    timeWindow: window,
    crewId: service.crewId,
    requiresStreetClosure: intervention.requiresStreetClosure,
  });
}

// ─── environmentalViolationDetected → M4 ──────────

/**
 * El acta que se le deriva a M4.
 *
 * `priorNoticeCount` les adelanta la reincidencia del establecimiento.
 * `evidence` viaja vacío hasta que exista el módulo de adjuntos: el schema lo
 * permite, y es preferible a inventar una referencia.
 *
 * Solo se construye cuando hay `establishmentId`: sin establecimiento el acta
 * no se deriva.
 */
export function environmentalViolationDetected(
  notice: ViolationNotice,
  inspection: EnvironmentalInspection,
  report: EnvironmentalReport,
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
    evidence: [],
    suggestedAction: notice.suggestedAction,
  });
}

// ─── updateTicketStatus → M2 ──────────────────────

export type TicketUpdateType =
  'STARTED' | 'PROGRESS' | 'INFORMATION_REQUIRED' | 'RETURNED' | 'RESOLVED' | 'REJECTED';

/**
 * Payload del contrato v1.5 de M2, adoptado sin cambios.
 *
 * La fecha y la franja agendadas **no viajan**: `progress` en la v1.5 es un
 * entero de porcentaje y no hay estructura de `details` definida para `STARTED`
 * ni `PROGRESS`. Es un bloqueante abierto con M2 — mientras tanto la
 * información va como texto en `publicMessage`.
 */
export function updateTicketStatus(params: {
  ticketId: string;
  updateType: TicketUpdateType;
  updatedById: string;
  publicMessage?: string;
  internalMessage?: string;
  details?: Record<string, unknown>;
}): Record<string, unknown> {
  return compact({
    ticketId: params.ticketId,
    updateType: params.updateType,
    publicMessage: params.publicMessage,
    internalMessage: params.internalMessage,
    details: params.details,
    updatedBy: { type: 'AREA_USER' as const, id: params.updatedById },
    statusChangedAt: new Date().toISOString(),
  });
}
