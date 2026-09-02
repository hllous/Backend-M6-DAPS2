import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { EnvironmentalReportsService } from './environmental-reports.service';
import {
  CreateEnvironmentalReportDto,
  EnvironmentalReportResponseDto,
  QueryEnvironmentalReportsDto,
  ReportStatusChangeDto,
} from './dto';
import { ErrorResponseDto } from '../../common/dto';
import { CurrentUser } from '../../common/decorators';

const AUTH = { status: 401, description: 'Token JWT inválido o ausente', type: ErrorResponseDto };
const FORBIDDEN = {
  status: 403,
  description: 'Sin permisos sobre expedientes ambientales',
  type: ErrorResponseDto,
};
const NOT_FOUND = { status: 404, description: 'Expediente no encontrado', type: ErrorResponseDto };
const CONFLICT = { status: 409, description: 'Transición inválida', type: ErrorResponseDto };
const SERVER = { status: 500, description: 'Error interno del servidor', type: ErrorResponseDto };

@ApiTags('environmental-reports')
@ApiBearerAuth('JWT-auth')
@Controller('environmental-reports')
export class EnvironmentalReportsController {
  constructor(private readonly reportsService: EnvironmentalReportsService) {}

  @Post()
  @ApiOperation({
    summary: 'Abrir un expediente ambiental',
    description:
      'Registra una denuncia ambiental —ruidos, vertidos, microbasurales, emisiones— y abre el expediente en estado RECEIVED. Puede nacer de un reclamo de M2 (con ticketId) o de una detección de oficio del inspector, que es el camino que no depende de ningún otro módulo.',
  })
  @ApiResponse({
    status: 201,
    description: 'Expediente abierto',
    type: EnvironmentalReportResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos', type: ErrorResponseDto })
  @ApiResponse(AUTH)
  @ApiResponse(FORBIDDEN)
  @ApiResponse(SERVER)
  async create(@Body() dto: CreateEnvironmentalReportDto): Promise<EnvironmentalReportResponseDto> {
    return this.reportsService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar expedientes ambientales',
    description:
      'Listado paginado. Filtros por estado, tipo de denuncia, prioridad, reclamo de origen y búsqueda por dirección.',
  })
  @ApiResponse({ status: 200, description: 'Listado paginado de expedientes' })
  @ApiResponse(AUTH)
  @ApiResponse(SERVER)
  async findAll(@Query() query: QueryEnvironmentalReportsDto) {
    return this.reportsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener un expediente por ID',
    description: 'Detalle del expediente, con su estado y su plazo de vencimiento si lo tiene.',
  })
  @ApiParam({ name: 'id', description: 'UUID del expediente', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Expediente encontrado',
    type: EnvironmentalReportResponseDto,
  })
  @ApiResponse(AUTH)
  @ApiResponse(NOT_FOUND)
  @ApiResponse(SERVER)
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<EnvironmentalReportResponseDto> {
    return this.reportsService.findOne(id);
  }

  @Post(':id/start-review')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Tomar el expediente para análisis',
    description: 'RECEIVED → UNDER_REVIEW. Si nació de un reclamo, se le avisa a M2.',
  })
  @ApiParam({ name: 'id', description: 'UUID del expediente', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Expediente en análisis',
    type: EnvironmentalReportResponseDto,
  })
  @ApiResponse(AUTH)
  @ApiResponse(FORBIDDEN)
  @ApiResponse(NOT_FOUND)
  @ApiResponse(CONFLICT)
  @ApiResponse(SERVER)
  async startReview(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') userId: string,
  ): Promise<EnvironmentalReportResponseDto> {
    return this.reportsService.startReview(id, userId);
  }

  @Post(':id/forward')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Derivar: no es de nuestra competencia',
    description:
      'UNDER_REVIEW → FORWARDED. Hacia M2 sale como RETURNED, no como REJECTED: devolver un reclamo que no es de nuestra área es distinto de desestimarlo.',
  })
  @ApiParam({ name: 'id', description: 'UUID del expediente', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Expediente derivado',
    type: EnvironmentalReportResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Falta el motivo', type: ErrorResponseDto })
  @ApiResponse(AUTH)
  @ApiResponse(FORBIDDEN)
  @ApiResponse(NOT_FOUND)
  @ApiResponse(CONFLICT)
  @ApiResponse(SERVER)
  async forward(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReportStatusChangeDto,
    @CurrentUser('userId') userId: string,
  ): Promise<EnvironmentalReportResponseDto> {
    return this.reportsService.forward(id, dto.reason, userId);
  }

  @Post(':id/dismiss')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Desestimar sin inspección',
    description: 'UNDER_REVIEW → DISMISSED. Hacia M2 sale como REJECTED.',
  })
  @ApiParam({ name: 'id', description: 'UUID del expediente', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Expediente desestimado',
    type: EnvironmentalReportResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Falta el motivo', type: ErrorResponseDto })
  @ApiResponse(AUTH)
  @ApiResponse(FORBIDDEN)
  @ApiResponse(NOT_FOUND)
  @ApiResponse(CONFLICT)
  @ApiResponse(SERVER)
  async dismiss(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReportStatusChangeDto,
    @CurrentUser('userId') userId: string,
  ): Promise<EnvironmentalReportResponseDto> {
    return this.reportsService.dismiss(id, dto.reason, userId);
  }

  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cerrar el expediente',
    description:
      'Cierra desde FORWARDED, DISMISSED, NO_VIOLATION, SANCTIONED o NOTICE_ISSUED. El cierre por vencimiento del plazo de M4 lo hace el sistema solo, sin pasar por acá.',
  })
  @ApiParam({ name: 'id', description: 'UUID del expediente', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Expediente cerrado',
    type: EnvironmentalReportResponseDto,
  })
  @ApiResponse(AUTH)
  @ApiResponse(FORBIDDEN)
  @ApiResponse(NOT_FOUND)
  @ApiResponse(CONFLICT)
  @ApiResponse(SERVER)
  async close(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') userId: string,
  ): Promise<EnvironmentalReportResponseDto> {
    return this.reportsService.close(id, userId);
  }
}
