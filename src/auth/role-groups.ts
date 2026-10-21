import { M6Role } from './m6-role';

/**
 * Quién puede qué (matriz de #161, ADR-008). Una sola definición para todos los
 * @Roles. M6_ADMIN va en los de Oficina ("más todo lo de Oficina") pero no en
 * los de Campo: Oficina y Campo son excluyentes (ADR-005). M6_AUDITOR no figura
 * en ninguno: solo lee.
 *
 * Los de Campo no distinguen "lo suyo": que la cuadrilla actúe solo sobre sus
 * servicios es la fase de pertenencia (#365).
 */
export const ROLES_ADMIN = [M6Role.M6_ADMIN] as const;
export const ROLES_OPERACIONES = [M6Role.M6_ADMIN, M6Role.M6_OFICINA_OPERACIONES] as const;
export const ROLES_AMBIENTAL = [M6Role.M6_ADMIN, M6Role.M6_OFICINA_AMBIENTAL] as const;
export const ROLES_CUADRILLA = [M6Role.M6_CAMPO_CUADRILLA] as const;
export const ROLES_INSPECTOR = [M6Role.M6_CAMPO_INSPECTOR] as const;
export const ROLES_CAMPO = [M6Role.M6_CAMPO_CUADRILLA, M6Role.M6_CAMPO_INSPECTOR] as const;
// Abrir expediente: Oficina Ambiental, o el inspector de oficio.
export const ROLES_EXPEDIENTE_ALTA = [...ROLES_AMBIENTAL, M6Role.M6_CAMPO_INSPECTOR] as const;
