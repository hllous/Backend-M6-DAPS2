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

/** Una meta del tablero: el valor y hacia qué lado se cumple. */
export class TargetDto {
  @ApiProperty({
    description:
      'El número de la meta. **Null con `direction: down`**: es una meta de tendencia y nadie definió un número',
    example: 95,
    nullable: true,
    type: Number,
  })
  value: number | null;

  @ApiProperty({
    enum: ['min', 'max', 'down'],
    description:
      '`min`: se cumple con un valor mayor o igual. `max`: con uno menor o igual. `down`: se cumple si baja de un período al otro (tendencia descendente), sin valor numérico.',
    example: 'min',
  })
  direction: 'min' | 'max' | 'down';
}

// ─── Cobertura ──────────────────────────────────────

export class CoverageTargetsDto {
  @ApiProperty({ type: TargetDto, description: 'Meta de `totals.coveragePct`' })
  coveragePct: TargetDto;
}

export class CoverageTotalsDto {
  @ApiProperty({
    description: 'Objetivos programados en el período cuya fecha ya venció (hoy o antes)',
    example: 240,
  })
  scheduled: number;

  @ApiProperty({ description: 'Atendidos por completo', example: 198 })
  served: number;

  @ApiProperty({ description: 'Atendidos parcialmente', example: 21 })
  partial: number;

  @ApiProperty({ description: 'No atendidos', example: 12 })
  notServiced: number;

  @ApiProperty({
    description: 'Vencidos (fecha programada de hoy o anterior) y todavía sin resultado cargado',
    example: 9,
  })
  pending: number;

  @ApiProperty({
    description:
      'Programados para una fecha futura. No cuentan en `scheduled` ni en `coveragePct`: todavía no son un incumplimiento',
    example: 14,
  })
  upcoming: number;

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

  @ApiProperty({
    description:
      'Hay menos programados que el umbral configurado: el porcentaje no es confiable (2 de 2 es 100 %)',
    example: false,
  })
  lowSample: boolean;
}

/** Un intervalo de la serie: los totales de ese tramo del período. */
export class CoverageSeriesPointDto extends CoverageTotalsDto {
  @ApiProperty({ description: 'Primer día del intervalo (YYYY-MM-DD)', example: '2026-08-03' })
  from: string;

  @ApiProperty({ description: 'Último día del intervalo, inclusive', example: '2026-08-09' })
  to: string;
}

export class CoveragePreviousDto {
  @ApiProperty({ type: PeriodDto })
  period: PeriodDto;

  @ApiProperty({ type: CoverageTotalsDto })
  totals: CoverageTotalsDto;
}

export class CoverageDeltaDto {
  @ApiProperty({
    description:
      'Puntos porcentuales de `coveragePct` contra el período anterior. Null si alguno de los dos no tiene programados',
    nullable: true,
    type: Number,
    example: 16.7,
  })
  coveragePct: number | null;
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

  @ApiProperty({ type: CoverageTargetsDto })
  targets: CoverageTargetsDto;

  @ApiPropertyOptional({
    type: [CoverageSeriesPointDto],
    description: 'Solo con `bucket`. La suma de los puntos coincide con `totals`',
  })
  series?: CoverageSeriesPointDto[];

  @ApiPropertyOptional({ type: CoveragePreviousDto, description: 'Solo con `compare=previous`' })
  previous?: CoveragePreviousDto;

  @ApiPropertyOptional({ type: CoverageDeltaDto, description: 'Solo con `compare=previous`' })
  delta?: CoverageDeltaDto;
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
  @ApiProperty({ enum: NotServicedReason, nullable: true })
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

export class SchedulingDeviationDto {
  @ApiProperty({ description: 'Servicios del período, sin los cancelados', example: 240 })
  total: number;

  @ApiProperty({
    description:
      'Reprogramados (`RESCHEDULED`) o con al menos un aviso de demora. Cada servicio cuenta una sola vez',
    example: 18,
  })
  deviated: number;

  @ApiProperty({
    description:
      'Desviados sobre servicios del período. No es el desvío del relleno sanitario (`divertedPct`)',
    example: 7.5,
  })
  deviatedPct: number;
}

/** Lo que se calcula por período: el total, cada punto de la serie y el período anterior. */
export class ComplianceTotalsDto {
  @ApiProperty({ type: ComplianceFinishedDto })
  finished: ComplianceFinishedDto;

  @ApiProperty({ type: SchedulingDeviationDto })
  schedulingDeviation: SchedulingDeviationDto;
}

export class ComplianceSeriesPointDto extends ComplianceTotalsDto {
  @ApiProperty({ description: 'Primer día del intervalo (YYYY-MM-DD)', example: '2026-08-03' })
  from: string;

