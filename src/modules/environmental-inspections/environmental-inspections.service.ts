import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EnvironmentalReportStatus as S,
  InspectionOutcome,
  Prisma,
  ServiceMode,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OutboxService } from '../../events/outbox/outbox.service';
import { AggregateType, EventType } from '../../events/event-types';
import * as payloads from '../../events/payloads';
import { EnvironmentalReportsService } from '../environmental-reports/environmental-reports.service';
import {
  CompleteInspectionDto,
  CreateInspectionDto,
  InspectionResponseDto,
  IssueViolationNoticeDto,
  ViolationNoticeResponseDto,
} from './dto';

const INSPECTION_INCLUDE = {
  checklistItems: true,
} satisfies Prisma.EnvironmentalInspectionInclude;

type InspectionWithItems = Prisma.EnvironmentalInspectionGetPayload<{
  include: typeof INSPECTION_INCLUDE;
}>;

@Injectable()
export class EnvironmentalInspectionsService {
  private readonly logger = new Logger(EnvironmentalInspectionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly reports: EnvironmentalReportsService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Programa la inspección y lleva el expediente a INSPECTION_SCHEDULED.
   *
   * Ese paso **no se publica**: `environmentalInspectionScheduled` fue uno de
   * los eventos descartados por no tener consumidor.
   */
  async create(reportId: string, dto: CreateInspectionDto): Promise<InspectionResponseDto> {
    const report = await this.reports.getReport(reportId);
    this.reports.assertTransition(report.status, S.INSPECTION_SCHEDULED);

    if (dto.serviceId) {
      await this.assertPointService(dto.serviceId);
    }

    const inspection = await this.prisma.$transaction(async (tx) => {
      const row = await tx.environmentalInspection.create({
        data: {
          reportId,
          serviceId: dto.serviceId ?? null,
          inspectorId: dto.inspectorId ?? null,
        },
        include: INSPECTION_INCLUDE,
      });
      await this.reports.applyTransition(tx, report, S.INSPECTION_SCHEDULED);
      return row;
    });

    this.logger.log(`Inspección programada: ${inspection.id} (expediente ${reportId})`);
    return this.toResponseDto(inspection);
  }

  /**
   * Cierra la inspección y mueve el expediente según el resultado.
   *
   * `INSPECTED` es un paso real de la máquina, y de ahí el expediente sale a
   * `NO_VIOLATION` o `VIOLATION_FOUND` en la misma operación: quedarse en
   * INSPECTED no le sirve a nadie.
   *
   * Un `INCONCLUSIVE` deja el expediente en INSPECTED, a la espera de otra
   * inspección.
   */
  async complete(id: string, dto: CompleteInspectionDto): Promise<InspectionResponseDto> {
    const inspection = await this.getInspection(id);
    if (inspection.outcome) {
      throw new ConflictException(
        `La inspección '${id}' ya fue cerrada con resultado ${inspection.outcome}`,
      );
    }

    const report = await this.reports.getReport(inspection.reportId);
    this.reports.assertTransition(report.status, S.INSPECTED);

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.environmentalInspection.update({
        where: { id },
        data: {
          inspectedAt: new Date(dto.inspectedAt),
          outcome: dto.outcome,
          nextStep: dto.nextStep ?? null,
          findings: dto.findings ?? null,
          ...(dto.checklist && {
            checklistItems: {
              deleteMany: {},
              createMany: {
                data: dto.checklist.map((i) => ({
                  itemCode: i.itemCode,
                  label: i.label,
                  result: i.result,
                  observations: i.observations ?? null,
                })),
              },
            },
          }),
        },
        include: INSPECTION_INCLUDE,
      });

      await this.reports.applyTransition(tx, report, S.INSPECTED);

      // De INSPECTED sale enseguida al resultado, salvo que sea inconcluyente.
      if (dto.outcome !== InspectionOutcome.INCONCLUSIVE) {
        const target =
          dto.outcome === InspectionOutcome.VIOLATION_FOUND ? S.VIOLATION_FOUND : S.NO_VIOLATION;
        await this.reports.applyTransition(tx, { ...report, status: S.INSPECTED }, target);
      }
      return row;
    });

