import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { EnvironmentalInspectionsService } from './environmental-inspections.service';
import {
  CompleteInspectionDto,
  CreateInspectionDto,
  InspectionResponseDto,
  IssueViolationNoticeDto,
  ViolationNoticeResponseDto,
} from './dto';
import { ErrorResponseDto } from '../../common/dto';
import { CurrentUser } from '../../common/decorators';

const AUTH = { status: 401, description: 'Token JWT inválido o ausente', type: ErrorResponseDto };
const FORBIDDEN = {
  status: 403,
  description: 'Sin permisos sobre inspecciones ambientales',
  type: ErrorResponseDto,
};
const NOT_FOUND = { status: 404, description: 'Inspección no encontrada', type: ErrorResponseDto };
const SERVER = { status: 500, description: 'Error interno del servidor', type: ErrorResponseDto };

@ApiTags('environmental-inspections')
@ApiBearerAuth('JWT-auth')
@Controller()
export class EnvironmentalInspectionsController {
  constructor(private readonly inspectionsService: EnvironmentalInspectionsService) {}

  @Post('environmental-reports/:reportId/inspections')
  @ApiOperation({
    summary: 'Programar la inspección de un expediente',
    description:
      'Lleva el expediente a INSPECTION_SCHEDULED. La inspección guarda qué se va a buscar; el Service asociado, cuándo y con qué cuadrilla — el mismo patrón que TreeIntervention. Ese paso no se publica al bus: environmentalInspectionScheduled fue descartado por no tener consumidor.',
  })
  @ApiParam({ name: 'reportId', description: 'UUID del expediente', format: 'uuid' })
  @ApiResponse({ status: 201, description: 'Inspección programada', type: InspectionResponseDto })
  @ApiResponse({
    status: 400,
    description: 'El servicio asociado no es de modo POINT',
    type: ErrorResponseDto,
  })
  @ApiResponse(AUTH)
  @ApiResponse(FORBIDDEN)
  @ApiResponse({
    status: 404,
    description: 'Expediente o servicio no encontrado',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'El expediente no está en UNDER_REVIEW',
    type: ErrorResponseDto,
  })
  @ApiResponse(SERVER)
  async create(
    @Param('reportId', ParseUUIDPipe) reportId: string,
    @Body() dto: CreateInspectionDto,
  ): Promise<InspectionResponseDto> {
    return this.inspectionsService.create(reportId, dto);
  }

  @Get('environmental-reports/:reportId/inspections')
  @ApiOperation({
    summary: 'Listar las inspecciones de un expediente',
    description: 'Incluye el checklist relevado, que es información interna.',
  })
  @ApiParam({ name: 'reportId', description: 'UUID del expediente', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Inspecciones del expediente',
    type: [InspectionResponseDto],
  })
  @ApiResponse(AUTH)
  @ApiResponse({ status: 404, description: 'Expediente no encontrado', type: ErrorResponseDto })
  @ApiResponse(SERVER)
  async findByReport(
    @Param('reportId', ParseUUIDPipe) reportId: string,
  ): Promise<InspectionResponseDto[]> {
    return this.inspectionsService.findByReport(reportId);
  }

  @Get('environmental-inspections/:id')
  @ApiOperation({
    summary: 'Obtener una inspección por ID',
    description:
      'Detalle completo con el checklist y los hallazgos. **Todo esto es interno y nunca sale hacia M2**: lo que el vecino ve es la proyección pública, sin identidad del inspector ni contenido del acta.',
  })
  @ApiParam({ name: 'id', description: 'UUID de la inspección', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Inspección encontrada', type: InspectionResponseDto })
  @ApiResponse(AUTH)
  @ApiResponse(NOT_FOUND)
  @ApiResponse(SERVER)
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<InspectionResponseDto> {
    return this.inspectionsService.findOne(id);
  }

  @Post('environmental-inspections/:id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cerrar la inspección con su resultado',
    description:
      'Lleva el expediente a INSPECTED y de ahí, en la misma operación, a NO_VIOLATION o VIOLATION_FOUND según el outcome. Un INCONCLUSIVE lo deja en INSPECTED, a la espera de otra inspección. El checklist y los hallazgos son internos.',
  })
  @ApiParam({ name: 'id', description: 'UUID de la inspección', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Inspección cerrada', type: InspectionResponseDto })
  @ApiResponse({ status: 400, description: 'Datos inválidos', type: ErrorResponseDto })
  @ApiResponse(AUTH)
  @ApiResponse(FORBIDDEN)
  @ApiResponse(NOT_FOUND)
  @ApiResponse({
    status: 409,
    description: 'La inspección ya fue cerrada, o el expediente no está en INSPECTION_SCHEDULED',
    type: ErrorResponseDto,
  })
  @ApiResponse(SERVER)
  async complete(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteInspectionDto,
  ): Promise<InspectionResponseDto> {
    return this.inspectionsService.complete(id, dto);
  }

  @Post('environmental-inspections/:id/violation-notice')
  @ApiOperation({
    summary: 'Emitir el acta de constatación',
    description:
      'Emite el acta sobre una inspección con resultado VIOLATION_FOUND y lleva el expediente a NOTICE_ISSUED. **El acta es inmutable**: no hay PATCH ni DELETE, si hay un error se emite otra. Sin establishmentId el acta se registra pero **no se deriva a M4** —es lo único sobre lo que pueden actuar— y el expediente cierra de nuestro lado. Con establishmentId se publica environmentalViolationDetected, con el conteo de actas previas del mismo establecimiento.',
  })
  @ApiParam({ name: 'id', description: 'UUID de la inspección', format: 'uuid' })
  @ApiResponse({ status: 201, description: 'Acta emitida', type: ViolationNoticeResponseDto })
  @ApiResponse({
    status: 400,
    description: 'La inspección no tiene resultado VIOLATION_FOUND',
    type: ErrorResponseDto,
  })
  @ApiResponse(AUTH)
  @ApiResponse(FORBIDDEN)
  @ApiResponse(NOT_FOUND)
  @ApiResponse({
    status: 409,
    description: 'La inspección ya tiene acta emitida, o el expediente no está en VIOLATION_FOUND',
    type: ErrorResponseDto,
  })
  @ApiResponse(SERVER)
  async issueNotice(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: IssueViolationNoticeDto,
    @CurrentUser('userId') userId: string,
  ): Promise<ViolationNoticeResponseDto> {
    return this.inspectionsService.issueNotice(id, dto, userId);
  }

  @Get('environmental-inspections/:id/violation-notice')
  @ApiOperation({
    summary: 'Obtener el acta de una inspección',
    description: 'El acta emitida, con su número correlativo y el conteo de reincidencia.',
  })
  @ApiParam({ name: 'id', description: 'UUID de la inspección', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Acta encontrada', type: ViolationNoticeResponseDto })
  @ApiResponse(AUTH)
  @ApiResponse({
    status: 404,
    description: 'La inspección no tiene acta emitida',
    type: ErrorResponseDto,
  })
  @ApiResponse(SERVER)
  async findNotice(@Param('id', ParseUUIDPipe) id: string): Promise<ViolationNoticeResponseDto> {
    return this.inspectionsService.findNotice(id);
  }
}
