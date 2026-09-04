import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

/**
 * Payload que este módulo espera del JWT.
 *
 * PROVISORIO: M1 todavía no publicó su claim set (ver docs/bloqueantes.md).
 * Asumimos el mínimo estándar —`sub` como identidad y `roles` como array de
 * strings— porque es lo que cubre cualquier forma razonable que elijan.
 */
export interface JwtPayload {
  sub: string;
  roles?: string[];
}

/** Lo que queda en `request.user`. Lo lee el decorador @CurrentUser(). */
export interface AuthenticatedUser {
  userId: string;
  roles: string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get<string>('jwt.secret'),
    });
  }

  // ponytail: verificación HS256 contra JWT_SECRET local, provisoria hasta que
  // M1 publique su contrato: algoritmo de firma, `iss`, `aud`, TTL y el nombre
  // del claim de roles. Cuando lleguen, lo único que cambia es este archivo:
  // `secretOrKey` (o `secretOrKeyProvider` si usan JWKS) y el mapeo de claims
  // de abajo. Los guards y los controllers no se tocan.
  validate(payload: JwtPayload): AuthenticatedUser {
    return { userId: payload.sub, roles: payload.roles ?? [] };
  }
}
