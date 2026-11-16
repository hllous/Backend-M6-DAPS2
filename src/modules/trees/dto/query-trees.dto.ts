import { ApiPropertyOptional } from '@nestjs/swagger';
import { RiskLevel } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { SearchText, ToBoolean } from '../../../common/decorators';
import { SortablePaginationQueryDto, SortField } from '../../../common/dto';

export const TREES_SORT_FIELDS = ['surveyCode', 'species', 'active', 'createdAt'] as const;

export class QueryTreesDto extends SortablePaginationQueryDto {
  @SortField(TREES_SORT_FIELDS, 'surveyCode')
  sort?: (typeof TREES_SORT_FIELDS)[number];

  @ApiPropertyOptional({ description: 'Filtrar por activo/inactivo' })
  @IsOptional()
  @ToBoolean()
  active?: boolean;

  @ApiPropertyOptional({ description: 'Filtrar por zona', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  zoneId?: string;

  @ApiPropertyOptional({
    description:
      'Filtrar por nivel de riesgo del último relevamiento (el mismo criterio que `indicators/incidents` → `trees.byRiskLevel`). Los árboles sin relevamiento no coinciden con ningún nivel',
    enum: RiskLevel,
  })
  @IsOptional()
  @IsEnum(RiskLevel)
  riskLevel?: RiskLevel;

  @ApiPropertyOptional({
    description:
      'Buscar por código de relevamiento, especie o dirección (coincidencia parcial, case-insensitive)',
    example: 'jacarand',
  })
  @IsOptional()
  @SearchText()
  search?: string;
}
