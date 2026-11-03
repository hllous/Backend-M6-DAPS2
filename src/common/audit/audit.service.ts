import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { M6Role } from '../../auth/m6-role';
import { PaginatedResponseDto } from '../dto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditEntityType } from './audit-entity-type';
import { AuditLogResponseDto, QueryAuditDto } from './dto';

/** Quien actuó: sale del token (`req.user`), nunca del body. */
export interface AuditActor {
  userId: string;
  /** UUID de M1 para `updatedBy.id` hacia M2 (#485); no se audita. */
  actorId?: string | null;
  roles: M6Role[];
}

export interface AuditEntry {
  entityType: AuditEntityType;
  entityId: string;
  /** Qué se hizo, en MAYÚSCULAS (p. ej. `REPORT_DAMAGE`, `CREATE`, `DEACTIVATE`). */
  action: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  actor: AuditActor;
  /** Solo el motivo que el flujo ya pide. Nunca datos personales ni payloads. */
  note?: string | null;
}

const MAX_NOTE = 500;

/** El "estado" de los catálogos con baja lógica, para fromStatus/toStatus. */
export const activeState = (active: boolean): string => (active ? 'ACTIVE' : 'INACTIVE');

/**
 * Lado de escritura de la auditoría de dominio. Como el outbox, `record` exige el
 * cliente de la transacción: la fila y el cambio caen juntos o no caen.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(tx: Prisma.TransactionClient, entry: AuditEntry): Promise<void> {
    await tx.domainAuditLog.create({
      data: {
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
        fromStatus: entry.fromStatus ?? null,
        toStatus: entry.toStatus ?? null,
        actorUserId: entry.actor.userId,
        actorRoles: entry.actor.roles,
        note: entry.note ? entry.note.slice(0, MAX_NOTE) : null,
      },
    });
  }

  /** Historial de una entidad, el más reciente primero. */
  async findAll(query: QueryAuditDto): Promise<PaginatedResponseDto<AuditLogResponseDto>> {
    const where: Prisma.DomainAuditLogWhereInput = {
      ...(query.entityType && { entityType: query.entityType }),
      ...(query.entityId && { entityId: query.entityId }),
    };
    const [rows, total] = await Promise.all([
      this.prisma.domainAuditLog.findMany({
        where,
        skip: query.skip,
        take: query.take,
        // id desempata filas del mismo instante.
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.domainAuditLog.count({ where }),
    ]);
    return new PaginatedResponseDto(
      rows.map((r) => ({
        id: r.id,
        entityType: r.entityType,
        entityId: r.entityId,
        action: r.action,
        fromStatus: r.fromStatus,
        toStatus: r.toStatus,
        actorUserId: r.actorUserId,
        actorRoles: r.actorRoles,
        note: r.note,
        occurredAt: r.occurredAt,
      })),
      total,
      query.page,
      query.pageSize,
    );
  }
}
