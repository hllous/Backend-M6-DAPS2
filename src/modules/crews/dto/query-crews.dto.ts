import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ToBoolean } from '../../../common/decorators';
import { CrewSpecialty, CrewType, Shift } from '@prisma/client';
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

  @ApiPropertyOptional({
    description: 'Filtrar por especialidad',
    enum: CrewSpecialty,
    example: CrewSpecialty.COLLECTION,
  })
  @IsOptional()
  @IsEnum(CrewSpecialty)
  specialty?: CrewSpecialty;

  @ApiPropertyOptional({
    description:
      'Filtrar por la zona **efectiva hoy**: la de la reubicación vigente si hay una; si no, la zona base',
    example: 'a1b2c3d4-e5f6-4789-8abc-def012345678',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  zoneId?: string;
}
