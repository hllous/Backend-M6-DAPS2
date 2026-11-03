import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsUUID } from 'class-validator';

export const BUCKETS = ['day', 'week', 'month'] as const;
export type Bucket = (typeof BUCKETS)[number];

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

  @ApiPropertyOptional({
    enum: BUCKETS,
    description:
      'Agrupa el período en intervalos y suma `series`. `week` va de lunes a domingo y `month` es mes calendario; el primero y el último se recortan al período. Máximo 90 puntos: si el rango y el bucket lo superan, 400. Los intervalos son días argentinos (UTC-3)',
  })
  @IsOptional()
  @IsIn(BUCKETS)
  bucket?: Bucket;

  @ApiPropertyOptional({
    enum: ['previous'],
    description:
      'Suma `previous` (el período inmediatamente anterior, de igual duración) y `delta` (la diferencia, en puntos porcentuales o en días). Sin este parámetro la respuesta no cambia',
  })
  @IsOptional()
  @IsIn(['previous'])
  compare?: 'previous';
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