    this.logger.log(`Inspección ${id} cerrada: ${dto.outcome}`);
    return this.toResponseDto(updated);
  }

  /**
   * Emite el acta de constatación. **Inmutable una vez emitida**: si hay un
   * error se emite otra, no se corrige esta.
   *
   * Sin `establishmentId` el acta se registra igual pero **no se deriva**, y el
   * expediente cierra de nuestro lado: intimar, clausurar y multar se le aplican
   * a un comercio habilitado, que es lo único sobre lo que M4 puede actuar.
   */
  async issueNotice(
    inspectionId: string,
    dto: IssueViolationNoticeDto,
    actorId: string,
  ): Promise<ViolationNoticeResponseDto> {
    const inspection = await this.getInspection(inspectionId);

    if (inspection.outcome !== InspectionOutcome.VIOLATION_FOUND) {
      throw new BadRequestException(
        `Solo se emite acta sobre una inspección con resultado VIOLATION_FOUND (esta es ${
          inspection.outcome ?? 'una inspección sin cerrar'
        })`,
      );
    }
    if (await this.prisma.violationNotice.findUnique({ where: { inspectionId } })) {
      throw new ConflictException(
        `La inspección '${inspectionId}' ya tiene un acta emitida. El acta es inmutable: si hay un error se emite otra sobre una inspección nueva`,
      );
    }

    const report = await this.reports.getReport(inspection.reportId);
    this.reports.assertTransition(report.status, S.NOTICE_ISSUED);

    // Reincidencia: cuántas actas previas tiene ese mismo establecimiento.
    const priorNoticeCount = dto.establishmentId
      ? await this.prisma.violationNotice.count({
          where: { establishmentId: dto.establishmentId },
        })
      : 0;

    const issuedAt = new Date();
    const noticeNumber = await this.nextNoticeNumber(issuedAt);
    const deadlineDays = this.config.get<number>('sanctionDeadlineDays') ?? 30;
    const deadlineAt = new Date(issuedAt.getTime() + deadlineDays * 24 * 60 * 60 * 1000);

    const notice = await this.prisma.$transaction(async (tx) => {
      const row = await tx.violationNotice.create({
        data: {
          noticeNumber,
          inspectionId,
          issuedAt,
          establishmentId: dto.establishmentId ?? null,
          violationType: dto.violationType,
          severity: dto.severity,
          suggestedAction: dto.suggestedAction,
          priorNoticeCount,
        },
      });

      await this.reports.applyTransition(tx, report, S.NOTICE_ISSUED, { deadlineAt });

      if (dto.establishmentId) {
        await this.outbox.enqueue(tx, {
          eventType: EventType.ENVIRONMENTAL_VIOLATION_DETECTED,
          aggregateType: AggregateType.VIOLATION_NOTICE,
          aggregateId: row.id,
          payload: payloads.environmentalViolationDetected(row, inspection, report),
          occurredAt: issuedAt,
        });
      } else {
        this.logger.warn(
          `Acta ${noticeNumber} emitida SIN establishmentId: no se deriva a M4 y el expediente cierra de nuestro lado`,
        );
      }

      // Lo que ve el vecino no lleva identidad del inspector ni contenido del acta.
      await this.outbox.enqueueMany(
        tx,
        this.reports.ticketEvents(report, actorId, {
          updateType: 'PROGRESS',
          publicMessage: 'Se constató una infracción y se emitió el acta correspondiente.',
        }),
      );

      return row;
    });

    this.logger.log(
      `Acta emitida: ${noticeNumber} (${dto.violationType}, ${priorNoticeCount} acta/s previa/s)`,
    );
    return this.toNoticeDto(notice);
  }

  async findByReport(reportId: string): Promise<InspectionResponseDto[]> {
    await this.reports.getReport(reportId);
    const rows = await this.prisma.environmentalInspection.findMany({
      where: { reportId },
      include: INSPECTION_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.toResponseDto(r));
  }

  async findOne(id: string): Promise<InspectionResponseDto> {
    return this.toResponseDto(await this.getInspection(id));
  }

  async findNotice(inspectionId: string): Promise<ViolationNoticeResponseDto> {
    const notice = await this.prisma.violationNotice.findUnique({ where: { inspectionId } });
    if (!notice) {
      throw new NotFoundException(`La inspección '${inspectionId}' no tiene acta emitida`);
    }
    return this.toNoticeDto(notice);
  }

  // ─── Helpers ──────────────────────────────────────

  /**
   * Número de acta correlativo por año.
   *
   * ponytail: cuenta las actas del año y suma uno. Con una sola instancia y el
   * volumen de un TPO alcanza; con concurrencia real haría falta una secuencia
   * de Postgres, porque dos emisiones simultáneas pueden pedir el mismo número
   * y una va a chocar contra el unique de noticeNumber.
   */
  private async nextNoticeNumber(at: Date): Promise<string> {
    const year = at.getUTCFullYear();
    const desde = new Date(Date.UTC(year, 0, 1));
    const count = await this.prisma.violationNotice.count({
      where: { issuedAt: { gte: desde } },
    });
    return `ACTA-${year}-${String(count + 1).padStart(6, '0')}`;
  }

  private async assertPointService(serviceId: string): Promise<void> {
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
      select: { id: true, mode: true },
    });
    if (!service) {
      throw new NotFoundException(`Servicio con id '${serviceId}' no encontrado`);
    }
    if (service.mode !== ServiceMode.POINT) {
      throw new BadRequestException(
        `Una inspección ambiental se ejecuta sobre un objetivo puntual, así que el servicio tiene que ser de modo POINT (este es ${service.mode})`,
      );
    }
  }

  private async getInspection(id: string): Promise<InspectionWithItems> {
    const inspection = await this.prisma.environmentalInspection.findUnique({
      where: { id },
      include: INSPECTION_INCLUDE,
    });
    if (!inspection) {
      throw new NotFoundException(`Inspección con id '${id}' no encontrada`);
    }
    return inspection;
  }

  private toResponseDto(inspection: InspectionWithItems): InspectionResponseDto {
    return {
      id: inspection.id,
      reportId: inspection.reportId,
      serviceId: inspection.serviceId,
      inspectorId: inspection.inspectorId,
      inspectedAt: inspection.inspectedAt,
      findings: inspection.findings,
      outcome: inspection.outcome,
      nextStep: inspection.nextStep,
      checklistItems: inspection.checklistItems.map((i) => ({
        id: i.id,
        itemCode: i.itemCode,
        label: i.label,
        result: i.result,
        observations: i.observations,
      })),
      createdAt: inspection.createdAt,
      updatedAt: inspection.updatedAt,
    };
  }

  private toNoticeDto(
    notice: Prisma.ViolationNoticeGetPayload<object>,
  ): ViolationNoticeResponseDto {
    return {
      id: notice.id,
      noticeNumber: notice.noticeNumber,
      inspectionId: notice.inspectionId,
      issuedAt: notice.issuedAt,
      establishmentId: notice.establishmentId,
      violationType: notice.violationType,
      severity: notice.severity,
      suggestedAction: notice.suggestedAction,
      priorNoticeCount: notice.priorNoticeCount,
      createdAt: notice.createdAt,
    };
  }
}
