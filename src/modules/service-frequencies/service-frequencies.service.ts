import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { FrequencyWeekday, Prisma, ServiceFrequency, ServiceMode } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateServiceFrequencyDto,
  QueryServiceFrequenciesDto,
  ServiceFrequencyResponseDto,
  UpdateServiceFrequencyDto,
} from './dto';
import { PaginatedResponseDto } from '../../common/dto';

type FrequencyWithWeekdays = ServiceFrequency & { weekdays: FrequencyWeekday[] };

/** Fecha sin hora: los campos son @db.Date y comparar con hora produce off-by-one. */
function toDateOnly(value: string | Date): Date {
  return new Date(`${new Date(value).toISOString().slice(0, 10)}T00:00:00.000Z`);
}

@Injectable()
export class ServiceFrequenciesService {
  private readonly logger = new Logger(ServiceFrequenciesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateServiceFrequencyDto): Promise<ServiceFrequencyResponseDto> {
    const validFrom = toDateOnly(dto.validFrom);
    const validTo = dto.validTo ? toDateOnly(dto.validTo) : null;

    this.assertValidPeriod(validFrom, validTo);
    await this.assertReferencesExist(dto.serviceTypeId, dto.routeId);

    const frequency = await this.prisma.serviceFrequency.create({
      data: {
        serviceTypeId: dto.serviceTypeId,
        routeId: dto.routeId,
        shift: dto.shift,
        validFrom,
        validTo,
        weekdays: { createMany: { data: dto.weekdays.map((weekday) => ({ weekday })) } },
      },
      include: { weekdays: true },
    });

    this.logger.log(
      `Frecuencia creada: ${frequency.id} (${dto.weekdays.join(',')} turno ${dto.shift})`,
    );
    return this.toResponseDto(frequency);
  }

  async findAll(
    query: QueryServiceFrequenciesDto,
  ): Promise<PaginatedResponseDto<ServiceFrequencyResponseDto>> {
    const where: Prisma.ServiceFrequencyWhereInput = {};

    if (query.serviceTypeId) {
      where.serviceTypeId = query.serviceTypeId;
    }
    if (query.routeId) {
      where.routeId = query.routeId;
    }
    if (query.shift) {
      where.shift = query.shift;
    }
    if (query.weekday !== undefined) {
      where.weekdays = { some: { weekday: query.weekday } };
    }
    if (query.validOn) {
      const on = toDateOnly(query.validOn);
      where.validFrom = { lte: on };
      where.OR = [{ validTo: null }, { validTo: { gte: on } }];
    }

    const [frequencies, total] = await Promise.all([
      this.prisma.serviceFrequency.findMany({
        where,
        include: { weekdays: true },
        skip: query.skip,
        take: query.take,
        orderBy: { validFrom: 'desc' },
      }),
      this.prisma.serviceFrequency.count({ where }),
    ]);

    return new PaginatedResponseDto(
      frequencies.map((f) => this.toResponseDto(f)),
      total,
      query.page,
      query.pageSize,
    );
  }

  async findOne(id: string): Promise<ServiceFrequencyResponseDto> {
    const frequency = await this.prisma.serviceFrequency.findUnique({
      where: { id },
      include: { weekdays: true },
    });

    if (!frequency) {
      throw new NotFoundException(`Frecuencia con id '${id}' no encontrada`);
    }

    return this.toResponseDto(frequency);
  }

