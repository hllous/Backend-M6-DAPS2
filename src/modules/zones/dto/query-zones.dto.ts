import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { ToBoolean } from '../../../common/decorators';
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
  @IsString()
  search?: string;
}
