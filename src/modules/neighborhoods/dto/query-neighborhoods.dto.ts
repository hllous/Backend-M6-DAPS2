import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { SearchText, ToBoolean } from '../../../common/decorators';

export class QueryNeighborhoodsDto {
  @ApiPropertyOptional({ description: 'Solo los barrios activos en M9', example: true })
  @IsOptional()
  @ToBoolean()
  soloActivos?: boolean;

  @ApiPropertyOptional({ description: 'Filtrar por comuna de M9', example: 'comuna-14' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  zona?: string;

  @ApiPropertyOptional({
    description: 'Buscar por nombre o código (coincidencia parcial, sin distinguir mayúsculas)',
    example: 'paler',
  })
  @IsOptional()
  @SearchText()
  q?: string;
}
