import { Injectable, NotFoundException } from '@nestjs/common';
import { EnvironmentalReportStatus as S, Prisma, ServiceStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginatedResponseDto } from '../../common/dto';
import {
  PublicGreenPointResponseDto,
  PublicReportResponseDto,
  PublicReportStage,
  PublicServiceResponseDto,
  PublicZoneResponseDto,
  QueryPublicGreenPointsDto,
  QueryPublicServicesDto,
} from './dto';

/** Los once estados internos, colapsados a lo que el vecino necesita saber. */
const ETAPA: Record<S, PublicReportStage> = {
  RECEIVED: PublicReportStage.RECIBIDA,
  UNDER_REVIEW: PublicReportStage.EN_ANALISIS,
  INSPECTION_SCHEDULED: PublicReportStage.INSPECCION_PROGRAMADA,
  INSPECTED: PublicReportStage.INSPECCIONADA,
  VIOLATION_FOUND: PublicReportStage.EN_TRAMITE_SANCIONATORIO,
  NOTICE_ISSUED: PublicReportStage.EN_TRAMITE_SANCIONATORIO,
  SANCTIONED: PublicReportStage.EN_TRAMITE_SANCIONATORIO,
  FORWARDED: PublicReportStage.DERIVADA,
  DISMISSED: PublicReportStage.CERRADA,
  NO_VIOLATION: PublicReportStage.CERRADA,
  CLOSED: PublicReportStage.CERRADA,
};

const ETAPA_TEXTO: Record<PublicReportStage, string> = {
  RECIBIDA: 'Recibimos su denuncia y está en cola para ser analizada.',
  EN_ANALISIS: 'Estamos analizando la denuncia para definir cómo seguir.',
  INSPECCION_PROGRAMADA: 'Programamos una inspección en el lugar denunciado.',
  INSPECCIONADA: 'Un inspector visitó el lugar y estamos evaluando lo que encontró.',
  EN_TRAMITE_SANCIONATORIO:
    'Se constató una infracción y el trámite sancionatorio sigue su curso en el área de Habilitaciones.',
  DERIVADA: 'La denuncia corresponde a otra área del municipio y fue derivada.',
  CERRADA: 'El trámite finalizó.',
};

/** Ídem para el servicio: los siete estados operativos, en cuatro. */
const ETAPA_SERVICIO: Record<ServiceStatus, string> = {
  SCHEDULED: 'PROGRAMADO',
  RESCHEDULED: 'REPROGRAMADO',
  IN_PROGRESS: 'EN_CURSO',
  SUSPENDED: 'EN_CURSO',
  COMPLETED: 'REALIZADO',
  PARTIALLY_COMPLETED: 'REALIZADO',
  CANCELLED: 'CANCELADO',
};

const DIA_MS = 86_400_000;

const hoy = () => new Date(new Date().toISOString().slice(0, 10));

/** `@db.Time` vuelve como Date con la fecha en cero; al vecino le sirve HH:mm. */
function hora(value: Date | null): string | null {
  return value === null ? null : value.toISOString().slice(11, 16);
}

/**
 * La única cara pública del módulo: se sirve sin JWT.
 *
 * Cada método acá es una **proyección explícita**, no un `findMany` que
 * devuelve la fila. La diferencia importa: si mañana alguien agrega una columna
 * al expediente, una proyección no la publica sola. Nunca salen por acá la
 * identidad del inspector, los hallazgos, el checklist, el contenido del acta
 * ni la identidad del denunciante.
 */
