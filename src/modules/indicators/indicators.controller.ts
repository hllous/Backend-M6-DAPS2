import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IndicatorsService } from './indicators.service';
import {
  ComplianceIndicatorDto,
  CoverageIndicatorDto,
  IncidentsIndicatorDto,
  PeriodQueryDto,
  ServicePeriodQueryDto,
  WasteIndicatorDto,
} from './dto';
import { ErrorResponseDto } from '../../common/dto';

@ApiTags('indicators')
@ApiBearerAuth('JWT-auth')
@Controller('indicators')
export class IndicatorsController {
  constructor(private readonly indicatorsService: IndicatorsService) {}

  @Get('coverage')
  @ApiOperation({
    summary: 'Cobertura del servicio',
    description:
      'Objetivos atendidos sobre programados, con desglose por zona operativa y por tipo de servicio. La unidad es el par servicio/zona: un recorrido que pasa por cuatro zonas y atiende tres cuenta como tres objetivos cumplidos y uno no. Los servicios cancelados no cuentan: dejaron de ser un objetivo. Solo cuentan los objetivos con fecha vencida (hoy o antes): lo programado a futuro va aparte en `upcoming`. Con `bucket` suma `series`; con `compare=previous`, `previous` y `delta`. `targets` trae la meta con su sentido.',
  })
  @ApiResponse({ status: 200, description: 'Indicador de cobertura', type: CoverageIndicatorDto })
  @ApiResponse({
    status: 400,
    description:
      'Período inválido (from posterior a to), bucket o compare fuera de los valores permitidos, o un bucket que da más de 90 puntos en el rango pedido',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Token JWT inválido o ausente',
    type: ErrorResponseDto,
  })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  async coverage(@Query() query: ServicePeriodQueryDto): Promise<CoverageIndicatorDto> {
    return this.indicatorsService.coverage(query);
  }

  @Get('compliance')
  @ApiOperation({
    summary: 'Cumplimiento y zonas no atendidas',
    description:
      'Servicios finalizados en término contra demorados, y el ranking de zonas que quedaron sin atender con los motivos que reportó la cuadrilla. "En término" se mide con el último resultado de campo cargado contra la fecha programada. El desvío de programación son los servicios reprogramados o con aviso de demora sobre los del período. Con `bucket` suma `series`; con `compare=previous`, `previous` y `delta`. `targets` trae la meta con su sentido.',
  })
  @ApiResponse({
    status: 200,
    description: 'Indicador de cumplimiento',
    type: ComplianceIndicatorDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Período inválido (from posterior a to), bucket o compare fuera de los valores permitidos, o un bucket que da más de 90 puntos en el rango pedido',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Token JWT inválido o ausente',
    type: ErrorResponseDto,
  })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  async compliance(@Query() query: ServicePeriodQueryDto): Promise<ComplianceIndicatorDto> {
    return this.indicatorsService.compliance(query);
  }

  @Get('incidents')
  @ApiOperation({
    summary: 'Incidencias del inventario y de las denuncias',
    description:
      'Contenedores por estado y zona (foto del estado actual), árboles por nivel de riesgo según su último relevamiento, y denuncias por tipo y estado con el tiempo medio de resolución. Desde el historial de estados suma los incidentes de desborde y de daño del período y los daños pendientes al final (`containers.history`, con `trackingSince`: antes de esa fecha no hay datos y los pendientes son null). De las denuncias suma las resueltas dentro del plazo objetivo (`reports.withinDeadline`) y los vencidos (`reports.overdue`, una foto de hoy de lo creado en el período). El plazo objetivo es de M6, único para todos los tipos y en días hábiles (lunes a viernes, sin feriados). El tiempo de resolución se informa en días corridos y en días hábiles; su meta es en días hábiles. Con `bucket` suma `series` (denuncias y contenedores del intervalo; los vencidos no tienen serie); con `compare=previous`, `previous` y `delta` (los vencidos no se comparan). `targets` trae cada meta con su sentido: las de desbordados y daños pendientes son de tendencia descendente (`down`) y no tienen valor numérico.',
  })
  @ApiResponse({
    status: 200,
    description: 'Indicador de incidencias',
    type: IncidentsIndicatorDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Período inválido (from posterior a to), bucket o compare fuera de los valores permitidos, o un bucket que da más de 90 puntos en el rango pedido',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Token JWT inválido o ausente',
    type: ErrorResponseDto,
  })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  async incidents(@Query() query: PeriodQueryDto): Promise<IncidentsIndicatorDto> {
    return this.indicatorsService.incidents(query);
  }

  @Get('waste')
  @ApiOperation({
    summary: 'Residuos recolectados y destino final',
    description:
      'Kilos y metros cúbicos por tipo de residuo y por sitio de disposición, y el porcentaje desviado del relleno hacia planta de reciclado o de compostaje. La fecha del residuo es la del servicio que lo recolectó. Con `bucket` suma `series`; con `compare=previous`, `previous` y `delta`. `targets` trae la meta con su sentido. La meta del desvío del relleno es null mientras el equipo no la defina.',
  })
  @ApiResponse({ status: 200, description: 'Indicador de residuos', type: WasteIndicatorDto })
  @ApiResponse({
    status: 400,
    description:
      'Período inválido (from posterior a to), bucket o compare fuera de los valores permitidos, o un bucket que da más de 90 puntos en el rango pedido',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Token JWT inválido o ausente',
    type: ErrorResponseDto,
  })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  async waste(@Query() query: PeriodQueryDto): Promise<WasteIndicatorDto> {
    return this.indicatorsService.waste(query);
  }
}
