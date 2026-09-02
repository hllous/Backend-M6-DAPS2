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
import { ServiceFrequenciesService } from './service-frequencies.service';
import {
  CreateServiceFrequencyDto,
  QueryServiceFrequenciesDto,
  ServiceFrequencyResponseDto,
  UpdateServiceFrequencyDto,
} from './dto';
import { ErrorResponseDto } from '../../common/dto';

// Tag 'zones': el estándar (docs/api/estandar-swagger.md §2) declara que ese
// tag cubre "Zonas operativas, recorridos y frecuencias".
@ApiTags('zones')
@ApiBearerAuth('JWT-auth')
@Controller('service-frequencies')
export class ServiceFrequenciesController {
  constructor(private readonly serviceFrequenciesService: ServiceFrequenciesService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear una frecuencia de servicio',
    description:
      'Da de alta la regla que genera los servicios planificados: "tipo X sobre el recorrido R, martes y viernes, turno mañana, desde tal fecha". El tipo de servicio tiene que ser de modo ROUTE. Los servicios que genera nacen con origin=PLANNED y no proyectan nada hacia M2.',
  })
  @ApiResponse({
    status: 201,
    description: 'Frecuencia creada exitosamente',
    type: ServiceFrequencyResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Datos inválidos: período con validTo anterior a validFrom, o tipo de servicio que no es de modo ROUTE',
    type: ErrorResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Token JWT inválido o ausente', type: ErrorResponseDto })
  @ApiResponse({
    status: 403,
    description: 'Sin permisos para crear frecuencias',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'El tipo de servicio o el recorrido referenciado no existe',
    type: ErrorResponseDto,
  })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  async create(@Body() dto: CreateServiceFrequencyDto): Promise<ServiceFrequencyResponseDto> {
    return this.serviceFrequenciesService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar frecuencias de servicio',
    description:
      'Retorna un listado paginado. Se puede filtrar por tipo de servicio, recorrido, turno, día de la semana, y por vigencia en una fecha dada con validOn.',
  })
  @ApiResponse({ status: 200, description: 'Listado paginado de frecuencias' })
  @ApiResponse({ status: 401, description: 'Token JWT inválido o ausente', type: ErrorResponseDto })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  async findAll(@Query() query: QueryServiceFrequenciesDto) {
    return this.serviceFrequenciesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener una frecuencia por ID',
    description: 'Retorna el detalle completo de la regla, con sus días de la semana.',
  })
  @ApiParam({ name: 'id', description: 'UUID de la frecuencia', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Frecuencia encontrada',
    type: ServiceFrequencyResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Token JWT inválido o ausente', type: ErrorResponseDto })
  @ApiResponse({ status: 404, description: 'Frecuencia no encontrada', type: ErrorResponseDto })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ServiceFrequencyResponseDto> {
    return this.serviceFrequenciesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar una frecuencia',
    description:
      'Actualiza días, turno y vigencia. El array de días reemplaza el conjunto completo. El tipo de servicio y el recorrido no se pueden cambiar: eso sería otra regla, y corresponde cerrar esta y crear una nueva.',
  })
  @ApiParam({ name: 'id', description: 'UUID de la frecuencia', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Frecuencia actualizada exitosamente',
    type: ServiceFrequencyResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos: validTo anterior a validFrom',
    type: ErrorResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Token JWT inválido o ausente', type: ErrorResponseDto })
  @ApiResponse({
    status: 403,
    description: 'Sin permisos para actualizar frecuencias',
    type: ErrorResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Frecuencia no encontrada', type: ErrorResponseDto })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServiceFrequencyDto,
  ): Promise<ServiceFrequencyResponseDto> {
    return this.serviceFrequenciesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Cerrar la vigencia de una frecuencia',
    description:
      'La regla deja de generar servicios a partir de hoy. No borra el registro: la baja se expresa con validTo, que es el mecanismo que ya define el dominio, en vez de un campo de estado aparte. Si la regla todavía no empezó a regir, se cierra en su fecha de inicio.',
  })
  @ApiParam({ name: 'id', description: 'UUID de la frecuencia', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Vigencia cerrada exitosamente' })
  @ApiResponse({ status: 401, description: 'Token JWT inválido o ausente', type: ErrorResponseDto })
  @ApiResponse({
    status: 403,
    description: 'Sin permisos para cerrar frecuencias',
    type: ErrorResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Frecuencia no encontrada', type: ErrorResponseDto })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.serviceFrequenciesService.remove(id);
  }
}
