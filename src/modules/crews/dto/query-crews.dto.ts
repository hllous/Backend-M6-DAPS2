import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { CrewType, Shift } from '@prisma/client';
import { PaginationQueryDto } from '../../../common/dto';

export class QueryCrewsDto extends PaginationQueryDto {
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
    description: 'Filtrar por tipo de cuadrilla',
    enum: CrewType,
    example: CrewType.MUNICIPAL,
  })
  @IsOptional()
  @IsEnum(CrewType)
  crewType?: CrewType;

  @ApiPropertyOptional({
    description: 'Filtrar por turno por defecto',
    enum: Shift,
    example: Shift.MORNING,
  })
  @IsOptional()
  @IsEnum(Shift)
  defaultShift?: Shift;
}
