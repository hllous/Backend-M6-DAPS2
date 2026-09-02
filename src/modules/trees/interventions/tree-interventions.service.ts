import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Prisma, TreeInterventionStatus, TreeInterventionType } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CreateTreeInterventionDto,
  QueryTreeInterventionsDto,
  TreeInterventionResponseDto,
  AuthorizeInterventionDto,
} from './dto';
import { PaginatedResponseDto } from '../../../common/dto';

/**
 * Transiciones válidas de TreeIntervention:
 *   [*] → REQUESTED
 *   REQUESTED → PENDING_AUTHORIZATION (solo REMOVAL)
 *   REQUESTED → AUTHORIZED (podas — no requieren autorización)
 *   PENDING_AUTHORIZATION → AUTHORIZED
 *   PENDING_AUTHORIZATION → REJECTED
 */
const VALID_TRANSITIONS: Record<TreeInterventionStatus, TreeInterventionStatus[]> = {
  REQUESTED: [TreeInterventionStatus.PENDING_AUTHORIZATION, TreeInterventionStatus.AUTHORIZED],
  PENDING_AUTHORIZATION: [TreeInterventionStatus.AUTHORIZED, TreeInterventionStatus.REJECTED],
  AUTHORIZED: [],
  REJECTED: [],
};

@Injectable()
export class TreeInterventionsService {
  private readonly logger = new Logger(TreeInterventionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTreeInterventionDto): Promise<TreeInterventionResponseDto> {
    // Verificar que todos los árboles existen
    const trees = await this.prisma.tree.findMany({
      where: { id: { in: dto.treeIds } },
      select: { id: true },
    });

    if (trees.length !== dto.treeIds.length) {
      const foundIds = new Set(trees.map((t) => t.id));
      const missing = dto.treeIds.filter((id) => !foundIds.has(id));
      throw new NotFoundException(`Árboles no encontrados: ${missing.join(', ')}`);
    }

    const intervention = await this.prisma.treeIntervention.create({
      data: {
        interventionType: dto.interventionType,
        address: dto.address ?? null,
        requiresStreetClosure: dto.requiresStreetClosure ?? false,
        status: TreeInterventionStatus.REQUESTED,
        priority: dto.priority ?? null,
        justification: dto.justification ?? null,
        trees: {
          createMany: {
            data: dto.treeIds.map((treeId) => ({ treeId })),
          },
        },
      },
      include: { trees: true },
    });

    this.logger.log(
      `Intervención creada: ${intervention.id} (${intervention.interventionType}, ${dto.treeIds.length} árboles)`,
    );
    return this.toResponseDto(intervention);
  }

  async findAll(
    query: QueryTreeInterventionsDto,
  ): Promise<PaginatedResponseDto<TreeInterventionResponseDto>> {
    const where: Prisma.TreeInterventionWhereInput = {};

    if (query.interventionType) {
      where.interventionType = query.interventionType;
    }
    if (query.status) {
      where.status = query.status;
    }

    const [interventions, total] = await Promise.all([
      this.prisma.treeIntervention.findMany({
        where,
        include: { trees: true },
        skip: query.skip,
        take: query.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.treeIntervention.count({ where }),
    ]);

    return new PaginatedResponseDto(
      interventions.map((i) => this.toResponseDto(i)),
      total,
      query.page,
      query.pageSize,
    );
  }

  async findOne(id: string): Promise<TreeInterventionResponseDto> {
    const intervention = await this.prisma.treeIntervention.findUnique({
      where: { id },
      include: { trees: true },
    });

    if (!intervention) {
      throw new NotFoundException(`Intervención con id '${id}' no encontrada`);
    }

    return this.toResponseDto(intervention);
  }

  /**
   * REQUESTED → PENDING_AUTHORIZATION (para REMOVAL).
   */
  async submitForAuthorization(id: string): Promise<TreeInterventionResponseDto> {
    const intervention = await this.getIntervention(id);

    if (intervention.interventionType !== TreeInterventionType.REMOVAL) {
      throw new BadRequestException(
        'Solo las intervenciones de tipo REMOVAL requieren autorización',
      );
    }

    return this.transition(intervention, TreeInterventionStatus.PENDING_AUTHORIZATION);
  }

  /**
   * PENDING_AUTHORIZATION → AUTHORIZED (o REQUESTED → AUTHORIZED para podas).
   */
  async authorize(id: string, dto: AuthorizeInterventionDto): Promise<TreeInterventionResponseDto> {
    const intervention = await this.getIntervention(id);

    // Sin esto una extracción se autoriza directo desde REQUESTED y el control
    // de autorización queda salteado: la tabla de transiciones habilita
    // REQUESTED → AUTHORIZED, pero eso es para las podas, que no lo requieren.
    if (
      intervention.interventionType === TreeInterventionType.REMOVAL &&
      intervention.status === TreeInterventionStatus.REQUESTED
    ) {
      throw new ConflictException(
        'Una extracción debe pasar por PENDING_AUTHORIZATION antes de autorizarse. Usar POST /tree-interventions/:id/submit-for-authorization',
      );
    }

    return this.transition(intervention, TreeInterventionStatus.AUTHORIZED, {
      authorizedByUserId: dto.authorizedByUserId ?? null,
      authorizedAt: new Date(),
      ...(dto.justification && { justification: dto.justification }),
    });
  }

  /**
   * PENDING_AUTHORIZATION → REJECTED.
   */
  async reject(id: string): Promise<TreeInterventionResponseDto> {
    const intervention = await this.getIntervention(id);
    return this.transition(intervention, TreeInterventionStatus.REJECTED);
  }

  // ─── Helpers ──────────────────────────────────────

  private async getIntervention(id: string) {
    const intervention = await this.prisma.treeIntervention.findUnique({
      where: { id },
      include: { trees: true },
    });

    if (!intervention) {
      throw new NotFoundException(`Intervención con id '${id}' no encontrada`);
    }

    return intervention;
  }

  private async transition(
    intervention: any,
    targetStatus: TreeInterventionStatus,
    additionalData: Record<string, any> = {},
  ): Promise<TreeInterventionResponseDto> {
    const currentStatus = intervention.status as TreeInterventionStatus;
    const allowed = VALID_TRANSITIONS[currentStatus] ?? [];
    if (!allowed.includes(targetStatus)) {
      throw new ConflictException(
        `No se puede pasar de '${intervention.status}' a '${targetStatus}'. Transiciones válidas: [${allowed.join(', ')}]`,
      );
    }

    const updated = await this.prisma.treeIntervention.update({
      where: { id: intervention.id },
      data: { status: targetStatus, ...additionalData },
      include: { trees: true },
    });

    this.logger.log(`Intervención ${intervention.id}: ${intervention.status} → ${targetStatus}`);
    return this.toResponseDto(updated);
  }

  private toResponseDto(intervention: any): TreeInterventionResponseDto {
    return {
      id: intervention.id,
      interventionType: intervention.interventionType,
      status: intervention.status,
      serviceId: intervention.serviceId,
      address: intervention.address,
      requiresStreetClosure: intervention.requiresStreetClosure,
      priority: intervention.priority,
      authorizedByUserId: intervention.authorizedByUserId,
      authorizedAt: intervention.authorizedAt,
      justification: intervention.justification,
      trees: intervention.trees?.map((t: { treeId: string }) => ({
        treeId: t.treeId,
      })),
      createdAt: intervention.createdAt,
      updatedAt: intervention.updatedAt,
    };
  }
}
