import { EnvironmentalReportType, InspectionOutcome, ViolationType } from '@prisma/client';

/** Qué se puede derivar a partir de un expediente según su tipo. */
export interface FollowUps {
  /** Reparación a Obras Públicas (M3): solo si el tipo puede dejar daño de infraestructura. */
  repair: boolean;
  /** Acta de constatación hacia Habilitaciones (M4). */
  notice: boolean;
  /** Tipo de infracción que corresponde al tipo de expediente; null si no hay uno canónico. */
  suggestedViolationType: ViolationType | null;
}

/**
 * Única fuente de verdad de las acciones posteriores a una inspección (#451).
 * "Solo registrar el resultado" está siempre permitido, por eso no figura.
 *
 * `DUMPING`, `ILLEGAL_DUMPSITE`, `WATER_DISCHARGE` y `OTHER` admiten reparación
 * porque pueden dejar daño (p. ej. `BLOCKED_DRAIN`); la decisión final es del
 * inspector, el backend solo descarta los tipos que nunca lo tienen.
 */
export const ALLOWED_FOLLOW_UPS: Record<EnvironmentalReportType, FollowUps> = {
  NOISE: { repair: false, notice: true, suggestedViolationType: ViolationType.NOISE_LIMIT },
  ODOR: { repair: false, notice: true, suggestedViolationType: null },
  PEST_INFESTATION: { repair: false, notice: true, suggestedViolationType: null },
  AIR_EMISSION: { repair: false, notice: true, suggestedViolationType: ViolationType.AIR_EMISSION },
  DUMPING: { repair: true, notice: true, suggestedViolationType: ViolationType.ILLEGAL_DUMPING },
  ILLEGAL_DUMPSITE: {
    repair: true,
    notice: true,
    suggestedViolationType: ViolationType.ILLEGAL_DUMPING,
  },
  WATER_DISCHARGE: {
    repair: true,
    notice: true,
    suggestedViolationType: ViolationType.UNTREATED_DISCHARGE,
  },
  OTHER: { repair: true, notice: true, suggestedViolationType: null },
};

/**
 * Una reparación se justifica solo con la inspección cerrada y con algo
 * constatado: `NO_VIOLATION` descarta el problema; `INCONCLUSIVE` queda a
 * criterio del inspector.
 */
export function repairJustifiedBy(outcome: InspectionOutcome | null): boolean {
  return outcome !== null && outcome !== InspectionOutcome.NO_VIOLATION;
}

/**
 * Acciones habilitadas hoy para una inspección: cruza la matriz por tipo con
 * el resultado y el acta, para que el cliente no replique la regla.
 */
export function allowedActionsFor(
  reportType: EnvironmentalReportType,
  outcome: InspectionOutcome | null,
  hasNotice = false,
): FollowUps {
  const base = ALLOWED_FOLLOW_UPS[reportType];
  return {
    repair: base.repair && repairJustifiedBy(outcome),
    // issueNotice exige VIOLATION_FOUND y responde 409 si ya hay acta.
    notice: base.notice && outcome === InspectionOutcome.VIOLATION_FOUND && !hasNotice,
    suggestedViolationType: base.suggestedViolationType,
  };
}
