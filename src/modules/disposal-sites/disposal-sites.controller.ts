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
import { DisposalSitesService } from './disposal-sites.service';
import {
  CreateDisposalSiteDto,
  DisposalSiteResponseDto,
  QueryDisposalSitesDto,
  UpdateDisposalSiteDto,
} from './dto';
import { ErrorResponseDto } from '../../common/dto';

// Tag 'services': el destino final del residuo se registra al cerrar un servicio
// de recolección. docs/api/estandar-swagger.md §2 no admite tags nuevos.
@ApiTags('services')
@ApiBearerAuth('JWT-auth')
@Controller('disposal-sites')
export class DisposalSitesController {
  constructor(private readonly disposalSitesService: DisposalSitesService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear un sitio de disposición',
    description:
      'Da de alta un destino final de residuos (relleno, estación de transferencia, planta de reciclado o de compostaje) con su código único.',
  })
  @ApiResponse({
    status: 201,
    description: 'Sitio de disposición creado exitosamente',
    type: DisposalSiteResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos', type: ErrorResponseDto })
  @ApiResponse({
    status: 401,
    description: 'Token JWT inválido o ausente',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Sin permisos para crear sitios de disposición',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Ya existe un sitio de disposición con ese código',
    type: ErrorResponseDto,
  })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  async create(@Body() dto: CreateDisposalSiteDto): Promise<DisposalSiteResponseDto> {
    return this.disposalSitesService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar sitios de disposición',
    description:
      'Retorna un listado paginado. Se puede filtrar por estado operativo y tipo de destino, y buscar por nombre.',
  })
  @ApiResponse({ status: 200, description: 'Listado paginado de sitios de disposición' })
  @ApiResponse({
    status: 401,
    description: 'Token JWT inválido o ausente',
    type: ErrorResponseDto,
  })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  async findAll(@Query() query: QueryDisposalSitesDto) {
    return this.disposalSitesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener un sitio de disposición por ID',
    description: 'Retorna el detalle completo de un sitio de disposición.',
  })
  @ApiParam({ name: 'id', description: 'UUID del sitio de disposición', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Sitio de disposición encontrado',
    type: DisposalSiteResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Token JWT inválido o ausente',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Sitio de disposición no encontrado',
    type: ErrorResponseDto,
  })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<DisposalSiteResponseDto> {
    return this.disposalSitesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar un sitio de disposición',
    description:
      'Actualiza nombre, tipo de destino y estado operativo. El código no se puede cambiar: identifica al sitio en los registros de recolección ya cargados.',
  })
  @ApiParam({ name: 'id', description: 'UUID del sitio de disposición', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Sitio de disposición actualizado exitosamente',
    type: DisposalSiteResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos', type: ErrorResponseDto })
  @ApiResponse({
    status: 401,
    description: 'Token JWT inválido o ausente',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Sin permisos para actualizar sitios de disposición',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Sitio de disposición no encontrado',
    type: ErrorResponseDto,
  })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDisposalSiteDto,
  ): Promise<DisposalSiteResponseDto> {
    return this.disposalSitesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Desactivar un sitio de disposición',
    description:
      'Soft-delete: lo saca del catálogo sin eliminar el registro. Los registros de recolección ya cargados apuntan al sitio, y el borrado físico rompería el histórico de destino final.',
  })
  @ApiParam({ name: 'id', description: 'UUID del sitio de disposición', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Sitio de disposición desactivado exitosamente' })
  @ApiResponse({
    status: 401,
    description: 'Token JWT inválido o ausente',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Sin permisos para desactivar sitios de disposición',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Sitio de disposición no encontrado',
    type: ErrorResponseDto,
  })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.disposalSitesService.remove(id);
  }
}
