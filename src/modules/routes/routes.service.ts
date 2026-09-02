import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Route, RouteStop } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateRouteDto,
  QueryRoutesDto,
  RouteResponseDto,
  SetRouteStopsDto,
  UpdateRouteDto,
} from './dto';
import { PaginatedResponseDto } from '../../common/dto';

type RouteWithStops = Route & { stops?: RouteStop[] };

@Injectable()
export class RoutesService {
  private readonly logger = new Logger(RoutesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateRouteDto): Promise<RouteResponseDto> {
    try {
      const route = await this.prisma.route.create({
        data: { code: dto.code, name: dto.name, active: dto.active ?? true },
      });

      this.logger.log(`Recorrido creado: ${route.code} (${route.id})`);
      return this.toResponseDto(route);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(`Ya existe un recorrido con el código '${dto.code}'`);
      }
      throw error;
    }
  }

  async findAll(query: QueryRoutesDto): Promise<PaginatedResponseDto<RouteResponseDto>> {
    const where: Prisma.RouteWhereInput = {};

    if (query.active !== undefined) {
      where.active = query.active;
    }
    if (query.zoneId) {
      where.stops = { some: { zoneId: query.zoneId } };
    }
    if (query.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }

    const [routes, total] = await Promise.all([
      this.prisma.route.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: { code: 'asc' },
      }),
      this.prisma.route.count({ where }),
    ]);

    return new PaginatedResponseDto(
      routes.map((r) => this.toResponseDto(r)),
      total,
      query.page,
      query.pageSize,
    );
  }

  async findOne(id: string): Promise<RouteResponseDto> {
    const route = await this.prisma.route.findUnique({
      where: { id },
      include: { stops: { orderBy: { sequence: 'asc' } } },
    });

    if (!route) {
      throw new NotFoundException(`Recorrido con id '${id}' no encontrado`);
    }

    return this.toResponseDto(route);
  }

  async update(id: string, dto: UpdateRouteDto): Promise<RouteResponseDto> {
    await this.ensureExists(id);

    const route = await this.prisma.route.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.active !== undefined && { active: dto.active }),
      },
    });

    this.logger.log(`Recorrido actualizado: ${route.code} (${route.id})`);
    return this.toResponseDto(route);
  }

  /**
   * Soft-delete: los Service ya programados guardan `routeId`, así que el
   * borrado físico rompería el histórico de lo ejecutado.
   */
  async remove(id: string): Promise<void> {
    await this.ensureExists(id);

    await this.prisma.route.update({ where: { id }, data: { active: false } });

    this.logger.log(`Recorrido desactivado: ${id}`);
  }

  // ─── Paradas ──────────────────────────────────────

  /**
   * Reemplaza la secuencia completa de paradas.
   *
   * Se borra todo y se recrea dentro de una transacción en vez de mover
   * paradas de a una: `@@unique([routeId, sequence])` hace que intercambiar
   * dos posiciones choque a mitad de camino. Borrar antes de insertar evita
   * el problema sin necesidad de secuencias temporales.
   *
   * Es seguro porque ningún registro referencia un `RouteStop` por id: un
   * Service copia las zonas a `ServiceZone` al programarse, no las lee de acá.
   */
  async setStops(routeId: string, dto: SetRouteStopsDto): Promise<RouteResponseDto> {
    await this.ensureExists(routeId);

    const zoneIds = dto.stops.map((s) => s.zoneId);

    // Una zona repetida rompería ServiceZone (@@id([serviceId, zoneId])) cuando
    // un Service copie el recorrido en la Fase 2, así que se rechaza acá.
    const duplicates = zoneIds.filter((z, i) => zoneIds.indexOf(z) !== i);
    if (duplicates.length > 0) {
      throw new BadRequestException(
        `Una zona no puede repetirse en el mismo recorrido: ${[...new Set(duplicates)].join(', ')}`,
      );
    }

    if (zoneIds.length > 0) {
      const found = await this.prisma.zone.findMany({
        where: { id: { in: zoneIds } },
        select: { id: true },
      });
      if (found.length !== zoneIds.length) {
        const foundIds = new Set(found.map((z) => z.id));
        const missing = zoneIds.filter((z) => !foundIds.has(z));
        throw new NotFoundException(`Zonas no encontradas: ${missing.join(', ')}`);
      }
    }

    await this.prisma.$transaction([
      this.prisma.routeStop.deleteMany({ where: { routeId } }),
      this.prisma.routeStop.createMany({
        data: dto.stops.map((stop, index) => ({
          routeId,
          zoneId: stop.zoneId,
          sequence: index + 1,
          estimatedDurationMin: stop.estimatedDurationMin,
        })),
      }),
    ]);

    this.logger.log(`Recorrido ${routeId}: secuencia actualizada a ${dto.stops.length} paradas`);
    return this.findOne(routeId);
  }

  // ─── Helpers ──────────────────────────────────────

  private async ensureExists(id: string): Promise<void> {
    const exists = await this.prisma.route.findUnique({ where: { id }, select: { id: true } });
    if (!exists) {
      throw new NotFoundException(`Recorrido con id '${id}' no encontrado`);
    }
  }

  private toResponseDto(route: RouteWithStops): RouteResponseDto {
    const dto: RouteResponseDto = {
      id: route.id,
      code: route.code,
      name: route.name,
      active: route.active,
      createdAt: route.createdAt,
      updatedAt: route.updatedAt,
    };

    if (route.stops) {
      dto.stops = route.stops.map((stop) => ({
        id: stop.id,
        sequence: stop.sequence,
        zoneId: stop.zoneId,
        estimatedDurationMin: stop.estimatedDurationMin,
      }));
    }

    return dto;
  }
}
