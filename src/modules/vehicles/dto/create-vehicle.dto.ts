import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsNumber,
  Min,
  MaxLength,
  Max,
} from 'class-validator';
import { ToBoolean, Trim } from '../../../common/decorators';
import { VehicleType } from '@prisma/client';
import { MAX_DECIMAL_10_2 } from '../../../common/decorators/numeric-limits';

export class CreateVehicleDto {
  @ApiProperty({
    description: 'Patente del vehículo (única)',
    example: 'AB 123 CD',
    maxLength: 15,
  })
  @Trim()
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
    maximum: MAX_DECIMAL_10_2,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_DECIMAL_10_2)
  capacity?: number;

  @ApiPropertyOptional({
    description: 'Si el vehículo está activo y disponible para asignación',
    example: true,
    default: true,
  })
  @IsOptional()
  @ToBoolean()
  active?: boolean;
}
