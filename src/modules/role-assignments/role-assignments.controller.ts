import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { M6Role } from '../../auth/m6-role';
import { ApiPaginatedResponse, CurrentUser, Roles } from '../../common/decorators';
import { ErrorResponseDto } from '../../common/dto';
import { RolesGuard } from '../../common/guards';
import { ParseNumericIdPipe } from '../../common/pipes/numeric-id.pipe';
import { QueryRoleAssignmentsDto, ReplaceRolesDto, RoleAssignmentResponseDto } from './dto';
import { RoleAssignmentsService } from './role-assignments.service';

const USER_ID_PARAM = {
  name: 'userId',
  description: 'Id del usuario en M1 (el `sub` de su token), numérico',
  example: '42',
};

// El RolesGuard todavía no es global (PR 2 de #161): se aplica acá, a mano.
@ApiTags('role-assignments')
@ApiBearerAuth('JWT-auth')
@UseGuards(RolesGuard)
@Roles(M6Role.M6_ADMIN)
@Controller('role-assignments')
export class RoleAssignmentsController {
  constructor(private readonly service: RoleAssignmentsService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar usuarios con roles de M6 asignados',
    description:
      'Listado paginado de usuarios que tienen al menos un rol asignado, ordenado por id como texto ("10" antes que "2"; el id de M1 no se ordena numéricamente). Son los roles asignados, no los efectivos.',
  })
  @ApiPaginatedResponse(RoleAssignmentResponseDto, 'Listado paginado de asignaciones')
  @ApiResponse({ status: 400, description: 'Parámetros inválidos', type: ErrorResponseDto })
  @ApiResponse({ status: 401, description: 'Token JWT inválido o ausente', type: ErrorResponseDto })
  @ApiResponse({ status: 403, description: 'Requiere el rol M6_ADMIN', type: ErrorResponseDto })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  findAll(@Query() query: QueryRoleAssignmentsDto) {
    return this.service.findAll(query);
  }

  @Get(':userId')
  @ApiOperation({
    summary: 'Roles de M6 asignados a un usuario',
    description:
      'Devuelve los roles ASIGNADOS al usuario (lista vacía si no tiene), en el orden del enum. No dice si son efectivos: eso depende del rol que el usuario tenga en M1, y lo que rige para quien llama se ve en GET /me. La UI de administración debería mostrar ambos.',
  })
  @ApiParam(USER_ID_PARAM)
  @ApiResponse({ status: 200, description: 'Roles asignados', type: RoleAssignmentResponseDto })
  @ApiResponse({ status: 400, description: 'Id de usuario no numérico', type: ErrorResponseDto })
  @ApiResponse({ status: 401, description: 'Token JWT inválido o ausente', type: ErrorResponseDto })
  @ApiResponse({ status: 403, description: 'Requiere el rol M6_ADMIN', type: ErrorResponseDto })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  findOne(@Param('userId', ParseNumericIdPipe) userId: string): Promise<RoleAssignmentResponseDto> {
    return this.service.findOne(userId);
  }

  @Put(':userId')
  @ApiOperation({
    summary: 'Reemplazar los roles de M6 de un usuario',
    description:
      'Fija el conjunto completo de roles del usuario y audita cada alta y baja en la misma transacción. Oficina (M6_ADMIN, M6_OFICINA_*) y Campo (M6_CAMPO_*) son excluyentes, y un admin de bootstrap no admite roles de Campo. No valida contra el rol de M1 del destinatario (M6 no lo conoce): un rol que su rol de M1 no permite queda asignado pero no es efectivo. No se puede quitar el último M6_ADMIN si no hay admins de bootstrap.',
  })
  @ApiParam(USER_ID_PARAM)
  @ApiResponse({
    status: 200,
    description: 'Roles asignados tras el cambio',
    type: RoleAssignmentResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Rol inexistente, repetido, mezcla de Oficina y Campo o id no numérico',
    type: ErrorResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Token JWT inválido o ausente', type: ErrorResponseDto })
  @ApiResponse({ status: 403, description: 'Requiere el rol M6_ADMIN', type: ErrorResponseDto })
  @ApiResponse({
    status: 409,
    description: 'Quitaría el último M6_ADMIN, o hubo un cambio simultáneo',
    type: ErrorResponseDto,
  })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  replace(
    @Param('userId', ParseNumericIdPipe) userId: string,
    @Body() dto: ReplaceRolesDto,
    @CurrentUser('userId') actorUserId: string,
  ): Promise<RoleAssignmentResponseDto> {
    return this.service.replace(actorUserId, userId, dto.roles);
  }

  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Quitar todos los roles de M6 de un usuario',
    description:
      'Equivale a PUT con la lista vacía: audita cada baja. Es idempotente. No se puede quitar el último M6_ADMIN si no hay admins de bootstrap.',
  })
  @ApiParam(USER_ID_PARAM)
  @ApiResponse({ status: 204, description: 'Roles quitados (o no había)' })
  @ApiResponse({ status: 400, description: 'Id de usuario no numérico', type: ErrorResponseDto })
  @ApiResponse({ status: 401, description: 'Token JWT inválido o ausente', type: ErrorResponseDto })
  @ApiResponse({ status: 403, description: 'Requiere el rol M6_ADMIN', type: ErrorResponseDto })
  @ApiResponse({
    status: 409,
    description: 'Quitaría el último M6_ADMIN, o hubo un cambio simultáneo',
    type: ErrorResponseDto,
  })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  remove(
    @Param('userId', ParseNumericIdPipe) userId: string,
    @CurrentUser('userId') actorUserId: string,
  ): Promise<void> {
    return this.service.remove(actorUserId, userId);
  }
}
