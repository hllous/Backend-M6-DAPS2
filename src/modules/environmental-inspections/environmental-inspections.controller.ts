import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { EnvironmentalInspectionsService } from './environmental-inspections.service';
import {
  CompleteInspectionDto,
  CreateInspectionDto,
  InspectionResponseDto,
  IssueViolationNoticeDto,
  ViolationNoticeResponseDto,
} from './dto';
import { ErrorResponseDto } from '../../common/dto';
import { ApiNotAssigned, CurrentUser, Roles } from '../../common/decorators';
import { ROLES_ACTA_LECTURA, ROLES_AMBIENTAL, ROLES_INSPECTOR } from '../../auth/role-groups';

const AUTH = { status: 401, description: 'Token JWT inválido o ausente', type: ErrorResponseDto };
const NOT_FOUND = { status: 404, description: 'Inspección no encontrada', type: ErrorResponseDto };
const SERVER = { status: 500, description: 'Error interno del servidor', type: ErrorResponseDto };

@ApiTags('environmental-inspections')
@ApiBearerAuth('JWT-auth')
@Controller()
export class EnvironmentalInspectionsController {
  constructor(private readonly inspectionsService: EnvironmentalInspectionsService) {}

  @Post('environmental-reports/:reportId/inspections')
  @Roles(...ROLES_AMBIENTAL)
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
  @ApiNotAssigned('el inspector asignado')
  @Roles(...ROLES_INSPECTOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cerrar la inspección con su resultado',
    description:
      'Si la inspección tiene inspector asignado, solo él puede cerrarla (403 NOT_ASSIGNED para otro inspector); sin asignado, cualquier inspector, y queda registrado el del token como `completedByUserId`. Lleva el expediente a INSPECTED y de ahí, en la misma operación, a NO_VIOLATION o VIOLATION_FOUND según el outcome. Un INCONCLUSIVE lo deja en INSPECTED, a la espera de otra inspección. El checklist y los hallazgos son internos.',
  })
  @ApiParam({ name: 'id', description: 'UUID de la inspección', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Inspección cerrada', type: InspectionResponseDto })
  @ApiResponse({
    status: 400,
    description:
      'Datos inválidos, inspectedAt en el futuro, o resultado VIOLATION_FOUND sin nextStep',
    type: ErrorResponseDto,
  })
  @ApiResponse(AUTH)
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
    @CurrentUser('userId') userId: string,
  ): Promise<InspectionResponseDto> {
    return this.inspectionsService.complete(id, dto, userId);
  }

  @Post('environmental-inspections/:id/violation-notice')
  @Roles(...ROLES_AMBIENTAL)
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
  @Roles(...ROLES_ACTA_LECTURA)
  @ApiExtraModels(ViolationNoticeResponseDto)
  @ApiOperation({
    summary: 'Obtener el acta de una inspección',
    description:
      'El acta emitida, con su número correlativo y el conteo de reincidencia. Si la inspección existe pero todavía no tiene acta responde 200 con el JSON literal null, no 404.',
  })
  @ApiParam({ name: 'id', description: 'UUID de la inspección', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Acta encontrada, o null si la inspección aún no tiene acta',
    schema: { nullable: true, allOf: [{ $ref: getSchemaPath(ViolationNoticeResponseDto) }] },
  })
  @ApiResponse(AUTH)
  @ApiResponse(NOT_FOUND)
  @ApiResponse(SERVER)
  async findNotice(
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ViolationNoticeResponseDto | string> {
    const notice = await this.inspectionsService.findNotice(id);
    if (notice) return notice;
    // Nest manda un cuerpo vacío para null, y res.json() del cliente falla con eso.
    // Devolver el texto 'null' con Content-Type JSON da el literal sin tocar otros endpoints.
    res.type('application/json');
    return 'null';
  }
}
