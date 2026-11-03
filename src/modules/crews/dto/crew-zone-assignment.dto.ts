import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { IsDateOnly, MAX_REASON_LENGTH, Trim } from '../../../common/decorators';

export class CreateCrewZoneAssignmentDto {
  @ApiProperty({
    description: 'Zona donde se reubica la cuadrilla (UUID)',
    example: 'a1b2c3d4-e5f6-4789-8abc-def012345678',
    format: 'uuid',
  })
  @IsUUID()
  zoneId: string;

  @ApiProperty({
    description: 'Primer día de la reubicación (YYYY-MM-DD). Puede ser futuro',
    example: '2026-11-02',
    format: 'date',
  })
  @IsDateOnly()
  validFrom: string;

  @ApiPropertyOptional({
    description:
      'Último día de la reubicación (YYYY-MM-DD), inclusive. Sin fecha queda vigente hasta nuevo aviso',
    example: '2026-11-15',
    format: 'date',
  })
  @IsOptional()
  @IsDateOnly()
  validTo?: string;

  @ApiProperty({
    description: 'Motivo de la reubicación',
    example: 'Refuerzo por acumulación de residuos tras el temporal',
    maxLength: MAX_REASON_LENGTH,
  })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_REASON_LENGTH)
  reason: string;
}

export class CrewZoneAssignmentResponseDto {
  @ApiProperty({ description: 'UUID de la reubicación', format: 'uuid' })
  id: string;

  @ApiProperty({ description: 'UUID de la cuadrilla', format: 'uuid' })
  crewId: string;

  @ApiProperty({ description: 'UUID de la zona donde se reubica', format: 'uuid' })
  zoneId: string;

  @ApiProperty({ description: 'Primer día de vigencia', example: '2026-11-02', format: 'date' })
  validFrom: string;

  @ApiProperty({
    description: 'Último día de vigencia. `null`: hasta nuevo aviso',
    example: '2026-11-15',
    format: 'date',
    nullable: true,
    type: String,
  })
  validTo: string | null;

  @ApiProperty({ description: 'Motivo de la reubicación' })
  reason: string;

  @ApiProperty({ description: 'Id de M1 de quien la cargó', example: '3' })
  createdBy: string;

  @ApiProperty({ description: 'Fecha de carga', format: 'date-time' })
  createdAt: Date;
}
