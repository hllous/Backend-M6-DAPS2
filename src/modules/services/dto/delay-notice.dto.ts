import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DelayType, ServiceStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * El aviso de que un servicio va con retraso.
 *
 * **`DELAYED` no es un estado del servicio**, es un hecho que se registra
 * mientras el servicio sigue en `SCHEDULED` o `IN_PROGRESS`. Por eso los avisos
 * viven en su propia tabla y levantar uno no mueve la máquina de estados.
 *
 * `delayType` distingue los dos retrasos que existen y que el enum del schema
 * ya nombraba sin que nadie los usara: `START` es empezar tarde —el servicio
 * todavía no arrancó— y `DURATION` es tardar más de lo previsto, con la
 * cuadrilla ya trabajando.
 */
export class CreateDelayNoticeDto {
  @ApiProperty({
    enum: DelayType,
    description:
      '`START` si el servicio va a empezar tarde (sigue en SCHEDULED). `DURATION` si ya arrancó y va a tardar más (IN_PROGRESS).',
    example: DelayType.START,
  })
  @IsEnum(DelayType)
  delayType: DelayType;

  @ApiProperty({
    description: 'Minutos de retraso estimados',
    minimum: 1,
    maximum: 1440,
    example: 90,
  })
  @IsInt()
  @Min(1)
  @Max(1440)
  delayMinutes: number;

  @ApiProperty({
    description:
      'Por qué se demora. Viaja hacia M2 como mensaje interno, no se le muestra al vecino.',
    maxLength: 500,
    example: 'Corte de calle imprevisto por rotura de un caño',
  })
  @IsString()
  reason: string;

  @ApiPropertyOptional({
    description: 'Nueva hora estimada de finalización, si se puede estimar',
    format: 'date-time',
    example: '2026-09-15T14:30:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  newEstimatedEnd?: string;

  @ApiPropertyOptional({
    description: 'Cuándo se detectó el retraso. Por defecto, ahora.',
    format: 'date-time',
    example: '2026-09-15T11:05:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  detectedAt?: string;
}

export class DelayNoticeResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  serviceId: string;

  @ApiProperty({ enum: DelayType })
  delayType: DelayType;

  @ApiProperty({ example: 90 })
  delayMinutes: number;

  @ApiProperty({ example: 'Corte de calle imprevisto por rotura de un caño' })
  reason: string;

  @ApiProperty({
    description: 'Nueva hora estimada de finalización, si se informó',
    format: 'date-time',
    nullable: true,
    type: String,
  })
  newEstimatedEnd: string | null;

  @ApiProperty({
    enum: ServiceStatus,
    description:
      'En qué estado estaba el servicio cuando se levantó el aviso. El aviso **no** cambia el estado.',
  })
  serviceStatus: ServiceStatus;

  @ApiProperty({
    description: 'Quién lo reportó, del JWT. Null si lo generó el sistema.',
    nullable: true,
    type: String,
  })
  reportedBy: string | null;

  @ApiProperty({ format: 'date-time' })
  detectedAt: string;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({
    description:
      'Si este aviso sigue vigente. Un aviso nuevo reemplaza al anterior; los reemplazados quedan en el historial.',
    example: true,
  })
  active: boolean;
}
