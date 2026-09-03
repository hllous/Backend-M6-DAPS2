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
      'Objetivos atendidos sobre programados, con desglose por zona operativa y por tipo de servicio. La unidad es el par servicio/zona: un recorrido que pasa por cuatro zonas y atiende tres cuenta como tres objetivos cumplidos y uno no. Los servicios cancelados no cuentan: dejaron de ser un objetivo.',
  })
  @ApiResponse({ status: 200, description: 'Indicador de cobertura', type: CoverageIndicatorDto })
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
      'Servicios finalizados en término contra demorados, y el ranking de zonas que quedaron sin atender con los motivos que reportó la cuadrilla. "En término" se mide con el último resultado de campo cargado contra la fecha programada.',
  })
  @ApiResponse({
    status: 200,
    description: 'Indicador de cumplimiento',
    type: ComplianceIndicatorDto,
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
      'Contenedores desbordados y dañados por zona, árboles por nivel de riesgo según su último relevamiento, y denuncias por tipo y estado con el tiempo medio de resolución. Contenedores y arbolado son una foto del estado actual: el período solo filtra las denuncias.',
  })
  @ApiResponse({
    status: 200,
    description: 'Indicador de incidencias',
    type: IncidentsIndicatorDto,
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
      'Kilos y metros cúbicos por tipo de residuo y por sitio de disposición, y el porcentaje desviado del relleno hacia planta de reciclado o de compostaje. La fecha del residuo es la del servicio que lo recolectó.',
  })
  @ApiResponse({ status: 200, description: 'Indicador de residuos', type: WasteIndicatorDto })
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
