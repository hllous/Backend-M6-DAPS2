import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateCrewDto,
  UpdateCrewDto,
  QueryCrewsDto,
  CrewResponseDto,
  AddCrewMembersDto,
  CreateCrewZoneAssignmentDto,
  CrewZoneAssignmentResponseDto,
} from './dto';
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

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crea una nueva cuadrilla.
   */
  async create(dto: CreateCrewDto): Promise<CrewResponseDto> {
    if (dto.homeZoneId) await this.assertZoneUsable(dto.homeZoneId);

    const crew = await this.prisma.crew.create({
      data: {
        name: dto.name,
        crewType: dto.crewType,
        defaultShift: dto.defaultShift,
        specialty: dto.specialty,
        homeZoneId: dto.homeZoneId ?? null,
        leaderUserId: dto.leaderUserId ? normalizeM1UserId(dto.leaderUserId) : null,
        leaderName: dto.leaderName || null,
        organizationId: dto.organizationId ?? null,
        organizationName: dto.organizationName || null,
        active: dto.active ?? true,
      },
      include: crewInclude(todayArgentina()),
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
  async update(id: string, dto: UpdateCrewDto): Promise<CrewResponseDto> {
    await this.ensureExists(id);
    if (dto.homeZoneId) await this.assertZoneUsable(dto.homeZoneId);

    const crew = await this.prisma.crew.update({
      where: { id },
      include: crewInclude(todayArgentina()),
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.defaultShift !== undefined && { defaultShift: dto.defaultShift }),
        ...(dto.leaderUserId !== undefined && {
          leaderUserId: dto.leaderUserId ? normalizeM1UserId(dto.leaderUserId) : null,
        }),
        ...(dto.organizationId !== undefined && { organizationId: dto.organizationId }),
        // Vacío y null borran el nombre guardado: no queda un "" que se muestre como nombre.
        ...(dto.leaderName !== undefined && { leaderName: dto.leaderName || null }),
        ...(dto.organizationName !== undefined && {
          organizationName: dto.organizationName || null,
        }),
        ...(dto.specialty !== undefined && { specialty: dto.specialty }),
        ...(dto.homeZoneId !== undefined && { homeZoneId: dto.homeZoneId }),
        ...(dto.active !== undefined && { active: dto.active }),
      },
    });

    this.logger.log(`Cuadrilla actualizada: ${crew.name} (${crew.id})`);
    return this.toResponseDto(crew);
  }

  /**
   * Soft-delete: marca la cuadrilla como inactiva.
   */
  async remove(id: string): Promise<void> {
    await this.ensureExists(id);

    await this.prisma.crew.update({
      where: { id },
      data: { active: false },
    });

    this.logger.log(`Cuadrilla desactivada: ${id}`);
  }

  /**
   * Agrega miembros a una cuadrilla.
   * Los que ya estaban se ignoran, salvo que traigan nombre: ahí se lo actualiza,
   * porque es la forma de corregir un nombre mal cargado sin quitar y volver a agregar.
   */
  async addMembers(crewId: string, dto: AddCrewMembersDto): Promise<CrewResponseDto> {
    await this.ensureExists(crewId);

    // `userIds` sigue valiendo por retrocompatibilidad; si un id viene en los dos,
    // gana el nombre de `members`.
    const entradas = new Map<string, string | null>();
    for (const userId of dto.userIds ?? []) entradas.set(normalizeM1UserId(userId), null);
    for (const m of dto.members ?? []) {
      const userId = normalizeM1UserId(m.userId);
      entradas.set(userId, m.displayName || entradas.get(userId) || null);
    }

    await this.prisma.$transaction(
      [...entradas].map(([userId, displayName]) =>
        this.prisma.crewMember.upsert({
          where: { crewId_userId: { crewId, userId } },
          create: { crewId, userId, displayName },
          update: displayName ? { displayName } : {},
        }),
      ),
    );

    this.logger.log(`Miembros agregados a cuadrilla ${crewId}: ${[...entradas.keys()].join(', ')}`);
    return this.findOne(crewId);
  }

  /**
   * Quita un miembro de una cuadrilla.
   */
  async removeMember(crewId: string, userId: string): Promise<void> {
    await this.ensureExists(crewId);

    const deleted = await this.prisma.crewMember.deleteMany({
      where: { crewId, userId },
    });

    if (deleted.count === 0) {
      throw new NotFoundException(`Usuario '${userId}' no es miembro de la cuadrilla '${crewId}'`);
    }

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
    actorId: string,
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

      return tx.crewZoneAssignment.create({
        data: {
          crewId,
          zoneId: dto.zoneId,
          validFrom,
          validTo,
          reason: dto.reason,
          createdBy: actorId,
        },
      });
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

  private async ensureExists(id: string): Promise<void> {
    const exists = await this.prisma.crew.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException(`Cuadrilla con id '${id}' no encontrada`);
    }
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
