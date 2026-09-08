import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ContainerStatus,
  DisposalSiteType,
  EnvironmentalReportStatus,
  EnvironmentalReportType,
  NotServicedReason,
  RiskLevel,
  WasteType,
} from '@prisma/client';

export class PeriodDto {
  @ApiProperty({ example: '2026-08-01' })
  from: string;

  @ApiProperty({ example: '2026-08-31' })
  to: string;
}

// ─── Cobertura ──────────────────────────────────────

export class CoverageTotalsDto {
  @ApiProperty({ description: 'Objetivos programados en el período', example: 240 })
  scheduled: number;

  @ApiProperty({ description: 'Atendidos por completo', example: 198 })
  served: number;

  @ApiProperty({ description: 'Atendidos parcialmente', example: 21 })
  partial: number;

  @ApiProperty({ description: 'No atendidos', example: 12 })
  notServiced: number;

  @ApiProperty({ description: 'Todavía sin resultado cargado', example: 9 })
  pending: number;

  @ApiProperty({ description: 'Atendidos por completo sobre programados', example: 82.5 })
  coveragePct: number;
}

export class CoverageBreakdownDto extends CoverageTotalsDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Z-CENTRO' })
  code: string;

  @ApiProperty({ example: 'Centro' })
  name: string;
}

export class CoverageIndicatorDto {
  @ApiProperty({ type: PeriodDto })
  period: PeriodDto;

  @ApiProperty({ type: CoverageTotalsDto })
  totals: CoverageTotalsDto;

  @ApiProperty({ type: [CoverageBreakdownDto], description: 'Por zona operativa' })
  byZone: CoverageBreakdownDto[];

  @ApiProperty({ type: [CoverageBreakdownDto], description: 'Por tipo de servicio' })
  byServiceType: CoverageBreakdownDto[];
}

// ─── Cumplimiento ───────────────────────────────────

export class ComplianceFinishedDto {
  @ApiProperty({ description: 'Servicios cerrados en el período', example: 176 })
  total: number;

  @ApiProperty({ description: 'Cerrados el día programado o antes', example: 151 })
  onTime: number;

  @ApiProperty({ description: 'Cerrados después de la fecha programada', example: 25 })
  late: number;

  @ApiProperty({ example: 85.8 })
  onTimePct: number;
}

export class ReasonCountDto {
  @ApiProperty({ enum: NotServicedReason })
  reason: NotServicedReason | null;

  @ApiProperty({ example: 4 })
  count: number;
}

export class NotServicedZoneDto {
  @ApiProperty({ format: 'uuid' })
  zoneId: string;

  @ApiProperty({ example: 'Z-SUR' })
  code: string;

  @ApiProperty({ example: 'Sur' })
  name: string;

  @ApiProperty({ example: 7 })
  count: number;

  @ApiProperty({ type: [ReasonCountDto], description: 'Por qué quedó sin atender' })
  reasons: ReasonCountDto[];
}

export class ComplianceIndicatorDto {
  @ApiProperty({ type: PeriodDto })
  period: PeriodDto;

  @ApiProperty({ type: ComplianceFinishedDto })
  finished: ComplianceFinishedDto;

  @ApiProperty({
    type: [NotServicedZoneDto],
    description: 'Ranking de zonas no atendidas, de mayor a menor',
  })
  notServicedRanking: NotServicedZoneDto[];
}

// ─── Incidencias ────────────────────────────────────

export class ContainersByZoneDto {
  @ApiProperty({ format: 'uuid' })
  zoneId: string;

  @ApiProperty({ example: 'Z-CENTRO' })
  code: string;

  @ApiProperty({ example: 'Centro' })
  name: string;

  @ApiProperty({ example: 3 })
  overflowed: number;

  @ApiProperty({ example: 2 })
  damaged: number;

  @ApiProperty({ description: 'Contenedores instalados en la zona', example: 48 })
  total: number;
}

export class StatusCountDto {
  @ApiProperty({ enum: ContainerStatus })
  status: ContainerStatus;

  @ApiProperty({ example: 41 })
  count: number;
}

export class RiskCountDto {
  @ApiProperty({ enum: RiskLevel })
  riskLevel: RiskLevel;

  @ApiProperty({ example: 12 })
  count: number;
}

export class ReportTypeCountDto {
  @ApiProperty({ enum: EnvironmentalReportType })
  reportType: EnvironmentalReportType;

  @ApiProperty({ example: 18 })
  count: number;
}

