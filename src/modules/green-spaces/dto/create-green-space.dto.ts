import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsUUID,
  Min,
  MaxLength,
} from 'class-validator';
import { GreenSpaceType } from '@prisma/client';

export class CreateGreenSpaceDto {
  @ApiProperty({
    description: 'Nombre del espacio verde',
    example: 'Plaza Miserere',
    maxLength: 150,
  })
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

  @ApiPropertyOptional({
    description: 'Superficie en metros cuadrados',
    example: 12500.5,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  areaM2?: number;

  @ApiPropertyOptional({
    description: 'Si el espacio verde está activo',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
