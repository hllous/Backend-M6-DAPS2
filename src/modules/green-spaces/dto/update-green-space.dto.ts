import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsUUID,
  IsLatitude,
  IsLongitude,
  Min,
  MaxLength,
  IsNotEmpty,
  Max,
} from 'class-validator';
import { ToBoolean, Trim } from '../../../common/decorators';

export class UpdateGreenSpaceDto {
  @ApiPropertyOptional({
    description: 'Nombre del espacio verde',
    example: 'Plaza Miserere (ampliada)',
    maxLength: 150,
  })
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({
    description: 'UUID de la zona operativa',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  zoneId?: string;

  @ApiPropertyOptional({ description: 'Latitud', example: -34.5724 })
  @IsOptional()
  @IsLatitude()
  lat?: number;

  @ApiPropertyOptional({ description: 'Longitud', example: -58.4166 })
  @IsOptional()
  @IsLongitude()
  lng?: number;

  @ApiPropertyOptional({
    description: 'Superficie en metros cuadrados',
    example: 13000.0,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99999999.99)
  areaM2?: number;

  @ApiPropertyOptional({
    description: 'Si el espacio verde está activo',
    example: false,
  })
  @IsOptional()
  @ToBoolean()
  active?: boolean;
}
