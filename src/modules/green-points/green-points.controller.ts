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
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GreenPointsService } from './green-points.service';
import {
  CreateGreenPointDto,
  GreenPointResponseDto,
  QueryGreenPointsDto,
  UpdateGreenPointDto,
} from './dto';
import { ErrorResponseDto } from '../../common/dto';

// Tag 'containers': docs/README.md agrupa "Contenedores y puntos verdes" en la
// misma área. El estándar (estandar-swagger.md §2) no admite tags nuevos.
@ApiTags('containers')
@ApiBearerAuth('JWT-auth')
@Controller('green-points')
export class GreenPointsController {
  constructor(private readonly greenPointsService: GreenPointsService) {}

  @Post()
  @ApiOperation({
    summary: 'Registrar un punto verde',
    description:
      'Da de alta un punto verde de entrega voluntaria con su código único, zona, ubicación y los tipos de residuo que acepta. El vaciado y el mantenimiento se programan después como Service con mode=POINT.',
  })
  @ApiResponse({
    status: 201,
    description: 'Punto verde registrado exitosamente',
    type: GreenPointResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos', type: ErrorResponseDto })
  @ApiResponse({ status: 401, description: 'Token JWT inválido o ausente', type: ErrorResponseDto })
  @ApiResponse({
    status: 403,
    description: 'Sin permisos para registrar puntos verdes',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Zona referenciada no encontrada',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Ya existe un punto verde con ese código',
    type: ErrorResponseDto,
  })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  async create(@Body() dto: CreateGreenPointDto): Promise<GreenPointResponseDto> {
    return this.greenPointsService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar puntos verdes',
    description:
      'Retorna un listado paginado. Se puede filtrar por estado, zona y tipo de residuo aceptado, y buscar por nombre o dirección.',
  })
  @ApiResponse({ status: 200, description: 'Listado paginado de puntos verdes' })
  @ApiResponse({ status: 401, description: 'Token JWT inválido o ausente', type: ErrorResponseDto })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  async findAll(@Query() query: QueryGreenPointsDto) {
    return this.greenPointsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener un punto verde por ID',
    description: 'Retorna el detalle completo, incluyendo los tipos de residuo que acepta.',
  })
  @ApiParam({ name: 'id', description: 'UUID del punto verde', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Punto verde encontrado', type: GreenPointResponseDto })
  @ApiResponse({ status: 401, description: 'Token JWT inválido o ausente', type: ErrorResponseDto })
  @ApiResponse({ status: 404, description: 'Punto verde no encontrado', type: ErrorResponseDto })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<GreenPointResponseDto> {
    return this.greenPointsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar un punto verde',
    description:
      'Actualiza los campos mutables. El array de tipos de residuo reemplaza el conjunto completo. El código no se puede cambiar: identifica al punto verde en la vía pública.',
  })
  @ApiParam({ name: 'id', description: 'UUID del punto verde', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Punto verde actualizado exitosamente',
    type: GreenPointResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos', type: ErrorResponseDto })
  @ApiResponse({ status: 401, description: 'Token JWT inválido o ausente', type: ErrorResponseDto })
  @ApiResponse({
    status: 403,
    description: 'Sin permisos para actualizar puntos verdes',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Punto verde o zona no encontrada',
    type: ErrorResponseDto,
  })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGreenPointDto,
  ): Promise<GreenPointResponseDto> {
    return this.greenPointsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Deshabilitar un punto verde',
    description:
      'Soft-delete: lo saca de servicio sin eliminar el registro, para no perder el histórico del emplazamiento.',
  })
  @ApiParam({ name: 'id', description: 'UUID del punto verde', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Punto verde deshabilitado exitosamente' })
  @ApiResponse({ status: 401, description: 'Token JWT inválido o ausente', type: ErrorResponseDto })
  @ApiResponse({
    status: 403,
    description: 'Sin permisos para deshabilitar puntos verdes',
    type: ErrorResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Punto verde no encontrado', type: ErrorResponseDto })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.greenPointsService.remove(id);
  }
}
