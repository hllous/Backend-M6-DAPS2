import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotServicedReason, ZoneResultStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateZoneResultDto {
  @ApiProperty({
    description: 'Zona sobre la que se informa. Tiene que ser una de las zonas del servicio.',
    example: 'd4e5f6a7-b8c9-0123-defa-234567890123',
    format: 'uuid',
  })
  @IsUUID()
  zoneId: string;

  @ApiProperty({
    description: 'Cómo quedó la zona',
    enum: ZoneResultStatus,
    example: ZoneResultStatus.SERVICED,
  })
  @IsEnum(ZoneResultStatus)
  status: ZoneResultStatus;

  @ApiPropertyOptional({
    description:
      'Por qué no se atendió. Obligatorio si el status es NOT_SERVICED o PARTIAL, y rechazado si es SERVICED.',
    enum: NotServicedReason,
    example: NotServicedReason.BLOCKED_ACCESS,
  })
  @IsOptional()
  @IsEnum(NotServicedReason)
  reason?: NotServicedReason;

  @ApiPropertyOptional({
    description: 'Fecha propuesta para reintentar la zona (YYYY-MM-DD)',
    example: '2026-09-16',
    format: 'date',
  })
  @IsOptional()
  @IsDateString()
  proposedDate?: string;

  @ApiPropertyOptional({
    description: 'Notas de la cuadrilla',
    example: 'Camión de mudanza bloqueando la cuadra entre Mitre y San Martín.',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
