import {
  Controller,
  Get,
  Post,
  Patch,
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
import { ContainersService } from './containers.service';
import {
  CreateContainerDto,
  UpdateContainerDto,
  ContainerResponseDto,
  QueryContainersDto,
  ReportDamageDto,
  ConfirmRelocationDto,
} from './dto';
import { ErrorResponseDto } from '../../common/dto';

@ApiTags('containers')
@ApiBearerAuth('JWT-auth')
@Controller('containers')
export class ContainersController {
  constructor(private readonly containersService: ContainersService) {}

  // ─── CRUD ──────────────────────────────────────────

  @Post()
  @ApiOperation({
    summary: 'Registrar un contenedor',
    description:
      'Da de alta un contenedor en el inventario urbano con su código único, tipo, zona, capacidad y ubicación. Se crea en estado ACTIVE.',
  })
  @ApiResponse({
    status: 201,
    description: 'Contenedor registrado exitosamente',
    type: ContainerResponseDto,
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
    description: 'Sin permisos para registrar contenedores',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Zona referenciada no encontrada',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Ya existe un contenedor con ese código',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  async create(
    @Body() dto: CreateContainerDto,
  ): Promise<ContainerResponseDto> {
    return this.containersService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar contenedores',
    description:
      'Retorna un listado paginado de contenedores. Se puede filtrar por estado, tipo, zona y buscar por dirección.',
  })
  @ApiResponse({
    status: 200,
    description: 'Listado paginado de contenedores',
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
  async findAll(@Query() query: QueryContainersDto) {
    return this.containersService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener un contenedor por ID',
    description:
      'Retorna el detalle completo de un contenedor incluyendo su zona, estado actual y datos de daño si aplica.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID del contenedor',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Contenedor encontrado',
    type: ContainerResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Token JWT inválido o ausente',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Contenedor no encontrado',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ContainerResponseDto> {
    return this.containersService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar datos de un contenedor',
    description:
      'Actualiza campos mutables (zona, capacidad, ubicación). El código y tipo no se pueden cambiar. Para cambios de estado, usar los endpoints específicos de transición.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID del contenedor',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Contenedor actualizado exitosamente',
    type: ContainerResponseDto,
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
    description: 'Sin permisos para actualizar contenedores',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Contenedor o zona no encontrada',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContainerDto,
  ): Promise<ContainerResponseDto> {
    return this.containersService.update(id, dto);
  }

  // ─── Transiciones de estado ────────────────────────

  @Post(':id/report-overflow')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reportar desborde de un contenedor',
    description:
      'Transición ACTIVE → OVERFLOWED. Registra que el contenedor está desbordado.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID del contenedor',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Desborde registrado. Retorna el contenedor actualizado',
    type: ContainerResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Token JWT inválido o ausente',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Contenedor no encontrado',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 409,
    description:
      'Transición inválida (el contenedor no está en estado ACTIVE)',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  async reportOverflow(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ContainerResponseDto> {
    return this.containersService.reportOverflow(id);
  }

  @Post(':id/report-damage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reportar daño en un contenedor',
    description:
      'Transición ACTIVE → DAMAGED. Registra el tipo de daño, severidad y si requiere derivación a Obras Públicas (M3). Un contenedor con requiresPublicWorks=true genera el evento containerDamaged hacia M3.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID del contenedor',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Daño registrado. Retorna el contenedor actualizado',
    type: ContainerResponseDto,
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
    status: 404,
    description: 'Contenedor no encontrado',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 409,
    description:
      'Transición inválida (el contenedor no está en estado ACTIVE)',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  async reportDamage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReportDamageDto,
  ): Promise<ContainerResponseDto> {
    return this.containersService.reportDamage(id, dto);
  }

  @Post(':id/empty')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Registrar vaciado de un contenedor',
    description:
      'Transición OVERFLOWED → ACTIVE. Indica que el contenedor fue vaciado y vuelve a estar operativo.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID del contenedor',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Vaciado registrado. Retorna el contenedor actualizado',
    type: ContainerResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Token JWT inválido o ausente',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Contenedor no encontrado',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 409,
    description:
      'Transición inválida (el contenedor no está en estado OVERFLOWED)',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  async empty(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ContainerResponseDto> {
    return this.containersService.empty(id);
  }

  @Post(':id/start-repair')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Enviar un contenedor a reparación',
    description:
      'Transición DAMAGED → UNDER_REPAIR. Indica que el contenedor fue retirado para reparación.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID del contenedor',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description:
      'Reparación iniciada. Retorna el contenedor actualizado',
    type: ContainerResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Token JWT inválido o ausente',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Contenedor no encontrado',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 409,
    description:
      'Transición inválida (el contenedor no está en estado DAMAGED)',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  async startRepair(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ContainerResponseDto> {
    return this.containersService.startRepair(id);
  }

  @Post(':id/complete-repair')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Completar reparación de un contenedor',
    description:
      'Transición UNDER_REPAIR → ACTIVE. Indica que la reparación finalizó y el contenedor vuelve a servicio. Limpia los campos de daño.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID del contenedor',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description:
      'Reparación completada. Retorna el contenedor actualizado',
    type: ContainerResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Token JWT inválido o ausente',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Contenedor no encontrado',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 409,
    description:
      'Transición inválida (el contenedor no está en estado UNDER_REPAIR)',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  async completeRepair(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ContainerResponseDto> {
    return this.containersService.completeRepair(id);
  }

  @Post(':id/relocate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Iniciar reubicación de un contenedor',
    description:
      'Transición ACTIVE → RELOCATING. Indica que el contenedor está siendo trasladado a una nueva ubicación.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID del contenedor',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description:
      'Reubicación iniciada. Retorna el contenedor actualizado',
    type: ContainerResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Token JWT inválido o ausente',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Contenedor no encontrado',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 409,
    description:
      'Transición inválida (el contenedor no está en estado ACTIVE)',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  async relocate(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ContainerResponseDto> {
    return this.containersService.relocate(id);
  }

  @Post(':id/confirm-relocation')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirmar reubicación de un contenedor',
    description:
      'Transición RELOCATING → ACTIVE. Confirma la nueva ubicación del contenedor y lo vuelve a poner en servicio.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID del contenedor',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description:
      'Reubicación confirmada. Retorna el contenedor con la nueva ubicación',
    type: ContainerResponseDto,
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
    status: 404,
    description: 'Contenedor no encontrado',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 409,
    description:
      'Transición inválida (el contenedor no está en estado RELOCATING)',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  async confirmRelocation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmRelocationDto,
  ): Promise<ContainerResponseDto> {
    return this.containersService.confirmRelocation(id, dto);
  }

  @Post(':id/remove')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Retirar un contenedor definitivamente',
    description:
      'Transición ACTIVE|DAMAGED → REMOVED. Retira el contenedor del servicio de forma permanente. Estado terminal: no admite más transiciones.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID del contenedor',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description:
      'Contenedor retirado. Retorna el contenedor en estado REMOVED',
    type: ContainerResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Token JWT inválido o ausente',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Contenedor no encontrado',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 409,
    description:
      'Transición inválida (solo se puede retirar desde ACTIVE o DAMAGED)',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ContainerResponseDto> {
    return this.containersService.remove(id);
  }
}