  @ApiProperty({ description: 'Último día del intervalo, inclusive', example: '2026-08-09' })
  to: string;
}

export class CompliancePreviousDto {
  @ApiProperty({ type: PeriodDto })
  period: PeriodDto;

  @ApiProperty({ type: ComplianceTotalsDto })
  totals: ComplianceTotalsDto;
}

export class ComplianceDeltaDto {
  @ApiProperty({
    description:
      'Puntos porcentuales de `finished.onTimePct`. Null si alguno de los dos períodos no cerró servicios',
    nullable: true,
    type: Number,
    example: -4.2,
  })
  onTimePct: number | null;

  @ApiProperty({
    description:
      'Puntos porcentuales de `schedulingDeviation.deviatedPct`. Null si alguno de los dos períodos no tiene servicios',
    nullable: true,
    type: Number,
    example: 1.5,
  })
  deviatedPct: number | null;
}

export class ComplianceTargetsDto {
  @ApiProperty({ type: TargetDto, description: 'Meta de `finished.onTimePct`' })
  compliancePct: TargetDto;

  @ApiProperty({ type: TargetDto, description: 'Meta de `schedulingDeviation.deviatedPct`' })
  schedulingDeviationPct: TargetDto;
}

export class ComplianceIndicatorDto {
  @ApiProperty({ type: PeriodDto })
  period: PeriodDto;

  @ApiProperty({ type: ComplianceFinishedDto })
  finished: ComplianceFinishedDto;

  @ApiProperty({
    type: SchedulingDeviationDto,
    description: 'Servicios demorados o reprogramados sobre los del período',
  })
  schedulingDeviation: SchedulingDeviationDto;

  @ApiProperty({
    type: [NotServicedZoneDto],
    description: 'Ranking de zonas no atendidas, de mayor a menor',
  })
  notServicedRanking: NotServicedZoneDto[];

  @ApiProperty({ type: ComplianceTargetsDto })
  targets: ComplianceTargetsDto;

  @ApiPropertyOptional({
    type: [ComplianceSeriesPointDto],
    description:
      'Solo con `bucket`. Cada servicio cae en el intervalo de su fecha programada, como en el total',
  })
  series?: ComplianceSeriesPointDto[];

  @ApiPropertyOptional({ type: CompliancePreviousDto, description: 'Solo con `compare=previous`' })
  previous?: CompliancePreviousDto;

  @ApiPropertyOptional({ type: ComplianceDeltaDto, description: 'Solo con `compare=previous`' })
  delta?: ComplianceDeltaDto;
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
/** Lo que se calcula por período con el historial: el total, cada punto de la serie y el período anterior. */
export class ContainerHistoryTotalsDto {
  @ApiProperty({
    description:
      'Incidentes de desborde del período: una transición a `OVERFLOWED` cuenta una vez, así que un contenedor que se desborda dos veces suma dos. El alta y la fila base de la migración no cuentan',
    example: 7,
  })
  overflowIncidents: number;

  @ApiProperty({
    description: 'Incidentes de daño del período: una transición a `DAMAGED` cuenta una vez',
    example: 4,
  })
  damageIncidents: number;

  @ApiProperty({
    description:
      'Contenedores cuyo último estado conocido al final del período (o del intervalo) es `DAMAGED` o `UNDER_REPAIR`: daño todavía sin resolver. **Null si ningún contenedor tiene historial hasta ese instante**: es la ausencia de dato, no un cero',
    example: 3,
    nullable: true,
    type: Number,
  })
  pendingDamage: number | null;
}

export class ContainerHistoryDto extends ContainerHistoryTotalsDto {
  @ApiProperty({
    description:
      'Instante (ISO 8601) de la fila más antigua del historial: desde cuándo existen datos. Null si todavía no hay ninguna. Los períodos anteriores no traen incidentes ni pendientes',
    example: '2026-10-30T15:00:00.000Z',
    nullable: true,
    type: String,
  })
  trackingSince: string | null;
}

export class ContainerIncidentsDto {
  @ApiProperty({ type: [StatusCountDto], description: 'Todo el parque, por estado' })
  byStatus: StatusCountDto[];

  @ApiProperty({
    type: ContainerHistoryDto,
    description:
      'Lo que sí es del período, a partir del historial de estados. `byStatus` y `byZone` siguen siendo la foto del estado actual',
  })
  history: ContainerHistoryDto;

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

/** Reclamos resueltos y cuántos se cerraron dentro del plazo objetivo. */
export class WithinDeadlineDto {
  @ApiProperty({ description: 'Reclamos resueltos (CLOSED) del período o intervalo', example: 12 })
  resolved: number;

