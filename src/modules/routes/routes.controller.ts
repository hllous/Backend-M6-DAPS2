import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RoutesService } from './routes.service';
import {
  CreateRouteDto,
  QueryRoutesDto,
  RouteResponseDto,
  SetRouteStopsDto,
  UpdateRouteDto,
} from './dto';
import { ErrorResponseDto } from '../../common/dto';

// Tag 'zones': el estándar (docs/api/estandar-swagger.md §2) declara que ese
// tag cubre "Zonas operativas, recorridos y frecuencias".
@ApiTags('zones')
@ApiBearerAuth('JWT-auth')
@Controller('routes')
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear un recorrido',
    description:
      'Da de alta un recorrido con su código único. Se crea sin paradas: la secuencia de zonas se carga después con PUT /routes/:id/stops.',
  })
  @ApiResponse({
    status: 201,
    description: 'Recorrido creado exitosamente',
    type: RouteResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos', type: ErrorResponseDto })
  @ApiResponse({ status: 401, description: 'Token JWT inválido o ausente', type: ErrorResponseDto })
  @ApiResponse({
    status: 403,
    description: 'Sin permisos para crear recorridos',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Ya existe un recorrido con ese código',
    type: ErrorResponseDto,
  })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  async create(@Body() dto: CreateRouteDto): Promise<RouteResponseDto> {
    return this.routesService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar recorridos',
    description:
      'Retorna un listado paginado. Se puede filtrar por estado, por zona por la que pasa el recorrido, y buscar por nombre. No incluye las paradas: para eso, el GET por ID.',
  })
  @ApiResponse({ status: 200, description: 'Listado paginado de recorridos' })
  @ApiResponse({ status: 401, description: 'Token JWT inválido o ausente', type: ErrorResponseDto })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  async findAll(@Query() query: QueryRoutesDto) {
    return this.routesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener un recorrido por ID',
    description: 'Retorna el recorrido con su secuencia completa de paradas, en orden.',
  })
  @ApiParam({ name: 'id', description: 'UUID del recorrido', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Recorrido encontrado', type: RouteResponseDto })
  @ApiResponse({ status: 401, description: 'Token JWT inválido o ausente', type: ErrorResponseDto })
  @ApiResponse({ status: 404, description: 'Recorrido no encontrado', type: ErrorResponseDto })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<RouteResponseDto> {
    return this.routesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar un recorrido',
    description:
      'Actualiza nombre y estado. El código no se puede cambiar, y las paradas se editan con PUT /routes/:id/stops.',
  })
  @ApiParam({ name: 'id', description: 'UUID del recorrido', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Recorrido actualizado exitosamente',
    type: RouteResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos', type: ErrorResponseDto })
  @ApiResponse({ status: 401, description: 'Token JWT inválido o ausente', type: ErrorResponseDto })
  @ApiResponse({
    status: 403,
    description: 'Sin permisos para actualizar recorridos',
    type: ErrorResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Recorrido no encontrado', type: ErrorResponseDto })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRouteDto,
  ): Promise<RouteResponseDto> {
    return this.routesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Desactivar un recorrido',
    description:
      'Soft-delete: lo saca del catálogo sin eliminar el registro. Los servicios ya programados guardan su routeId, y el borrado físico rompería el histórico.',
  })
  @ApiParam({ name: 'id', description: 'UUID del recorrido', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Recorrido desactivado exitosamente' })
  @ApiResponse({ status: 401, description: 'Token JWT inválido o ausente', type: ErrorResponseDto })
  @ApiResponse({
    status: 403,
    description: 'Sin permisos para desactivar recorridos',
    type: ErrorResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Recorrido no encontrado', type: ErrorResponseDto })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.routesService.remove(id);
  }

  // ─── Paradas ──────────────────────────────────────

  @Put(':id/stops')
  @ApiOperation({
    summary: 'Definir la secuencia de paradas de un recorrido',
    description:
      'Reemplaza la secuencia completa. El orden del array es el orden del recorrido. Un solo endpoint cubre alta, baja y reordenamiento de paradas, de forma atómica: mover paradas de a una chocaría con la restricción de unicidad de la posición. Enviar un array vacío deja el recorrido sin paradas. Una zona no puede repetirse.',
  })
  @ApiParam({ name: 'id', description: 'UUID del recorrido', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Secuencia actualizada. Devuelve el recorrido con sus paradas en orden.',
    type: RouteResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos, o una zona repetida en el recorrido',
    type: ErrorResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Token JWT inválido o ausente', type: ErrorResponseDto })
  @ApiResponse({
    status: 403,
    description: 'Sin permisos para editar recorridos',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Recorrido no encontrado, o alguna zona referenciada no existe',
    type: ErrorResponseDto,
  })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  async setStops(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetRouteStopsDto,
  ): Promise<RouteResponseDto> {
    return this.routesService.setStops(id, dto);
  }
}
