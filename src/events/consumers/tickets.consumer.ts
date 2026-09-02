import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  EnvironmentalReportStatus as S,
  EnvironmentalReportType,
  ServiceStatus,
  Severity,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { InboxService } from '../inbox/inbox.service';
import { ConsumedEvent, TicketUpdateType } from '../inbox/consumed-events';
import { REPORT_TRANSITIONS } from '../../modules/environmental-reports/environmental-reports.service';

/** El `requestType.name` de M2 mapeado a nuestro catálogo de denuncias. */
const TIPO_POR_PALABRA: [RegExp, EnvironmentalReportType][] = [
  [/ruido|sonor/i, EnvironmentalReportType.NOISE],
  [/basural|microbasural/i, EnvironmentalReportType.ILLEGAL_DUMPSITE],
  [/vertido|efluente|liquid/i, EnvironmentalReportType.WATER_DISCHARGE],
  [/humo|emisi|aire/i, EnvironmentalReportType.AIR_EMISSION],
  [/olor/i, EnvironmentalReportType.ODOR],
  [/plaga|roedor|insect/i, EnvironmentalReportType.PEST_INFESTATION],
  [/volcado|descarga/i, EnvironmentalReportType.DUMPING],
];

const PRIORIDAD: Record<string, Severity> = {
  LOW: Severity.LOW,
  MEDIUM: Severity.MEDIUM,
  HIGH: Severity.HIGH,
  CRITICAL: Severity.CRITICAL,
  URGENT: Severity.CRITICAL,
};

/**
 * `ticketUpdated` de M2, el único evento suyo que escuchamos y **nuestro único
 * disparador de entrada**.
 *
 * La v1.5 define trece `updateType`. Seis disparan acción y **siete se ignoran
 * a propósito**: el doc pide explícitamente no implementarles handler, y están
 * enumerados en su tabla para que quede escrito que la omisión es deliberada y
 * no haya que volver a auditarla contra el contrato.
 *
 * Los siete que no hacen nada: CONTENT_UPDATED, PROGRESS, DUPLICATE_LINKED,
 * INFORMATION_REQUIRED, STATUS_CHANGED, RESOLVED y CLOSED.
 */
@Injectable()
export class TicketsConsumer implements OnModuleInit {
  private readonly logger = new Logger(TicketsConsumer.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inbox: InboxService,
  ) {}

  onModuleInit(): void {
    this.inbox.register(ConsumedEvent.TICKET_UPDATED, (d) => this.handle(d));
  }

  private async handle(data: Record<string, unknown>): Promise<void> {
    const updateType = String(data.updateType ?? '');
    const ticketId = data.ticketId as string | undefined;

    if (!ticketId) {
      this.logger.warn('ticketUpdated sin ticketId: no se puede correlacionar, se descarta');
      return;
    }

    switch (updateType) {
      case TicketUpdateType.ROUTED:
        return this.routed(ticketId, data);
      case TicketUpdateType.CANCELLED:
        return this.cancelled(ticketId);
      case TicketUpdateType.PRIORITY_CHANGED:
        return this.priorityChanged(ticketId, data);
      case TicketUpdateType.INFORMATION_PROVIDED:
        return this.informationProvided(ticketId, data);
      case TicketUpdateType.REOPENED:
        return this.reopened(ticketId);
      case TicketUpdateType.ESCALATION_CHANGED:
        return this.escalationChanged(ticketId, data);
      default:
        // Los siete restantes de la v1.5 se descartan a propósito.
        this.logger.log(`ticketUpdated/${updateType}: sin efecto operativo, se descarta`);
    }
  }

  /**
   * La entrada. Abre el expediente ambiental.
   *
   * **`responsibleAreaId` dice si el ROUTED es nuestro**, y desde la v1.5 es un
   * campo común: ya no hay que adivinar ni necesitar el catálogo de
   * `requestTypeId`.
   *
   * ponytail: abre siempre un expediente, nunca un `Service` puntual. Abrir un
   * servicio directo necesitaría el catálogo de Request Types que M2 no
   * publicó, y el expediente es la entrada diseñada para el reclamo del vecino
   * — de él sale la inspección, y de la inspección el servicio.
   */
  private async routed(ticketId: string, data: Record<string, unknown>): Promise<void> {
    const existente = await this.prisma.environmentalReport.findFirst({ where: { ticketId } });
    if (existente) {
      this.logger.log(`ticketUpdated/ROUTED: el ticket ${ticketId} ya tiene expediente abierto`);
      return;
    }

    const location = (data.location ?? {}) as Record<string, unknown>;
    const requestType = (data.requestType ?? {}) as Record<string, unknown>;
    const nombre = `${requestType.name ?? ''} ${data.summary ?? ''}`;

    const report = await this.prisma.environmentalReport.create({
      data: {
        ticketId,
        reportType: this.tipoDeDenuncia(nombre),
        address: (location.addressLine as string) ?? (location.street as string) ?? null,
        lat: location.latitude != null ? Number(location.latitude) : null,
        lng: location.longitude != null ? Number(location.longitude) : null,
        priority: this.prioridad(data.currentPriority),
        // Solo lo que el vecino aceptó exponer: si es anónimo no guardamos
        // identidad.
        reporterSnapshot: data.isAnonymous
          ? { isAnonymous: true }
          : { isAnonymous: false, citizenId: data.citizenId ?? null },
        status: S.RECEIVED,
      },
    });

    this.logger.log(
      `ticketUpdated/ROUTED: expediente ${report.id} abierto para el reclamo ${ticketId} (${report.reportType})`,
    );
  }

