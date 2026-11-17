import { Injectable } from '@nestjs/common';
import { DomainAuditLog, Prisma } from '@prisma/client';
import { M6Role } from '../../auth/m6-role';
import { PaginatedResponseDto } from '../dto';
import { PrismaService } from '../../prisma/prisma.service';
import { M4_ACTOR_ID } from './audit-actors';
import { AuditEntityType } from './audit-entity-type';
import { AuditHistoryItemDto, AuditLogResponseDto, QueryAuditDto } from './dto';
import { PaginationQueryDto } from '../dto';

/** Quien actuó: sale del token (`req.user`), nunca del body; en eventos entrantes es `system:<módulo>` (p. ej. `system:m3`). */
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

/** Un recurso Tier 2 entregado en una lectura (`recordRead`). */
export interface AuditTarget {
  entityType: AuditEntityType;
  entityId: string;
}

const MAX_NOTE = 500;

/** El "estado" de los catálogos con baja lógica, para fromStatus/toStatus. */
export const activeState = (active: boolean): string => (active ? 'ACTIVE' : 'INACTIVE');

/**
 * Lado de escritura de la auditoría de dominio. Como el outbox, `record` exige el
 * cliente de la transacción: la fila y el cambio caen juntos o no caen.
 * `recordRead` va sin transacción a propósito: una lectura no tiene cambio que acompañar.
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

  /**
   * Lectura de datos Tier 2 (ADR-005, #643): una fila `READ` por recurso entregado,
   * sin contenido. No hay transacción que acompañar, va directo; un solo
   * `createMany` para que caigan todas o ninguna. Si falla, el error sube y la
   * lectura da 500 sin entregar los datos: la auditoría es obligatoria.
   */
  async recordRead(targets: AuditTarget[], actor: AuditActor): Promise<void> {
    await this.prisma.domainAuditLog.createMany({
      data: targets.map((t) => ({
        entityType: t.entityType,
        entityId: t.entityId,
        action: 'READ',
        actorUserId: actor.userId,
        actorRoles: actor.roles,
      })),
    });
  }

  /** Historial de una entidad, el más reciente primero. */
  async findAll(query: QueryAuditDto): Promise<PaginatedResponseDto<AuditLogResponseDto>> {
    return this.paginate(
      {
        ...(query.entityType && { entityType: query.entityType }),
        ...(query.entityId && { entityId: query.entityId }),
      },
      query,
      (r) => ({
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
      }),
    );
  }

  /**
   * Historial de una entidad para quien no puede leer `GET /audit` (#728): sin actor ni
   * ids, y sin las filas `READ` (son la auditoría de lecturas Tier 2, no pasos de la
   * entidad). Quien llama ya validó que la entidad existe.
   */
  async findHistory(
    entityType: AuditEntityType,
    entityId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<AuditHistoryItemDto>> {
    return this.paginate({ entityType, entityId, action: { not: 'READ' } }, query, (r) => ({
      occurredAt: r.occurredAt,
      action: r.action,
      fromStatus: r.fromStatus,
      toStatus: r.toStatus,
      // El `note` de lo que escribe M4 es la decisión de la sanción (Tier 2, ADR-005):
      // sale del acta, que se audita al leerla. Acá no se entrega sin fila `READ`.
      note: r.actorUserId === M4_ACTOR_ID ? null : r.note,
    }));
  }

  private async paginate<T>(
    where: Prisma.DomainAuditLogWhereInput,
    query: PaginationQueryDto,
    map: (row: DomainAuditLog) => T,
  ): Promise<PaginatedResponseDto<T>> {
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
    return new PaginatedResponseDto(rows.map(map), total, query.page, query.pageSize);
  }
}
