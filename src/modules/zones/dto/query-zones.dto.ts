import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationQueryDto } from '../../../common/dto';

export class QueryZonesDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filtrar por estado activo/inactivo',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  active?: boolean;

  @ApiPropertyOptional({
    description: 'Buscar por nombre (coincidencia parcial, case-insensitive)',
    example: 'Norte',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
