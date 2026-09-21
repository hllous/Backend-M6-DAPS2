import { Trim, Latitude, Longitude } from '../../../common/decorators';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength, IsNotEmpty } from 'class-validator';

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
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  address: string;

  @ApiPropertyOptional({
    description: 'Nueva latitud',
    example: -34.5955,
  })
  @IsOptional()
  @Latitude()
  lat?: number;

  @ApiPropertyOptional({
    description: 'Nueva longitud',
    example: -58.4016,
  })
  @IsOptional()
  @Longitude()
  lng?: number;
}