@Injectable()
export class CitizenPortalService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Seguimiento por el número de reclamo de M2, que es lo único que el vecino
   * tiene en la mano: el id del expediente es nuestro y él nunca lo vio.
   */
  async findReportByTicket(ticketId: string): Promise<PublicReportResponseDto> {
    const report = await this.prisma.environmentalReport.findFirst({
      where: { ticketId },
      orderBy: { createdAt: 'desc' },
      select: {
        ticketId: true,
        reportType: true,
        status: true,
        address: true,
        createdAt: true,
        updatedAt: true,
        inspections: {
          where: { inspectedAt: { not: null } },
          orderBy: { inspectedAt: 'desc' },
          take: 1,
          select: { inspectedAt: true },
        },
      },
    });

    // El mismo 404 exista o no el ticket en M2: desde acá no se puede averiguar
    // si un número de reclamo ajeno es válido.
    if (!report) {
      throw new NotFoundException(`No hay una denuncia ambiental para el reclamo '${ticketId}'`);
    }

    const stage = ETAPA[report.status];
    return {
      ticketId: report.ticketId as string,
      reportType: report.reportType,
      stage,
      stageLabel: ETAPA_TEXTO[stage],
      address: report.address,
      openedAt: report.createdAt,
      lastUpdateAt: report.updatedAt,
      inspectedAt: report.inspections[0]?.inspectedAt ?? null,
      closed: stage === PublicReportStage.CERRADA,
    };
  }

  /** Cuándo pasa el servicio. Sin cuadrilla, sin vehículo, sin notas internas. */
  async findServices(
    query: QueryPublicServicesDto,
  ): Promise<PaginatedResponseDto<PublicServiceResponseDto>> {
    const from = query.from ? new Date(query.from) : hoy();
    const to = query.to ? new Date(query.to) : new Date(from.getTime() + 30 * DIA_MS);

    const where: Prisma.ServiceWhereInput = {
      scheduledDate: { gte: from, lte: to },
      status: { not: ServiceStatus.CANCELLED },
      ...(query.serviceTypeId && { serviceTypeId: query.serviceTypeId }),
      ...(query.zoneId && { zones: { some: { zoneId: query.zoneId } } }),
    };

    const [services, total] = await Promise.all([
      this.prisma.service.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: [{ scheduledDate: 'asc' }, { windowFrom: 'asc' }],
        select: {
          id: true,
          scheduledDate: true,
          windowFrom: true,
          windowTo: true,
          status: true,
          serviceType: { select: { name: true, category: true } },
          zones: { orderBy: { sequence: 'asc' }, select: { zone: { select: { name: true } } } },
        },
      }),
      this.prisma.service.count({ where }),
    ]);

    return new PaginatedResponseDto(
      services.map((s) => ({
        id: s.id,
        serviceTypeName: s.serviceType.name,
        category: s.serviceType.category,
        scheduledDate: s.scheduledDate,
        windowFrom: hora(s.windowFrom),
        windowTo: hora(s.windowTo),
        stage: ETAPA_SERVICIO[s.status],
        zones: s.zones.map((z) => z.zone.name),
      })),
      total,
      query.page,
      query.pageSize,
    );
  }

  /** Dónde llevar reciclables y qué recibe cada punto. */
  async findGreenPoints(
    query: QueryPublicGreenPointsDto,
  ): Promise<PaginatedResponseDto<PublicGreenPointResponseDto>> {
    const where: Prisma.GreenPointWhereInput = {
      active: true,
      ...(query.zoneId && { zoneId: query.zoneId }),
    };

    const [points, total] = await Promise.all([
      this.prisma.greenPoint.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          code: true,
          name: true,
          address: true,
          lat: true,
          lng: true,
          zone: { select: { name: true } },
          wasteTypes: { select: { wasteType: true } },
        },
      }),
      this.prisma.greenPoint.count({ where }),
    ]);

    return new PaginatedResponseDto(
      points.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        address: p.address,
        lat: p.lat === null ? null : Number(p.lat),
        lng: p.lng === null ? null : Number(p.lng),
        zoneName: p.zone.name,
        wasteTypes: p.wasteTypes.map((w) => w.wasteType),
      })),
      total,
      query.page,
      query.pageSize,
    );
  }

  /** Las zonas activas, para que el frontend arme el filtro de los otros dos. */
  async findZones(): Promise<PublicZoneResponseDto[]> {
    return this.prisma.zone.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: { id: true, code: true, name: true },
    });
  }
}
