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
import { CrewsService } from './crews.service';
import {
  CreateCrewDto,
  UpdateCrewDto,
  CrewResponseDto,
  QueryCrewsDto,
  AddCrewMembersDto,
} from './dto';
import { ErrorResponseDto } from '../../common/dto';

@ApiTags('crews')
@ApiBearerAuth('JWT-auth')
@Controller('crews')
export class CrewsController {
  constructor(private readonly crewsService: CrewsService) {}

  // ─── CRUD ──────────────────────────────────────────

  @Post()
  @ApiOperation({
    summary: 'Crear una cuadrilla',
    description:
      'Registra una nueva cuadrilla con su tipo, turno por defecto y opcionalmente un líder y organización. Se crea activa por defecto.',
  })
  @ApiResponse({
    status: 201,
    description: 'Cuadrilla creada exitosamente',
    type: CrewResponseDto,
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
    description: 'Sin permisos para crear cuadrillas',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  async create(@Body() dto: CreateCrewDto): Promise<CrewResponseDto> {
    return this.crewsService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar cuadrillas',
    description:
      'Retorna un listado paginado de cuadrillas. Se puede filtrar por estado activo/inactivo, tipo de cuadrilla y turno.',
  })
  @ApiResponse({
    status: 200,
    description: 'Listado paginado de cuadrillas',
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
  async findAll(@Query() query: QueryCrewsDto) {
    return this.crewsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener una cuadrilla por ID',
    description:
      'Retorna el detalle de una cuadrilla incluyendo la lista de miembros asignados.',
  })
  @ApiParam({ name: 'id', description: 'UUID de la cuadrilla', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Cuadrilla encontrada',
    type: CrewResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Token JWT inválido o ausente',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Cuadrilla no encontrada',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CrewResponseDto> {
    return this.crewsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar una cuadrilla',
    description:
      'Actualiza los campos mutables de una cuadrilla (nombre, turno, líder, organización, estado). El tipo de cuadrilla no se puede cambiar después de la creación.',
  })
  @ApiParam({ name: 'id', description: 'UUID de la cuadrilla', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Cuadrilla actualizada exitosamente',
    type: CrewResponseDto,
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
    description: 'Sin permisos para actualizar cuadrillas',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Cuadrilla no encontrada',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCrewDto,
  ): Promise<CrewResponseDto> {
    return this.crewsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Desactivar una cuadrilla',
    description:
      'Soft-delete: marca la cuadrilla como inactiva. No elimina el registro para preservar el historial de servicios asignados.',
  })
  @ApiParam({ name: 'id', description: 'UUID de la cuadrilla', format: 'uuid' })
  @ApiResponse({
    status: 204,
    description: 'Cuadrilla desactivada exitosamente',
  })
  @ApiResponse({
    status: 401,
    description: 'Token JWT inválido o ausente',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Sin permisos para desactivar cuadrillas',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Cuadrilla no encontrada',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.crewsService.remove(id);
  }

  // ─── Miembros (sub-recurso) ─────────────────────────

  @Post(':id/members')
  @ApiOperation({
    summary: 'Agregar miembros a una cuadrilla',
    description:
      'Asigna uno o más usuarios internos de M6 como miembros de la cuadrilla. Los duplicados se ignoran silenciosamente. Retorna la cuadrilla actualizada con todos sus miembros.',
  })
  @ApiParam({ name: 'id', description: 'UUID de la cuadrilla', format: 'uuid' })
  @ApiResponse({
    status: 201,
    description: 'Miembros agregados exitosamente. Retorna la cuadrilla actualizada',
    type: CrewResponseDto,
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
    description: 'Sin permisos para modificar cuadrillas',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Cuadrilla no encontrada',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  async addMembers(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddCrewMembersDto,
  ): Promise<CrewResponseDto> {
    return this.crewsService.addMembers(id, dto);
  }

  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Quitar un miembro de una cuadrilla',
    description: 'Desvincula un usuario específico de esta cuadrilla.',
  })
  @ApiParam({ name: 'id', description: 'UUID de la cuadrilla', format: 'uuid' })
  @ApiParam({
    name: 'userId',
    description: 'ID del usuario a desvincular',
  })
  @ApiResponse({
    status: 204,
    description: 'Miembro removido exitosamente',
  })
  @ApiResponse({
    status: 401,
    description: 'Token JWT inválido o ausente',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Sin permisos para modificar cuadrillas',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Cuadrilla o miembro no encontrado',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  async removeMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId') userId: string,
  ): Promise<void> {
    return this.crewsService.removeMember(id, userId);
  }
}
