// Filas viejas pueden traer texto libre (`barrio-palermo`): M3 espera un UUID de M9.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Lo mínimo del cliente Prisma (o de una transacción) que hace falta acá. */
interface ZoneNeighborhoodReader {
  zoneNeighborhood: {
    findMany(args: {
      where: { zoneId: string };
      select: { neighborhoodId: true };
      take: number;
    }): Promise<{ neighborhoodId: string }[]>;
  };
}

/**
 * El barrio de una zona, para completar `location.neighborhoodId` de los eventos.
 *
 * Las zonas operativas son una por barrio: solo si la zona tiene exactamente un
 * barrio se sabe en cuál está la ubicación. Con cero o varios no se adivina y el
 * campo viaja ausente. Lo mismo si el valor guardado no es un UUID.
 */
export async function zoneNeighborhoodId(
  db: ZoneNeighborhoodReader,
  zoneId: string,
): Promise<string | undefined> {
  const rows = await db.zoneNeighborhood.findMany({
    where: { zoneId },
    select: { neighborhoodId: true },
    take: 2,
  });
  const id = rows.length === 1 ? rows[0].neighborhoodId : undefined;
  return id && UUID.test(id) ? id : undefined;
}
