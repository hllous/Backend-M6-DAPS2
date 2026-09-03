import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateGreenSpaceDto,
  UpdateGreenSpaceDto,
  QueryGreenSpacesDto,
  GreenSpaceResponseDto,
} from './dto';
import { PaginatedResponseDto } from '../../common/dto';

@Injectable()
export class GreenSpacesService {
  private readonly logger = new Logger(GreenSpacesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateGreenSpaceDto): Promise<GreenSpaceResponseDto> {
    try {
      const greenSpace = await this.prisma.greenSpace.create({
        data: {
          name: dto.name,
          spaceType: dto.spaceType,
          zoneId: dto.zoneId,
          areaM2: dto.areaM2 ?? null,
          active: dto.active ?? true,
        },
      });

      this.logger.log(`Espacio verde registrado: ${greenSpace.name} (${greenSpace.id})`);
      return this.toResponseDto(greenSpace);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new NotFoundException(`Zona con id '${dto.zoneId}' no encontrada`);
      }
      throw error;
    }
  }

  async findAll(query: QueryGreenSpacesDto): Promise<PaginatedResponseDto<GreenSpaceResponseDto>> {
    const where: Prisma.GreenSpaceWhereInput = {};

    if (query.active !== undefined) {
      where.active = query.active;
    }
    if (query.spaceType) {
      where.spaceType = query.spaceType;
    }
    if (query.zoneId) {
      where.zoneId = query.zoneId;
    }
    if (query.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }

    const [greenSpaces, total] = await Promise.all([
      this.prisma.greenSpace.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: { name: 'asc' },
      }),
      this.prisma.greenSpace.count({ where }),
    ]);

    return new PaginatedResponseDto(
      greenSpaces.map((gs) => this.toResponseDto(gs)),
      total,
      query.page,
      query.pageSize,
    );
  }

  async findOne(id: string): Promise<GreenSpaceResponseDto> {
    const greenSpace = await this.prisma.greenSpace.findUnique({
      where: { id },
    });

    if (!greenSpace) {
      throw new NotFoundException(`Espacio verde con id '${id}' no encontrado`);
    }

    return this.toResponseDto(greenSpace);
  }

  async update(id: string, dto: UpdateGreenSpaceDto): Promise<GreenSpaceResponseDto> {
    await this.ensureExists(id);

    try {
      const greenSpace = await this.prisma.greenSpace.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.zoneId !== undefined && { zoneId: dto.zoneId }),
          ...(dto.areaM2 !== undefined && { areaM2: dto.areaM2 }),
          ...(dto.active !== undefined && { active: dto.active }),
        },
      });

      this.logger.log(`Espacio verde actualizado: ${greenSpace.name} (${greenSpace.id})`);
      return this.toResponseDto(greenSpace);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new NotFoundException(`Zona con id '${dto.zoneId}' no encontrada`);
      }
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    await this.ensureExists(id);

    await this.prisma.greenSpace.update({
      where: { id },
      data: { active: false },
    });

    this.logger.log(`Espacio verde desactivado: ${id}`);
  }

  // ─── Helpers ──────────────────────────────────────

  private async ensureExists(id: string): Promise<void> {
    const exists = await this.prisma.greenSpace.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException(`Espacio verde con id '${id}' no encontrado`);
    }
  }

  private toResponseDto(greenSpace: any): GreenSpaceResponseDto {
    return {
      id: greenSpace.id,
      name: greenSpace.name,
      spaceType: greenSpace.spaceType,
      zoneId: greenSpace.zoneId,
      areaM2: greenSpace.areaM2 === null ? null : Number(greenSpace.areaM2),
      active: greenSpace.active,
      createdAt: greenSpace.createdAt,
      updatedAt: greenSpace.updatedAt,
    };
  }
}
