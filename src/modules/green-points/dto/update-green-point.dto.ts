import { ApiPropertyOptional } from '@nestjs/swagger';
import { WasteType } from '@prisma/client';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  IsNotEmpty,
} from 'class-validator';
import { ToBoolean, Trim, MAX_LIST_SIZE, Latitude, Longitude } from '../../../common/decorators';

/** El código no es mutable: identifica al punto verde en la vía pública. */
export class UpdateGreenPointDto {
  @ApiPropertyOptional({
    description: 'Nombre del punto verde',
    example: 'Punto verde Plaza Mitre (ampliado)',
    maxLength: 100,
  })
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Zona operativa', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  zoneId?: string;

  @ApiPropertyOptional({
    maxItems: MAX_LIST_SIZE,
    description: 'Tipos de residuo aceptados. Reemplaza el conjunto completo.',
    enum: WasteType,
    isArray: true,
    example: [WasteType.RECYCLABLE],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_LIST_SIZE)
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
  @Latitude()
  lat?: number;

  @ApiPropertyOptional({ description: 'Longitud', example: -58.3816 })
  @IsOptional()
  @Longitude()
  lng?: number;

  @ApiPropertyOptional({ description: 'Si está habilitado', example: false })
  @IsOptional()
  @ToBoolean()
  active?: boolean;
}
