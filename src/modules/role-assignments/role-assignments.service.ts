import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, RoleAssignmentAction } from '@prisma/client';
import { CAMPO_ROLES, M6Role, OFICINA_ROLES } from '../../auth/m6-role';
import { PaginatedResponseDto } from '../../common/dto';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryRoleAssignmentsDto, RoleAssignmentResponseDto } from './dto';

/**
 * Asignación de roles de M6 (ADR-008). La validación contra el rol de M1 del
 * destinatario NO se hace acá: M6 no tiene directorio de M1 y no sabe qué rol
 * tiene un `userId` hasta que ese usuario llega con un token. Rige al leer, por
 * la intersección de JwtStrategy: un rol asignado que M1 no permite no es efectivo.
 */
@Injectable()
export class RoleAssignmentsService implements OnModuleInit {
  private readonly logger = new Logger(RoleAssignmentsService.name);
  private readonly bootstrapAdminCount: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.bootstrapAdminCount = (config.get<string[]>('bootstrapAdminUserIds') ?? []).length;
  }

  onModuleInit(): void {
    // Solo la cuenta: los ids identifican cuentas con poder y no hace falta
    // dejarlos en los logs de la plataforma para saber si la variable se cargó.
    this.logger.log(
      this.bootstrapAdminCount
        ? `Admins de bootstrap (M6_BOOTSTRAP_ADMIN_USER_IDS): ${this.bootstrapAdminCount}`
        : 'Sin admins de bootstrap (M6_BOOTSTRAP_ADMIN_USER_IDS vacía): solo los M6_ADMIN de la tabla pueden asignar roles',
    );
  }

  async findAll(
    query: QueryRoleAssignmentsDto,
  ): Promise<PaginatedResponseDto<RoleAssignmentResponseDto>> {
    // ponytail: agrupa en memoria; el padrón es el personal de M6 (decenas).
    // Con miles de usuarios, paginar con una consulta SQL propia.
    const groups = await this.prisma.userRoleAssignment.groupBy({
      by: ['userId'],
      orderBy: { userId: 'asc' },
    });
    const ids = groups.map((g) => g.userId).slice(query.skip, query.skip + query.take);
    const rows = await this.prisma.userRoleAssignment.findMany({
      where: { userId: { in: ids } },
      orderBy: { role: 'asc' },
    });
    const data = ids.map((userId) => ({
      userId,
      roles: rows.filter((r) => r.userId === userId).map((r) => r.role),
    }));
    return new PaginatedResponseDto(data, groups.length, query.page, query.pageSize);
  }

  async findOne(userId: string): Promise<RoleAssignmentResponseDto> {
    const rows = await this.prisma.userRoleAssignment.findMany({
      where: { userId },
      orderBy: { role: 'asc' },
    });
    return { userId, roles: rows.map((r) => r.role) };
  }

  /**
   * Reemplaza el conjunto de roles. Alta/baja de filas y su auditoría van en la
   * misma transacción; Serializable para que dos admins quitándose el rol a la
   * vez no dejen el sistema sin ninguno.
   */
  async replace(
    actorUserId: string,
    userId: string,
    roles: M6Role[],
  ): Promise<RoleAssignmentResponseDto> {
    const wanted = [...new Set(roles)];
    if (
      wanted.some((r) => OFICINA_ROLES.includes(r)) &&
      wanted.some((r) => CAMPO_ROLES.includes(r))
    ) {
      throw new BadRequestException(
        'Los roles de Oficina (M6_ADMIN, M6_OFICINA_*) y de Campo (M6_CAMPO_*) son excluyentes',
      );
    }

    try {
      await this.prisma.$transaction(
        async (tx) => {
          const current = (await tx.userRoleAssignment.findMany({ where: { userId } })).map(
            (r) => r.role,
          );
          const toGrant = wanted.filter((r) => !current.includes(r));
          const toRevoke = current.filter((r) => !wanted.includes(r));
          if (toGrant.length === 0 && toRevoke.length === 0) return;

          if (toRevoke.includes(M6Role.M6_ADMIN) && this.bootstrapAdminCount === 0) {
            const others = await tx.userRoleAssignment.count({
              where: { role: M6Role.M6_ADMIN, userId: { not: userId } },
            });
            if (others === 0) {
              throw new ConflictException(
                'No se puede quitar el último M6_ADMIN: el sistema quedaría sin quien asigne roles',
              );
            }
          }

          await tx.userRoleAssignment.deleteMany({ where: { userId, role: { in: toRevoke } } });
          await tx.userRoleAssignment.createMany({
            data: toGrant.map((role) => ({ userId, role })),
          });
          await tx.roleAssignmentAudit.createMany({
            data: [
              ...toGrant.map((role) => ({
                actorUserId,
                targetUserId: userId,
                action: RoleAssignmentAction.GRANT,
                role,
              })),
              ...toRevoke.map((role) => ({
                actorUserId,
                targetUserId: userId,
                action: RoleAssignmentAction.REVOKE,
                role,
              })),
            ],
          });
          this.logger.log(
            `Roles de ${userId} cambiados por ${actorUserId}: +[${toGrant}] -[${toRevoke}]`,
          );
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      // P2034: conflicto de serialización con otro cambio simultáneo.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        throw new ConflictException('Otro cambio de roles se estaba aplicando: reintentá');
      }
      throw error;
    }
    return this.findOne(userId);
  }

  /** Quita todos los roles. Idempotente: sin filas no hace nada ni audita. */
  async remove(actorUserId: string, userId: string): Promise<void> {
    await this.replace(actorUserId, userId, []);
  }
}
