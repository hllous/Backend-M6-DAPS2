import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DisposalSiteType } from '@prisma/client';
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDisposalSiteDto {
  @ApiProperty({
    description: 'Código único del sitio de disposición',
    example: 'DS-CEAMSE',
    maxLength: 20,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code: string;

  @ApiProperty({
    description: 'Nombre del sitio de disposición',
    example: 'Relleno sanitario Norte III',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Tipo de destino final al que se deriva el residuo',
    enum: DisposalSiteType,
    example: DisposalSiteType.LANDFILL,
  })
  @IsEnum(DisposalSiteType)
  siteType: DisposalSiteType;

  @ApiPropertyOptional({
    description: 'Si el sitio está operativo para recibir residuos',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
