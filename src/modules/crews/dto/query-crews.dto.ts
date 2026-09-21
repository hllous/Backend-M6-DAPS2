import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { ToBoolean } from '../../../common/decorators';
import { CrewType, Shift } from '@prisma/client';
import { PaginationQueryDto } from '../../../common/dto';

export class QueryCrewsDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filtrar por estado activo/inactivo',
    example: true,
  })
  @IsOptional()
  @ToBoolean()
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
