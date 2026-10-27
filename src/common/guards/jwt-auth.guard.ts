import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { AuthenticatedUser } from '../../auth/jwt.strategy';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Guard que valida el JWT del request. Delega en la JwtStrategy de src/auth.
 *
 * Está registrado como APP_GUARD global en AppModule: protege todo por
 * defecto. Los endpoints que no requieren token se marcan con @Public().
 * M6 es solo para personal municipal: un token válido de CIUDADANO recibe 403
 * (token ausente o inválido sigue siendo 401).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    return isPublic ? true : super.canActivate(context);
  }

  handleRequest<T = AuthenticatedUser>(err: unknown, user: T | false): T {
    // super lanza 401 si hay error o no hay usuario.
    const authenticated = super.handleRequest(err, user, undefined, undefined as never) as T;
    if ((authenticated as AuthenticatedUser).subType !== 'EMPLEADO') {
      throw new ForbiddenException('Este sistema es solo para personal municipal');
    }
    return authenticated;
  }
}