  @ApiProperty({
    description:
      'Resueltos cuyos días hábiles entre el alta y el cierre son menores o iguales al plazo objetivo',
    example: 10,
  })
  withinDeadline: number;

  @ApiProperty({
    description:
      'Dentro del plazo ÷ resueltos, con un decimal. **Null si no hay resueltos**: es la ausencia de dato, no un 0 %',
    example: 83.3,
    nullable: true,
    type: Number,
  })
  pct: number | null;
}

/** Lo que se calcula por período: el total, cada punto de la serie y el período anterior. */
export class ReportsTotalsDto {
  @ApiProperty({ description: 'Denuncias abiertas en el período', example: 18 })
  total: number;

  @ApiProperty({
    description:
      'Días corridos promedio de `createdAt` a `updatedAt` en los expedientes CLOSED del período. ' +
      '**Null si no se cerró ninguno**: es la ausencia de dato, no un cero.',
    example: 4.3,
    nullable: true,
    type: Number,
  })
  avgResolutionDays: number | null;

  @ApiProperty({
    description:
      'Días hábiles (lunes a viernes, sin feriados) promedio entre el alta y el cierre, contados en días argentinos: ' +
      'es lo que se compara con la meta. Null si no se cerró ninguno.',
    example: 3.1,
    nullable: true,
    type: Number,
  })
  avgResolutionBusinessDays: number | null;

  @ApiProperty({
    type: WithinDeadlineDto,
    description:
      'Resolución dentro del plazo objetivo (`deadlineBusinessDays`): se compara con la meta `reportsWithinDeadlinePct`',
  })
  withinDeadline: WithinDeadlineDto;
}

/** Foto de hoy de los reclamos abiertos creados en el período. */
export class OverdueDto {
  @ApiProperty({
    description: 'Reclamos abiertos (todo estado que no sea CLOSED) creados en el período',
    example: 9,
  })
  open: number;

  @ApiProperty({
    description:
      'Abiertos cuyos días hábiles desde el alta hasta hoy (día argentino) superan el plazo objetivo',
    example: 1,
  })
  overdue: number;

  @ApiProperty({
    description:
      'Vencidos ÷ abiertos, con un decimal. **Null si no hay abiertos**: es la ausencia de dato, no un 0 %',
    example: 11.1,
    nullable: true,
    type: Number,
  })
  pct: number | null;
}

export class ReportIncidentsDto extends ReportsTotalsDto {
  @ApiProperty({
    description:
      'Plazo objetivo de resolución en días hábiles (lunes a viernes, sin feriados), el mismo para todos los tipos de reclamo. Es un supuesto de M6 configurable (`INDICATORS_REPORT_DEADLINE_BUSINESS_DAYS`) hasta que M2 acuerde el suyo',
    example: 5,
  })
  deadlineBusinessDays: number;

  @ApiProperty({
    type: OverdueDto,
    description:
      'Foto del estado actual de los reclamos creados en el período, sin serie ni comparación: el sistema no guarda el historial de estados de los reclamos',
  })
  overdue: OverdueDto;

  @ApiProperty({ type: [ReportTypeCountDto] })
  byType: ReportTypeCountDto[];

  @ApiProperty({ type: [ReportStatusCountDto] })
  byStatus: ReportStatusCountDto[];
}

/** Denuncias más contenedores: lo que lleva cada punto de la serie y el período anterior. */
export class IncidentsTotalsDto extends ReportsTotalsDto {
  @ApiProperty({
    type: ContainerHistoryTotalsDto,
    description: 'Incidentes y pendientes de contenedores del intervalo o período',
  })
  containers: ContainerHistoryTotalsDto;
}

export class ReportsSeriesPointDto extends IncidentsTotalsDto {
  @ApiProperty({ description: 'Primer día del intervalo (YYYY-MM-DD)', example: '2026-08-03' })
  from: string;

  @ApiProperty({ description: 'Último día del intervalo, inclusive', example: '2026-08-09' })
  to: string;
}

export class ReportsPreviousDto {
  @ApiProperty({ type: PeriodDto })
  period: PeriodDto;

  @ApiProperty({ type: IncidentsTotalsDto })
  totals: IncidentsTotalsDto;
}

export class ReportsDeltaDto {
  @ApiProperty({
    description:
      'Puntos porcentuales de `withinDeadline.pct` contra el período anterior. Null si alguno de los dos no tiene reclamos resueltos',
    nullable: true,
    type: Number,
    example: 4.2,
  })
  withinDeadlinePct: number | null;

