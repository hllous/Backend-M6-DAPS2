import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { TreeInterventionsService } from './tree-interventions.service';
import {
  CreateTreeInterventionDto,
  TreeInterventionResponseDto,
  QueryTreeInterventionsDto,
  AuthorizeInterventionDto,
} from './dto';
import { ErrorResponseDto } from '../../../common/dto';

@ApiTags('tree-interventions')
@ApiBearerAuth('JWT-auth')
@Controller('tree-interventions')
export class TreeInterventionsController {
  constructor(private readonly treeInterventionsService: TreeInterventionsService) {}

  @Post()
  @ApiOperation({
    summary: 'Solicitar una intervención sobre árboles',
    description:
      'Crea una solicitud de intervención (poda, extracción, plantación o tratamiento) sobre uno o más árboles. Se crea en estado REQUESTED. Las extracciones (REMOVAL) requieren autorización adicional vía el endpoint submit-for-authorization.',
  })
  @ApiResponse({
    status: 201,
    description: 'Intervención solicitada exitosamente',
    type: TreeInterventionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos', type: ErrorResponseDto })
  @ApiResponse({ status: 401, description: 'Token JWT inválido o ausente', type: ErrorResponseDto })
  @ApiResponse({
    status: 403,
    description: 'Sin permisos para solicitar intervenciones',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Uno o más árboles no encontrados',
    type: ErrorResponseDto,
  })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  async create(@Body() dto: CreateTreeInterventionDto): Promise<TreeInterventionResponseDto> {
    return this.treeInterventionsService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar intervenciones sobre árboles',
    description:
      'Retorna un listado paginado de intervenciones. Se puede filtrar por tipo y estado.',
  })
  @ApiResponse({ status: 200, description: 'Listado paginado de intervenciones' })
  @ApiResponse({ status: 401, description: 'Token JWT inválido o ausente', type: ErrorResponseDto })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  async findAll(@Query() query: QueryTreeInterventionsDto) {
    return this.treeInterventionsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener una intervención por ID',
    description: 'Retorna el detalle de una intervención incluyendo los árboles afectados.',
  })
  @ApiParam({ name: 'id', description: 'UUID de la intervención', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Intervención encontrada',
    type: TreeInterventionResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Token JWT inválido o ausente', type: ErrorResponseDto })
  @ApiResponse({ status: 404, description: 'Intervención no encontrada', type: ErrorResponseDto })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<TreeInterventionResponseDto> {
    return this.treeInterventionsService.findOne(id);
  }

  // ─── Transiciones de estado ────────────────────────

  @Post(':id/submit-for-authorization')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Enviar extracción a autorización',
    description:
      'Transición REQUESTED → PENDING_AUTHORIZATION. Solo para intervenciones de tipo REMOVAL. Las podas no requieren este paso.',
  })
  @ApiParam({ name: 'id', description: 'UUID de la intervención', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Enviada a autorización',
    type: TreeInterventionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Solo REMOVAL requiere autorización',
    type: ErrorResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Token JWT inválido o ausente', type: ErrorResponseDto })
  @ApiResponse({ status: 404, description: 'Intervención no encontrada', type: ErrorResponseDto })
  @ApiResponse({ status: 409, description: 'Transición inválida', type: ErrorResponseDto })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  async submitForAuthorization(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TreeInterventionResponseDto> {
    return this.treeInterventionsService.submitForAuthorization(id);
  }

  @Post(':id/authorize')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Autorizar una intervención',
    description:
      'Transición PENDING_AUTHORIZATION → AUTHORIZED (para REMOVAL) o REQUESTED → AUTHORIZED (para podas). Registra quién autorizó y cuándo.',
  })
  @ApiParam({ name: 'id', description: 'UUID de la intervención', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Intervención autorizada',
    type: TreeInterventionResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Token JWT inválido o ausente', type: ErrorResponseDto })
  @ApiResponse({ status: 404, description: 'Intervención no encontrada', type: ErrorResponseDto })
  @ApiResponse({ status: 409, description: 'Transición inválida', type: ErrorResponseDto })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  async authorize(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AuthorizeInterventionDto,
  ): Promise<TreeInterventionResponseDto> {
    return this.treeInterventionsService.authorize(id, dto);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rechazar una intervención',
    description: 'Transición PENDING_AUTHORIZATION → REJECTED. Estado terminal.',
  })
  @ApiParam({ name: 'id', description: 'UUID de la intervención', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Intervención rechazada',
    type: TreeInterventionResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Token JWT inválido o ausente', type: ErrorResponseDto })
  @ApiResponse({ status: 404, description: 'Intervención no encontrada', type: ErrorResponseDto })
  @ApiResponse({ status: 409, description: 'Transición inválida', type: ErrorResponseDto })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  async reject(@Param('id', ParseUUIDPipe) id: string): Promise<TreeInterventionResponseDto> {
    return this.treeInterventionsService.reject(id);
  }
}
