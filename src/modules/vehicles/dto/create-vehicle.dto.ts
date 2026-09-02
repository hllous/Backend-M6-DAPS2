import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsNumber,
  Min,
  MaxLength,
} from 'class-validator';
import { VehicleType } from '@prisma/client';

export class CreateVehicleDto {
  @ApiProperty({
    description: 'Patente del vehículo (única)',
    example: 'AB 123 CD',
    maxLength: 15,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(15)
  plate: string;

  @ApiProperty({
    description: 'Tipo de vehículo',
    enum: VehicleType,
    example: VehicleType.COMPACTOR_TRUCK,
  })
  @IsEnum(VehicleType)
  vehicleType: VehicleType;

  @ApiPropertyOptional({
    description: 'Capacidad del vehículo en toneladas (ej. 10.50)',
    example: 10.5,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  capacity?: number;

  @ApiPropertyOptional({
    description: 'Si el vehículo está activo y disponible para asignación',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
