import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  Service,
  ServiceMode,
  ServiceOrigin,
  ServiceStatus,
  ZoneResultStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AssignCrewDto,
  ConfirmRescheduleDto,
  CreateCollectionRecordDto,
  CreateServiceDto,
  CreateZoneResultDto,
  QueryServicesDto,
  ServiceResponseDto,
  ServiceTargetType,
  UpdateServiceDto,
  ZoneResultResponseDto,
  CollectionRecordResponseDto,
} from './dto';
import { PaginatedResponseDto } from '../../common/dto';

/**
 * Transiciones válidas. Derivado del diagrama de docs/entidades/service.md,
 * y vale igual para mode = ROUTE y mode = POINT.
 *
 *   [*] → SCHEDULED
 *   SCHEDULED → IN_PROGRESS | RESCHEDULED | CANCELLED
 *   RESCHEDULED → SCHEDULED (con la nueva fecha)
 *   IN_PROGRESS → SUSPENDED | COMPLETED | PARTIALLY_COMPLETED
 *   SUSPENDED → IN_PROGRESS | CANCELLED
 *
 * DELAYED no está: no es un estado, es un aviso puntual. El servicio sigue
 * en SCHEDULED o IN_PROGRESS.
 */
const VALID_TRANSITIONS: Record<ServiceStatus, ServiceStatus[]> = {
  SCHEDULED: [ServiceStatus.IN_PROGRESS, ServiceStatus.RESCHEDULED, ServiceStatus.CANCELLED],
  RESCHEDULED: [ServiceStatus.SCHEDULED],
  IN_PROGRESS: [
    ServiceStatus.SUSPENDED,
    ServiceStatus.COMPLETED,
    ServiceStatus.PARTIALLY_COMPLETED,
  ],
  SUSPENDED: [ServiceStatus.IN_PROGRESS, ServiceStatus.CANCELLED],
  COMPLETED: [],
  PARTIALLY_COMPLETED: [],
  CANCELLED: [],
};

/** Los campos del servicio no se pueden tocar una vez que arrancó o cerró. */
const EDITABLE_STATUSES: ServiceStatus[] = [ServiceStatus.SCHEDULED, ServiceStatus.RESCHEDULED];

const SERVICE_INCLUDE = {
  zones: { orderBy: { sequence: 'asc' } },
  zoneResults: { orderBy: { recordedAt: 'asc' } },
  collectionRecords: true,
} satisfies Prisma.ServiceInclude;

type ServiceWithRelations = Prisma.ServiceGetPayload<{ include: typeof SERVICE_INCLUDE }>;

/** Fecha sin hora: scheduledDate es @db.Date y comparar con hora produce off-by-one. */
function toDateOnly(value: string | Date): Date {
  return new Date(`${new Date(value).toISOString().slice(0, 10)}T00:00:00.000Z`);
}

/** windowFrom/windowTo son @db.Time; Prisma los maneja como DateTime sobre la época. */
function toTime(hhmm?: string | null): Date | null {
  return hhmm ? new Date(`1970-01-01T${hhmm}:00.000Z`) : null;
}

function fromTime(value: Date | null): string | null {
  return value ? value.toISOString().slice(11, 16) : null;
}

function toNumber(value: Prisma.Decimal | null): number | null {
  return value === null ? null : Number(value);
}

