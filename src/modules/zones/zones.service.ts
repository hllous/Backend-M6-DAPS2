import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateZoneDto,
  UpdateZoneDto,
  QueryZonesDto,
  ZoneResponseDto,
  AddNeighborhoodsDto,
} from './dto';
import { PaginatedResponseDto } from '../../common/dto';

@Injectable()
export class ZonesService {
  private readonly logger = new Logger(ZonesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crea una nueva zona operativa.
   * Falla si el código ya existe (unique constraint).
   */
  async create(dto: CreateZoneDto): Promise<ZoneResponseDto> {
    try {
      const zone = await this.prisma.zone.create({
        data: {
          code: dto.code,
          name: dto.name,
          active: dto.active ?? true,
        },
      });

      this.logger.log(`Zona creada: ${zone.code} (${zone.id})`);
      return this.toResponseDto(zone);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(`Ya existe una zona con el código '${dto.code}'`);
      }
      throw error;
    }
  }

  /**
   * Lista zonas con paginación y filtros opcionales.
   */
  async findAll(query: QueryZonesDto): Promise<PaginatedResponseDto<ZoneResponseDto>> {
    const where: Prisma.ZoneWhereInput = {};

    if (query.active !== undefined) {
      where.active = query.active;
    }

    if (query.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }

    const [zones, total] = await Promise.all([
      this.prisma.zone.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: { code: 'asc' },
      }),
      this.prisma.zone.count({ where }),
    ]);

    return new PaginatedResponseDto(
      zones.map((z) => this.toResponseDto(z)),
      total,
      query.page,
      query.pageSize,
    );
  }

  /**
   * Obtiene una zona por ID con sus barrios asignados.
   */
  async findOne(id: string): Promise<ZoneResponseDto> {
    const zone = await this.prisma.zone.findUnique({
      where: { id },
      include: { neighborhoods: true },
    });

    if (!zone) {
      throw new NotFoundException(`Zona con id '${id}' no encontrada`);
    }

    return this.toResponseDto(zone, true);
  }

  /**
   * Actualiza campos mutables de una zona (name, active).
   */
  async update(id: string, dto: UpdateZoneDto): Promise<ZoneResponseDto> {
    await this.ensureExists(id);

    const zone = await this.prisma.zone.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.active !== undefined && { active: dto.active }),
      },
    });

    this.logger.log(`Zona actualizada: ${zone.code} (${zone.id})`);
    return this.toResponseDto(zone);
  }

  /**
   * Soft-delete: marca la zona como inactiva.
   * No elimina el registro para preservar integridad referencial.
   */
  async remove(id: string): Promise<void> {
    await this.ensureExists(id);

    await this.prisma.zone.update({
      where: { id },
      data: { active: false },
    });

    this.logger.log(`Zona desactivada: ${id}`);
  }

  /**
   * Asigna barrios a una zona.
   * Ignora duplicados silenciosamente (skipDuplicates).
   */
  async addNeighborhoods(zoneId: string, dto: AddNeighborhoodsDto): Promise<ZoneResponseDto> {
    await this.ensureExists(zoneId);

    await this.prisma.zoneNeighborhood.createMany({
      data: dto.neighborhoodIds.map((neighborhoodId) => ({
        zoneId,
        neighborhoodId,
      })),
      skipDuplicates: true,
    });

    this.logger.log(`Barrios asignados a zona ${zoneId}: ${dto.neighborhoodIds.join(', ')}`);
    return this.findOne(zoneId);
  }

  /**
   * Quita un barrio de una zona.
   */
  async removeNeighborhood(zoneId: string, neighborhoodId: string): Promise<void> {
    await this.ensureExists(zoneId);

    const deleted = await this.prisma.zoneNeighborhood.deleteMany({
      where: { zoneId, neighborhoodId },
    });

    if (deleted.count === 0) {
      throw new NotFoundException(
        `Barrio '${neighborhoodId}' no está asignado a la zona '${zoneId}'`,
      );
    }

    this.logger.log(`Barrio '${neighborhoodId}' removido de zona '${zoneId}'`);
  }

  // ─── Helpers ──────────────────────────────────────

  private async ensureExists(id: string): Promise<void> {
    const exists = await this.prisma.zone.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException(`Zona con id '${id}' no encontrada`);
    }
  }

  /**
   * Mapea la entidad Prisma al DTO de respuesta.
   * @param includeNeighborhoods incluir barrios (solo en detalle)
   */
  private toResponseDto(zone: any, includeNeighborhoods = false): ZoneResponseDto {
    const dto: ZoneResponseDto = {
      id: zone.id,
      code: zone.code,
      name: zone.name,
      active: zone.active,
      createdAt: zone.createdAt,
      updatedAt: zone.updatedAt,
    };

    if (includeNeighborhoods && zone.neighborhoods) {
      dto.neighborhoods = zone.neighborhoods.map((n: { neighborhoodId: string }) => ({
        neighborhoodId: n.neighborhoodId,
      }));
    }

    return dto;
  }
}