  async update(id: string, dto: UpdateServiceFrequencyDto): Promise<ServiceFrequencyResponseDto> {
    const current = await this.getFrequency(id);

    const validFrom = dto.validFrom ? toDateOnly(dto.validFrom) : current.validFrom;
    const validTo = dto.validTo !== undefined ? toDateOnly(dto.validTo) : current.validTo;
    this.assertValidPeriod(validFrom, validTo);

    const frequency = await this.prisma.serviceFrequency.update({
      where: { id },
      data: {
        ...(dto.shift !== undefined && { shift: dto.shift }),
        ...(dto.validFrom !== undefined && { validFrom }),
        ...(dto.validTo !== undefined && { validTo }),
        // El conjunto de días se reemplaza entero: FrequencyWeekday tiene clave
        // compuesta (frequencyId, weekday), así que no hay orden que preservar.
        ...(dto.weekdays !== undefined && {
          weekdays: {
            deleteMany: {},
            createMany: { data: dto.weekdays.map((weekday) => ({ weekday })) },
          },
        }),
      },
      include: { weekdays: true },
    });

    this.logger.log(`Frecuencia actualizada: ${frequency.id}`);
    return this.toResponseDto(frequency);
  }

  /**
   * Cierra la vigencia en lugar de borrar.
   *
   * `ServiceFrequency` no tiene columna `active`: el dominio ya expresa la baja
   * con `validTo` (ver docs/entidades/configuracion-y-recursos.md), así que
   * agregar una columna nueva duplicaría el mismo dato. La regla deja de
   * generar servicios a partir de hoy, y queda el registro de que existió.
   *
   * Si la regla todavía no empezó a regir, se cierra en su fecha de inicio:
   * un `validTo` anterior al `validFrom` sería un período inválido.
   */
  async remove(id: string): Promise<void> {
    const current = await this.getFrequency(id);

    const today = toDateOnly(new Date());
    const validTo = current.validFrom > today ? current.validFrom : today;

    await this.prisma.serviceFrequency.update({ where: { id }, data: { validTo } });

    this.logger.log(`Frecuencia ${id}: vigencia cerrada el ${validTo.toISOString().slice(0, 10)}`);
  }

  // ─── Helpers ──────────────────────────────────────

  private assertValidPeriod(validFrom: Date, validTo: Date | null): void {
    if (validTo && validTo < validFrom) {
      throw new BadRequestException(
        `'validTo' (${validTo.toISOString().slice(0, 10)}) no puede ser anterior a 'validFrom' (${validFrom.toISOString().slice(0, 10)})`,
      );
    }
  }

  /**
   * El tipo de servicio tiene que ser de modo ROUTE: una frecuencia genera
   * servicios sobre un recorrido, y un tipo POINT no se ejecuta sobre uno.
   */
  private async assertReferencesExist(serviceTypeId: string, routeId: string): Promise<void> {
    const [serviceType, route] = await Promise.all([
      this.prisma.serviceType.findUnique({
        where: { id: serviceTypeId },
        select: { id: true, mode: true },
      }),
      this.prisma.route.findUnique({ where: { id: routeId }, select: { id: true } }),
    ]);

    if (!serviceType) {
      throw new NotFoundException(`Tipo de servicio con id '${serviceTypeId}' no encontrado`);
    }
    if (!route) {
      throw new NotFoundException(`Recorrido con id '${routeId}' no encontrado`);
    }
    if (serviceType.mode !== ServiceMode.ROUTE) {
      throw new BadRequestException(
        `Una frecuencia se programa sobre un recorrido, así que el tipo de servicio tiene que ser de modo ROUTE (este es ${serviceType.mode})`,
      );
    }
  }

  private async getFrequency(id: string): Promise<ServiceFrequency> {
    const frequency = await this.prisma.serviceFrequency.findUnique({ where: { id } });
    if (!frequency) {
      throw new NotFoundException(`Frecuencia con id '${id}' no encontrada`);
    }
    return frequency;
  }

  private toResponseDto(frequency: FrequencyWithWeekdays): ServiceFrequencyResponseDto {
    return {
      id: frequency.id,
      serviceTypeId: frequency.serviceTypeId,
      routeId: frequency.routeId,
      weekdays: frequency.weekdays.map((w) => w.weekday).sort((a, b) => a - b),
      shift: frequency.shift,
      validFrom: frequency.validFrom,
      validTo: frequency.validTo,
      createdAt: frequency.createdAt,
      updatedAt: frequency.updatedAt,
    };
  }
}
