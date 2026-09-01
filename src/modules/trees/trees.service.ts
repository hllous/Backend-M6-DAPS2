import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTreeDto, UpdateTreeDto, QueryTreesDto, TreeResponseDto } from './dto';
import { PaginatedResponseDto } from '../../common/dto';

@Injectable()
export class TreesService {
  private readonly logger = new Logger(TreesService.name);
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTreeDto): Promise<TreeResponseDto> {
    try {
      const tree = await this.prisma.tree.create({
        data: {
          surveyCode: dto.surveyCode, zoneId: dto.zoneId,
          species: dto.species ?? null, address: dto.address ?? null,
          lat: dto.lat ?? null, lng: dto.lng ?? null,
          heightM: dto.heightM ?? null, diameterCm: dto.diameterCm ?? null,
          active: dto.active ?? true,
        },
      });
      this.logger.log(`Árbol registrado: ${tree.surveyCode} (${tree.id})`);
      return this.toResponseDto(tree);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(`Ya existe un árbol con el código '${dto.surveyCode}'`);
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new NotFoundException(`Zona con id '${dto.zoneId}' no encontrada`);
      }
      throw error;
    }
  }

  async findAll(query: QueryTreesDto): Promise<PaginatedResponseDto<TreeResponseDto>> {
    const where: Prisma.TreeWhereInput = {};
    if (query.active !== undefined) where.active = query.active;
    if (query.zoneId) where.zoneId = query.zoneId;
    if (query.search) {
      where.OR = [
        { species: { contains: query.search, mode: 'insensitive' } },
        { address: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    const [trees, total] = await Promise.all([
      this.prisma.tree.findMany({ where, skip: query.skip, take: query.take, orderBy: { surveyCode: 'asc' } }),
      this.prisma.tree.count({ where }),
    ]);
    return new PaginatedResponseDto(trees.map((t) => this.toResponseDto(t)), total, query.page, query.pageSize);
  }

  async findOne(id: string): Promise<TreeResponseDto> {
    const tree = await this.prisma.tree.findUnique({ where: { id } });
    if (!tree) throw new NotFoundException(`Árbol con id '${id}' no encontrado`);
    return this.toResponseDto(tree);
  }

  async update(id: string, dto: UpdateTreeDto): Promise<TreeResponseDto> {
    await this.ensureExists(id);
    try {
      const tree = await this.prisma.tree.update({
        where: { id },
        data: {
          ...(dto.zoneId !== undefined && { zoneId: dto.zoneId }),
          ...(dto.species !== undefined && { species: dto.species }),
          ...(dto.address !== undefined && { address: dto.address }),
          ...(dto.lat !== undefined && { lat: dto.lat }),
          ...(dto.lng !== undefined && { lng: dto.lng }),
          ...(dto.heightM !== undefined && { heightM: dto.heightM }),
          ...(dto.diameterCm !== undefined && { diameterCm: dto.diameterCm }),
          ...(dto.active !== undefined && { active: dto.active }),
        },
      });
      this.logger.log(`Árbol actualizado: ${tree.surveyCode} (${tree.id})`);
      return this.toResponseDto(tree);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new NotFoundException(`Zona con id '${dto.zoneId}' no encontrada`);
      }
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    await this.ensureExists(id);
    await this.prisma.tree.update({ where: { id }, data: { active: false } });
    this.logger.log(`Árbol desactivado: ${id}`);
  }

  private async ensureExists(id: string): Promise<void> {
    const exists = await this.prisma.tree.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException(`Árbol con id '${id}' no encontrado`);
  }

  private toResponseDto(tree: any): TreeResponseDto {
    return {
      id: tree.id, surveyCode: tree.surveyCode, species: tree.species,
      zoneId: tree.zoneId, address: tree.address,
      lat: tree.lat ? Number(tree.lat) : null, lng: tree.lng ? Number(tree.lng) : null,
      heightM: tree.heightM ? Number(tree.heightM) : null,
      diameterCm: tree.diameterCm ? Number(tree.diameterCm) : null,
      active: tree.active, createdAt: tree.createdAt, updatedAt: tree.updatedAt,
    };
  }
}
