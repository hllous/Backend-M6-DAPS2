import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedUser } from '../../auth/jwt.strategy';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ANY_EMPLOYEE_KEY, roleRequiredException, ROLES_KEY } from '../decorators/roles.decorator';

const LECTURA = new Set(['GET', 'HEAD']);

/**
 * Autorización por rol de M6. Global (APP_GUARD), registrado DESPUÉS de
 * JwtAuthGuard: este lee `request.user`, que el otro deja puesto.
 *
 * - `@Public()`: no se evalúa.
 * - `@Roles(...)`: el usuario necesita alguno.
 * - Sin `@Roles`: un GET/HEAD pide cualquier rol de M6 (el auditor incluido);
 *   una escritura falla cerrado para todos, así un endpoint nuevo al que se le
 *   olvidó el decorador no queda abierto.
 *
 * `user.roles` son los roles de M6 efectivos (JwtStrategy, ADR-008), no el rol
 * de M1. El 403 lleva `code: ROLE_REQUIRED` y no dice qué rol faltaba.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;
    if (this.reflector.getAllAndOverride<boolean>(ANY_EMPLOYEE_KEY, targets)) return true;

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, targets) ?? [];
    const request = context.switchToHttp().getRequest();
    const user: Partial<AuthenticatedUser> | undefined = request.user;
    const roles: string[] = user?.roles ?? [];
    const route = `${request.method} ${request.path}`;

    let allowed: boolean;
    if (requiredRoles.length > 0) {
      allowed = requiredRoles.some((role) => roles.includes(role));
    } else if (LECTURA.has(request.method)) {
      allowed = roles.length > 0;
    } else {
      allowed = false;
      this.logger.error(`Escritura sin @Roles, rechazada para todos (falta configurar): ${route}`);
    }

    if (!allowed) {
      // Para detectar abuso. Nunca el token ni el header Authorization.
      this.logger.warn(
        `Acceso denegado: usuario=${user?.userId ?? 'anónimo'} ${route} requiere=[${requiredRoles}]`,
      );
      throw roleRequiredException();
    }
    return true;
  }
}
