import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ToBoolean, Trim } from '../../../common/decorators';
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
  @ToBoolean()
  requiresPublicWorks?: boolean;

  // Dato interno del módulo: no viaja en el evento containerDamaged.
  @ApiPropertyOptional({
    description: 'Descripción libre del desperfecto (máx. 500 caracteres)',
    example: 'La tapa quedó desencajada y la bisagra del lado izquierdo está partida',
    maxLength: 500,
  })
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  observations?: string;
}
