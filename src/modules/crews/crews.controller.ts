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
import { CrewsService } from './crews.service';
import {
  CreateCrewDto,
  UpdateCrewDto,
  CrewResponseDto,
  QueryCrewsDto,
  AddCrewMembersDto,
  CreateCrewZoneAssignmentDto,
  CrewZoneAssignmentResponseDto,
} from './dto';
import { ErrorResponseDto } from '../../common/dto';
import { ApiPaginatedResponse, CurrentUser, Roles } from '../../common/decorators';
import { ROLES_ADMIN, ROLES_OPERACIONES } from '../../auth/role-groups';

@ApiTags('crews')
@ApiBearerAuth('JWT-auth')
@Controller('crews')
export class CrewsController {
  constructor(private readonly crewsService: CrewsService) {}

  // ─── CRUD ──────────────────────────────────────────

  @Post()
  @Roles(...ROLES_ADMIN)
  @ApiOperation({
    summary: 'Crear una cuadrilla',
    description:
      'Registra una nueva cuadrilla con su tipo, especialidad y turno por defecto, y opcionalmente zona base, líder y organización (con sus nombres, que se guardan como copia de M1). Se crea activa por defecto.',
  })
  @ApiResponse({
    status: 201,
    description: 'Cuadrilla creada exitosamente',
    type: CrewResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Datos de entrada inválidos (validación fallida) o zona base dada de baja',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Token JWT inválido o ausente',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'La zona base no existe',
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
      'Retorna un listado paginado de cuadrillas con su cantidad de integrantes y su zona efectiva hoy. Se puede filtrar por estado activo/inactivo, tipo, turno, especialidad y zona efectiva hoy (`zoneId`: la reubicación vigente o, si no hay, la zona base).',
  })
  @ApiPaginatedResponse(CrewResponseDto, 'Listado paginado de cuadrillas')
  @ApiResponse({
    status: 400,
    description:
      'Filtros inválidos (por ejemplo `specialty` fuera del enum o `zoneId` que no es UUID)',
    type: ErrorResponseDto,
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
      'Retorna el detalle de una cuadrilla incluyendo la lista de miembros asignados, con sus nombres.',
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
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<CrewResponseDto> {
    return this.crewsService.findOne(id);
  }

  @Patch(':id')
  @Roles(...ROLES_ADMIN)
  @ApiOperation({
    summary: 'Actualizar una cuadrilla',
    description:
      'Actualiza los campos mutables de una cuadrilla (nombre, turno, especialidad, zona base, líder, organización, sus nombres y estado). El tipo de cuadrilla no se puede cambiar después de la creación.',
  })
  @ApiParam({ name: 'id', description: 'UUID de la cuadrilla', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Cuadrilla actualizada exitosamente',
    type: CrewResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Datos de entrada inválidos o zona base dada de baja',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Token JWT inválido o ausente',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Cuadrilla o zona base no encontrada',
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
  @Roles(...ROLES_ADMIN)
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
  @Roles(...ROLES_ADMIN)
  @ApiOperation({
    summary: 'Agregar miembros a una cuadrilla',
    description:
      'Asigna uno o más usuarios internos de M6 como miembros de la cuadrilla. Se envían en `members` (id de M1 y nombre opcional) o, por compatibilidad, en `userIds` (solo ids). Si un integrante ya estaba, se lo ignora salvo que traiga nombre: ahí se actualiza. Retorna la cuadrilla actualizada con todos sus miembros.',
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
  @Roles(...ROLES_ADMIN)
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

  // ─── Reubicaciones de zona (sub-recurso) ────────────

  @Post(':id/zone-assignments')
  @Roles(...ROLES_OPERACIONES)
  @ApiOperation({
    summary: 'Reubicar una cuadrilla en otra zona por un período',
    description:
      'Registra que la cuadrilla trabaja en otra zona entre `validFrom` y `validTo` (inclusive; sin `validTo`, hasta nuevo aviso). No cambia la zona base: al vencer, la cuadrilla vuelve a ella. Una cuadrilla no puede tener dos reubicaciones que se superpongan. Quien la carga queda registrado a partir del token.',
  })
  @ApiParam({ name: 'id', description: 'UUID de la cuadrilla', format: 'uuid' })
  @ApiResponse({
    status: 201,
    description: 'Reubicación registrada',
    type: CrewZoneAssignmentResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos: `validTo` anterior a `validFrom` o zona dada de baja',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Token JWT inválido o ausente',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'El rol del usuario no puede reubicar cuadrillas',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Cuadrilla o zona no encontrada',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'El período se superpone con otra reubicación de la cuadrilla',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  async createZoneAssignment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCrewZoneAssignmentDto,
    @CurrentUser('userId') userId: string,
  ): Promise<CrewZoneAssignmentResponseDto> {
    return this.crewsService.createZoneAssignment(id, dto, userId);
  }

  @Get(':id/zone-assignments')
  @ApiOperation({
    summary: 'Listar las reubicaciones de una cuadrilla',
    description:
      'Historial de reubicaciones de zona de la cuadrilla, la más reciente primero: vigentes, futuras y vencidas.',
  })
  @ApiParam({ name: 'id', description: 'UUID de la cuadrilla', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Reubicaciones de la cuadrilla',
    type: CrewZoneAssignmentResponseDto,
    isArray: true,
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
  async listZoneAssignments(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CrewZoneAssignmentResponseDto[]> {
    return this.crewsService.listZoneAssignments(id);
  }
}
