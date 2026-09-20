import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
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

  @ApiPropertyOptional({ description: 'Buscar por especie o dirección' })
  @IsOptional()
  @SearchText()
  search?: string;
}
