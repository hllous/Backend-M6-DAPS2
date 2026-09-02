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
import { ServiceTypesService } from './service-types.service';
import {
  CreateServiceTypeDto,
  QueryServiceTypesDto,
  ServiceTypeResponseDto,
  UpdateServiceTypeDto,
} from './dto';
import { ErrorResponseDto } from '../../common/dto';

// Tag 'services': el catálogo de tipos es configuración de los servicios.
// docs/api/estandar-swagger.md §2 no admite tags fuera de los declarados en main.ts.
@ApiTags('services')
@ApiBearerAuth('JWT-auth')
@Controller('service-types')
export class ServiceTypesController {
  constructor(private readonly serviceTypesService: ServiceTypesService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear un tipo de servicio',
    description:
      'Da de alta un tipo de servicio en el catálogo, con su código único, área operativa, modo de ejecución (ROUTE o POINT) y si exige vehículo. Es lo que después permite programar un Service.',
  })
  @ApiResponse({
    status: 201,
    description: 'Tipo de servicio creado exitosamente',
    type: ServiceTypeResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos', type: ErrorResponseDto })
  @ApiResponse({
    status: 401,
    description: 'Token JWT inválido o ausente',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Sin permisos para crear tipos de servicio',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Ya existe un tipo de servicio con ese código',
    type: ErrorResponseDto,
  })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  async create(@Body() dto: CreateServiceTypeDto): Promise<ServiceTypeResponseDto> {
    return this.serviceTypesService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar tipos de servicio',
    description:
      'Retorna un listado paginado del catálogo. Se puede filtrar por estado, área operativa y modo, y buscar por nombre.',
  })
  @ApiResponse({ status: 200, description: 'Listado paginado de tipos de servicio' })
  @ApiResponse({
    status: 401,
    description: 'Token JWT inválido o ausente',
    type: ErrorResponseDto,
  })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  async findAll(@Query() query: QueryServiceTypesDto) {
    return this.serviceTypesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener un tipo de servicio por ID',
    description: 'Retorna el detalle completo de un tipo de servicio del catálogo.',
  })
  @ApiParam({ name: 'id', description: 'UUID del tipo de servicio', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Tipo de servicio encontrado',
    type: ServiceTypeResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Token JWT inválido o ausente',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Tipo de servicio no encontrado',
    type: ErrorResponseDto,
  })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ServiceTypeResponseDto> {
    return this.serviceTypesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar un tipo de servicio',
    description:
      'Actualiza los campos mutables (nombre, si exige vehículo, estado). El código, el área y el modo no se pueden cambiar: hay servicios ya programados que los copiaron.',
  })
  @ApiParam({ name: 'id', description: 'UUID del tipo de servicio', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Tipo de servicio actualizado exitosamente',
    type: ServiceTypeResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos', type: ErrorResponseDto })
  @ApiResponse({
    status: 401,
    description: 'Token JWT inválido o ausente',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Sin permisos para actualizar tipos de servicio',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Tipo de servicio no encontrado',
    type: ErrorResponseDto,
  })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServiceTypeDto,
  ): Promise<ServiceTypeResponseDto> {
    return this.serviceTypesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Desactivar un tipo de servicio',
    description:
      'Soft-delete: lo saca del catálogo de programación sin eliminar el registro, para no romper los servicios y las frecuencias que ya lo referencian.',
  })
  @ApiParam({ name: 'id', description: 'UUID del tipo de servicio', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Tipo de servicio desactivado exitosamente' })
  @ApiResponse({
    status: 401,
    description: 'Token JWT inválido o ausente',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Sin permisos para desactivar tipos de servicio',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Tipo de servicio no encontrado',
    type: ErrorResponseDto,
  })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.serviceTypesService.remove(id);
  }
}
