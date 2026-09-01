import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsInt,
  IsNumber,
  IsUUID,
  Min,
  MaxLength,
} from 'class-validator';
import { ContainerType } from '@prisma/client';

export class CreateContainerDto {
  @ApiProperty({
    description: 'Código único del contenedor (ej. CT-0442)',
    example: 'CT-0442',
    maxLength: 20,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code: string;

  @ApiProperty({
    description: 'Tipo de contenedor',
    enum: ContainerType,
    example: ContainerType.HOUSEHOLD,
  })
  @IsEnum(ContainerType)
  containerType: ContainerType;

  @ApiProperty({
    description: 'UUID de la zona operativa donde se ubica el contenedor',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  @IsUUID()
  zoneId: string;

  @ApiProperty({
    description: 'Capacidad del contenedor en litros',
    example: 1100,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  capacityLiters: number;

  @ApiPropertyOptional({
    description: 'Dirección donde se ubica el contenedor',
    example: 'Av. Rivadavia 4500, esquina Medrano',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @ApiPropertyOptional({
    description: 'Latitud de ubicación',
    example: -34.6037,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 7 })
  lat?: number;

  @ApiPropertyOptional({
    description: 'Longitud de ubicación',
    example: -58.3816,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 7 })
  lng?: number;
}
