import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { isUUID } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateZoneDto,
  UpdateZoneDto,
  QueryZonesDto,
  ZoneResponseDto,
  AddNeighborhoodsDto,
} from './dto';
import { PaginatedResponseDto } from '../../common/dto';
import { Barrio, NeighborhoodsCatalogService } from '../../core/neighborhoods-catalog.service';

const ZONE_INCLUDE = { commune: true, neighborhoods: true } satisfies Prisma.ZoneInclude;
type ZoneWithRelations = Prisma.ZoneGetPayload<{ include: typeof ZONE_INCLUDE }>;

@Injectable()
export class ZonesService {
  private readonly logger = new Logger(ZonesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: NeighborhoodsCatalogService,
  ) {}

  /**
   * Crea una nueva zona operativa.
   * Falla si el código ya existe (unique constraint).
   */
  async create(dto: CreateZoneDto): Promise<ZoneResponseDto> {
    if (dto.communeId) await this.ensureCommuneExists(dto.communeId);
    try {
      const zone = await this.prisma.zone.create({
        data: {
          code: dto.code,
          name: dto.name,
          active: dto.active ?? true,
          communeId: dto.communeId,
        },
        include: ZONE_INCLUDE,
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

    if (query.communeId) {
      where.communeId = query.communeId;
    }

    if (query.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }

    const [zones, total] = await Promise.all([
      this.prisma.zone.findMany({
        where,
        include: ZONE_INCLUDE,
        skip: query.skip,
        take: query.take,
        // Por número de comuna y, dentro de ella, por barrio. Las zonas sin comuna van al
        // final (Postgres ordena NULL al último en ASC). `id` desempata para que la
        // paginación sea estable entre páginas.
        orderBy: [{ commune: { number: 'asc' } }, { name: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.zone.count({ where }),
    ]);

    const catalogo = this.catalogMap();
    return new PaginatedResponseDto(
      zones.map((z) => this.toResponseDto(z, false, catalogo)),
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
      include: ZONE_INCLUDE,
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
    // null desasigna la comuna: no hay nada que validar.
    if (dto.communeId) await this.ensureCommuneExists(dto.communeId);

    const zone = await this.prisma.zone.update({
      where: { id },
      include: ZONE_INCLUDE,
      data: {
        ...(dto.communeId !== undefined && { communeId: dto.communeId }),
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
   * Ignora duplicados silenciosamente (skipDuplicates). Los ids se validan contra
   * el catálogo de M9 cacheado; sin catálogo se acepta con un warning, porque un
   * Core caído no tiene que impedir armar zonas.
   */
  async addNeighborhoods(zoneId: string, dto: AddNeighborhoodsDto): Promise<ZoneResponseDto> {
    await this.ensureExists(zoneId);

    if (this.catalog.disponible) {
      const inexistentes = dto.neighborhoodIds.filter((id) => !this.catalog.existe(id));
      if (inexistentes.length) {
        throw new BadRequestException(
          `Barrios que no están en el catálogo de M9: ${inexistentes.join(', ')}`,
        );
      }
    } else {
      this.logger.warn('Catálogo de barrios no disponible: se asignan sin validar contra M9');
    }

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

  private catalogMap(): Map<string, Barrio> {
    return new Map(this.catalog.list().map((b) => [b.id, b]));
  }

  private async ensureCommuneExists(id: string): Promise<void> {
    const exists = await this.prisma.commune.findUnique({ where: { id }, select: { id: true } });
    if (!exists) {
      throw new BadRequestException(`La comuna '${id}' no existe`);
    }
  }

  /**
   * Mapea la entidad Prisma al DTO de respuesta.
   * @param includeNeighborhoods incluir barrios (solo en detalle)
   */
  private toResponseDto(
    zone: ZoneWithRelations,
    includeNeighborhoods = false,
    catalogo: Map<string, Barrio> = this.catalogMap(),
  ): ZoneResponseDto {
    // Una zona es un barrio: el primero por id es "el" barrio. Solo se expone un UUID:
    // las filas legacy (ej. `barrio-palermo`) quedan en `neighborhoods[]` pero no acá.
    const barrioId = zone.neighborhoods
      .map((n) => n.neighborhoodId)
      .filter((id) => isUUID(id))
      .sort()[0];
    const barrio = barrioId ? catalogo.get(barrioId) : undefined;
    const dto: ZoneResponseDto = {
      id: zone.id,
      code: zone.code,
      name: zone.name,
      active: zone.active,
      createdAt: zone.createdAt,
      updatedAt: zone.updatedAt,
      commune: zone.commune
        ? {
            id: zone.commune.id,
            code: zone.commune.code,
            number: zone.commune.number,
            name: zone.commune.name,
          }
        : null,
      neighborhood: barrioId
        ? { id: barrioId, codigo: barrio?.codigo, nombre: barrio?.nombre }
        : null,
    };

    if (includeNeighborhoods) {
      dto.neighborhoods = zone.neighborhoods.map((n) => ({
        neighborhoodId: n.neighborhoodId,
      }));
    }

    return dto;
  }
}
