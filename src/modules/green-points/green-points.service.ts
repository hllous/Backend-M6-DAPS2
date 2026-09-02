import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { GreenPoint, GreenPointWasteType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateGreenPointDto,
  GreenPointResponseDto,
  QueryGreenPointsDto,
  UpdateGreenPointDto,
} from './dto';
import { PaginatedResponseDto } from '../../common/dto';

type GreenPointWithWasteTypes = GreenPoint & { wasteTypes: GreenPointWasteType[] };

@Injectable()
export class GreenPointsService {
  private readonly logger = new Logger(GreenPointsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateGreenPointDto): Promise<GreenPointResponseDto> {
    try {
      const greenPoint = await this.prisma.greenPoint.create({
        data: {
          code: dto.code,
          name: dto.name,
          zoneId: dto.zoneId,
          address: dto.address ?? null,
          lat: dto.lat ?? null,
          lng: dto.lng ?? null,
          active: dto.active ?? true,
          wasteTypes: {
            createMany: { data: dto.wasteTypes.map((wasteType) => ({ wasteType })) },
          },
        },
        include: { wasteTypes: true },
      });

      this.logger.log(`Punto verde creado: ${greenPoint.code} (${greenPoint.id})`);
      return this.toResponseDto(greenPoint);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(`Ya existe un punto verde con el código '${dto.code}'`);
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new NotFoundException(`Zona con id '${dto.zoneId}' no encontrada`);
      }
      throw error;
    }
  }

  async findAll(query: QueryGreenPointsDto): Promise<PaginatedResponseDto<GreenPointResponseDto>> {
    const where: Prisma.GreenPointWhereInput = {};

    if (query.active !== undefined) {
      where.active = query.active;
    }
    if (query.zoneId) {
      where.zoneId = query.zoneId;
    }
    if (query.wasteType) {
      where.wasteTypes = { some: { wasteType: query.wasteType } };
    }
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { address: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [greenPoints, total] = await Promise.all([
      this.prisma.greenPoint.findMany({
        where,
        include: { wasteTypes: true },
        skip: query.skip,
        take: query.take,
        orderBy: { code: 'asc' },
      }),
      this.prisma.greenPoint.count({ where }),
    ]);

    return new PaginatedResponseDto(
      greenPoints.map((gp) => this.toResponseDto(gp)),
      total,
      query.page,
      query.pageSize,
    );
  }

  async findOne(id: string): Promise<GreenPointResponseDto> {
    const greenPoint = await this.prisma.greenPoint.findUnique({
      where: { id },
      include: { wasteTypes: true },
    });

    if (!greenPoint) {
      throw new NotFoundException(`Punto verde con id '${id}' no encontrado`);
    }

    return this.toResponseDto(greenPoint);
  }

  async update(id: string, dto: UpdateGreenPointDto): Promise<GreenPointResponseDto> {
    await this.ensureExists(id);

    try {
      const greenPoint = await this.prisma.greenPoint.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.zoneId !== undefined && { zoneId: dto.zoneId }),
          ...(dto.address !== undefined && { address: dto.address }),
          ...(dto.lat !== undefined && { lat: dto.lat }),
          ...(dto.lng !== undefined && { lng: dto.lng }),
          ...(dto.active !== undefined && { active: dto.active }),
          // Conjunto, no lista ordenada: GreenPointWasteType tiene clave
          // compuesta (greenPointId, wasteType), así que se reemplaza entero.
          ...(dto.wasteTypes !== undefined && {
            wasteTypes: {
              deleteMany: {},
              createMany: { data: dto.wasteTypes.map((wasteType) => ({ wasteType })) },
            },
          }),
        },
        include: { wasteTypes: true },
      });

      this.logger.log(`Punto verde actualizado: ${greenPoint.code} (${greenPoint.id})`);
      return this.toResponseDto(greenPoint);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new NotFoundException(`Zona con id '${dto.zoneId}' no encontrada`);
      }
      throw error;
    }
  }

  /** Soft-delete: lo saca de servicio sin perder el histórico del emplazamiento. */
  async remove(id: string): Promise<void> {
    await this.ensureExists(id);

    await this.prisma.greenPoint.update({ where: { id }, data: { active: false } });

    this.logger.log(`Punto verde deshabilitado: ${id}`);
  }

  // ─── Helpers ──────────────────────────────────────

  private async ensureExists(id: string): Promise<void> {
    const exists = await this.prisma.greenPoint.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException(`Punto verde con id '${id}' no encontrado`);
    }
  }

  private toResponseDto(greenPoint: GreenPointWithWasteTypes): GreenPointResponseDto {
    return {
      id: greenPoint.id,
      code: greenPoint.code,
      name: greenPoint.name,
      zoneId: greenPoint.zoneId,
      wasteTypes: greenPoint.wasteTypes.map((wt) => wt.wasteType).sort(),
      address: greenPoint.address,
      lat: greenPoint.lat === null ? null : Number(greenPoint.lat),
      lng: greenPoint.lng === null ? null : Number(greenPoint.lng),
      active: greenPoint.active,
      createdAt: greenPoint.createdAt,
      updatedAt: greenPoint.updatedAt,
    };
  }
}
