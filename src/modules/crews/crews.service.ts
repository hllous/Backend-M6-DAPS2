import {
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
} from './dto';
import { PaginatedResponseDto } from '../../common/dto';

@Injectable()
export class CrewsService {
  private readonly logger = new Logger(CrewsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crea una nueva cuadrilla.
   */
  async create(dto: CreateCrewDto): Promise<CrewResponseDto> {
    const crew = await this.prisma.crew.create({
      data: {
        name: dto.name,
        crewType: dto.crewType,
        defaultShift: dto.defaultShift,
        leaderUserId: dto.leaderUserId ?? null,
        organizationId: dto.organizationId ?? null,
        active: dto.active ?? true,
      },
    });

    this.logger.log(`Cuadrilla creada: ${crew.name} (${crew.id})`);
    return this.toResponseDto(crew);
  }

  /**
   * Lista cuadrillas con paginación y filtros opcionales.
   */
  async findAll(
    query: QueryCrewsDto,
  ): Promise<PaginatedResponseDto<CrewResponseDto>> {
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

    const [crews, total] = await Promise.all([
      this.prisma.crew.findMany({
        where,
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
      include: { members: true },
    });

    if (!crew) {
      throw new NotFoundException(`Cuadrilla con id '${id}' no encontrada`);
    }

    return this.toResponseDto(crew, true);
  }

  /**
   * Actualiza campos mutables de una cuadrilla.
   * crewType no se puede cambiar después de la creación.
   */
  async update(id: string, dto: UpdateCrewDto): Promise<CrewResponseDto> {
    await this.ensureExists(id);

    const crew = await this.prisma.crew.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.defaultShift !== undefined && { defaultShift: dto.defaultShift }),
        ...(dto.leaderUserId !== undefined && { leaderUserId: dto.leaderUserId }),
        ...(dto.organizationId !== undefined && { organizationId: dto.organizationId }),
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
   * Ignora duplicados silenciosamente (skipDuplicates).
   */
  async addMembers(
    crewId: string,
    dto: AddCrewMembersDto,
  ): Promise<CrewResponseDto> {
    await this.ensureExists(crewId);

    await this.prisma.crewMember.createMany({
      data: dto.userIds.map((userId) => ({
        crewId,
        userId,
      })),
      skipDuplicates: true,
    });

    this.logger.log(
      `Miembros agregados a cuadrilla ${crewId}: ${dto.userIds.join(', ')}`,
    );
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
      throw new NotFoundException(
        `Usuario '${userId}' no es miembro de la cuadrilla '${crewId}'`,
      );
    }

    this.logger.log(
      `Miembro '${userId}' removido de cuadrilla '${crewId}'`,
    );
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

  private toResponseDto(
    crew: any,
    includeMembers = false,
  ): CrewResponseDto {
    const dto: CrewResponseDto = {
      id: crew.id,
      name: crew.name,
      crewType: crew.crewType,
      defaultShift: crew.defaultShift,
      leaderUserId: crew.leaderUserId,
      organizationId: crew.organizationId,
      active: crew.active,
      createdAt: crew.createdAt,
      updatedAt: crew.updatedAt,
    };

    if (includeMembers && crew.members) {
      dto.members = crew.members.map((m: { userId: string }) => ({
        userId: m.userId,
      }));
    }

    return dto;
  }
}
