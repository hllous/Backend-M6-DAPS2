import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VehicleType } from '@prisma/client';

export class VehicleResponseDto {
  @ApiProperty({
    description: 'UUID del vehículo',
    example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({
    description: 'Patente del vehículo',
    example: 'AB 123 CD',
  })
  plate: string;

  @ApiProperty({
    description: 'Tipo de vehículo',
    enum: VehicleType,
    example: VehicleType.COMPACTOR_TRUCK,
  })
  vehicleType: VehicleType;

  @ApiPropertyOptional({
    description: 'Capacidad en toneladas (null si no aplica)',
    example: 10.5,
  })
  capacity: number | null;

  @ApiProperty({
    description: 'Si el vehículo está activo',
    example: true,
  })
  active: boolean;

  @ApiProperty({
    description: 'Fecha de creación',
    example: '2026-08-20T10:00:00.000Z',
    format: 'date-time',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Fecha de última actualización',
    example: '2026-08-20T10:00:00.000Z',
    format: 'date-time',
  })
  updatedAt: Date;
}
