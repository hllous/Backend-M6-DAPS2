import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

/**
 * El período que filtra todos los indicadores.
 *
 * Sin `from` ni `to` son los últimos 30 días: un tablero que se abre sin
 * parámetros tiene que mostrar algo.
 */
export class PeriodQueryDto {
  @ApiPropertyOptional({
    description: 'Desde (YYYY-MM-DD). Por defecto, 30 días atrás',
    example: '2026-08-01',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description: 'Hasta (YYYY-MM-DD). Por defecto, hoy',
    example: '2026-08-31',
  })
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class ServicePeriodQueryDto extends PeriodQueryDto {
  @ApiPropertyOptional({ description: 'Acotar a una zona operativa', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  zoneId?: string;

  @ApiPropertyOptional({ description: 'Acotar a un tipo de servicio', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  serviceTypeId?: string;
}
