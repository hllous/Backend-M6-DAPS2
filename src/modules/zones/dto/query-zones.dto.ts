import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { SearchText, ToBoolean } from '../../../common/decorators';
import { PaginationQueryDto } from '../../../common/dto';

export class QueryZonesDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filtrar por estado activo/inactivo',
    example: true,
  })
  @IsOptional()
  @ToBoolean()
  active?: boolean;

  @ApiPropertyOptional({
    description: 'Buscar por nombre (coincidencia parcial, case-insensitive)',
    example: 'Norte',
  })
  @IsOptional()
  @SearchText()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por comuna (UUID)',
    example: 'c0a80101-0000-4000-8000-000000000014',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  communeId?: string;
}