export class ReportStatusCountDto {
  @ApiProperty({ enum: EnvironmentalReportStatus })
  status: EnvironmentalReportStatus;

  @ApiProperty({ example: 6 })
  count: number;
}

/**
 * Los tres bloques del indicador van en clases propias y no como tipos inline.
 *
 * Un `@ApiProperty` sobre un tipo literal de TypeScript se emite en el OpenAPI
 * como un `object` sin propiedades: el consumidor ve que el campo existe y no
 * qué trae adentro. Con una clase, Swagger lo describe entero.
 */
export class ContainerIncidentsDto {
  @ApiProperty({ type: [StatusCountDto], description: 'Todo el parque, por estado' })
  byStatus: StatusCountDto[];

  @ApiProperty({
    type: [ContainersByZoneDto],
    description: 'Ordenado de mayor a menor cantidad de incidencias',
  })
  byZone: ContainersByZoneDto[];
}

export class TreeIncidentsDto {
  @ApiProperty({
    type: [RiskCountDto],
    description: 'Cada árbol cuenta una sola vez, por su último relevamiento',
  })
  byRiskLevel: RiskCountDto[];
}

export class ReportIncidentsDto {
  @ApiProperty({ description: 'Denuncias abiertas en el período', example: 18 })
  total: number;

  @ApiProperty({ type: [ReportTypeCountDto] })
  byType: ReportTypeCountDto[];

  @ApiProperty({ type: [ReportStatusCountDto] })
  byStatus: ReportStatusCountDto[];

  @ApiProperty({
    description:
      'Días promedio de `createdAt` a `updatedAt` en los expedientes CLOSED del período. ' +
      '**Null si no se cerró ninguno**: es la ausencia de dato, no un cero.',
    example: 4.3,
    nullable: true,
    type: Number,
  })
  avgResolutionDays: number | null;
}

export class IncidentsIndicatorDto {
  @ApiProperty({ type: PeriodDto })
  period: PeriodDto;

  @ApiProperty({
    type: ContainerIncidentsDto,
    description:
      'Foto del estado actual del inventario, no del período: el inventario no guarda historial de estados. El período solo filtra las denuncias.',
  })
  containers: ContainerIncidentsDto;

  @ApiProperty({
    type: TreeIncidentsDto,
    description:
      'Foto del estado actual del arbolado, no del período, por el mismo motivo que los contenedores.',
  })
  trees: TreeIncidentsDto;

  @ApiProperty({ type: ReportIncidentsDto, description: 'Denuncias abiertas en el período' })
  reports: ReportIncidentsDto;
}

// ─── Residuos ───────────────────────────────────────

export class WasteByTypeDto {
  @ApiProperty({ enum: WasteType })
  wasteType: WasteType;

  @ApiProperty({ example: 128400.5 })
  weightKg: number;

  @ApiProperty({ example: 640.25 })
  volumeM3: number;
}

export class WasteBySiteDto {
  @ApiProperty({ format: 'uuid' })
  disposalSiteId: string;

  @ApiProperty({ example: 'RS-NORTE' })
  code: string;

  @ApiProperty({ example: 'Relleno Sanitario Norte' })
  name: string;

  @ApiProperty({ enum: DisposalSiteType })
  siteType: DisposalSiteType;

  @ApiProperty({ example: 98000 })
  weightKg: number;

  @ApiProperty({ example: 490 })
  volumeM3: number;
}

export class WasteTotalsDto {
  @ApiProperty({ example: 128400.5 })
  weightKg: number;

  @ApiProperty({ example: 640.25 })
  volumeM3: number;

  @ApiProperty({
    description: 'Peso que fue a planta de reciclado o de compostaje, no a relleno',
    example: 30400.5,
  })
  divertedKg: number;

  @ApiProperty({ description: 'Porcentaje desviado del relleno', example: 23.7 })
  divertedPct: number;
}

export class WasteIndicatorDto {
  @ApiProperty({ type: PeriodDto })
  period: PeriodDto;

  @ApiProperty({ type: WasteTotalsDto })
  totals: WasteTotalsDto;

  @ApiProperty({ type: [WasteByTypeDto] })
  byWasteType: WasteByTypeDto[];

  @ApiProperty({ type: [WasteBySiteDto] })
  byDisposalSite: WasteBySiteDto[];

  @ApiPropertyOptional({
    description: 'Cuántos registros de recolección sustentan las cifras',
    example: 312,
  })
  records: number;
}
