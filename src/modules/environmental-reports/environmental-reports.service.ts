import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EnvironmentalReport, EnvironmentalReportStatus as S, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OutboxEntry, OutboxService } from '../../events/outbox/outbox.service';
import { AggregateType, EventType } from '../../events/event-types';
import * as payloads from '../../events/payloads';
import {
  CreateEnvironmentalReportDto,
  EnvironmentalReportResponseDto,
  QueryEnvironmentalReportsDto,
} from './dto';
import { PaginatedResponseDto } from '../../common/dto';

/**
 * Transiciones válidas del expediente ambiental.
 * Derivado del diagrama de docs/entidades/environmental-report.md.
 *
 *   [*] → RECEIVED → UNDER_REVIEW
 *   UNDER_REVIEW → FORWARDED | DISMISSED | INSPECTION_SCHEDULED
 *   INSPECTION_SCHEDULED → INSPECTED
 *   INSPECTED → NO_VIOLATION | VIOLATION_FOUND
 *   VIOLATION_FOUND → NOTICE_ISSUED
 *   NOTICE_ISSUED → SANCTIONED | CLOSED (vence el plazo sin respuesta de M4)
 *   FORWARDED | DISMISSED | NO_VIOLATION | SANCTIONED → CLOSED
 */
export const REPORT_TRANSITIONS: Record<S, S[]> = {
  RECEIVED: [S.UNDER_REVIEW],
  UNDER_REVIEW: [S.FORWARDED, S.DISMISSED, S.INSPECTION_SCHEDULED],
  INSPECTION_SCHEDULED: [S.INSPECTED],
  INSPECTED: [S.NO_VIOLATION, S.VIOLATION_FOUND],
  VIOLATION_FOUND: [S.NOTICE_ISSUED],
  NOTICE_ISSUED: [S.SANCTIONED, S.CLOSED],
  FORWARDED: [S.CLOSED],
  DISMISSED: [S.CLOSED],
  NO_VIOLATION: [S.CLOSED],
  SANCTIONED: [S.CLOSED],
  CLOSED: [],
};

function toNumber(value: Prisma.Decimal | null): number | null {
  return value === null ? null : Number(value);
}

