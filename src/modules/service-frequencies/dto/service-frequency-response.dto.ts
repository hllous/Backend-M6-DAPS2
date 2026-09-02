import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Shift } from '@prisma/client';

export class ServiceFrequencyResponseDto {
  @ApiProperty({
    description: 'UUID de la frecuencia',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({ description: 'Tipo de servicio', format: 'uuid' })
  serviceTypeId: string;

  @ApiProperty({ description: 'Recorrido sobre el que se ejecuta', format: 'uuid' })
  routeId: string;

  @ApiProperty({
    description: 'Días de la semana, ordenados. 1 = Lunes … 7 = Domingo.',
    example: [2, 5],
    type: [Number],
  })
  weekdays: number[];

  @ApiProperty({ description: 'Turno de ejecución', enum: Shift, example: Shift.MORNING })
  shift: Shift;

  @ApiProperty({
    description: 'Fecha desde la que rige la regla',
    example: '2026-09-01',
    format: 'date-time',
  })
  validFrom: Date;

  @ApiPropertyOptional({
    description: 'Fecha hasta la que rige. Null si no tiene vencimiento.',
    example: '2026-12-31',
    format: 'date-time',
    nullable: true,
  })
  validTo: Date | null;

  @ApiProperty({
    description: 'Fecha de creación',
    example: '2026-09-02T10:00:00.000Z',
    format: 'date-time',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Fecha de última actualización',
    example: '2026-09-02T10:00:00.000Z',
    format: 'date-time',
  })
  updatedAt: Date;
}
