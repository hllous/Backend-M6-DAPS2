/** Registro de M1 tal como lo devuelve el directorio. `estado` es el real: puede no ser ACTIVO. */
export interface IdentityRecord {
  sub: string;
  actorType: string;
  /** UUID de M1: es lo que va en `updatedBy.id`. `sub` sigue siendo nuestra clave interna. */
  actorId: string;
  nombre: string;
  apellido: string;
  estado: string;
}

/**
 * Organización o ciudadano devuelto por M1. No hay muestra real: solo se tipa lo
 * mínimo (id/uuid y estado opcionales) y el resto pasa como `unknown`.
 */
export interface DirectoryRecord {
  id?: string;
  uuid?: string;
  estado?: string;
  [campo: string]: unknown;
}
export type OrganizationRecord = DirectoryRecord;
export type CitizenRecord = DirectoryRecord;

/**
 * Puerto de identidad (ADR-004, ADR-009): lo que M6 le pregunta a M1.
 * `null` es "no existe" (404); un registro inactivo vuelve con su `estado`.
 */
export abstract class IdentityPort {
  abstract findEmployeeBySub(sub: string): Promise<IdentityRecord | null>;
  abstract findCitizenById(id: string): Promise<CitizenRecord | null>;
  abstract findOrganizationById(id: string): Promise<OrganizationRecord | null>;
  abstract findOrganizationByCuit(cuit: string): Promise<OrganizationRecord | null>;
}

/** M1 deshabilitada, 401, 5xx, timeout o red. Nunca lleva el token ni el body de M1. */
export class IdentityUnavailableError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'IdentityUnavailableError';
  }
}
