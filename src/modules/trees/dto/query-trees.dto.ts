import { ApiPropertyOptional } from '@nestjs/swagger';
import { RiskLevel } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { SearchText, ToBoolean } from '../../../common/decorators';
import { PaginationQueryDto } from '../../../common/dto';

export class QueryTreesDto extends PaginationQueryDto {
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

  @ApiPropertyOptional({ description: 'Buscar por especie o dirección' })
  @IsOptional()
  @SearchText()
  search?: string;
}
