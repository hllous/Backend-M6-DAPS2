import { Prisma } from '@prisma/client';

/**
 * Reubicaciones vigentes en `dia` (fecha sin hora): empezaron y no terminaron.
 * `validTo` es inclusivo, y vacío significa "hasta nuevo aviso". Una sola
 * definición para el listado, el detalle y el aviso al asignar, así los tres
 * coinciden en qué zona es "la efectiva".
 */
export const reubicacionVigente = (dia: Date): Prisma.CrewZoneAssignmentWhereInput => ({
  validFrom: { lte: dia },
  OR: [{ validTo: null }, { validTo: { gte: dia } }],
});

/**
 * Zona donde trabaja la cuadrilla: la de la reubicación vigente y, si no hay,
 * la base. `vigentes` ya viene filtrado con `reubicacionVigente` y ordenado por
 * `validFrom` descendente; como los rangos de una cuadrilla no se pisan, a lo
 * sumo hay una.
 */
export function zonaEfectiva(
  crew: { homeZoneId: string | null },
  vigentes: { zoneId: string }[],
): string | null {
  return vigentes[0]?.zoneId ?? crew.homeZoneId;
}
