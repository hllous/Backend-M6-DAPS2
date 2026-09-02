import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DisposalSite, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateDisposalSiteDto,
  DisposalSiteResponseDto,
  QueryDisposalSitesDto,
  UpdateDisposalSiteDto,
} from './dto';
import { PaginatedResponseDto } from '../../common/dto';

@Injectable()
export class DisposalSitesService {
  private readonly logger = new Logger(DisposalSitesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateDisposalSiteDto): Promise<DisposalSiteResponseDto> {
    try {
      const site = await this.prisma.disposalSite.create({
        data: {
          code: dto.code,
          name: dto.name,
          siteType: dto.siteType,
          active: dto.active ?? true,
        },
      });

      this.logger.log(`Sitio de disposición creado: ${site.code} (${site.id})`);
      return this.toResponseDto(site);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(
          `Ya existe un sitio de disposición con el código '${dto.code}'`,
        );
      }
      throw error;
    }
  }

  async findAll(
    query: QueryDisposalSitesDto,
  ): Promise<PaginatedResponseDto<DisposalSiteResponseDto>> {
    const where: Prisma.DisposalSiteWhereInput = {};

    if (query.active !== undefined) {
      where.active = query.active;
    }
    if (query.siteType) {
      where.siteType = query.siteType;
    }
    if (query.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }

    const [sites, total] = await Promise.all([
      this.prisma.disposalSite.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: { code: 'asc' },
      }),
      this.prisma.disposalSite.count({ where }),
    ]);

    return new PaginatedResponseDto(
      sites.map((s) => this.toResponseDto(s)),
      total,
      query.page,
      query.pageSize,
    );
  }

  async findOne(id: string): Promise<DisposalSiteResponseDto> {
    const site = await this.prisma.disposalSite.findUnique({ where: { id } });

    if (!site) {
      throw new NotFoundException(`Sitio de disposición con id '${id}' no encontrado`);
    }

    return this.toResponseDto(site);
  }

  async update(id: string, dto: UpdateDisposalSiteDto): Promise<DisposalSiteResponseDto> {
    await this.ensureExists(id);

    const site = await this.prisma.disposalSite.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.siteType !== undefined && { siteType: dto.siteType }),
        ...(dto.active !== undefined && { active: dto.active }),
      },
    });

    this.logger.log(`Sitio de disposición actualizado: ${site.code} (${site.id})`);
    return this.toResponseDto(site);
  }

  /**
   * Soft-delete: los CollectionRecord ya cargados apuntan al sitio, así que el
   * borrado físico rompería el histórico de destino final de los residuos.
   */
  async remove(id: string): Promise<void> {
    await this.ensureExists(id);

    await this.prisma.disposalSite.update({ where: { id }, data: { active: false } });

    this.logger.log(`Sitio de disposición desactivado: ${id}`);
  }

  // ─── Helpers ──────────────────────────────────────

  private async ensureExists(id: string): Promise<void> {
    const exists = await this.prisma.disposalSite.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException(`Sitio de disposición con id '${id}' no encontrado`);
    }
  }

  private toResponseDto(site: DisposalSite): DisposalSiteResponseDto {
    return {
      id: site.id,
      code: site.code,
      name: site.name,
      siteType: site.siteType,
      active: site.active,
      createdAt: site.createdAt,
      updatedAt: site.updatedAt,
    };
  }
}
