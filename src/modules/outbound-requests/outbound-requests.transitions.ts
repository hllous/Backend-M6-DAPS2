import { ConflictException } from '@nestjs/common';
import { RepairRequestStatus, StreetClosureRequestStatus } from '@prisma/client';

// Derivadas de docs/entidades/derivaciones.md. Los eventos de M3 y M7 viajan
// por topics distintos sin orden garantizado, así que las transiciones que
// "saltean" un paso son válidas a propósito:
// - REQUESTED→CLOSED: `workOrderCompleted` puede llegar sin haber visto
//   `workOrderScheduled` (además M3 no confirmó cuándo lo dispara, bloqueantes.md).
// - REQUESTED→ENDED: `streetClosureEnded` puede adelantarse a `streetClosureApproved`.
// CLOSED, REJECTED y ENDED son terminales: un evento tardío no las reabre.
export const REPAIR_TRANSITIONS: Record<RepairRequestStatus, RepairRequestStatus[]> = {
  REQUESTED: [RepairRequestStatus.IN_PROGRESS, RepairRequestStatus.CLOSED],
  IN_PROGRESS: [RepairRequestStatus.CLOSED],
  CLOSED: [],
};

export const CLOSURE_TRANSITIONS: Record<StreetClosureRequestStatus, StreetClosureRequestStatus[]> =
  {
    REQUESTED: [
      StreetClosureRequestStatus.APPROVED,
      StreetClosureRequestStatus.REJECTED,
      StreetClosureRequestStatus.ENDED,
    ],
    APPROVED: [StreetClosureRequestStatus.ENDED],
    REJECTED: [],
    ENDED: [],
  };

/** Estados desde los que se puede llegar a `to`: el filtro de los `updateMany` de los consumers. */
export function sourcesOf<S extends string>(table: Record<S, S[]>, to: S): S[] {
  return (Object.keys(table) as S[]).filter((from) => table[from].includes(to));
}

export function assertTransition<S extends string>(table: Record<S, S[]>, from: S, to: S): void {
  const allowed = table[from];
  if (!allowed.includes(to)) {
    throw new ConflictException(
      `No se puede pasar de '${from}' a '${to}'. Transiciones válidas desde '${from}': [${allowed.join(', ')}]`,
    );
  }
}
