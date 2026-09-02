import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  ClosureStreet,
  Prisma,
  RepairRequest,
  RepairRequestStatus,
  StreetClosureRequest,
  StreetClosureRequestStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OutboxService } from '../../events/outbox/outbox.service';
import { AggregateType, EventType } from '../../events/event-types';
import * as payloads from '../../events/payloads';
import {
  ApproveClosureDto,
  CreateRepairRequestDto,
  CreateStreetClosureRequestDto,
  DetectedInType,
  QueryRepairRequestsDto,
  QueryStreetClosureRequestsDto,
  RepairRequestResponseDto,
  StartRepairDto,
  StreetClosureRequestResponseDto,
} from './dto';
import { PaginatedResponseDto } from '../../common/dto';

type ClosureWithStreets = StreetClosureRequest & { streets: ClosureStreet[] };

@Injectable()
export class OutboundRequestsService {
  private readonly logger = new Logger(OutboundRequestsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  // ─── RepairRequest → M3 ───────────────────────────

  async createRepairRequest(dto: CreateRepairRequestDto): Promise<RepairRequestResponseDto> {
    // Si el daño salió de un servicio nacido de un reclamo, el ticket viaja
    // para que M3 pueda correlacionarlo con lo que el vecino reportó.
    const ticketId = await this.ticketOfOrigin(dto.detectedInType, dto.detectedInId);

    const request = await this.prisma.$transaction(async (tx) => {
      const row = await tx.repairRequest.create({
        data: {
          damageType: dto.damageType,
          severity: dto.severity,
          publicSafetyRisk: dto.publicSafetyRisk,
          detectedInType: dto.detectedInType,
          detectedInId: dto.detectedInId,
          address: dto.address ?? null,
        },
      });

      await this.outbox.enqueue(tx, {
        eventType: EventType.INFRASTRUCTURE_REPAIR_REQUESTED,
        aggregateType: AggregateType.REPAIR_REQUEST,
        aggregateId: row.id,
        payload: payloads.infrastructureRepairRequested(row, ticketId),
        occurredAt: row.requestedAt,
      });

      return row;
    });

    this.logger.log(
      `Reparación solicitada a M3: ${request.id} (${request.damageType}${
        request.publicSafetyRisk ? ', con riesgo para la seguridad pública' : ''
      })`,
    );
    return this.toRepairDto(request);
  }

  async findRepairRequests(
    query: QueryRepairRequestsDto,
  ): Promise<PaginatedResponseDto<RepairRequestResponseDto>> {
    const where: Prisma.RepairRequestWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.damageType) where.damageType = query.damageType;
    if (query.severity) where.severity = query.severity;
    if (query.detectedInId) where.detectedInId = query.detectedInId;

    const [rows, total] = await Promise.all([
      this.prisma.repairRequest.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: { requestedAt: 'desc' },
      }),
      this.prisma.repairRequest.count({ where }),
    ]);

    return new PaginatedResponseDto(
      rows.map((r) => this.toRepairDto(r)),
      total,
      query.page,
      query.pageSize,
    );
  }

  async findRepairRequest(id: string): Promise<RepairRequestResponseDto> {
    return this.toRepairDto(await this.getRepairRequest(id));
  }

  /**
   * Pasa la solicitud a en curso.
   *
   * Normalmente lo dispara `workOrderScheduled` de M3 (Fase 6). El endpoint
   * existe para operación manual y para poder demostrar el circuito mientras
   * no haya bus.
   */
  async startRepair(id: string, dto: StartRepairDto): Promise<RepairRequestResponseDto> {
    await this.getRepairRequest(id);
    const row = await this.prisma.repairRequest.update({
      where: { id },
      data: {
        status: RepairRequestStatus.IN_PROGRESS,
        ...(dto.workOrderId !== undefined && { workOrderId: dto.workOrderId }),
      },
    });
    this.logger.log(
      `Reparación ${id}: en curso${dto.workOrderId ? ` (OT ${dto.workOrderId})` : ''}`,
    );
    return this.toRepairDto(row);
  }

  /** Cierra la solicitud. Normalmente lo dispara `workOrderCompleted` de M3. */
  async closeRepair(id: string): Promise<RepairRequestResponseDto> {
    await this.getRepairRequest(id);
    const row = await this.prisma.repairRequest.update({
      where: { id },
      data: { status: RepairRequestStatus.CLOSED },
    });
    this.logger.log(`Reparación ${id}: cerrada`);
    return this.toRepairDto(row);
  }

  // ─── StreetClosureRequest → M7 ────────────────────

  async createClosureRequest(
    dto: CreateStreetClosureRequestDto,
  ): Promise<StreetClosureRequestResponseDto> {
    const request = await this.prisma.$transaction(async (tx) => {
      const row = await tx.streetClosureRequest.create({
        data: {
          sourceType: dto.sourceType,
          sourceId: dto.sourceId,
          reason: dto.reason,
          closureFrom: new Date(dto.requestedFrom),
          closureTo: new Date(dto.requestedTo),
          closureType: dto.closureType ?? null,
          streets: {
            createMany: {
              data: dto.sections.map((s) => ({
                streetName: s.streetName,
                fromCross: s.fromCross,
                toCross: s.toCross,
              })),
            },
          },
        },
        include: { streets: true },
      });

      await this.outbox.enqueue(tx, {
        eventType: EventType.STREET_CLOSURE_REQUESTED,
        aggregateType: AggregateType.STREET_CLOSURE_REQUEST,
        aggregateId: row.id,
        payload: payloads.streetClosureRequested(row),
        occurredAt: row.createdAt,
      });

      return row;
    });

    this.logger.log(
      `Corte solicitado a M7: ${request.id} (${request.streets.length} tramo/s, origen ${request.sourceType})`,
    );
    return this.toClosureDto(request);
  }

  async findClosureRequests(
    query: QueryStreetClosureRequestsDto,
  ): Promise<PaginatedResponseDto<StreetClosureRequestResponseDto>> {
    const where: Prisma.StreetClosureRequestWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.sourceId) where.sourceId = query.sourceId;

    const [rows, total] = await Promise.all([
      this.prisma.streetClosureRequest.findMany({
        where,
        include: { streets: true },
        skip: query.skip,
        take: query.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.streetClosureRequest.count({ where }),
    ]);

    return new PaginatedResponseDto(
      rows.map((r) => this.toClosureDto(r)),
      total,
      query.page,
      query.pageSize,
    );
  }

  async findClosureRequest(id: string): Promise<StreetClosureRequestResponseDto> {
    return this.toClosureDto(await this.getClosureRequest(id));
  }

  /** Normalmente lo dispara `streetClosureApproved` de M7 (Fase 6). */
  async approveClosure(
    id: string,
    dto: ApproveClosureDto,
  ): Promise<StreetClosureRequestResponseDto> {
    return this.updateClosure(id, StreetClosureRequestStatus.APPROVED, {
      ...(dto.closureId !== undefined && { closureId: dto.closureId }),
    });
  }

  /** Normalmente lo dispara `streetClosureRejected` de M7. */
  async rejectClosure(id: string, reason: string): Promise<StreetClosureRequestResponseDto> {
    this.logger.log(`Corte ${id}: rechazado por M7 — ${reason}`);
    return this.updateClosure(id, StreetClosureRequestStatus.REJECTED);
  }

  /** Normalmente lo dispara `streetClosureEnded` de M7. */
  async endClosure(id: string): Promise<StreetClosureRequestResponseDto> {
    return this.updateClosure(id, StreetClosureRequestStatus.ENDED);
  }

  // ─── Helpers ──────────────────────────────────────

  /**
   * El reclamo de M2 detrás de la detección, si lo hay.
   *
   * Solo aplica cuando el daño salió de un `Service`: una inspección ambiental
   * cuelga de un expediente, no de un ticket directo.
   */
  private async ticketOfOrigin(type: DetectedInType, id: string): Promise<string | undefined> {
    if (type !== DetectedInType.SERVICE) return undefined;
    const service = await this.prisma.service.findUnique({
      where: { id },
      select: { ticketId: true },
    });
    return service?.ticketId ?? undefined;
  }

  private async updateClosure(
    id: string,
    status: StreetClosureRequestStatus,
    data: Prisma.StreetClosureRequestUpdateInput = {},
  ): Promise<StreetClosureRequestResponseDto> {
    await this.getClosureRequest(id);
    const row = await this.prisma.streetClosureRequest.update({
      where: { id },
      data: { status, ...data },
      include: { streets: true },
    });
    this.logger.log(`Corte ${id}: ${status}`);
    return this.toClosureDto(row);
  }

  private async getRepairRequest(id: string): Promise<RepairRequest> {
    const row = await this.prisma.repairRequest.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Solicitud de reparación con id '${id}' no encontrada`);
    }
    return row;
  }

  private async getClosureRequest(id: string): Promise<ClosureWithStreets> {
    const row = await this.prisma.streetClosureRequest.findUnique({
      where: { id },
      include: { streets: true },
    });
    if (!row) {
      throw new NotFoundException(`Solicitud de corte con id '${id}' no encontrada`);
    }
    return row;
  }

  private toRepairDto(r: RepairRequest): RepairRequestResponseDto {
    return {
      id: r.id,
      damageType: r.damageType,
      severity: r.severity,
      publicSafetyRisk: r.publicSafetyRisk,
      detectedInType: r.detectedInType,
      detectedInId: r.detectedInId,
      address: r.address,
      status: r.status,
      workOrderId: r.workOrderId,
      requestedAt: r.requestedAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  private toClosureDto(r: ClosureWithStreets): StreetClosureRequestResponseDto {
    return {
      id: r.id,
      sourceType: r.sourceType,
      sourceId: r.sourceId,
      reason: r.reason,
      sections: r.streets.map((s) => ({
        id: s.id,
        streetName: s.streetName,
        fromCross: s.fromCross,
        toCross: s.toCross,
      })),
      closureFrom: r.closureFrom,
      closureTo: r.closureTo,
      closureType: r.closureType,
      status: r.status,
      closureId: r.closureId,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
}
