import { Controller, Get, Post, Patch, Delete, Body, Param, Query, HttpCode, HttpStatus, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { TreesService } from './trees.service';
import { CreateTreeDto, UpdateTreeDto, TreeResponseDto, QueryTreesDto } from './dto';
import { ErrorResponseDto } from '../../common/dto';

@ApiTags('trees')
@ApiBearerAuth('JWT-auth')
@Controller('trees')
export class TreesController {
  constructor(private readonly treesService: TreesService) {}

  @Post()
  @ApiOperation({ summary: 'Registrar un árbol', description: 'Da de alta un árbol en el inventario de arbolado urbano con su código de relevamiento (único), especie, ubicación y datos dendrométricos.' })
  @ApiResponse({ status: 201, description: 'Árbol registrado exitosamente', type: TreeResponseDto })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos', type: ErrorResponseDto })
  @ApiResponse({ status: 401, description: 'Token JWT inválido o ausente', type: ErrorResponseDto })
  @ApiResponse({ status: 403, description: 'Sin permisos para registrar árboles', type: ErrorResponseDto })
  @ApiResponse({ status: 404, description: 'Zona referenciada no encontrada', type: ErrorResponseDto })
  @ApiResponse({ status: 409, description: 'Ya existe un árbol con ese código de relevamiento', type: ErrorResponseDto })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  async create(@Body() dto: CreateTreeDto): Promise<TreeResponseDto> { return this.treesService.create(dto); }

  @Get()
  @ApiOperation({ summary: 'Listar árboles del inventario', description: 'Retorna un listado paginado de árboles. Se puede filtrar por estado, zona y buscar por especie o dirección.' })
  @ApiResponse({ status: 200, description: 'Listado paginado de árboles' })
  @ApiResponse({ status: 401, description: 'Token JWT inválido o ausente', type: ErrorResponseDto })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  async findAll(@Query() query: QueryTreesDto) { return this.treesService.findAll(query); }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un árbol por ID', description: 'Retorna el detalle completo de un árbol del inventario.' })
  @ApiParam({ name: 'id', description: 'UUID del árbol', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Árbol encontrado', type: TreeResponseDto })
  @ApiResponse({ status: 401, description: 'Token JWT inválido o ausente', type: ErrorResponseDto })
  @ApiResponse({ status: 404, description: 'Árbol no encontrado', type: ErrorResponseDto })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<TreeResponseDto> { return this.treesService.findOne(id); }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar datos de un árbol', description: 'Actualiza los campos mutables. El código de relevamiento no se puede cambiar.' })
  @ApiParam({ name: 'id', description: 'UUID del árbol', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Árbol actualizado exitosamente', type: TreeResponseDto })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos', type: ErrorResponseDto })
  @ApiResponse({ status: 401, description: 'Token JWT inválido o ausente', type: ErrorResponseDto })
  @ApiResponse({ status: 403, description: 'Sin permisos', type: ErrorResponseDto })
  @ApiResponse({ status: 404, description: 'Árbol o zona no encontrada', type: ErrorResponseDto })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTreeDto): Promise<TreeResponseDto> { return this.treesService.update(id, dto); }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Desactivar un árbol del inventario', description: 'Soft-delete: marca el árbol como inactivo. No elimina el registro.' })
  @ApiParam({ name: 'id', description: 'UUID del árbol', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Árbol desactivado exitosamente' })
  @ApiResponse({ status: 401, description: 'Token JWT inválido o ausente', type: ErrorResponseDto })
  @ApiResponse({ status: 403, description: 'Sin permisos', type: ErrorResponseDto })
  @ApiResponse({ status: 404, description: 'Árbol no encontrado', type: ErrorResponseDto })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> { return this.treesService.remove(id); }
}
