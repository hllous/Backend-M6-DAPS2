import { Latitude, Longitude } from '../../../common/decorators';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsUUID,
  Min,
  MaxLength,
  Max,
} from 'class-validator';
import { ToBoolean, Trim } from '../../../common/decorators';
import { MAX_TREE_DIAMETER_CM, MAX_TREE_HEIGHT_M } from '../../../common/decorators/numeric-limits';

export class CreateTreeDto {
  @ApiProperty({
    description: 'Código de relevamiento único del árbol (ej. ARB-00442)',
    example: 'ARB-00442',
    maxLength: 20,
  })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  surveyCode: string;

  @ApiProperty({
    description: 'UUID de la zona operativa donde se ubica el árbol',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  @IsUUID()
  zoneId: string;

  @ApiPropertyOptional({
    description: 'Especie del árbol',
    example: 'Tipuana tipu (Tipa)',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  species?: string;

  @ApiPropertyOptional({
    description: 'Dirección donde se ubica el árbol',
    example: 'Av. del Libertador 4200',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @ApiPropertyOptional({ description: 'Latitud', example: -34.5754 })
  @IsOptional()
  @Latitude()
  lat?: number;

  @ApiPropertyOptional({ description: 'Longitud', example: -58.4109 })
  @IsOptional()
  @Longitude()
  lng?: number;

  @ApiPropertyOptional({
    description: 'Altura en metros',
    example: 12.5,
    minimum: 0,
    maximum: MAX_TREE_HEIGHT_M,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_TREE_HEIGHT_M)
  heightM?: number;

  @ApiPropertyOptional({
    description: 'Diámetro del tronco en cm',
    example: 45.0,
    minimum: 0,
    maximum: MAX_TREE_DIAMETER_CM,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(MAX_TREE_DIAMETER_CM)
  diameterCm?: number;

  @ApiPropertyOptional({ description: 'Si el árbol está activo', example: true, default: true })
  @IsOptional()
  @ToBoolean()
  active?: boolean;
}
