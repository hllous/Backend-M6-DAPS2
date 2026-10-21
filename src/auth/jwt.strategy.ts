import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

/**
 * Claims del access token de M1 (docs/integracion/m1.md). Firma, `iss` y
 * vencimiento los verifica passport-jwt; acá llegan los ya verificados.
 */
export interface JwtPayload {
  sub?: number | string;
  sub_type?: string;
  /** Un solo rol por usuario (no `roles[]`). */
  rol?: string;
  typ?: string;
  exp?: number;
}

export const SUB_TYPES = ['CIUDADANO', 'EMPLEADO'] as const;
export type SubType = (typeof SUB_TYPES)[number];

/** Lo que queda en `request.user`. Lo lee el decorador @CurrentUser(). */
export interface AuthenticatedUser {
  userId: string;
  /** Hoy siempre un elemento; array para no tocar RolesGuard (#161). */
  roles: string[];
  subType: SubType;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // M1 comparte la clave en base64: se verifica con los bytes, no con el texto.
      secretOrKey: Buffer.from(config.getOrThrow<string>('jwt.secret'), 'base64'),
      // Sin esto se aceptaría cualquier HS*.
      algorithms: ['HS256'],
      issuer: config.getOrThrow<string>('jwt.issuer'),
      ignoreExpiration: false,
    });
  }

  validate(payload: JwtPayload): AuthenticatedUser {
    // El refresh token comparte firma y emisor: solo `typ` lo distingue.
    if (payload.typ !== 'access') throw new UnauthorizedException();
    // jsonwebtoken acepta un token sin `exp`; M1 siempre lo emite.
    if (payload.exp === undefined) throw new UnauthorizedException();
    if (typeof payload.rol !== 'string' || payload.rol === '') throw new UnauthorizedException();
    const subType = SUB_TYPES.find((t) => t === payload.sub_type);
    if (!subType) throw new UnauthorizedException();
    if (!/^\d+$/.test(String(payload.sub ?? ''))) throw new UnauthorizedException();
    return { userId: String(payload.sub), roles: [payload.rol], subType };
  }
}
