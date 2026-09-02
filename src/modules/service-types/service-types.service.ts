import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, ServiceType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateServiceTypeDto,
  QueryServiceTypesDto,
  ServiceTypeResponseDto,
  UpdateServiceTypeDto,
} from './dto';
import { PaginatedResponseDto } from '../../common/dto';

@Injectable()
export class ServiceTypesService {
  private readonly logger = new Logger(ServiceTypesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateServiceTypeDto): Promise<ServiceTypeResponseDto> {
    try {
      const serviceType = await this.prisma.serviceType.create({
        data: {
          code: dto.code,
          name: dto.name,
          category: dto.category,
          mode: dto.mode,
          requiresVehicle: dto.requiresVehicle ?? false,
          active: dto.active ?? true,
        },
      });

      this.logger.log(`Tipo de servicio creado: ${serviceType.code} (${serviceType.id})`);
      return this.toResponseDto(serviceType);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(`Ya existe un tipo de servicio con el código '${dto.code}'`);
      }
      throw error;
    }
  }

  async findAll(
    query: QueryServiceTypesDto,
  ): Promise<PaginatedResponseDto<ServiceTypeResponseDto>> {
    const where: Prisma.ServiceTypeWhereInput = {};

    if (query.active !== undefined) {
      where.active = query.active;
    }
    if (query.category) {
      where.category = query.category;
    }
    if (query.mode) {
      where.mode = query.mode;
    }
    if (query.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }

    const [serviceTypes, total] = await Promise.all([
      this.prisma.serviceType.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: { code: 'asc' },
      }),
      this.prisma.serviceType.count({ where }),
    ]);

    return new PaginatedResponseDto(
      serviceTypes.map((st) => this.toResponseDto(st)),
      total,
      query.page,
      query.pageSize,
    );
  }

  async findOne(id: string): Promise<ServiceTypeResponseDto> {
    const serviceType = await this.prisma.serviceType.findUnique({ where: { id } });

    if (!serviceType) {
      throw new NotFoundException(`Tipo de servicio con id '${id}' no encontrado`);
    }

    return this.toResponseDto(serviceType);
  }

  async update(id: string, dto: UpdateServiceTypeDto): Promise<ServiceTypeResponseDto> {
    await this.ensureExists(id);

    const serviceType = await this.prisma.serviceType.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.requiresVehicle !== undefined && { requiresVehicle: dto.requiresVehicle }),
        ...(dto.active !== undefined && { active: dto.active }),
      },
    });

    this.logger.log(`Tipo de servicio actualizado: ${serviceType.code} (${serviceType.id})`);
    return this.toResponseDto(serviceType);
  }

  /**
   * Soft-delete: lo saca del catálogo de programación sin romper los Service
   * y las ServiceFrequency que ya lo referencian.
   */
  async remove(id: string): Promise<void> {
    await this.ensureExists(id);

    await this.prisma.serviceType.update({ where: { id }, data: { active: false } });

    this.logger.log(`Tipo de servicio desactivado: ${id}`);
  }

  // ─── Helpers ──────────────────────────────────────

  private async ensureExists(id: string): Promise<void> {
    const exists = await this.prisma.serviceType.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException(`Tipo de servicio con id '${id}' no encontrado`);
    }
  }

  private toResponseDto(serviceType: ServiceType): ServiceTypeResponseDto {
    return {
      id: serviceType.id,
      code: serviceType.code,
      name: serviceType.name,
      category: serviceType.category,
      mode: serviceType.mode,
      requiresVehicle: serviceType.requiresVehicle,
      active: serviceType.active,
      createdAt: serviceType.createdAt,
      updatedAt: serviceType.updatedAt,
    };
  }
}
