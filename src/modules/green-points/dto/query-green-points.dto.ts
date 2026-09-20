import { ApiPropertyOptional } from '@nestjs/swagger';
import { WasteType } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { SearchText, ToBoolean } from '../../../common/decorators';
import { PaginationQueryDto } from '../../../common/dto';

export class QueryGreenPointsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filtrar por estado habilitado', example: true })
  @IsOptional()
  @ToBoolean()
  active?: boolean;

  @ApiPropertyOptional({ description: 'Filtrar por zona operativa', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  zoneId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar los que aceptan un tipo de residuo',
    enum: WasteType,
    example: WasteType.RECYCLABLE,
  })
  @IsOptional()
  @IsEnum(WasteType)
  wasteType?: WasteType;

  @ApiPropertyOptional({
    description: 'Buscar por nombre o dirección (parcial, case-insensitive)',
    example: 'Mitre',
  })
  @IsOptional()
  @SearchText()
  search?: string;
}
