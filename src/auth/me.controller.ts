import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AnyEmployee, CurrentUser } from '../common/decorators';
import { ErrorResponseDto } from '../common/dto';
import { AuthenticatedUser, SUB_TYPES, SubType } from './jwt.strategy';
import { MeService } from './me.service';
import { M6_ROLES, M6Role } from './m6-role';

export const CREW_ROLES = ['LEADER', 'MEMBER'] as const;
export type CrewRole = (typeof CREW_ROLES)[number];

export class MeCrewDto {
  @ApiProperty({
    example: '0b0e3b52-5c1a-4a3e-9d57-3c1f2a8f9c11',
    description: 'Id de la cuadrilla',
  })
  id: string;

  @ApiProperty({ example: 'Cuadrilla Municipal Belgrano y Colegiales — Recolección' })
  name: string;

  @ApiProperty({
    enum: CREW_ROLES,
    example: 'LEADER',
    description: 'Rol de la persona dentro de la cuadrilla: responsable o integrante',
  })
  role: CrewRole;
}

export class MeResponseDto {
  @ApiProperty({ example: '42', description: 'Id del usuario en M1 (`sub` del token), como texto' })
  userId: string;

  @ApiProperty({ enum: SUB_TYPES, example: 'EMPLEADO', description: '`sub_type` del token de M1' })
  subType: SubType;

  @ApiProperty({
    example: 'ADMINISTRATIVO',
    description: 'Rol único del usuario en M1, tal cual vino en el token',
  })
  m1Role: string;

  @ApiProperty({
    enum: M6_ROLES,
    isArray: true,
    example: ['M6_OFICINA_OPERACIONES'],
    description:
      'Roles de M6 efectivos ahora: los asignados que el rol de M1 todavía permite. Vacío = sin acceso a la lógica de M6',
  })
  roles: M6Role[];

  @ApiProperty({
    type: [MeCrewDto],
    description:
      'Cuadrillas a las que pertenece la persona (como responsable o integrante), según la misma pertenencia que exige Campo para operar. Solo propias: sin datos de otras personas. Vacío para Oficina y auditoría',
  })
  crews: MeCrewDto[];

  @ApiProperty({
    example: false,
    description:
      'true si tiene el rol efectivo M6_CAMPO_INSPECTOR: puede cerrar las inspecciones ambientales sin asignado o asignadas a su id',
  })
  isAssignedInspector: boolean;
}

@ApiTags('auth')
@ApiBearerAuth('JWT-auth')
@Controller('me')
export class MeController {
  constructor(private readonly service: MeService) {}

  @Get()
  // Sin rol de M6 también: es como el frontend se entera de que no tiene ninguno.
  @AnyEmployee()
  @ApiOperation({
    summary: 'Quién soy y qué puedo hacer',
    description:
      'Devuelve la identidad del token, los roles de M6 efectivos (asignaciones locales ∩ lo que permite el rol de M1), las cuadrillas de la persona (id, nombre y si es responsable o integrante) y si es inspector. Se calcula en cada request: un cambio de asignación rige en la próxima llamada. El frontend usa esto en vez de deducir permisos del token.',
  })
  @ApiResponse({ status: 200, description: 'Identidad y roles efectivos', type: MeResponseDto })
  @ApiResponse({
    status: 401,
    description: 'Token JWT inválido o ausente',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Token válido de un ciudadano: M6 es solo para personal municipal',
    type: ErrorResponseDto,
  })
  @ApiResponse({ status: 500, description: 'Error interno del servidor', type: ErrorResponseDto })
  me(@CurrentUser() user: AuthenticatedUser): Promise<MeResponseDto> {
    return this.service.me(user);
  }
}
