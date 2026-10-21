import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Guard que valida que el usuario tenga al menos uno de los roles
 * requeridos por el endpoint (marcados con @Roles()).
 *
 * Si el endpoint no tiene @Roles(), permite el acceso (no restringe).
 *
 * Nota: `user.roles` es `[rol]`, el único rol que trae el token de M1 (sin
 * área). Ningún endpoint lo usa todavía; el modelo de roles de M6 es el #161.
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
