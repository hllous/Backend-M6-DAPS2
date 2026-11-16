import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { SearchText, ToBoolean } from '../../../common/decorators';
import { GreenSpaceType } from '@prisma/client';
import { SortablePaginationQueryDto, SortField } from '../../../common/dto';

export const GREEN_SPACES_SORT_FIELDS = ['name', 'spaceType', 'active', 'createdAt'] as const;

export class QueryGreenSpacesDto extends SortablePaginationQueryDto {
  @SortField(GREEN_SPACES_SORT_FIELDS, 'name')
  sort?: (typeof GREEN_SPACES_SORT_FIELDS)[number];

  @ApiPropertyOptional({
    description: 'Filtrar por estado activo/inactivo',
    example: true,
  })
  @IsOptional()
  @ToBoolean()
  active?: boolean;

  @ApiPropertyOptional({
    description: 'Filtrar por tipo de espacio verde',
    enum: GreenSpaceType,
    example: GreenSpaceType.PARK,
  })
  @IsOptional()
  @IsEnum(GreenSpaceType)
  spaceType?: GreenSpaceType;

  @ApiPropertyOptional({
    description: 'Filtrar por zona operativa',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  zoneId?: string;

  @ApiPropertyOptional({
    description: 'Buscar por nombre (coincidencia parcial)',
    example: 'Miserere',
  })
  @IsOptional()
  @SearchText()
  search?: string;
}
