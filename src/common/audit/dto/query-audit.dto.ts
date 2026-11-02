import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../dto';
import { AUDIT_ENTITY_TYPES, AuditEntityType } from '../audit-entity-type';

export class QueryAuditDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: AUDIT_ENTITY_TYPES,
    example: 'CONTAINER',
    description: 'Tipo de entidad auditada',
  })
  @IsOptional()
  @IsIn(AUDIT_ENTITY_TYPES)
  entityType?: AuditEntityType;

  @ApiPropertyOptional({
    format: 'uuid',
    example: '3f2b8c1e-5d4a-4e6f-9a1b-2c3d4e5f6a7b',
    description: 'Id de la entidad auditada',
  })
  @IsOptional()
  @IsUUID()
  entityId?: string;
}
