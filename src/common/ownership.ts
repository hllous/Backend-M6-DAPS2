import { PrismaService } from '../prisma/prisma.service';

/**
 * Pertenencia de Campo (#365). Una sola definición para services y evidencia:
 * el usuario del token es líder o integrante de la cuadrilla. Sin cuadrilla
 * (`null`) nadie pertenece.
 */
export async function belongsToCrew(
  prisma: Pick<PrismaService, 'crew'>,
  crewId: string | null,
  userId: string,
): Promise<boolean> {
  if (!crewId) return false;
  const n = await prisma.crew.count({
    where: { id: crewId, OR: [{ leaderUserId: userId }, { members: { some: { userId } } }] },
  });
  return n > 0;
}

/**
 * Una inspección sin inspector asignado la puede cerrar cualquier inspector;
 * con asignado, solo ese.
 */
export function isInspectionAssignee(inspectorId: string | null, userId: string): boolean {
  return inspectorId === null || inspectorId === userId;
}