  @ApiProperty({
    description:
      'Incidentes de desborde contra el período anterior, en cantidades. Null si alguno de los dos períodos no tiene historial',
    nullable: true,
    type: Number,
    example: -2,
  })
  overflowIncidents: number | null;

  @ApiProperty({
    description:
      'Daños pendientes al fin del período contra los del anterior, en cantidades. Null si alguno de los dos no tiene historial',
    nullable: true,
    type: Number,
    example: -1,
  })
  pendingDamage: number | null;

  @ApiProperty({
    description: 'Días corridos contra el período anterior. Null si alguno no cerró denuncias',
    nullable: true,
    type: Number,
    example: -1.2,
  })
  avgResolutionDays: number | null;

  @ApiProperty({
    description: 'Días hábiles contra el período anterior. Null si alguno no cerró denuncias',
    nullable: true,
    type: Number,
    example: -0.8,
  })
  avgResolutionBusinessDays: number | null;
}

export class IncidentsTargetsDto {
  @ApiProperty({
    type: TargetDto,
    description: 'Meta de `reports.avgResolutionBusinessDays`',
  })
  resolutionBusinessDays: TargetDto;

  @ApiProperty({
    type: TargetDto,
    description: 'Meta de `reports.withinDeadline.pct` (mínimo)',
  })
  reportsWithinDeadlinePct: TargetDto;

  @ApiProperty({
    type: TargetDto,
    description: 'Meta de `reports.overdue.pct` (máximo)',
  })
  reportsOverduePct: TargetDto;

  @ApiProperty({
    type: TargetDto,
    description:
      'Meta de `containers.history.overflowIncidents`: tendencia mensual descendente, sin valor numérico (`direction: down`)',
  })
  overflowTrend: TargetDto;

  @ApiProperty({
    type: TargetDto,
    description:
      'Meta de `containers.history.pendingDamage`: reducir los pendientes mes a mes, sin valor numérico (`direction: down`)',
  })
  pendingDamageTrend: TargetDto;
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

  @ApiProperty({ type: IncidentsTargetsDto })
  targets: IncidentsTargetsDto;

  @ApiPropertyOptional({
    type: [ReportsSeriesPointDto],
    description:
      'Solo con `bucket`. Son las denuncias, por día argentino de creación. Contenedores y arbolado no tienen serie: son una foto del estado actual',
  })
  series?: ReportsSeriesPointDto[];

  @ApiPropertyOptional({
    type: ReportsPreviousDto,
    description: 'Solo con `compare=previous`. Cubre las denuncias, no contenedores ni arbolado',
  })
  previous?: ReportsPreviousDto;

  @ApiPropertyOptional({ type: ReportsDeltaDto, description: 'Solo con `compare=previous`' })
  delta?: ReportsDeltaDto;
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

export class WasteSeriesPointDto extends WasteTotalsDto {
  @ApiProperty({ description: 'Primer día del intervalo (YYYY-MM-DD)', example: '2026-08-03' })
  from: string;

  @ApiProperty({ description: 'Último día del intervalo, inclusive', example: '2026-08-09' })
  to: string;
}

export class WastePreviousDto {
  @ApiProperty({ type: PeriodDto })
  period: PeriodDto;

  @ApiProperty({ type: WasteTotalsDto })
  totals: WasteTotalsDto;
}

export class WasteDeltaDto {
  @ApiProperty({
    description:
      'Puntos porcentuales de `totals.divertedPct` contra el período anterior. Null si alguno de los dos no recolectó kilos',
    nullable: true,
    type: Number,
    example: 2.4,
  })
  divertedPct: number | null;
}

export class WasteTargetsDto {
  @ApiProperty({
    type: TargetDto,
    nullable: true,
    description:
      'Meta de `totals.divertedPct`. **Null mientras el equipo no la defina**: no hay meta acordada para el desvío del relleno',
  })
  landfillDiversionPct: TargetDto | null;
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

  @ApiProperty({ type: WasteTargetsDto })
  targets: WasteTargetsDto;

  @ApiPropertyOptional({
    type: [WasteSeriesPointDto],
    description:
      'Solo con `bucket`. Cada registro cae en el intervalo de la fecha del servicio que lo recolectó, como en el total',
  })
  series?: WasteSeriesPointDto[];

  @ApiPropertyOptional({ type: WastePreviousDto, description: 'Solo con `compare=previous`' })
  previous?: WastePreviousDto;

  @ApiPropertyOptional({ type: WasteDeltaDto, description: 'Solo con `compare=previous`' })
  delta?: WasteDeltaDto;
}
