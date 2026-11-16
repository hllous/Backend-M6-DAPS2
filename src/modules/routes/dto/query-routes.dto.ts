import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { SearchText, ToBoolean } from '../../../common/decorators';
import { SortablePaginationQueryDto, SortField } from '../../../common/dto';

export const ROUTES_SORT_FIELDS = ['code', 'name', 'active', 'createdAt'] as const;

export class QueryRoutesDto extends SortablePaginationQueryDto {
  @SortField(ROUTES_SORT_FIELDS, 'code')
  sort?: (typeof ROUTES_SORT_FIELDS)[number];

  @ApiPropertyOptional({ description: 'Filtrar por estado activo/inactivo', example: true })
  @IsOptional()
  @ToBoolean()
  active?: boolean;

  @ApiPropertyOptional({
    description: 'Filtrar los recorridos que pasan por una zona operativa',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  zoneId?: string;

  @ApiPropertyOptional({
    description: 'Buscar por código o nombre (coincidencia parcial, case-insensitive)',
    example: 'troncal',
  })
  @IsOptional()
  @SearchText()
  search?: string;
}
