import { ApiPropertyOptional } from '@nestjs/swagger';
import { ServiceCategory, ServiceMode } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { SearchText, ToBoolean } from '../../../common/decorators';
import { PaginationQueryDto } from '../../../common/dto';

export class QueryServiceTypesDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filtrar por estado activo/inactivo',
    example: true,
  })
  @IsOptional()
  @ToBoolean()
  active?: boolean;

  @ApiPropertyOptional({
    description: 'Filtrar por área operativa',
    enum: ServiceCategory,
    example: ServiceCategory.WASTE_COLLECTION,
  })
  @IsOptional()
  @IsEnum(ServiceCategory)
  category?: ServiceCategory;

  @ApiPropertyOptional({
    description: 'Filtrar por modo de ejecución',
    enum: ServiceMode,
    example: ServiceMode.ROUTE,
  })
  @IsOptional()
  @IsEnum(ServiceMode)
  mode?: ServiceMode;

  @ApiPropertyOptional({
    description: 'Buscar por nombre (coincidencia parcial, case-insensitive)',
    example: 'recolección',
  })
  @IsOptional()
  @SearchText()
  search?: string;
}
