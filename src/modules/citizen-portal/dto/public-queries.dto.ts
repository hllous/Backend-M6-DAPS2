import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto';

export class QueryPublicServicesDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Zona operativa', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  zoneId?: string;

  @ApiPropertyOptional({ description: 'Tipo de servicio', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  serviceTypeId?: string;

  @ApiPropertyOptional({
    description: 'Desde (YYYY-MM-DD). Por defecto, hoy',
    example: '2026-09-01',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description: 'Hasta (YYYY-MM-DD). Por defecto, 30 días después de `from`',
    example: '2026-09-30',
  })
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class QueryPublicGreenPointsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Zona operativa', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  zoneId?: string;
}
