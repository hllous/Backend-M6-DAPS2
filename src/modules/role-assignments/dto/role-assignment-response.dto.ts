import { ApiProperty } from '@nestjs/swagger';
import { M6_ROLES, M6Role } from '../../../auth/m6-role';

export class RoleAssignmentResponseDto {
  @ApiProperty({ example: '42', description: 'Id del usuario en M1 (numérico, como texto)' })
  userId: string;

  @ApiProperty({
    enum: M6_ROLES,
    isArray: true,
    example: ['M6_CAMPO_CUADRILLA'],
    description:
      'Roles ASIGNADOS en M6. No son los efectivos: el rol del usuario en M1 puede no permitir alguno (ver GET /me)',
  })
  roles: M6Role[];
}
