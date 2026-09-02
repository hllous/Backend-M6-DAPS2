import { ApiPropertyOptional } from '@nestjs/swagger';
import { Shift } from '@prisma/client';
import { IsDateString, IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../../common/dto';

export class QueryServiceFrequenciesDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filtrar por tipo de servicio',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  serviceTypeId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por recorrido',
    example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  routeId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por turno', enum: Shift, example: Shift.MORNING })
  @IsOptional()
  @IsEnum(Shift)
  shift?: Shift;

  @ApiPropertyOptional({
    description: 'Filtrar por día de la semana en el que aplica. 1 = Lunes … 7 = Domingo.',
    example: 2,
    minimum: 1,
    maximum: 7,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(7)
  weekday?: number;

  @ApiPropertyOptional({
    description:
      'Devolver solo las reglas vigentes en esa fecha (validFrom <= fecha y validTo nulo o >= fecha)',
    example: '2026-09-02',
    format: 'date',
  })
  @IsOptional()
  @IsDateString()
  validOn?: string;
}
