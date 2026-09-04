import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { Container, Prisma, ContainerStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OutboxEntry, OutboxService } from '../../events/outbox/outbox.service';
import { AggregateType, EventType } from '../../events/event-types';
import { containerDamaged } from '../../events/payloads';
import {
  CreateContainerDto,
  UpdateContainerDto,
  QueryContainersDto,
  ContainerResponseDto,
  ReportDamageDto,
  ConfirmRelocationDto,
} from './dto';
import { PaginatedResponseDto } from '../../common/dto';

/**
 * Transiciones válidas de la máquina de estados de Container.
 * Derivado de docs/entidades/container.md
 *
 *   [*] → ACTIVE
 *   ACTIVE → OVERFLOWED (desborde)
 *   OVERFLOWED → ACTIVE (vaciado)
 *   ACTIVE → DAMAGED (daño)
 *   DAMAGED → UNDER_REPAIR
 *   UNDER_REPAIR → ACTIVE (reparación completa)
 *   DAMAGED → REMOVED (no admite reparación)
 *   ACTIVE → RELOCATING
 *   RELOCATING → ACTIVE (nueva ubicación)
 */
export const CONTAINER_TRANSITIONS: Record<ContainerStatus, ContainerStatus[]> = {
  ACTIVE: [ContainerStatus.OVERFLOWED, ContainerStatus.DAMAGED, ContainerStatus.RELOCATING],
  OVERFLOWED: [ContainerStatus.ACTIVE],
  DAMAGED: [ContainerStatus.UNDER_REPAIR, ContainerStatus.REMOVED],
  UNDER_REPAIR: [ContainerStatus.ACTIVE],
  RELOCATING: [ContainerStatus.ACTIVE],
  REMOVED: [],
};

@Injectable()
export class ContainersService {
  private readonly logger = new Logger(ContainersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  // ─── CRUD ──────────────────────────────────────────

  async create(dto: CreateContainerDto): Promise<ContainerResponseDto> {
    try {
      const container = await this.prisma.container.create({
        data: {
          code: dto.code,
          containerType: dto.containerType,
          zoneId: dto.zoneId,
          capacityLiters: dto.capacityLiters,
          address: dto.address ?? null,
          lat: dto.lat ?? null,
          lng: dto.lng ?? null,
          status: ContainerStatus.ACTIVE,
        },
      });

      this.logger.log(`Contenedor registrado: ${container.code} (${container.id})`);
      return this.toResponseDto(container);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(`Ya existe un contenedor con el código '${dto.code}'`);
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new NotFoundException(`Zona con id '${dto.zoneId}' no encontrada`);
      }
      throw error;
    }
  }

  async findAll(query: QueryContainersDto): Promise<PaginatedResponseDto<ContainerResponseDto>> {
    const where: Prisma.ContainerWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }
    if (query.containerType) {
      where.containerType = query.containerType;
    }
    if (query.zoneId) {
      where.zoneId = query.zoneId;
    }
    if (query.search) {
      where.address = { contains: query.search, mode: 'insensitive' };
    }

