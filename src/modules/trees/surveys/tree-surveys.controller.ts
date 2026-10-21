import { Controller, Get, Post, Body, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { TreeSurveysService } from './tree-surveys.service';
import { CreateTreeSurveyDto, TreeSurveyResponseDto, QueryTreeSurveysDto } from './dto';
import { ErrorResponseDto } from '../../../common/dto';
import { ApiPaginatedResponse, CurrentUser, Roles } from '../../../common/decorators';
import { ROLES_CUADRILLA } from '../../../auth/role-groups';

@ApiTags('tree-surveys')
@ApiBearerAuth('JWT-auth')
@Controller('trees/:treeId/surveys')
export class TreeSurveysController {
  constructor(private readonly treeSurveysService: TreeSurveysService) {}

  @Post()
  @Roles(...ROLES_CUADRILLA)
  @ApiOperation({
    summary: 'Registrar un relevamiento fitosanitario',
    description:
      'Crea un nuevo registro de inspección fitosanitaria para un árbol. El relevamiento es inmutable: una vez registrado, no se puede modificar ni eliminar. Si riskLevel es HIGH o CRITICAL, el sistema puede generar el evento treeRiskDetected hacia M3/M5.',
  })
  @ApiParam({ name: 'treeId', description: 'UUID del árbol', format: 'uuid' })
  @ApiResponse({
    status: 201,
    description: 'Relevamiento registrado exitosamente',
    type: TreeSurveyResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos, fecha posterior a hoy o riesgo HIGH/CRITICAL sin riskType',
    type: ErrorResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Token JWT inválido o ausente', type: ErrorResponseDto })
  @ApiResponse({ status: 404, description: 'Árbol no encontrado', type: ErrorResponseDto })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  async create(
    @Param('treeId', ParseUUIDPipe) treeId: string,
    @Body() dto: CreateTreeSurveyDto,
    @CurrentUser('userId') userId: string,
  ): Promise<TreeSurveyResponseDto> {
    return this.treeSurveysService.create(treeId, dto, userId);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar relevamientos de un árbol',
    description:
      'Retorna un listado paginado de relevamientos fitosanitarios, ordenados del más reciente al más antiguo.',
  })
  @ApiParam({ name: 'treeId', description: 'UUID del árbol', format: 'uuid' })
  @ApiPaginatedResponse(TreeSurveyResponseDto, 'Listado paginado de relevamientos')
  @ApiResponse({ status: 401, description: 'Token JWT inválido o ausente', type: ErrorResponseDto })
  @ApiResponse({ status: 404, description: 'Árbol no encontrado', type: ErrorResponseDto })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  async findAll(
    @Param('treeId', ParseUUIDPipe) treeId: string,
    @Query() query: QueryTreeSurveysDto,
  ) {
    return this.treeSurveysService.findAllByTree(treeId, query);
  }

  @Get(':surveyId')
  @ApiOperation({
    summary: 'Obtener un relevamiento por ID',
    description: 'Retorna el detalle completo de un relevamiento fitosanitario específico.',
  })
  @ApiParam({ name: 'treeId', description: 'UUID del árbol', format: 'uuid' })
  @ApiParam({ name: 'surveyId', description: 'UUID del relevamiento', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Relevamiento encontrado', type: TreeSurveyResponseDto })
  @ApiResponse({ status: 401, description: 'Token JWT inválido o ausente', type: ErrorResponseDto })
  @ApiResponse({
    status: 404,
    description: 'Árbol o relevamiento no encontrado',
    type: ErrorResponseDto,
  })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  async findOne(
    @Param('treeId', ParseUUIDPipe) treeId: string,
    @Param('surveyId', ParseUUIDPipe) surveyId: string,
  ): Promise<TreeSurveyResponseDto> {
    return this.treeSurveysService.findOne(treeId, surveyId);
  }
}
