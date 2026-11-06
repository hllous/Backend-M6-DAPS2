import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditActor, AuditService, activeState } from '../../common/audit/audit.service';
import {
  CreateCrewDto,
  UpdateCrewDto,
  QueryCrewsDto,
  CrewResponseDto,
  AddCrewMembersDto,
  CreateCrewZoneAssignmentDto,
  CrewZoneAssignmentResponseDto,
} from './dto';
import { IdentityPort, IdentityUnavailableError } from '../../identity/identity.port';
import { PaginatedResponseDto } from '../../common/dto';
import { normalizeM1UserId } from '../../common/decorators';
import { toDateOnly, todayArgentina } from '../../common/utils/date-only';
import { reubicacionVigente, zonaEfectiva } from './crew-zone';

/**
 * Lo que hace falta para armar la respuesta: cuántos integrantes tiene y su
 * reubicación vigente hoy (a lo sumo una, ver `zonaEfectiva`).
 */
const crewInclude = (hoy: Date) =>
  ({
    _count: { select: { members: true } },
    zoneAssignments: {
      where: reubicacionVigente(hoy),
      orderBy: { validFrom: 'desc' },
      take: 1,
      select: { zoneId: true },
    },
  }) satisfies Prisma.CrewInclude;

type CrewRow = Prisma.CrewGetPayload<{ include: ReturnType<typeof crewInclude> }> & {
  members?: { userId: string; displayName: string | null }[];
};

@Injectable()
export class CrewsService {
  private readonly logger = new Logger(CrewsService.name);

