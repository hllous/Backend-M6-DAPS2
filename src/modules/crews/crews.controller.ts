import { Idempotent } from '../../common/idempotency/idempotent.decorator';
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
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
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
import {
  ApiPaginatedResponse,
  CurrentUser,
  Roles,
  ApiBadRequestParams,
} from '../../common/decorators';
import { AuthenticatedUser } from '../../auth/jwt.strategy';
import { ROLES_ADMIN, ROLES_OPERACIONES } from '../../auth/role-groups';
import { ApiAnyM6Role } from '../../common/decorators/roles.decorator';

@ApiTags('crews')
@ApiBearerAuth('JWT-auth')
@Controller('crews')
export class CrewsController {
  constructor(private readonly crewsService: CrewsService) {}

  // ─── CRUD ──────────────────────────────────────────

  @Post()
  @Roles(...ROLES_ADMIN)
  @ApiBody({
    type: CreateCrewDto,
    examples: {
      ejemplo: {
        summary: 'Cuadrilla municipal de recolección',
        value: {
          name: 'Cuadrilla Norte - Turno Mañana',
          crewType: 'MUNICIPAL',
          defaultShift: 'MORNING',
          specialty: 'COLLECTION',
          leaderUserId: '1',
          leaderName: 'Marta Gómez',
          homeZoneId: 'a1b2c3d4-e5f6-4789-8abc-def012345678',
        },
      },
    },
  })
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
    status: 422,
    description:
      'Algún id de usuario no existe en M1 o no es un empleado activo (el mensaje los lista)',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 503,
    description: 'M1 no responde y no se pudo validar a los usuarios; no se guardó nada',
    type: ErrorResponseDto,
  })
  @Idempotent()
  async create(
    @Body() dto: CreateCrewDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<CrewResponseDto> {
    return this.crewsService.create(dto, actor);
  }

  @ApiAnyM6Role()
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

  @ApiAnyM6Role()
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
  @ApiBadRequestParams()
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
    status: 422,
    description:
      'Algún id de usuario no existe en M1 o no es un empleado activo (el mensaje los lista)',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 503,
    description: 'M1 no responde y no se pudo validar a los usuarios; no se guardó nada',
    type: ErrorResponseDto,
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCrewDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<CrewResponseDto> {
    return this.crewsService.update(id, dto, actor);
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
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<void> {
    return this.crewsService.remove(id, actor);
  }

  // ─── Miembros (sub-recurso) ─────────────────────────

  @Post(':id/members')
  @Roles(...ROLES_ADMIN)
  @ApiBody({
    type: AddCrewMembersDto,
    examples: {
      ejemplo: {
        summary: 'Alta de dos integrantes',
        value: {
          members: [
            { userId: '10', displayName: 'Lucía Fernández' },
            { userId: '11', displayName: 'Tomás Ruiz' },
          ],
        },
      },
    },
  })
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
    status: 422,
    description:
      'Algún id de usuario no existe en M1 o no es un empleado activo (el mensaje los lista)',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 503,
    description: 'M1 no responde y no se pudo validar a los usuarios; no se guardó nada',
    type: ErrorResponseDto,
  })
  async addMembers(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddCrewMembersDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<CrewResponseDto> {
    return this.crewsService.addMembers(id, dto, actor);
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
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<void> {
    return this.crewsService.removeMember(id, userId, actor);
  }

  // ─── Reubicaciones de zona (sub-recurso) ────────────

  @Post(':id/zone-assignments')
  @Roles(...ROLES_OPERACIONES)
  @ApiBody({
    type: CreateCrewZoneAssignmentDto,
    examples: {
      ejemplo: {
        summary: 'Reubicación temporal por refuerzo',
        value: {
          zoneId: 'a1b2c3d4-e5f6-4789-8abc-def012345678',
          validFrom: '2027-03-22',
          validTo: '2027-04-05',
          reason: 'Refuerzo por acumulación de residuos tras el temporal',
        },
      },
    },
  })
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
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<CrewZoneAssignmentResponseDto> {
    return this.crewsService.createZoneAssignment(id, dto, actor);
  }

  @ApiAnyM6Role()
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
  @ApiBadRequestParams()
  async listZoneAssignments(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CrewZoneAssignmentResponseDto[]> {
    return this.crewsService.listZoneAssignments(id);
  }
}
