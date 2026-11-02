import { ApiProperty } from '@nestjs/swagger';
import { M6_ROLES, M6Role } from '../../../auth/m6-role';
import { AUDIT_ENTITY_TYPES } from '../audit-entity-type';

export class AuditLogResponseDto {
  @ApiProperty({ format: 'uuid', example: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d' })
  id: string;

  @ApiProperty({ enum: AUDIT_ENTITY_TYPES, example: 'CONTAINER' })
  entityType: string;

  @ApiProperty({ example: '3f2b8c1e-5d4a-4e6f-9a1b-2c3d4e5f6a7b', description: 'Id de la entidad' })
  entityId: string;

  @ApiProperty({ example: 'REPORT_DAMAGE', description: 'Acción realizada' })
  action: string;

  @ApiProperty({ nullable: true, type: String, example: 'ACTIVE', description: 'Estado anterior' })
  fromStatus: string | null;

  @ApiProperty({ nullable: true, type: String, example: 'DAMAGED', description: 'Estado nuevo' })
  toStatus: string | null;

  @ApiProperty({ example: '42', description: 'Id en M1 de quien actuó, tomado del token' })
  actorUserId: string;

  @ApiProperty({
    enum: M6_ROLES,
    isArray: true,
    example: ['M6_CAMPO_CUADRILLA'],
    description: 'Roles de M6 efectivos de quien actuó al momento de la acción',
  })
  actorRoles: M6Role[];

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'Reubicación por obra en la vereda',
    description: 'Motivo que el flujo ya pedía; sin datos personales',
  })
  note: string | null;

  @ApiProperty({ example: '2026-11-02T14:30:00.000Z', description: 'Cuándo ocurrió' })
  occurredAt: Date;
}