@Injectable()
export class ServicesService {
  private readonly logger = new Logger(ServicesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Programación ─────────────────────────────────

  async create(dto: CreateServiceDto, createdBy?: string): Promise<ServiceResponseDto> {
    const serviceType = await this.prisma.serviceType.findUnique({
      where: { id: dto.serviceTypeId },
    });
    if (!serviceType) {
      throw new NotFoundException(`Tipo de servicio con id '${dto.serviceTypeId}' no encontrado`);
    }
    if (!serviceType.active) {
      throw new BadRequestException(
        `El tipo de servicio '${serviceType.code}' está dado de baja y no admite programación`,
      );
    }

    this.assertTicketConsistency(dto);
    this.assertWindowOrder(dto.windowFrom, dto.windowTo);

    // El modo lo manda el tipo de servicio, no el DTO: un tipo ROUTE no se
    // puede programar como POINT ni al revés.
    const mode = serviceType.mode;
    const zones =
      mode === ServiceMode.ROUTE
        ? await this.resolveRouteZones(dto)
        : await this.resolvePointZone(dto);

    await this.assertResourcesExist(dto.crewId, dto.vehicleId);

    const service = await this.prisma.service.create({
      data: {
        serviceTypeId: dto.serviceTypeId,
        mode,
        status: ServiceStatus.SCHEDULED,
        origin: dto.origin,
        routeId: mode === ServiceMode.ROUTE ? (dto.routeId as string) : null,
        targetType: mode === ServiceMode.POINT ? (dto.targetType ?? null) : null,
        targetId: mode === ServiceMode.POINT ? (dto.targetId ?? null) : null,
        scheduledDate: toDateOnly(dto.scheduledDate),
        windowFrom: toTime(dto.windowFrom),
        windowTo: toTime(dto.windowTo),
        crewId: dto.crewId ?? null,
        vehicleId: dto.vehicleId ?? null,
        ticketId: dto.ticketId ?? null,
        notes: dto.notes ?? null,
        createdBy: createdBy ?? null,
        // Snapshot: se copia al programar y no se recalcula, para que editar un
        // recorrido no altere lo ya ejecutado (docs/entidades/service.md).
        zones: { createMany: { data: zones } },
      },
      include: SERVICE_INCLUDE,
    });

    this.logger.log(
      `Servicio programado: ${service.id} (${serviceType.code}, ${mode}, ${zones.length} zona/s)`,
    );
    return this.toResponseDto(service);
  }

  async findAll(query: QueryServicesDto): Promise<PaginatedResponseDto<ServiceResponseDto>> {
    const where: Prisma.ServiceWhereInput = {};

    if (query.status) where.status = query.status;
    if (query.serviceTypeId) where.serviceTypeId = query.serviceTypeId;
    if (query.mode) where.mode = query.mode;
    if (query.origin) where.origin = query.origin;
    if (query.crewId) where.crewId = query.crewId;
    if (query.vehicleId) where.vehicleId = query.vehicleId;
    if (query.ticketId) where.ticketId = query.ticketId;
    if (query.zoneId) where.zones = { some: { zoneId: query.zoneId } };

    if (query.scheduledFrom || query.scheduledTo) {
      where.scheduledDate = {
        ...(query.scheduledFrom && { gte: toDateOnly(query.scheduledFrom) }),
        ...(query.scheduledTo && { lte: toDateOnly(query.scheduledTo) }),
      };
    }

    const [services, total] = await Promise.all([
      this.prisma.service.findMany({
        where,
        include: SERVICE_INCLUDE,
        skip: query.skip,
        take: query.take,
        orderBy: [{ scheduledDate: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.service.count({ where }),
    ]);

    return new PaginatedResponseDto(
      services.map((s) => this.toResponseDto(s)),
      total,
      query.page,
      query.pageSize,
    );
  }

  async findOne(id: string): Promise<ServiceResponseDto> {
    return this.toResponseDto(await this.getService(id));
  }

  async update(id: string, dto: UpdateServiceDto): Promise<ServiceResponseDto> {
    const current = await this.getService(id);
    this.assertEditable(current);

    if (dto.vehicleId) {
      await this.assertResourcesExist(undefined, dto.vehicleId);
    }
    this.assertWindowOrder(
      dto.windowFrom ?? fromTime(current.windowFrom),
      dto.windowTo ?? fromTime(current.windowTo),
    );

    const service = await this.prisma.service.update({
      where: { id },
      data: {
        ...(dto.vehicleId !== undefined && { vehicleId: dto.vehicleId }),
        ...(dto.windowFrom !== undefined && { windowFrom: toTime(dto.windowFrom) }),
        ...(dto.windowTo !== undefined && { windowTo: toTime(dto.windowTo) }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      include: SERVICE_INCLUDE,
    });

    this.logger.log(`Servicio actualizado: ${service.id}`);
    return this.toResponseDto(service);
  }

  async assignCrew(id: string, dto: AssignCrewDto): Promise<ServiceResponseDto> {
    const current = await this.getService(id);
    this.assertEditable(current);
    await this.assertResourcesExist(dto.crewId, dto.vehicleId);

    const service = await this.prisma.service.update({
      where: { id },
      data: {
        crewId: dto.crewId,
        ...(dto.vehicleId !== undefined && { vehicleId: dto.vehicleId }),
      },
      include: SERVICE_INCLUDE,
    });

    this.logger.log(`Servicio ${id}: cuadrilla ${dto.crewId} asignada`);
    return this.toResponseDto(service);
  }

  // ─── Máquina de estados ───────────────────────────

  /**
   * SCHEDULED → IN_PROGRESS.
   *
   * No se puede iniciar sin cuadrilla, ni sin vehículo si el tipo de servicio
   * lo exige: es el caso que el propio estándar Swagger usa como ejemplo de 409.
   */
  async start(id: string): Promise<ServiceResponseDto> {
    const current = await this.getService(id);

    if (!current.crewId) {
      throw new ConflictException(
        'No se puede iniciar un servicio sin cuadrilla asignada. Usar POST /services/:id/assign-crew',
      );
    }

    const serviceType = await this.prisma.serviceType.findUnique({
      where: { id: current.serviceTypeId },
      select: { code: true, requiresVehicle: true },
    });
    if (serviceType?.requiresVehicle && !current.vehicleId) {
      throw new ConflictException(
        `El tipo de servicio '${serviceType.code}' exige vehículo y el servicio no tiene ninguno asignado`,
      );
    }

    return this.transition(current, ServiceStatus.IN_PROGRESS);
  }

  /** IN_PROGRESS → SUSPENDED */
  async suspend(id: string, reason: string): Promise<ServiceResponseDto> {
    const current = await this.getService(id);
    return this.transition(current, ServiceStatus.SUSPENDED, { statusReason: reason });
  }

  /** SUSPENDED → IN_PROGRESS */
  async resume(id: string): Promise<ServiceResponseDto> {
    const current = await this.getService(id);
    return this.transition(current, ServiceStatus.IN_PROGRESS, { statusReason: null });
  }

  /**
   * IN_PROGRESS → COMPLETED | PARTIALLY_COMPLETED.
   *
   * El estado final no se elige: sale de los ZoneResult. Todas las zonas del
   * servicio tienen que tener resultado, y alcanza con que una haya quedado
   * NOT_SERVICED o PARTIAL para que el cierre sea parcial.
   */
  async complete(id: string): Promise<ServiceResponseDto> {
    const current = await this.getService(id);

    const reported = new Set(current.zoneResults.map((r) => r.zoneId));
    const missing = current.zones.filter((z) => !reported.has(z.zoneId));
    if (missing.length > 0) {
      throw new ConflictException(
        `Faltan resultados de ${missing.length} zona/s para poder cerrar: ${missing
          .map((z) => z.zoneId)
          .join(', ')}`,
      );
    }

    const allServiced = current.zoneResults.every((r) => r.status === ZoneResultStatus.SERVICED);
    const target = allServiced ? ServiceStatus.COMPLETED : ServiceStatus.PARTIALLY_COMPLETED;

    return this.transition(current, target);
  }

  /** SCHEDULED | SUSPENDED → CANCELLED */
  async cancel(id: string, reason: string): Promise<ServiceResponseDto> {
    const current = await this.getService(id);
    return this.transition(current, ServiceStatus.CANCELLED, { statusReason: reason });
  }

  /**
   * SCHEDULED → RESCHEDULED.
   *
   * Marca que el servicio necesita fecha nueva sin fijarla todavía: es el
   * estado en el que caen los servicios cuando llega una alerta meteorológica
   * o M7 rechaza un corte de calle. La fecha se pone con confirmReschedule.
   */
  async reschedule(id: string, reason: string): Promise<ServiceResponseDto> {
    const current = await this.getService(id);
    return this.transition(current, ServiceStatus.RESCHEDULED, { statusReason: reason });
  }

  /** RESCHEDULED → SCHEDULED, con la fecha nueva. */
  async confirmReschedule(id: string, dto: ConfirmRescheduleDto): Promise<ServiceResponseDto> {
    const current = await this.getService(id);
    this.assertWindowOrder(dto.windowFrom, dto.windowTo);

    return this.transition(current, ServiceStatus.SCHEDULED, {
      scheduledDate: toDateOnly(dto.scheduledDate),
      ...(dto.windowFrom !== undefined && { windowFrom: toTime(dto.windowFrom) }),
      ...(dto.windowTo !== undefined && { windowTo: toTime(dto.windowTo) }),
    });
  }

  // ─── Resultado por zona ───────────────────────────

  async addZoneResult(serviceId: string, dto: CreateZoneResultDto): Promise<ZoneResultResponseDto> {
    const current = await this.getService(serviceId);

    if (current.status !== ServiceStatus.IN_PROGRESS) {
      throw new ConflictException(
        `Solo se puede informar el resultado de una zona con el servicio en IN_PROGRESS (está en ${current.status})`,
      );
    }
    if (!current.zones.some((z) => z.zoneId === dto.zoneId)) {
      throw new BadRequestException(`La zona '${dto.zoneId}' no forma parte de este servicio`);
    }
    if (current.zoneResults.some((r) => r.zoneId === dto.zoneId)) {
      throw new ConflictException(`La zona '${dto.zoneId}' ya tiene resultado informado`);
    }

    // El motivo es lo que hace utilizable el ranking de zonas no atendidas del
    // tablero: sin él, "no se atendió" no dice nada.
    if (dto.status === ZoneResultStatus.SERVICED && dto.reason) {
      throw new BadRequestException("Una zona con status SERVICED no lleva 'reason'");
    }
    if (dto.status !== ZoneResultStatus.SERVICED && !dto.reason) {
      throw new BadRequestException(
        `Una zona con status ${dto.status} necesita 'reason' (NotServicedReason)`,
      );
    }

    const result = await this.prisma.zoneResult.create({
      data: {
        serviceId,
        zoneId: dto.zoneId,
        status: dto.status,
        reason: dto.reason ?? null,
        proposedDate: dto.proposedDate ? toDateOnly(dto.proposedDate) : null,
        notes: dto.notes ?? null,
      },
    });

    this.logger.log(`Servicio ${serviceId}: zona ${dto.zoneId} informada como ${dto.status}`);
    return this.toZoneResultDto(result);
  }

  async findZoneResults(serviceId: string): Promise<ZoneResultResponseDto[]> {
    const service = await this.getService(serviceId);
    return service.zoneResults.map((r) => this.toZoneResultDto(r));
  }

  // ─── Registro de recolección ──────────────────────

  async addCollectionRecord(
    serviceId: string,
    dto: CreateCollectionRecordDto,
  ): Promise<CollectionRecordResponseDto> {
    const current = await this.getService(serviceId);

    const closed: ServiceStatus[] = [
      ServiceStatus.IN_PROGRESS,
      ServiceStatus.COMPLETED,
      ServiceStatus.PARTIALLY_COMPLETED,
    ];
    if (!closed.includes(current.status)) {
      throw new ConflictException(
        `Solo se puede registrar recolección sobre un servicio iniciado o cerrado (está en ${current.status})`,
      );
    }

    const site = await this.prisma.disposalSite.findUnique({
      where: { id: dto.disposalSiteId },
      select: { id: true, code: true, active: true },
    });
    if (!site) {
      throw new NotFoundException(
        `Sitio de disposición con id '${dto.disposalSiteId}' no encontrado`,
      );
    }
    if (!site.active) {
      throw new BadRequestException(
        `El sitio de disposición '${site.code}' está dado de baja y no puede recibir residuos`,
      );
    }

    if (dto.zoneResultId && !current.zoneResults.some((r) => r.id === dto.zoneResultId)) {
      throw new BadRequestException(
        `El resultado de zona '${dto.zoneResultId}' no pertenece a este servicio`,
      );
    }

    const record = await this.prisma.collectionRecord.create({
      data: {
        serviceId,
        zoneResultId: dto.zoneResultId ?? null,
        disposalSiteId: dto.disposalSiteId,
        wasteType: dto.wasteType,
        volumeM3: dto.volumeM3 ?? null,
        weightKg: dto.weightKg ?? null,
      },
    });

    this.logger.log(
      `Servicio ${serviceId}: recolección ${dto.wasteType} registrada hacia ${site.code}`,
    );
    return this.toCollectionRecordDto(record);
  }

  async findCollectionRecords(serviceId: string): Promise<CollectionRecordResponseDto[]> {
    const service = await this.getService(serviceId);
    return service.collectionRecords.map((r) => this.toCollectionRecordDto(r));
  }

  // ─── Helpers de programación ──────────────────────

  private assertTicketConsistency(dto: CreateServiceDto): void {
    if (dto.origin === ServiceOrigin.TICKET && !dto.ticketId) {
      throw new BadRequestException("Un servicio con origin = TICKET necesita 'ticketId'");
    }
    if (dto.origin !== ServiceOrigin.TICKET && dto.ticketId) {
      throw new BadRequestException(
        `'ticketId' solo corresponde con origin = TICKET (este es ${dto.origin})`,
      );
    }
  }

  private assertWindowOrder(from?: string | null, to?: string | null): void {
    if (from && to && from >= to) {
      throw new BadRequestException(
        `La ventana horaria está invertida: windowFrom (${from}) no puede ser posterior o igual a windowTo (${to})`,
      );
    }
  }

  private async resolveRouteZones(
    dto: CreateServiceDto,
  ): Promise<{ zoneId: string; sequence: number }[]> {
    if (!dto.routeId) {
      throw new BadRequestException("Un servicio de modo ROUTE necesita 'routeId'");
    }

    const route = await this.prisma.route.findUnique({
      where: { id: dto.routeId },
      include: { stops: { orderBy: { sequence: 'asc' } } },
    });
    if (!route) {
      throw new NotFoundException(`Recorrido con id '${dto.routeId}' no encontrado`);
    }
    if (!route.active) {
      throw new BadRequestException(
        `El recorrido '${route.code}' está dado de baja y no admite programación`,
      );
    }
    if (route.stops.length === 0) {
      throw new BadRequestException(
        `El recorrido '${route.code}' no tiene paradas cargadas. Definir la secuencia con PUT /routes/:id/stops`,
      );
    }

    return route.stops.map((stop) => ({ zoneId: stop.zoneId, sequence: stop.sequence }));
  }

  private async resolvePointZone(
    dto: CreateServiceDto,
  ): Promise<{ zoneId: string; sequence: number }[]> {
    if (dto.targetType && !dto.targetId) {
      throw new BadRequestException("'targetId' es obligatorio cuando se indica 'targetType'");
    }
    if (dto.targetId && !dto.targetType) {
      throw new BadRequestException("'targetType' es obligatorio cuando se indica 'targetId'");
    }

    // Objetivo suelto: el servicio se ubica por zona, sin bien del inventario.
    if (!dto.targetType) {
      if (!dto.zoneId) {
        throw new BadRequestException(
          "Un servicio de modo POINT necesita un objetivo ('targetType' + 'targetId') o una 'zoneId'",
        );
      }
      const zone = await this.prisma.zone.findUnique({
        where: { id: dto.zoneId },
        select: { id: true },
      });
      if (!zone) {
        throw new NotFoundException(`Zona con id '${dto.zoneId}' no encontrada`);
      }
      return [{ zoneId: dto.zoneId, sequence: 1 }];
    }

    const zoneId = await this.findTargetZone(dto.targetType, dto.targetId as string);
    return [{ zoneId, sequence: 1 }];
  }

  /** La zona de un servicio POINT sale del bien del inventario sobre el que se ejecuta. */
  private async findTargetZone(targetType: ServiceTargetType, targetId: string): Promise<string> {
    const select = { zoneId: true };
    const target = await {
      [ServiceTargetType.CONTAINER]: () =>
        this.prisma.container.findUnique({ where: { id: targetId }, select }),
      [ServiceTargetType.TREE]: () =>
        this.prisma.tree.findUnique({ where: { id: targetId }, select }),
      [ServiceTargetType.GREEN_SPACE]: () =>
        this.prisma.greenSpace.findUnique({ where: { id: targetId }, select }),
      [ServiceTargetType.GREEN_POINT]: () =>
        this.prisma.greenPoint.findUnique({ where: { id: targetId }, select }),
    }[targetType]();

    if (!target) {
      throw new NotFoundException(`${targetType} con id '${targetId}' no encontrado`);
    }
    return target.zoneId;
  }

  private async assertResourcesExist(crewId?: string, vehicleId?: string): Promise<void> {
    if (crewId) {
      const crew = await this.prisma.crew.findUnique({
        where: { id: crewId },
        select: { id: true, active: true, name: true },
      });
      if (!crew) {
        throw new NotFoundException(`Cuadrilla con id '${crewId}' no encontrada`);
      }
      if (!crew.active) {
        throw new BadRequestException(`La cuadrilla '${crew.name}' está dada de baja`);
      }
    }

    if (vehicleId) {
      const vehicle = await this.prisma.vehicle.findUnique({
        where: { id: vehicleId },
        select: { id: true, active: true, plate: true },
      });
      if (!vehicle) {
        throw new NotFoundException(`Vehículo con id '${vehicleId}' no encontrado`);
      }
      if (!vehicle.active) {
        throw new BadRequestException(`El vehículo '${vehicle.plate}' está dado de baja`);
      }
    }
  }

  // ─── Helpers de estado ────────────────────────────

  private async transition(
    current: ServiceWithRelations,
    targetStatus: ServiceStatus,
    additionalData: Prisma.ServiceUpdateInput = {},
  ): Promise<ServiceResponseDto> {
    const allowed = VALID_TRANSITIONS[current.status] ?? [];
    if (!allowed.includes(targetStatus)) {
      throw new ConflictException(
        `No se puede pasar de '${current.status}' a '${targetStatus}'. Transiciones válidas desde '${current.status}': [${allowed.join(', ') || 'ninguna, es un estado final'}]`,
      );
    }

    const updated = await this.prisma.service.update({
      where: { id: current.id },
      data: { status: targetStatus, ...additionalData },
      include: SERVICE_INCLUDE,
    });

    this.logger.log(`Servicio ${current.id}: ${current.status} → ${targetStatus}`);
    return this.toResponseDto(updated);
  }

  private assertEditable(service: Service): void {
    if (!EDITABLE_STATUSES.includes(service.status)) {
      throw new ConflictException(
        `Un servicio en '${service.status}' ya no se puede editar. Estados editables: [${EDITABLE_STATUSES.join(', ')}]`,
      );
    }
  }

  private async getService(id: string): Promise<ServiceWithRelations> {
    const service = await this.prisma.service.findUnique({
      where: { id },
      include: SERVICE_INCLUDE,
    });
    if (!service) {
      throw new NotFoundException(`Servicio con id '${id}' no encontrado`);
    }
    return service;
  }

  // ─── Mapeo a DTO ──────────────────────────────────

  private toResponseDto(service: ServiceWithRelations): ServiceResponseDto {
    return {
      id: service.id,
      serviceTypeId: service.serviceTypeId,
      mode: service.mode,
      status: service.status,
      statusReason: service.statusReason,
      origin: service.origin,
      routeId: service.routeId,
      targetType: service.targetType,
      targetId: service.targetId,
      scheduledDate: service.scheduledDate,
      windowFrom: fromTime(service.windowFrom),
      windowTo: fromTime(service.windowTo),
      crewId: service.crewId,
      vehicleId: service.vehicleId,
      ticketId: service.ticketId,
      notes: service.notes,
      zones: service.zones.map((z) => ({ zoneId: z.zoneId, sequence: z.sequence })),
      zoneResults: service.zoneResults.map((r) => this.toZoneResultDto(r)),
      collectionRecords: service.collectionRecords.map((r) => this.toCollectionRecordDto(r)),
      createdBy: service.createdBy,
      createdAt: service.createdAt,
      updatedAt: service.updatedAt,
    };
  }

  private toZoneResultDto(
    result: ServiceWithRelations['zoneResults'][number],
  ): ZoneResultResponseDto {
    return {
      id: result.id,
      zoneId: result.zoneId,
      status: result.status,
      reason: result.reason,
      proposedDate: result.proposedDate,
      notes: result.notes,
      recordedAt: result.recordedAt,
    };
  }

  private toCollectionRecordDto(
    record: ServiceWithRelations['collectionRecords'][number],
  ): CollectionRecordResponseDto {
    return {
      id: record.id,
      wasteType: record.wasteType,
      disposalSiteId: record.disposalSiteId,
      zoneResultId: record.zoneResultId,
      volumeM3: toNumber(record.volumeM3),
      weightKg: toNumber(record.weightKg),
    };
  }
}
