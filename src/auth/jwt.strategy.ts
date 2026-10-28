import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { M1RoleAdapter } from './m1-role.adapter';
import { CAMPO_ROLES, M6Role, OFICINA_ROLES } from './m6-role';

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
  subType: SubType;
  /** El rol único de M1, tal cual vino en el token. */
  m1Role: string;
  /** Roles de M6 efectivos (ADR-008), no el rol de M1. */
  roles: M6Role[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly bootstrapAdmins: ReadonlySet<string>;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly adapter: M1RoleAdapter,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // M1 comparte la clave en base64: se verifica con los bytes, no con el texto.
      secretOrKey: Buffer.from(config.getOrThrow<string>('jwt.secret'), 'base64'),
      // Solo HMAC (M1 v3.1: JJWT elige HS256/384/512 según el largo de la clave); sin lista se aceptaría cualquier alg.
      algorithms: ['HS256', 'HS384', 'HS512'],
      issuer: config.getOrThrow<string>('jwt.issuer'),
      ignoreExpiration: false,
    });
    this.bootstrapAdmins = new Set(config.get<string[]>('bootstrapAdminUserIds') ?? []);
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    // El refresh token comparte firma y emisor: solo `typ` lo distingue.
    if (payload.typ !== 'access') throw new UnauthorizedException();
    // jsonwebtoken acepta un token sin `exp`; M1 siempre lo emite.
    if (payload.exp === undefined) throw new UnauthorizedException();
    if (typeof payload.rol !== 'string' || payload.rol === '') throw new UnauthorizedException();
    const subType = SUB_TYPES.find((t) => t === payload.sub_type);
    if (!subType) throw new UnauthorizedException();
    if (!/^\d+$/.test(String(payload.sub ?? ''))) throw new UnauthorizedException();
    // Misma forma que en la tabla y en el bootstrap: sin ceros a la izquierda.
    const userId = BigInt(String(payload.sub)).toString();
    return {
      userId,
      subType,
      m1Role: payload.rol,
      roles: await this.effectiveRoles(userId, payload.rol),
    };
  }

  /**
   * (filas de la tabla ∪ M6_ADMIN si es admin de bootstrap) ∩ lo que su rol de
   * M1 permite. La tabla se lee en cada request, sin caché: un cambio de rol o
   * de asignación rige en la próxima request, no cuando vence el token de 15 min.
   */
  private async effectiveRoles(userId: string, m1Role: string): Promise<M6Role[]> {
    const allowed = this.adapter.assignableRoles(m1Role);
    if (allowed.length === 0) return []; // sin acceso: ni se consulta la base
    const rows = await this.prisma.userRoleAssignment.findMany({
      where: { userId },
      select: { role: true },
    });
    const assigned = new Set<M6Role>(rows.map((r) => r.role));
    if (this.bootstrapAdmins.has(userId)) assigned.add(M6Role.M6_ADMIN);
    const effective = allowed.filter((r) => assigned.has(r));
    // ADR-005: Oficina y Campo no conviven. Si el bootstrap o una fila cargada a
    // mano los mezcla, ganan los de Oficina (el admin no pierde su acceso).
    if (
      effective.some((r) => CAMPO_ROLES.includes(r)) &&
      effective.some((r) => OFICINA_ROLES.includes(r))
    ) {
      return effective.filter((r) => !CAMPO_ROLES.includes(r));
    }
    return effective;
  }
}
