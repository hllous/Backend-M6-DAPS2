import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsInt, IsUUID, Min, MaxLength } from 'class-validator';

export class UpdateContainerDto {
  @ApiPropertyOptional({
    description: 'UUID de la zona operativa',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  zoneId?: string;

  @ApiPropertyOptional({
    description: 'Capacidad del contenedor en litros',
    example: 1200,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  capacityLiters?: number;

  @ApiPropertyOptional({
    description: 'Dirección donde se ubica el contenedor',
    example: 'Av. Corrientes 3200',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @ApiPropertyOptional({
    description: 'Latitud de ubicación',
    example: -34.6037,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 7 })
  lat?: number;

  @ApiPropertyOptional({
    description: 'Longitud de ubicación',
    example: -58.3816,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 7 })
  lng?: number;
}
