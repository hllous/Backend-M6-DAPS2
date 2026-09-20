import { Latitude, Longitude } from '../../../common/decorators';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsUUID, Min, MaxLength, Max } from 'class-validator';
import { ToBoolean } from '../../../common/decorators';
import { MAX_TREE_DIAMETER_CM, MAX_TREE_HEIGHT_M } from '../../../common/decorators/numeric-limits';

export class UpdateTreeDto {
  @ApiPropertyOptional({ description: 'UUID de la zona operativa', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  zoneId?: string;

  @ApiPropertyOptional({ description: 'Especie del árbol', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  species?: string;

  @ApiPropertyOptional({ description: 'Dirección', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @ApiPropertyOptional({ description: 'Latitud' })
  @IsOptional()
  @Latitude()
  lat?: number;

  @ApiPropertyOptional({ description: 'Longitud' })
  @IsOptional()
  @Longitude()
  lng?: number;

  @ApiPropertyOptional({ description: 'Altura en metros', minimum: 0, maximum: MAX_TREE_HEIGHT_M })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_TREE_HEIGHT_M)
  heightM?: number;

  @ApiPropertyOptional({
    description: 'Diámetro del tronco en cm',
    minimum: 0,
    maximum: MAX_TREE_DIAMETER_CM,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(MAX_TREE_DIAMETER_CM)
  diameterCm?: number;

  @ApiPropertyOptional({ description: 'Si el árbol está activo' })
  @IsOptional()
  @ToBoolean()
  active?: boolean;
}
