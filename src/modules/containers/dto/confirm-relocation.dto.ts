import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, MaxLength } from 'class-validator';

/**
 * DTO para confirmar la reubicación de un contenedor.
 * Transición: RELOCATING → ACTIVE (con nueva ubicación).
 */
export class ConfirmRelocationDto {
  @ApiProperty({
    description: 'Nueva dirección del contenedor tras la reubicación',
    example: 'Av. Santa Fe 2800, esquina Anchorena',
    maxLength: 200,
  })
  @IsString()
  @MaxLength(200)
  address: string;

  @ApiPropertyOptional({
    description: 'Nueva latitud',
    example: -34.5955,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 7 })
  lat?: number;

  @ApiPropertyOptional({
    description: 'Nueva longitud',
    example: -58.4016,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 7 })
  lng?: number;
}
