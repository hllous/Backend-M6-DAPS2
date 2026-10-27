import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { ToBoolean } from '../../../common/decorators';

export class QueryCommunesDto {
  @ApiPropertyOptional({ description: 'Filtrar por estado activo/inactivo', example: true })
  @IsOptional()
  @ToBoolean()
  active?: boolean;
}
