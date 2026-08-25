import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard que valida el JWT del request.
 * Delega a la JwtStrategy registrada en el módulo de Auth.
 *
 * Nota: la JwtStrategy se implementará en Fase 2 (Auth).
 * Este guard ya se puede referenciar en controllers.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
