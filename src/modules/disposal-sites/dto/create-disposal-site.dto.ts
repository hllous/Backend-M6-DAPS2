import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DisposalSiteType } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ToBoolean, Trim } from '../../../common/decorators';

export class CreateDisposalSiteDto {
  @ApiProperty({
    description: 'Código único del sitio de disposición',
    example: 'DS-CEAMSE',
    maxLength: 20,
  })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code: string;

  @ApiProperty({
    description: 'Nombre del sitio de disposición',
    example: 'Relleno sanitario Norte III',
    maxLength: 100,
  })
  @Trim()
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
  @ToBoolean()
  active?: boolean;
}
