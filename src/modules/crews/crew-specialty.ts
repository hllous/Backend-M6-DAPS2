import { CrewSpecialty } from '@prisma/client';

/**
 * Qué especialidad de cuadrilla cubre cada tipo de servicio (`ServiceType.code`).
 *
 * Es una constante a propósito: el catálogo de tipos es chico y estable, y la
 * regla solo alimenta un aviso al asignar (#455), no un bloqueo. Para sumar un
 * tipo nuevo basta una línea acá. Un código que no figura no genera aviso:
 * mejor callar que avisar mal de un tipo que nadie mapeó.
 *
 * `CONT-VAC` va con COLLECTION (lo levanta el camión recolector) y `HIG-LAV`
 * con CLEANING, igual que `CONT-LAV`.
 */
export const SERVICE_TYPE_SPECIALTY: Readonly<Record<string, CrewSpecialty>> = {
  'REC-DOM': CrewSpecialty.COLLECTION,
  'REC-VOL': CrewSpecialty.COLLECTION,
  'CONT-VAC': CrewSpecialty.COLLECTION,
  'REC-REC': CrewSpecialty.RECYCLING,
  'BAR-MEC': CrewSpecialty.SWEEPING,
  'BAR-MAN': CrewSpecialty.SWEEPING,
  'HIG-LAV': CrewSpecialty.CLEANING,
  'CONT-LAV': CrewSpecialty.CLEANING,
  'ARB-POD': CrewSpecialty.TREES,
  'ARB-CENSO': CrewSpecialty.TREES,
  'EV-RIEGO': CrewSpecialty.GREEN_SPACES,
  'EV-MANT': CrewSpecialty.GREEN_SPACES,
  'AMB-INSP': CrewSpecialty.INSPECTION,
};
