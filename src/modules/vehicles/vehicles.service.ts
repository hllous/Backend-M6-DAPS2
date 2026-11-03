import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditActor, AuditService, activeState } from '../../common/audit/audit.service';
import { CreateVehicleDto, UpdateVehicleDto, QueryVehiclesDto, VehicleResponseDto } from './dto';
import { PaginatedResponseDto } from '../../common/dto';

@Injectable()
export class VehiclesService {
  private readonly logger = new Logger(VehiclesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Registra un nuevo vehículo.
   * Falla si la patente ya existe (unique constraint).
   */
  async create(dto: CreateVehicleDto, actor: AuditActor): Promise<VehicleResponseDto> {
    try {
      const vehicle = await this.prisma.$transaction(async (tx) => {
        const created = await tx.vehicle.create({
          data: {
            plate: dto.plate,
            vehicleType: dto.vehicleType,
            capacity: dto.capacity ?? null,
            active: dto.active ?? true,
          },
        });
        await this.audit.record(tx, {
          entityType: 'VEHICLE',
          entityId: created.id,
          action: 'CREATE',
          toStatus: activeState(created.active),
          actor,
        });
        return created;
      });

      this.logger.log(`Vehículo registrado: ${vehicle.plate} (${vehicle.id})`);
      return this.toResponseDto(vehicle);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(`Ya existe un vehículo con la patente '${dto.plate}'`);
      }
      throw error;
    }
  }

  /**
   * Lista vehículos con paginación y filtros opcionales.
   */
  async findAll(query: QueryVehiclesDto): Promise<PaginatedResponseDto<VehicleResponseDto>> {
    const where: Prisma.VehicleWhereInput = {};

    if (query.active !== undefined) {
      where.active = query.active;
    }

    if (query.vehicleType) {
      where.vehicleType = query.vehicleType;
    }

    const [vehicles, total] = await Promise.all([
      this.prisma.vehicle.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: { plate: 'asc' },
      }),
      this.prisma.vehicle.count({ where }),
    ]);

    return new PaginatedResponseDto(
      vehicles.map((v) => this.toResponseDto(v)),
      total,
      query.page,
      query.pageSize,
    );
  }

  /**
   * Obtiene un vehículo por ID.
   */
  async findOne(id: string): Promise<VehicleResponseDto> {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id },
    });

    if (!vehicle) {
      throw new NotFoundException(`Vehículo con id '${id}' no encontrado`);
    }

    return this.toResponseDto(vehicle);
  }

  /**
   * Actualiza campos mutables de un vehículo (plate, capacity, active).
   * vehicleType no se puede cambiar después de la creación.
   */
  async update(id: string, dto: UpdateVehicleDto, actor: AuditActor): Promise<VehicleResponseDto> {
    await this.ensureExists(id);

    try {
      const vehicle = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.vehicle.update({
          where: { id },
          data: {
            ...(dto.plate !== undefined && { plate: dto.plate }),
            ...(dto.capacity !== undefined && { capacity: dto.capacity }),
            ...(dto.active !== undefined && { active: dto.active }),
          },
        });
        // Solo el alta o la baja son auditables acá; el resto de los campos no son estado.
        if (dto.active !== undefined) {
          await this.audit.record(tx, {
            entityType: 'VEHICLE',
            entityId: id,
            action: dto.active ? 'ACTIVATE' : 'DEACTIVATE',
            toStatus: activeState(dto.active),
            actor,
          });
        }
        return updated;
      });

      this.logger.log(`Vehículo actualizado: ${vehicle.plate} (${vehicle.id})`);
      return this.toResponseDto(vehicle);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(`Ya existe un vehículo con la patente '${dto.plate}'`);
      }
      throw error;
    }
  }

  /**
   * Soft-delete: marca el vehículo como inactivo.
   */
  async remove(id: string, actor: AuditActor): Promise<void> {
    await this.ensureExists(id);

    await this.prisma.$transaction(async (tx) => {
      await tx.vehicle.update({
        where: { id },
        data: { active: false },
      });
      await this.audit.record(tx, {
        entityType: 'VEHICLE',
        entityId: id,
        action: 'DEACTIVATE',
        toStatus: activeState(false),
        actor,
      });
    });

    this.logger.log(`Vehículo desactivado: ${id}`);
  }

  // ─── Helpers ──────────────────────────────────────

  private async ensureExists(id: string): Promise<void> {
    const exists = await this.prisma.vehicle.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException(`Vehículo con id '${id}' no encontrado`);
    }
  }

  private toResponseDto(vehicle: any): VehicleResponseDto {
    return {
      id: vehicle.id,
      plate: vehicle.plate,
      vehicleType: vehicle.vehicleType,
      capacity: vehicle.capacity === null ? null : Number(vehicle.capacity),
      active: vehicle.active,
      createdAt: vehicle.createdAt,
      updatedAt: vehicle.updatedAt,
    };
  }
}
