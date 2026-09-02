import { ApiPropertyOptional } from '@nestjs/swagger';
import { WasteType } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationQueryDto } from '../../../common/dto';

export class QueryGreenPointsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filtrar por estado habilitado', example: true })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
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
  @IsString()
  search?: string;
}