    const [containers, total] = await Promise.all([
      this.prisma.container.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: { code: 'asc' },
      }),
      this.prisma.container.count({ where }),
    ]);

    return new PaginatedResponseDto(
      containers.map((c) => this.toResponseDto(c)),
      total,
      query.page,
      query.pageSize,
    );
  }

  async findOne(id: string): Promise<ContainerResponseDto> {
    const container = await this.prisma.container.findUnique({
      where: { id },
    });

    if (!container) {
      throw new NotFoundException(`Contenedor con id '${id}' no encontrado`);
    }

    return this.toResponseDto(container);
  }

  async update(id: string, dto: UpdateContainerDto): Promise<ContainerResponseDto> {
    await this.ensureExists(id);

    try {
      const container = await this.prisma.container.update({
        where: { id },
        data: {
          ...(dto.zoneId !== undefined && { zoneId: dto.zoneId }),
          ...(dto.capacityLiters !== undefined && {
            capacityLiters: dto.capacityLiters,
          }),
          ...(dto.address !== undefined && { address: dto.address }),
          ...(dto.lat !== undefined && { lat: dto.lat }),
          ...(dto.lng !== undefined && { lng: dto.lng }),
        },
      });

      this.logger.log(`Contenedor actualizado: ${container.code} (${container.id})`);
      return this.toResponseDto(container);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new NotFoundException(`Zona con id '${dto.zoneId}' no encontrada`);
      }
      throw error;
    }
  }

  // ─── Transiciones de estado ────────────────────────

  /** ACTIVE → OVERFLOWED */
  async reportOverflow(id: string): Promise<ContainerResponseDto> {
    return this.transition(id, ContainerStatus.OVERFLOWED);
  }

  /** OVERFLOWED → ACTIVE */
  async empty(id: string): Promise<ContainerResponseDto> {
    return this.transition(id, ContainerStatus.ACTIVE, {
      // Limpiar campos de daño por si viniera de un flujo anterior
      damageType: null,
      severity: null,
      requiresPublicWorks: null,
    });
  }

  /** ACTIVE → DAMAGED */
  async reportDamage(id: string, dto: ReportDamageDto): Promise<ContainerResponseDto> {
    return this.transition(
      id,
      ContainerStatus.DAMAGED,
      {
        damageType: dto.damageType,
        severity: dto.severity,
        requiresPublicWorks: dto.requiresPublicWorks ?? false,
      },
      // requiresPublicWorks = true es lo que hace que a M3 le sirva el evento.
      (container) => ({
        eventType: EventType.CONTAINER_DAMAGED,
        aggregateType: AggregateType.CONTAINER,
        aggregateId: container.id,
        payload: containerDamaged(container),
      }),
    );
  }

  /** DAMAGED → UNDER_REPAIR */
  async startRepair(id: string): Promise<ContainerResponseDto> {
    return this.transition(id, ContainerStatus.UNDER_REPAIR);
  }

  /** UNDER_REPAIR → ACTIVE */
  async completeRepair(id: string): Promise<ContainerResponseDto> {
    return this.transition(id, ContainerStatus.ACTIVE, {
      damageType: null,
      severity: null,
      requiresPublicWorks: null,
    });
  }

  /** ACTIVE → RELOCATING */
  async relocate(id: string): Promise<ContainerResponseDto> {
    return this.transition(id, ContainerStatus.RELOCATING);
  }

  /** RELOCATING → ACTIVE (con nueva ubicación) */
  async confirmRelocation(id: string, dto: ConfirmRelocationDto): Promise<ContainerResponseDto> {
    return this.transition(id, ContainerStatus.ACTIVE, {
      address: dto.address,
      lat: dto.lat ?? null,
      lng: dto.lng ?? null,
    });
  }

  /** DAMAGED → REMOVED (no admite reparación) */
  async remove(id: string): Promise<ContainerResponseDto> {
    return this.transition(id, ContainerStatus.REMOVED);
  }

  // ─── Helpers ──────────────────────────────────────

  /**
   * Ejecuta una transición de estado validada.
   * Lanza ConflictException si la transición no es válida.
   */
  private async transition(
    id: string,
    targetStatus: ContainerStatus,
    additionalData: Record<string, any> = {},
    // Si viene, la fila del outbox se escribe en la MISMA transaccion que el
    // cambio de estado: o quedan los dos, o no queda ninguno.
    event?: (container: Container) => OutboxEntry,
  ): Promise<ContainerResponseDto> {
    const container = await this.prisma.container.findUnique({
      where: { id },
    });

    if (!container) {
      throw new NotFoundException(`Contenedor con id '${id}' no encontrado`);
    }

    const allowed = CONTAINER_TRANSITIONS[container.status] ?? [];
    if (!allowed.includes(targetStatus)) {
      throw new ConflictException(
        `No se puede pasar de '${container.status}' a '${targetStatus}'. Transiciones válidas desde '${container.status}': [${allowed.join(', ')}]`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.container.update({
        where: { id },
        data: {
          status: targetStatus,
          ...additionalData,
        },
      });
      if (event) await this.outbox.enqueue(tx, event(row));
      return row;
    });

    this.logger.log(`Contenedor ${container.code}: ${container.status} → ${targetStatus}`);
    return this.toResponseDto(updated);
  }

  private async ensureExists(id: string): Promise<void> {
    const exists = await this.prisma.container.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException(`Contenedor con id '${id}' no encontrado`);
    }
  }

  private toResponseDto(container: any): ContainerResponseDto {
    return {
      id: container.id,
      code: container.code,
      containerType: container.containerType,
      zoneId: container.zoneId,
      address: container.address,
      lat: container.lat === null ? null : Number(container.lat),
      lng: container.lng === null ? null : Number(container.lng),
      capacityLiters: container.capacityLiters,
      status: container.status,
      damageType: container.damageType,
      severity: container.severity,
      requiresPublicWorks: container.requiresPublicWorks,
      createdAt: container.createdAt,
      updatedAt: container.updatedAt,
    };
  }
}
