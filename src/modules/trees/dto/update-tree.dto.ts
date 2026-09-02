import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsNumber, IsUUID, Min, MaxLength } from 'class-validator';

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
  @IsNumber({ maxDecimalPlaces: 7 })
  lat?: number;

  @ApiPropertyOptional({ description: 'Longitud' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 7 })
  lng?: number;

  @ApiPropertyOptional({ description: 'Altura en metros', minimum: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  heightM?: number;

  @ApiPropertyOptional({ description: 'Diámetro del tronco en cm', minimum: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  diameterCm?: number;

  @ApiPropertyOptional({ description: 'Si el árbol está activo' })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
