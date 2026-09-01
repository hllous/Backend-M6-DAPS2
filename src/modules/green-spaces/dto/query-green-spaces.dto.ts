import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { GreenSpaceType } from '@prisma/client';
import { PaginationQueryDto } from '../../../common/dto';

export class QueryGreenSpacesDto extends PaginationQueryDto {
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
    description: 'Filtrar por tipo de espacio verde',
    enum: GreenSpaceType,
    example: GreenSpaceType.PARK,
  })
  @IsOptional()
  @IsEnum(GreenSpaceType)
  spaceType?: GreenSpaceType;

  @ApiPropertyOptional({
    description: 'Filtrar por zona operativa',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  zoneId?: string;

  @ApiPropertyOptional({
    description: 'Buscar por nombre (coincidencia parcial)',
    example: 'Miserere',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
