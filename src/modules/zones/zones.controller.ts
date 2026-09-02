import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { ZonesService } from './zones.service';
import {
  CreateZoneDto,
  UpdateZoneDto,
  ZoneResponseDto,
  QueryZonesDto,
  AddNeighborhoodsDto,
} from './dto';
import { ErrorResponseDto } from '../../common/dto';

@ApiTags('zones')
@ApiBearerAuth('JWT-auth')
@Controller('zones')
export class ZonesController {
  constructor(private readonly zonesService: ZonesService) {}

  // ─── CRUD ──────────────────────────────────────────

  @Post()
  @ApiOperation({
    summary: 'Crear una zona operativa',
    description:
      'Registra una nueva zona operativa con un código único. La zona se crea activa por defecto y puede agrupar barrios del catálogo de M9.',
  })
  @ApiResponse({
    status: 201,
    description: 'Zona creada exitosamente',
    type: ZoneResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Datos de entrada inválidos (validación fallida)',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Token JWT inválido o ausente',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Sin permisos para crear zonas',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Ya existe una zona con ese código',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  async create(@Body() dto: CreateZoneDto): Promise<ZoneResponseDto> {
    return this.zonesService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar zonas operativas',
    description:
      'Retorna un listado paginado de zonas operativas. Se puede filtrar por estado activo/inactivo y buscar por nombre.',
  })
  @ApiResponse({
    status: 200,
    description: 'Listado paginado de zonas',
  })
  @ApiResponse({
    status: 401,
    description: 'Token JWT inválido o ausente',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  async findAll(@Query() query: QueryZonesDto) {
    return this.zonesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener una zona por ID',
    description: 'Retorna el detalle de una zona operativa incluyendo los barrios asignados.',
  })
  @ApiParam({ name: 'id', description: 'UUID de la zona', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Zona encontrada',
    type: ZoneResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Token JWT inválido o ausente',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Zona no encontrada',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ZoneResponseDto> {
    return this.zonesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar una zona operativa',
    description:
      'Actualiza los campos mutables de una zona (nombre, estado). El código no se puede cambiar después de la creación.',
  })
  @ApiParam({ name: 'id', description: 'UUID de la zona', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Zona actualizada exitosamente',
    type: ZoneResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Datos de entrada inválidos',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Token JWT inválido o ausente',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Sin permisos para actualizar zonas',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Zona no encontrada',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateZoneDto,
  ): Promise<ZoneResponseDto> {
    return this.zonesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Desactivar una zona operativa',
    description:
      'Soft-delete: marca la zona como inactiva. No elimina el registro para preservar la integridad referencial con servicios, contenedores y otros recursos asociados.',
  })
  @ApiParam({ name: 'id', description: 'UUID de la zona', format: 'uuid' })
  @ApiResponse({
    status: 204,
    description: 'Zona desactivada exitosamente',
  })
  @ApiResponse({
    status: 401,
    description: 'Token JWT inválido o ausente',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Sin permisos para desactivar zonas',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Zona no encontrada',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.zonesService.remove(id);
  }

  // ─── Barrios (sub-recurso) ──────────────────────────

  @Post(':id/neighborhoods')
  @ApiOperation({
    summary: 'Asignar barrios a una zona',
    description:
      'Vincula uno o más barrios del catálogo de M9 a esta zona operativa. Los barrios duplicados se ignoran silenciosamente. Retorna la zona actualizada con todos sus barrios.',
  })
  @ApiParam({ name: 'id', description: 'UUID de la zona', format: 'uuid' })
  @ApiResponse({
    status: 201,
    description: 'Barrios asignados exitosamente. Retorna la zona actualizada',
    type: ZoneResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Datos de entrada inválidos',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Token JWT inválido o ausente',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Sin permisos para modificar zonas',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Zona no encontrada',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  async addNeighborhoods(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddNeighborhoodsDto,
  ): Promise<ZoneResponseDto> {
    return this.zonesService.addNeighborhoods(id, dto);
  }

  @Delete(':id/neighborhoods/:neighborhoodId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Quitar un barrio de una zona',
    description: 'Desvincula un barrio específico de esta zona operativa.',
  })
  @ApiParam({ name: 'id', description: 'UUID de la zona', format: 'uuid' })
  @ApiParam({
    name: 'neighborhoodId',
    description: 'ID del barrio a desvincular (catálogo de M9)',
  })
  @ApiResponse({
    status: 204,
    description: 'Barrio desvinculado exitosamente',
  })
  @ApiResponse({
    status: 401,
    description: 'Token JWT inválido o ausente',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Sin permisos para modificar zonas',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Zona o barrio no encontrado',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  async removeNeighborhood(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('neighborhoodId') neighborhoodId: string,
  ): Promise<void> {
    return this.zonesService.removeNeighborhood(id, neighborhoodId);
  }
}
