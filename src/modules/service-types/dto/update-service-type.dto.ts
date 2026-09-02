import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * `code`, `category` y `mode` no son mutables: hay servicios ya programados
 * que copiaron esas decisiones. Cambiar el modo de un tipo existente
 * invalidaría los Service que lo referencian.
 */
export class UpdateServiceTypeDto {
  @ApiPropertyOptional({
    description: 'Nombre descriptivo del tipo de servicio',
    example: 'Recolección domiciliaria (turno noche)',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description: 'Si la programación de este tipo de servicio exige asignar un vehículo',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  requiresVehicle?: boolean;

  @ApiPropertyOptional({
    description: 'Si el tipo de servicio está disponible para programar',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
