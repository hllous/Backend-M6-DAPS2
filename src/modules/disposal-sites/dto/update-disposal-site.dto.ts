import { ApiPropertyOptional } from '@nestjs/swagger';
import { DisposalSiteType } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

/** El código no es mutable: identifica al sitio en los registros de recolección ya cargados. */
export class UpdateDisposalSiteDto {
  @ApiPropertyOptional({
    description: 'Nombre del sitio de disposición',
    example: 'Relleno sanitario Norte III (ampliación)',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description: 'Tipo de destino final',
    enum: DisposalSiteType,
    example: DisposalSiteType.TRANSFER_STATION,
  })
  @IsOptional()
  @IsEnum(DisposalSiteType)
  siteType?: DisposalSiteType;

  @ApiPropertyOptional({ description: 'Si el sitio está operativo', example: false })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