  /** El vecino canceló: se cancela el servicio ya programado. */
  private async cancelled(ticketId: string): Promise<void> {
    const { count } = await this.prisma.service.updateMany({
      where: {
        ticketId,
        status: { in: [ServiceStatus.SCHEDULED, ServiceStatus.RESCHEDULED] },
      },
      data: {
        status: ServiceStatus.CANCELLED,
        statusReason: 'El vecino canceló el reclamo en M2',
      },
    });

    const report = await this.prisma.environmentalReport.findFirst({ where: { ticketId } });
    if (report && report.status === S.UNDER_REVIEW) {
      await this.prisma.environmentalReport.update({
        where: { id: report.id },
        data: { status: S.DISMISSED },
      });
    }

    this.logger.log(
      `ticketUpdated/CANCELLED: ${count} servicio/s cancelado/s para el reclamo ${ticketId}`,
    );
  }

  private async priorityChanged(ticketId: string, data: Record<string, unknown>): Promise<void> {
    const priority = this.prioridad(data.currentPriority);
    if (!priority) return;

    const { count } = await this.prisma.environmentalReport.updateMany({
      where: { ticketId },
      data: { priority },
    });
    this.logger.log(
      `ticketUpdated/PRIORITY_CHANGED: ${count} expediente/s del reclamo ${ticketId} a ${priority}`,
    );
  }

  /**
   * Lo que el vecino respondió a nuestra solicitud de información.
   *
   * La v1.5 no usa ID de correlación: impone como máximo una solicitud activa
   * por ticket, así que la respuesta siempre corresponde a la nuestra.
   */
  private async informationProvided(
    ticketId: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const respuesta =
      (data.publicMessage as string) ??
      ((data.details as Record<string, unknown>)?.informationResponse as string);
    if (!respuesta) return;

    const { count } = await this.prisma.environmentalReport.updateMany({
      where: { ticketId },
      data: { citizenResponse: respuesta.slice(0, 2000) },
    });
    this.logger.log(
      `ticketUpdated/INFORMATION_PROVIDED: respuesta del vecino sumada a ${count} expediente/s`,
    );
  }

  /** El vecino rechazó la solución: el expediente vuelve a gestión. */
  private async reopened(ticketId: string): Promise<void> {
    const report = await this.prisma.environmentalReport.findFirst({ where: { ticketId } });
    if (!report) return;

    // Un evento entrante no debería fallar duro por una carrera de estado:
    // si la reapertura no aplica desde donde está, se descarta con log.
    if (!REPORT_TRANSITIONS[report.status].includes(S.UNDER_REVIEW)) {
      this.logger.warn(
        `ticketUpdated/REOPENED: el expediente ${report.id} está en ${report.status} y no admite reapertura`,
      );
      return;
    }

    await this.prisma.environmentalReport.update({
      where: { id: report.id },
      data: { status: S.UNDER_REVIEW },
    });
    this.logger.log(
      `ticketUpdated/REOPENED: expediente ${report.id} vuelve a gestión desde ${report.status}`,
    );
  }

  private async escalationChanged(ticketId: string, data: Record<string, unknown>): Promise<void> {
    const escalated = Boolean(
      (data.escalation as Record<string, unknown>)?.escalated ?? data.escalated ?? true,
    );
    const { count } = await this.prisma.environmentalReport.updateMany({
      where: { ticketId },
      data: { escalated },
    });
    this.logger.log(
      `ticketUpdated/ESCALATION_CHANGED: ${count} expediente/s marcado/s escalated=${escalated}`,
    );
  }

  // ─── Helpers ──────────────────────────────────────

  /**
   * ponytail: mapea el texto del reclamo a nuestro catálogo por palabra clave,
   * y cae en OTHER si no reconoce nada. Es lo que se puede hacer sin el
   * catálogo de Request Types de M2; cuando lo publiquen, esto se reemplaza por
   * un mapeo explícito de `requestType.id`.
   */
  private tipoDeDenuncia(texto: string): EnvironmentalReportType {
    for (const [patron, tipo] of TIPO_POR_PALABRA) {
      if (patron.test(texto)) return tipo;
    }
    return EnvironmentalReportType.OTHER;
  }

  private prioridad(value: unknown): Severity | null {
    return PRIORIDAD[String(value ?? '').toUpperCase()] ?? null;
  }
}
