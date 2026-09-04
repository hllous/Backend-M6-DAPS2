import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Guard que valida que el usuario tenga al menos uno de los roles
 * requeridos por el endpoint (marcados con @Roles()).
 *
 * Si el endpoint no tiene @Roles(), permite el acceso (no restringe).
 *
 * Nota: el shape de `user.roles` depende del claim set de M1 — pendiente.
 * Por ahora se asume que el JwtStrategy pone un array de strings en user.roles.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user || !user.roles) {
      return false;
    }

    return requiredRoles.some((role) => user.roles.includes(role));
  }
}
