import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsNumber,
  IsUUID,
  IsLatitude,
  IsLongitude,
  Min,
  MaxLength,
  Max,
} from 'class-validator';
import { ToBoolean, Trim, Latitude, Longitude } from '../../../common/decorators';
import { GreenSpaceType } from '@prisma/client';
import { MAX_DECIMAL_10_2 } from '../../../common/decorators/numeric-limits';

export class CreateGreenSpaceDto {
  @ApiProperty({
    description: 'Nombre del espacio verde',
    example: 'Plaza Miserere',
    maxLength: 150,
  })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiProperty({
    description: 'Tipo de espacio verde',
    enum: GreenSpaceType,
    example: GreenSpaceType.SQUARE,
  })
  @IsEnum(GreenSpaceType)
  spaceType: GreenSpaceType;

  @ApiProperty({
    description: 'UUID de la zona operativa donde se ubica',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  @IsUUID()
  zoneId: string;

  @ApiPropertyOptional({ description: 'Latitud', example: -34.5724 })
  @IsOptional()
  @Latitude()
  lat?: number;

  @ApiPropertyOptional({ description: 'Longitud', example: -58.4166 })
  @IsOptional()
  @Longitude()
  lng?: number;

  @ApiPropertyOptional({
    description: 'Superficie en metros cuadrados',
    example: 12500.5,
    minimum: 0,
    maximum: MAX_DECIMAL_10_2,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_DECIMAL_10_2)
  areaM2?: number;

  @ApiPropertyOptional({
    description: 'Si el espacio verde está activo',
    example: true,
    default: true,
  })
  @IsOptional()
  @ToBoolean()
  active?: boolean;
}
