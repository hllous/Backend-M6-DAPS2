import { ApiPropertyOptional } from '@nestjs/swagger';
import { DisposalSiteType } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationQueryDto } from '../../../common/dto';

export class QueryDisposalSitesDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filtrar por estado operativo', example: true })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  active?: boolean;

  @ApiPropertyOptional({
    description: 'Filtrar por tipo de destino final',
    enum: DisposalSiteType,
    example: DisposalSiteType.RECYCLING_PLANT,
  })
  @IsOptional()
  @IsEnum(DisposalSiteType)
  siteType?: DisposalSiteType;

  @ApiPropertyOptional({
    description: 'Buscar por nombre (coincidencia parcial, case-insensitive)',
    example: 'relleno',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
