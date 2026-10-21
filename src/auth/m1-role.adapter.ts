import { Injectable, Logger } from '@nestjs/common';
import { CAMPO_ROLES, M6Role, OFICINA_ROLES } from './m6-role';

const OPERATIVOS: readonly M6Role[] = [
  ...OFICINA_ROLES.filter((r) => r !== M6Role.M6_ADMIN),
  ...CAMPO_ROLES,
];

/**
 * Rol de M1 -> roles de M6 que se le pueden ASIGNAR a esa persona. Ningún rol de
 * M1 da un rol de M6 por sí solo: M1 no tiene área, así que la asignación la
 * hace un M6_ADMIN y esto es el techo (docs/decisiones/adr-008).
 */
const ASIGNABLES: Readonly<Record<string, readonly M6Role[]>> = {
  CIUDADANO: [],
  PERSONA: [], // nombre viejo de CIUDADANO en M1
  MESA_ENTRADAS: [],
  SERVICIO: [], // lo tiene M9; sus eventos entran por RabbitMQ, no por JWT
  ADMINISTRATIVO: OPERATIVOS,
  RESPONSABLE_AREA: [M6Role.M6_ADMIN, ...OPERATIVOS],
  AUDITOR: [M6Role.M6_AUDITOR],
};

@Injectable()
export class M1RoleAdapter {
  private readonly logger = new Logger(M1RoleAdapter.name);

  assignableRoles(m1Role: string): readonly M6Role[] {
    // hasOwn: 'constructor' o '__proto__' no son roles.
    if (Object.prototype.hasOwnProperty.call(ASIGNABLES, m1Role)) return ASIGNABLES[m1Role];
    // Denegar por defecto. El valor viene de un token firmado, pero se acota igual.
    this.logger.warn(
      `Rol de M1 desconocido, sin acceso a M6: ${JSON.stringify(m1Role.slice(0, 40))}`,
    );
    return [];
  }
}
