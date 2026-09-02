import { ApiPropertyOptional } from '@nestjs/swagger';
import { Shift } from '@prisma/client';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

/**
 * `serviceTypeId` y `routeId` no son mutables: cambiarlos convierte la regla
 * en otra distinta. Para eso se cierra la vigencia de esta y se crea una nueva.
 */
export class UpdateServiceFrequencyDto {
  @ApiPropertyOptional({
    description: 'Días de la semana. Reemplaza el conjunto completo. 1 = Lunes … 7 = Domingo.',
    example: [1, 3, 5],
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  weekdays?: number[];

  @ApiPropertyOptional({ description: 'Turno de ejecución', enum: Shift, example: Shift.AFTERNOON })
  @IsOptional()
  @IsEnum(Shift)
  shift?: Shift;

  @ApiPropertyOptional({
    description: 'Fecha desde la que rige la regla (YYYY-MM-DD)',
    example: '2026-10-01',
    format: 'date',
  })
  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @ApiPropertyOptional({
    description: 'Fecha hasta la que rige (YYYY-MM-DD)',
    example: '2027-03-31',
    format: 'date',
  })
  @IsOptional()
  @IsDateString()
  validTo?: string;
}
