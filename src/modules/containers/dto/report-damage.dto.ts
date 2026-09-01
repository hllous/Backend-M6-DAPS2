import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsBoolean, IsString, MaxLength } from 'class-validator';
import { DamageType, Severity } from '@prisma/client';

/**
 * DTO para reportar daño en un contenedor.
 * Transición: ACTIVE → DAMAGED.
 * requiresPublicWorks = true señala el componente de infraestructura civil
 * que no nos corresponde y es la señal para que el evento le sirva a M3.
 */
export class ReportDamageDto {
  @ApiProperty({
    description: 'Tipo de daño detectado',
    enum: DamageType,
    example: DamageType.LID_BROKEN,
  })
  @IsEnum(DamageType)
  damageType: DamageType;

  @ApiProperty({
    description: 'Severidad del daño',
    enum: Severity,
    example: Severity.MEDIUM,
  })
  @IsEnum(Severity)
  severity: Severity;

  @ApiProperty({
    description:
      'Si el daño involucra infraestructura civil que debe derivarse a M3 (base rota, vereda hundida)',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  requiresPublicWorks?: boolean;
}
