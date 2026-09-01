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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { VehiclesService } from './vehicles.service';
import {
  CreateVehicleDto,
  UpdateVehicleDto,
  VehicleResponseDto,
  QueryVehiclesDto,
} from './dto';
import { ErrorResponseDto } from '../../common/dto';

@ApiTags('vehicles')
@ApiBearerAuth('JWT-auth')
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Post()
  @ApiOperation({
    summary: 'Registrar un vehículo',
    description:
      'Da de alta un vehículo con su patente (única), tipo y capacidad opcional. Se crea activo por defecto.',
  })
  @ApiResponse({
    status: 201,
    description: 'Vehículo registrado exitosamente',
    type: VehicleResponseDto,
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
    description: 'Sin permisos para registrar vehículos',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Ya existe un vehículo con esa patente',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  async create(@Body() dto: CreateVehicleDto): Promise<VehicleResponseDto> {
    return this.vehiclesService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar vehículos',
    description:
      'Retorna un listado paginado de vehículos. Se puede filtrar por estado activo/inactivo y por tipo de vehículo.',
  })
  @ApiResponse({
    status: 200,
    description: 'Listado paginado de vehículos',
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
  async findAll(@Query() query: QueryVehiclesDto) {
    return this.vehiclesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener un vehículo por ID',
    description: 'Retorna el detalle completo de un vehículo.',
  })
  @ApiParam({ name: 'id', description: 'UUID del vehículo', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Vehículo encontrado',
    type: VehicleResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Token JWT inválido o ausente',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Vehículo no encontrado',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<VehicleResponseDto> {
    return this.vehiclesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar un vehículo',
    description:
      'Actualiza los campos mutables de un vehículo (patente, capacidad, estado activo). El tipo de vehículo no se puede cambiar después de la creación.',
  })
  @ApiParam({ name: 'id', description: 'UUID del vehículo', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Vehículo actualizado exitosamente',
    type: VehicleResponseDto,
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
    description: 'Sin permisos para actualizar vehículos',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Vehículo no encontrado',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Ya existe un vehículo con esa patente',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVehicleDto,
  ): Promise<VehicleResponseDto> {
    return this.vehiclesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Desactivar un vehículo',
    description:
      'Soft-delete: marca el vehículo como inactivo. No elimina el registro para preservar el historial de servicios asociados.',
  })
  @ApiParam({ name: 'id', description: 'UUID del vehículo', format: 'uuid' })
  @ApiResponse({
    status: 204,
    description: 'Vehículo desactivado exitosamente',
  })
  @ApiResponse({
    status: 401,
    description: 'Token JWT inválido o ausente',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Sin permisos para desactivar vehículos',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Vehículo no encontrado',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.vehiclesService.remove(id);
  }
}
