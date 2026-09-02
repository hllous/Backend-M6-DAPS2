import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WasteType } from '@prisma/client';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateGreenPointDto {
  @ApiProperty({
    description: 'Código único del punto verde',
    example: 'GP-0012',
    maxLength: 20,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code: string;

  @ApiProperty({
    description: 'Nombre del punto verde',
    example: 'Punto verde Plaza Mitre',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Zona operativa en la que está emplazado',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  @IsUUID()
  zoneId: string;

  @ApiProperty({
    description: 'Tipos de residuo que el punto verde acepta',
    enum: WasteType,
    isArray: true,
    example: [WasteType.RECYCLABLE, WasteType.GREEN],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsEnum(WasteType, { each: true })
  wasteTypes: WasteType[];

  @ApiPropertyOptional({
    description: 'Dirección del emplazamiento',
    example: 'Av. Mitre 1200',
    maxLength: 200,
  })
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

  @ApiPropertyOptional({
    description: 'Si el punto verde está habilitado para recibir residuos',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
