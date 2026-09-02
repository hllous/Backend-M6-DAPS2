import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateServiceFrequencyDto {
  @ApiProperty({
    description: 'Tipo de servicio que genera esta frecuencia. Tiene que ser de modo ROUTE.',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  @IsUUID()
  serviceTypeId: string;

  @ApiProperty({
    description: 'Recorrido sobre el que se ejecuta',
    example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    format: 'uuid',
  })
  @IsUUID()
  routeId: string;

  @ApiProperty({
    description: 'Días de la semana en los que aplica. 1 = Lunes … 7 = Domingo.',
    example: [2, 5],
    type: [Number],
    minItems: 1,
    maxItems: 7,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  weekdays: number[];

  @ApiProperty({ description: 'Turno de ejecución', enum: Shift, example: Shift.MORNING })
  @IsEnum(Shift)
  shift: Shift;

  @ApiProperty({
    description: 'Fecha desde la que rige la regla (YYYY-MM-DD)',
    example: '2026-09-01',
    format: 'date',
  })
  @IsDateString()
  validFrom: string;

  @ApiPropertyOptional({
    description: 'Fecha hasta la que rige. Si se omite, la regla no tiene vencimiento.',
    example: '2026-12-31',
    format: 'date',
  })
  @IsOptional()
  @IsDateString()
  validTo?: string;
}