@Injectable()
export class EnvironmentalReportsService {
  private readonly logger = new Logger(EnvironmentalReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async create(dto: CreateEnvironmentalReportDto): Promise<EnvironmentalReportResponseDto> {
    const report = await this.prisma.environmentalReport.create({
      data: {
        reportType: dto.reportType,
        address: dto.address ?? null,
        lat: dto.lat ?? null,
        lng: dto.lng ?? null,
        ticketId: dto.ticketId ?? null,
        priority: dto.priority ?? null,
        status: S.RECEIVED,
      },
    });

    this.logger.log(
      `Expediente ambiental abierto: ${report.id} (${report.reportType}${
        report.ticketId ? `, reclamo ${report.ticketId}` : ', de oficio'
      })`,
    );
    return this.toResponseDto(report);
  }

  async findAll(
    query: QueryEnvironmentalReportsDto,
  ): Promise<PaginatedResponseDto<EnvironmentalReportResponseDto>> {
    const where: Prisma.EnvironmentalReportWhereInput = {};

    if (query.status) where.status = query.status;
    if (query.reportType) where.reportType = query.reportType;
    if (query.priority) where.priority = query.priority;
    if (query.ticketId) where.ticketId = query.ticketId;
    if (query.search) {
      where.address = { contains: query.search, mode: 'insensitive' };
    }

    const [reports, total] = await Promise.all([
      this.prisma.environmentalReport.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.environmentalReport.count({ where }),
    ]);

    return new PaginatedResponseDto(
      reports.map((r) => this.toResponseDto(r)),
      total,
      query.page,
      query.pageSize,
    );
  }

  async findOne(id: string): Promise<EnvironmentalReportResponseDto> {
    return this.toResponseDto(await this.getReport(id));
  }

  // ─── Acciones ─────────────────────────────────────

  /** RECEIVED → UNDER_REVIEW */
  async startReview(id: string, actorId: string): Promise<EnvironmentalReportResponseDto> {
    const report = await this.getReport(id);
    return this.transition(report, S.UNDER_REVIEW, {}, [
      ...this.ticketEvents(report, actorId, {
        updateType: 'STARTED',
        publicMessage: 'Su denuncia ambiental está en análisis.',
      }),
    ]);
  }

  /**
   * UNDER_REVIEW → FORWARDED. No es de nuestra competencia.
   *
   * Hacia M2 sale como `RETURNED`, no como `REJECTED`: devolver un reclamo que
   * no es de nuestra área es distinto de desestimarlo.
   */
  async forward(
    id: string,
    reason: string,
    actorId: string,
  ): Promise<EnvironmentalReportResponseDto> {
    const report = await this.getReport(id);
    return this.transition(report, S.FORWARDED, {}, [
      ...this.ticketEvents(report, actorId, {
        updateType: 'RETURNED',
        internalMessage: reason,
        details: { returnInfo: { reasonCode: 'REQUEST_TYPE_MISMATCH' } },
      }),
    ]);
  }

  /** UNDER_REVIEW → DISMISSED. Se desestima sin inspección; hacia M2 va como REJECTED. */
  async dismiss(
    id: string,
    reason: string,
    actorId: string,
  ): Promise<EnvironmentalReportResponseDto> {
    const report = await this.getReport(id);
    return this.transition(report, S.DISMISSED, {}, [
      ...this.ticketEvents(report, actorId, {
        updateType: 'REJECTED',
        internalMessage: reason,
        details: { cancellation: { reasonCode: 'DOES_NOT_APPLY' } },
      }),
    ]);
  }

  /** Cierre manual desde cualquier estado terminal previo. */
  async close(id: string, actorId: string): Promise<EnvironmentalReportResponseDto> {
    const report = await this.getReport(id);
    return this.transition(report, S.CLOSED, {}, [
      ...this.ticketEvents(report, actorId, {
        updateType: 'RESOLVED',
        publicMessage: 'Su denuncia ambiental fue cerrada.',
        details: { resolution: { type: 'ACTION_COMPLETED' } },
      }),
    ]);
  }

  // ─── Transiciones que disparan otros módulos ──────

  /**
   * Las mueve la inspección y el acta, no un endpoint propio del expediente.
   * Se exponen para que esos módulos las apliquen dentro de su transacción.
   */
  async applyTransition(
    tx: Prisma.TransactionClient,
    report: EnvironmentalReport,
    target: S,
    data: Prisma.EnvironmentalReportUpdateInput = {},
  ): Promise<void> {
    this.assertTransition(report.status, target);
    await tx.environmentalReport.update({
      where: { id: report.id },
      data: { status: target, ...data },
    });
    this.logger.log(`Expediente ${report.id}: ${report.status} → ${target}`);
  }

  assertTransition(from: S, to: S): void {
    const allowed = REPORT_TRANSITIONS[from] ?? [];
    if (!allowed.includes(to)) {
      throw new ConflictException(
        `No se puede pasar de '${from}' a '${to}'. Transiciones válidas desde '${from}': [${
          allowed.join(', ') || 'ninguna, es un estado final'
        }]`,
      );
    }
  }

  async getReport(id: string): Promise<EnvironmentalReport> {
    const report = await this.prisma.environmentalReport.findUnique({ where: { id } });
    if (!report) {
      throw new NotFoundException(`Expediente ambiental con id '${id}' no encontrado`);
    }
    return report;
  }

  // ─── Helpers ──────────────────────────────────────

  private async transition(
    report: EnvironmentalReport,
    target: S,
    data: Prisma.EnvironmentalReportUpdateInput = {},
    events: OutboxEntry[] = [],
  ): Promise<EnvironmentalReportResponseDto> {
    this.assertTransition(report.status, target);

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.environmentalReport.update({
        where: { id: report.id },
        data: { status: target, ...data },
      });
      await this.outbox.enqueueMany(tx, events);
      return row;
    });

    this.logger.log(`Expediente ${report.id}: ${report.status} → ${target}`);
    return this.toResponseDto(updated);
  }

  /**
   * Proyección hacia M2, solo si el expediente nació de un reclamo.
   *
   * Una detección de oficio no tiene a quién contestarle: sin `ticketId` no
   * sale nada (docs/entidades/environmental-report.md).
   */
  ticketEvents(
    report: EnvironmentalReport,
    actorId: string,
    update: {
      updateType: payloads.TicketUpdateType;
      publicMessage?: string;
      internalMessage?: string;
      details?: Record<string, unknown>;
    },
  ): OutboxEntry[] {
    if (!report.ticketId) return [];

    return [
      {
        eventType: EventType.UPDATE_TICKET_STATUS,
        aggregateType: AggregateType.ENVIRONMENTAL_REPORT,
        aggregateId: report.id,
        payload: payloads.updateTicketStatus({
          ticketId: report.ticketId,
          updatedById: actorId,
          ...update,
        }),
      },
    ];
  }

  toResponseDto(report: EnvironmentalReport): EnvironmentalReportResponseDto {
    return {
      id: report.id,
      reportType: report.reportType,
      status: report.status,
      address: report.address,
      lat: toNumber(report.lat),
      lng: toNumber(report.lng),
      ticketId: report.ticketId,
      priority: report.priority,
      deadlineAt: report.deadlineAt,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
    };
  }
}
