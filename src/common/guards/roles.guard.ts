import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Guard que valida que el usuario tenga al menos uno de los roles
 * requeridos por el endpoint (marcados con @Roles()).
 *
 * Si el endpoint no tiene @Roles(), permite el acceso (no restringe).
 *
 * `user.roles` son los roles de M6 efectivos (JwtStrategy, ADR-008), no el rol
 * de M1. Todavía no es global: solo lo usa role-assignments (PR 2 de #161).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const { user } = request;

    const allowed = !!user?.roles && requiredRoles.some((role) => user.roles.includes(role));
    if (!allowed) {
      // Para detectar abuso. Nunca el token ni el header Authorization.
      this.logger.warn(
        `Acceso denegado: usuario=${user?.userId ?? 'anónimo'} ${request.method} ${request.path} requiere=[${requiredRoles}]`,
      );
    }
    return allowed;
  }
}
