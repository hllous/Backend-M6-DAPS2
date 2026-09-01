import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationQueryDto } from '../../../common/dto';

export class QueryTreesDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filtrar por activo/inactivo' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => { if (value === 'true') return true; if (value === 'false') return false; return value; })
  active?: boolean;

  @ApiPropertyOptional({ description: 'Filtrar por zona', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  zoneId?: string;

  @ApiPropertyOptional({ description: 'Buscar por especie o dirección' })
  @IsOptional()
  @IsString()
  search?: string;
}