  private avisoM1Emitido = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly identity: IdentityPort,
  ) {}

  /**
   * Crea una nueva cuadrilla.
   */
  async create(dto: CreateCrewDto, actor: AuditActor): Promise<CrewResponseDto> {
    if (dto.homeZoneId) await this.assertZoneUsable(dto.homeZoneId);
    const leaderUserId = dto.leaderUserId ? normalizeM1UserId(dto.leaderUserId) : null;
    const m1 = await this.validateAgainstM1(leaderUserId ? [leaderUserId] : []);

    const crew = await this.prisma.$transaction(async (tx) => {
      const created = await tx.crew.create({
        data: {
          name: dto.name,
          crewType: dto.crewType,
          defaultShift: dto.defaultShift,
          specialty: dto.specialty,
          homeZoneId: dto.homeZoneId ?? null,
          leaderUserId,
          leaderName: dto.leaderName || this.fullName(m1.get(leaderUserId ?? '')),
          organizationId: dto.organizationId ?? null,
          organizationName: dto.organizationName || null,
          active: dto.active ?? true,
        },
        include: crewInclude(todayArgentina()),
      });
      await this.audit.record(tx, {
        entityType: 'CREW',
        entityId: created.id,
        action: 'CREATE',
        toStatus: activeState(created.active),
        actor,
      });
      return created;
    });

    this.logger.log(`Cuadrilla creada: ${crew.name} (${crew.id})`);
    return this.toResponseDto(crew);
  }

  /**
   * Lista cuadrillas con paginación y filtros opcionales.
   */
  async findAll(query: QueryCrewsDto): Promise<PaginatedResponseDto<CrewResponseDto>> {
    const where: Prisma.CrewWhereInput = {};

    if (query.active !== undefined) {
      where.active = query.active;
    }

    if (query.crewType) {
      where.crewType = query.crewType;
    }

    if (query.defaultShift) {
      where.defaultShift = query.defaultShift;
    }

    if (query.specialty) {
      where.specialty = query.specialty;
    }

    // Zona efectiva hoy: la reubicación vigente manda; la base solo cuenta si la
    // cuadrilla no tiene ninguna vigente (si no, aparecería en dos zonas).
    const hoy = todayArgentina();
    if (query.zoneId) {
      where.OR = [
        { zoneAssignments: { some: { zoneId: query.zoneId, ...reubicacionVigente(hoy) } } },
        { homeZoneId: query.zoneId, zoneAssignments: { none: reubicacionVigente(hoy) } },
      ];
    }

    const [crews, total] = await Promise.all([
      this.prisma.crew.findMany({
        where,
        include: crewInclude(hoy),
        skip: query.skip,
        take: query.take,
        orderBy: { name: 'asc' },
      }),
      this.prisma.crew.count({ where }),
    ]);

    return new PaginatedResponseDto(
      crews.map((c) => this.toResponseDto(c)),
      total,
      query.page,
      query.pageSize,
    );
  }

  /**
   * Obtiene una cuadrilla por ID con sus miembros.
   */
  async findOne(id: string): Promise<CrewResponseDto> {
    const crew = await this.prisma.crew.findUnique({
      where: { id },
      include: { ...crewInclude(todayArgentina()), members: true },
    });

    if (!crew) {
      throw new NotFoundException(`Cuadrilla con id '${id}' no encontrada`);
    }

    return this.toResponseDto(crew);
  }

  /**
   * Actualiza campos mutables de una cuadrilla.
   * crewType no se puede cambiar después de la creación.
   */
  async update(id: string, dto: UpdateCrewDto, actor: AuditActor): Promise<CrewResponseDto> {
    const current = await this.ensureExists(id);
    if (dto.homeZoneId) await this.assertZoneUsable(dto.homeZoneId);
    // Solo se consulta un líder nuevo: reeditar otros campos no depende de M1.
    const newLeader = dto.leaderUserId ? normalizeM1UserId(dto.leaderUserId) : null;
    const m1 = await this.validateAgainstM1(
      newLeader && newLeader !== current.leaderUserId ? [newLeader] : [],
    );

    const crew = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.crew.update({
        where: { id },
        include: crewInclude(todayArgentina()),
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.defaultShift !== undefined && { defaultShift: dto.defaultShift }),
          ...(dto.leaderUserId !== undefined && { leaderUserId: newLeader }),
          ...(dto.organizationId !== undefined && { organizationId: dto.organizationId }),
          // Vacío y null borran el nombre guardado: no queda un "" que se muestre como nombre.
          ...(dto.leaderName !== undefined && { leaderName: dto.leaderName || null }),
          // Líder nuevo sin nombre en el dto: el de M1 reemplaza el del líder anterior.
          ...(dto.leaderName === undefined &&
            m1.has(newLeader ?? '') && { leaderName: this.fullName(m1.get(newLeader ?? '')) }),
          ...(dto.organizationName !== undefined && {
            organizationName: dto.organizationName || null,
          }),
          ...(dto.specialty !== undefined && { specialty: dto.specialty }),
          ...(dto.homeZoneId !== undefined && { homeZoneId: dto.homeZoneId }),
          ...(dto.active !== undefined && { active: dto.active }),
        },
      });
      // Solo el alta o la baja son auditables acá; el resto de los campos no son estado.
      if (dto.active !== undefined) {
        await this.audit.record(tx, {
          entityType: 'CREW',
          entityId: id,
          action: dto.active ? 'ACTIVATE' : 'DEACTIVATE',
          toStatus: activeState(dto.active),
          actor,
        });
      }
      return updated;
    });

    this.logger.log(`Cuadrilla actualizada: ${crew.name} (${crew.id})`);
    return this.toResponseDto(crew);
  }

  /**
   * Soft-delete: marca la cuadrilla como inactiva.
   */
  async remove(id: string, actor: AuditActor): Promise<void> {
    await this.ensureExists(id);

    await this.prisma.$transaction(async (tx) => {
      await tx.crew.update({
        where: { id },
        data: { active: false },
      });
      await this.audit.record(tx, {
        entityType: 'CREW',
        entityId: id,
        action: 'DEACTIVATE',
        toStatus: activeState(false),
        actor,
      });
    });

    this.logger.log(`Cuadrilla desactivada: ${id}`);
  }

  /**
   * Agrega miembros a una cuadrilla.
   * Los que ya estaban se ignoran, salvo que traigan nombre: ahí se lo actualiza,
   * porque es la forma de corregir un nombre mal cargado sin quitar y volver a agregar.
   */
  async addMembers(
    crewId: string,
    dto: AddCrewMembersDto,
    actor: AuditActor,
  ): Promise<CrewResponseDto> {
    await this.ensureExists(crewId);

    // `userIds` sigue valiendo por retrocompatibilidad; si un id viene en los dos,
    // gana el nombre de `members`.
    const entradas = new Map<string, string | null>();
    for (const userId of dto.userIds ?? []) entradas.set(normalizeM1UserId(userId), null);
    for (const m of dto.members ?? []) {
      const userId = normalizeM1UserId(m.userId);
      entradas.set(userId, m.displayName || entradas.get(userId) || null);
    }

    // Los que ya integran la cuadrilla ya se validaron al entrar: no se consultan de nuevo.
    const existentes = await this.prisma.crewMember.findMany({
      where: { crewId, userId: { in: [...entradas.keys()] } },
      select: { userId: true },
    });
    const yaEstan = new Set(existentes.map((e) => e.userId));
    const m1 = await this.validateAgainstM1([...entradas.keys()].filter((u) => !yaEstan.has(u)));

    await this.prisma.$transaction(async (tx) => {
      for (const [userId, displayName] of entradas) {
        await tx.crewMember.upsert({
          where: { crewId_userId: { crewId, userId } },
          create: { crewId, userId, displayName: displayName ?? this.fullName(m1.get(userId)) },
          update: displayName ? { displayName } : {},
        });
      }
      // Sin ids ni nombres en la nota: quién quedó en la cuadrilla se ve en la cuadrilla.
      await this.audit.record(tx, {
        entityType: 'CREW',
        entityId: crewId,
        action: 'ADD_MEMBERS',
        note: `${entradas.size} integrante/s`,
        actor,
      });
    });

    this.logger.log(`Miembros agregados a cuadrilla ${crewId}: ${[...entradas.keys()].join(', ')}`);
    return this.findOne(crewId);
  }

  /**
   * Quita un miembro de una cuadrilla.
   */
  async removeMember(crewId: string, userId: string, actor: AuditActor): Promise<void> {
    await this.ensureExists(crewId);

    await this.prisma.$transaction(async (tx) => {
      const deleted = await tx.crewMember.deleteMany({
        where: { crewId, userId },
      });

      if (deleted.count === 0) {
        throw new NotFoundException(
          `Usuario '${userId}' no es miembro de la cuadrilla '${crewId}'`,
        );
      }
      await this.audit.record(tx, {
        entityType: 'CREW',
        entityId: crewId,
        action: 'REMOVE_MEMBER',
        actor,
      });
    });

    this.logger.log(`Miembro '${userId}' removido de cuadrilla '${crewId}'`);
  }

  // ─── Reubicaciones de zona (sub-recurso) ────────────

  /**
   * Reubica la cuadrilla en otra zona por un período. No pisa la zona base:
   * al vencer, la cuadrilla vuelve sola a ella.
   */
  async createZoneAssignment(
    crewId: string,
    dto: CreateCrewZoneAssignmentDto,
    actor: AuditActor,
  ): Promise<CrewZoneAssignmentResponseDto> {
    await this.ensureExists(crewId);
    await this.assertZoneUsable(dto.zoneId);

    const validFrom = toDateOnly(dto.validFrom);
    const validTo = dto.validTo ? toDateOnly(dto.validTo) : null;
    if (validTo && validTo < validFrom) {
      throw new BadRequestException(
        `'validTo' (${dto.validTo}) no puede ser anterior a 'validFrom' (${dto.validFrom})`,
      );
    }

    // Una sola zona vigente por fecha: si los rangos se pisaran, "la efectiva"
    // dependería del orden en que se cargaron. El lock por cuadrilla serializa
    // las altas simultáneas: sin él, dos POST podían pasar el chequeo a la vez
    // y dejar dos vigentes. Se libera solo al cerrar la transacción.
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${crewId}))`;

      const choque = await tx.crewZoneAssignment.findFirst({
        where: {
          crewId,
          ...(validTo && { validFrom: { lte: validTo } }),
          OR: [{ validTo: null }, { validTo: { gte: validFrom } }],
        },
        select: { id: true },
      });
      if (choque) {
        throw new ConflictException(
          `La cuadrilla ya tiene una reubicación que se superpone con ese período (${choque.id})`,
        );
      }

      const created = await tx.crewZoneAssignment.create({
        data: {
          crewId,
          zoneId: dto.zoneId,
          validFrom,
          validTo,
          reason: dto.reason,
          createdBy: actor.userId,
        },
      });
      await this.audit.record(tx, {
        entityType: 'CREW',
        entityId: crewId,
        action: 'REASSIGN_ZONE',
        note: dto.reason,
        actor,
      });
      return created;
    });

    this.logger.log(`Cuadrilla ${crewId} reubicada en zona ${dto.zoneId} (${row.id})`);
    return this.toAssignmentDto(row);
  }

  /** Historial completo, la más reciente primero. Una cuadrilla tiene pocas: sin paginar. */
  async listZoneAssignments(crewId: string): Promise<CrewZoneAssignmentResponseDto[]> {
    await this.ensureExists(crewId);

    const rows = await this.prisma.crewZoneAssignment.findMany({
      where: { crewId },
      orderBy: [{ validFrom: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map((r) => this.toAssignmentDto(r));
  }

  // ─── Helpers ──────────────────────────────────────

  private async ensureExists(id: string): Promise<{ leaderUserId: string | null }> {
    const exists = await this.prisma.crew.findUnique({
      where: { id },
      select: { id: true, leaderUserId: true },
    });
    if (!exists) {
      throw new NotFoundException(`Cuadrilla con id '${id}' no encontrada`);
    }
    return exists;
  }

  private fullName(r?: { nombre: string; apellido: string }): string | null {
    return r ? `${r.nombre} ${r.apellido}`.trim() : null;
  }

  /**
   * Comprueba en M1 que cada `sub` sea un empleado activo (ADR-009). Se llama antes
   * de abrir la transacción: con M1 caída no se guarda nada. Todos los fallos
   * salen juntos en un solo 422. Sin M1_BASE_URL se omite (local, e2e, demo).
   */
  private async validateAgainstM1(subs: string[]) {
    const found = new Map<string, { nombre: string; apellido: string }>();
    const unicos = [...new Set(subs)];
    if (unicos.length === 0) return found;
    if (!this.identity.enabled) {
      if (!this.avisoM1Emitido) {
        this.avisoM1Emitido = true;
        this.logger.warn(
          'M1_BASE_URL sin configurar: no se validan líder ni integrantes contra M1',
        );
      }
      return found;
    }

    const inexistentes: string[] = [];
    const inactivos: string[] = [];
    try {
      // Lotes de 5 para no saturar a M1 con una cuadrilla grande.
      for (let i = 0; i < unicos.length; i += 5) {
        const lote = unicos.slice(i, i + 5);
        const res = await Promise.all(lote.map((s) => this.identity.findEmployeeBySub(s)));
        res.forEach((r, j) => {
          if (!r) inexistentes.push(lote[j]);
          else if (r.estado !== 'ACTIVO') inactivos.push(lote[j]);
          else found.set(lote[j], r);
        });
      }
    } catch (e) {
      if (!(e instanceof IdentityUnavailableError)) throw e;
      this.logger.error(`No se pudo validar contra M1: ${e.message}`);
      throw new ServiceUnavailableException(
        'No se pudo validar a los usuarios contra M1. Reintentá en unos minutos',
      );
    }

    const partes: string[] = [];
    if (inexistentes.length) partes.push(`no existen en M1: ${inexistentes.join(', ')}`);
    if (inactivos.length) partes.push(`están inactivos en M1: ${inactivos.join(', ')}`);
    if (partes.length) {
      throw new UnprocessableEntityException(`Usuarios inválidos (${partes.join('; ')})`);
    }
    return found;
  }

  private async assertZoneUsable(zoneId: string): Promise<void> {
    const zone = await this.prisma.zone.findUnique({
      where: { id: zoneId },
      select: { active: true, name: true },
    });
    if (!zone) {
      throw new NotFoundException(`Zona con id '${zoneId}' no encontrada`);
    }
    if (!zone.active) {
      throw new BadRequestException(`La zona '${zone.name}' está dada de baja`);
    }
  }

  private toAssignmentDto(row: {
    id: string;
    crewId: string;
    zoneId: string;
    validFrom: Date;
    validTo: Date | null;
    reason: string;
    createdBy: string;
    createdAt: Date;
  }): CrewZoneAssignmentResponseDto {
    return {
      id: row.id,
      crewId: row.crewId,
      zoneId: row.zoneId,
      validFrom: row.validFrom.toISOString().slice(0, 10),
      validTo: row.validTo?.toISOString().slice(0, 10) ?? null,
      reason: row.reason,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
    };
  }

  private toResponseDto(crew: CrewRow): CrewResponseDto {
    const dto: CrewResponseDto = {
      id: crew.id,
      name: crew.name,
      crewType: crew.crewType,
      defaultShift: crew.defaultShift,
      specialty: crew.specialty,
      homeZoneId: crew.homeZoneId,
      effectiveZoneId: zonaEfectiva(crew, crew.zoneAssignments),
      leaderUserId: crew.leaderUserId,
      leaderName: crew.leaderName,
      organizationId: crew.organizationId,
      organizationName: crew.organizationName,
      membersCount: crew._count.members,
      active: crew.active,
      createdAt: crew.createdAt,
      updatedAt: crew.updatedAt,
    };

    if (crew.members) {
      dto.members = crew.members.map((m) => ({
        userId: m.userId,
        displayName: m.displayName,
      }));
    }

    return dto;
  }
}
