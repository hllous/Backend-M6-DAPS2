import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

export class ContainerRelocationDto {
  @ApiProperty({
    description: 'Nueva dirección del contenedor tras la reubicación',
    example: 'Av. Santa Fe 2800, esquina Anchorena',
    maxLength: 200,
  })
  @IsString()
  @MaxLength(200)
  address: string;

  @ApiPropertyOptional({ description: 'Nueva latitud', example: -34.5955 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 7 })
  lat?: number;

  @ApiPropertyOptional({ description: 'Nueva longitud', example: -58.4016 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 7 })
  lng?: number;
}

/**
 * Body opcional del cierre.
 *
 * Solo hace falta cuando el servicio actúa sobre un contenedor que está en
 * `RELOCATING`: la reubicación es la única transición encadenada que necesita
 * un dato que el `Service` no lleva — la ubicación nueva. El vaciado y la
 * reparación se derivan del estado del contenedor sin datos extra.
 */
export class CompleteServiceDto {
  @ApiPropertyOptional({
    description:
      'Ubicación nueva del contenedor. Obligatoria si el servicio actúa sobre un contenedor en RELOCATING; se ignora en cualquier otro caso.',
    type: ContainerRelocationDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ContainerRelocationDto)
  containerLocation?: ContainerRelocationDto;
}
