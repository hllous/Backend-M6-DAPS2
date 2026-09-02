import { ApiPropertyOptional } from '@nestjs/swagger';
import { WasteType } from '@prisma/client';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/** El código no es mutable: identifica al punto verde en la vía pública. */
export class UpdateGreenPointDto {
  @ApiPropertyOptional({
    description: 'Nombre del punto verde',
    example: 'Punto verde Plaza Mitre (ampliado)',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Zona operativa', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  zoneId?: string;

  @ApiPropertyOptional({
    description: 'Tipos de residuo aceptados. Reemplaza el conjunto completo.',
    enum: WasteType,
    isArray: true,
    example: [WasteType.RECYCLABLE],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsEnum(WasteType, { each: true })
  wasteTypes?: WasteType[];

  @ApiPropertyOptional({ description: 'Dirección', example: 'Av. Mitre 1250', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @ApiPropertyOptional({ description: 'Latitud', example: -34.6037 })
  @IsOptional()
  @IsLatitude()
  lat?: number;

  @ApiPropertyOptional({ description: 'Longitud', example: -58.3816 })
  @IsOptional()
  @IsLongitude()
  lng?: number;

  @ApiPropertyOptional({ description: 'Si está habilitado', example: false })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
