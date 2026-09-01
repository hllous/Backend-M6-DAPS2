import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsNumber, Min, MaxLength } from 'class-validator';

export class UpdateVehicleDto {
  @ApiPropertyOptional({
    description: 'Patente del vehículo',
    example: 'AB 456 EF',
    maxLength: 15,
  })
  @IsOptional()
  @IsString()
  @MaxLength(15)
  plate?: string;

  @ApiPropertyOptional({
    description: 'Capacidad del vehículo en toneladas',
    example: 12.0,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  capacity?: number;

  @ApiPropertyOptional({
    description: 'Si el vehículo está activo y disponible para asignación',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
