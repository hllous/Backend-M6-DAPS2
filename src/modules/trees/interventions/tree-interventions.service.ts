import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import {
  M6Role,
  Prisma,
  ServiceMode,
  TreeInterventionStatus,
  TreeInterventionType,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  AssignInterventionServiceDto,
  CreateTreeInterventionDto,
  QueryTreeInterventionsDto,
  TreeInterventionResponseDto,
  AuthorizeInterventionDto,
} from './dto';
import { PaginatedResponseDto } from '../../../common/dto';
import { roleRequiredException } from '../../../common/decorators';

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

  async create(
    dto: CreateTreeInterventionDto,
    userId: string,
  ): Promise<TreeInterventionResponseDto> {
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
        // Quién solicita lo dice el token: sin esto no se puede auditar la separación de funciones.
        requestedByUserId: userId,
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
    if (query.priority) {
      where.priority = query.priority;
    }
    if (query.treeId) {
      where.trees = { some: { treeId: query.treeId } };
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
  async authorize(
    id: string,
    dto: AuthorizeInterventionDto,
    userId: string,
    roles: readonly M6Role[] = [],
  ): Promise<TreeInterventionResponseDto> {
    const intervention = await this.getIntervention(id);
    this.assertCanDecideRemoval(intervention, userId, roles);

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

    return this.transition(
      intervention,
      TreeInterventionStatus.AUTHORIZED,
      {
        // Quién autoriza lo dice el token, nunca el body (dto.authorizedByUserId está deprecado e ignorado).
        authorizedByUserId: userId,
        authorizedAt: new Date(),
        ...(dto.justification && { justification: dto.justification }),
      },
      userId,
    );
  }

  /**
   * PENDING_AUTHORIZATION → REJECTED.
   */
  async reject(
    id: string,
    userId: string,
    roles: readonly M6Role[] = [],
  ): Promise<TreeInterventionResponseDto> {
    const intervention = await this.getIntervention(id);
    this.assertCanDecideRemoval(intervention, userId, roles);
    return this.transition(intervention, TreeInterventionStatus.REJECTED, {}, userId);
  }

  /**
   * Asocia la intervención al Service que la ejecuta.
   *
   * La intervención guarda **qué** hay que hacer; el servicio, **cuándo, con
   * qué cuadrilla y cómo terminó** (docs/entidades/tree-intervention.md). Solo
   * se programa lo autorizado, y un servicio ejecuta una sola intervención:
   * TreeIntervention.serviceId es @unique.
   */
  async assignService(
    id: string,
    dto: AssignInterventionServiceDto,
  ): Promise<TreeInterventionResponseDto> {
    const intervention = await this.getIntervention(id);

    if (intervention.status !== TreeInterventionStatus.AUTHORIZED) {
      throw new ConflictException(
        `Solo se programa una intervención autorizada (esta está en ${intervention.status})`,
      );
    }
    if (intervention.serviceId) {
      throw new ConflictException(
        `La intervención ya está asociada al servicio '${intervention.serviceId}'`,
      );
    }

    const service = await this.prisma.service.findUnique({ where: { id: dto.serviceId } });
    if (!service) {
      throw new NotFoundException(`Servicio con id '${dto.serviceId}' no encontrado`);
    }
    if (service.mode !== ServiceMode.POINT) {
      throw new BadRequestException(
        `Una intervención de arbolado se ejecuta sobre un objetivo puntual, así que el servicio tiene que ser de modo POINT (este es ${service.mode})`,
      );
    }

    try {
      // Sin evento hacia M7: solo consume streetClosureRequested (#345).
      const updated = await this.prisma.treeIntervention.update({
        where: { id },
        data: { serviceId: dto.serviceId },
        include: { trees: true },
      });

      this.logger.log(`Intervención ${id}: asociada al servicio ${dto.serviceId}`);
      return this.toResponseDto(updated);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(`El servicio '${dto.serviceId}' ya ejecuta otra intervención`);
      }
      throw error;
    }
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

  /**
   * Autorizar o rechazar una extracción es decisión del responsable de área
   * (M6_ADMIN), no de quien la solicita. Se chequea acá y no solo en @Roles porque
   * la misma ruta sirve a las podas, que no requieren autorización. Un admin puede
   * decidir sobre lo que él mismo solicitó: queda registrado en requestedByUserId.
   */
  private assertCanDecideRemoval(
    intervention: { id: string; interventionType: TreeInterventionType },
    userId: string,
    roles: readonly M6Role[],
  ): void {
    if (
      intervention.interventionType === TreeInterventionType.REMOVAL &&
      !roles.includes(M6Role.M6_ADMIN)
    ) {
      // Para detectar quién intenta decidir una extracción sin ser responsable de área.
      this.logger.warn(
        `Decisión sobre extracción denegada: usuario=${userId} intervención=${intervention.id} (requiere M6_ADMIN)`,
      );
      throw roleRequiredException();
    }
  }

  private async transition(
    intervention: any,
    targetStatus: TreeInterventionStatus,
    additionalData: Record<string, any> = {},
    userId?: string,
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

    this.logger.log(
      `Intervención ${intervention.id}: ${intervention.status} → ${targetStatus}${userId ? ` (usuario ${userId})` : ''}`,
    );
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
      requestedByUserId: intervention.requestedByUserId,
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
