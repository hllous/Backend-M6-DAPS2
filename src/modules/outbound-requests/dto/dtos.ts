import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RepairDamageType, Severity, StreetClosureType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/** De dónde salió la detección. `Attachment.ownerType` usa el mismo criterio. */
export enum DetectedInType {
  SERVICE = 'SERVICE',
  INSPECTION = 'INSPECTION',
}

/** Qué origina el corte de calle. */
export enum ClosureSourceType {
  SERVICE = 'SERVICE',
  TREE_INTERVENTION = 'TREE_INTERVENTION',
}

export class CreateRepairRequestDto {
  @ApiProperty({
    description: 'Tipo de daño de infraestructura detectado',
    enum: RepairDamageType,
    example: RepairDamageType.BLOCKED_DRAIN,
  })
  @IsEnum(RepairDamageType)
  damageType: RepairDamageType;

  @ApiProperty({ description: 'Gravedad del daño', enum: Severity, example: Severity.HIGH })
  @IsEnum(Severity)
  severity: Severity;

  @ApiProperty({
    description:
      'Si el daño representa un riesgo para la seguridad pública. M3 prioriza con esto, y no se deriva de la gravedad: son dos cosas distintas.',
    example: true,
  })
  @IsBoolean()
  publicSafetyRisk: boolean;

  @ApiProperty({
    description: 'Qué originó la detección: un servicio en campo o una inspección ambiental',
    enum: DetectedInType,
    example: DetectedInType.SERVICE,
  })
  @IsEnum(DetectedInType)
  detectedInType: DetectedInType;

  @ApiProperty({
    description: 'UUID del servicio o de la inspección que detectó el daño',
    format: 'uuid',
  })
  @IsUUID()
  detectedInId: string;

  @ApiPropertyOptional({
    description: 'Dirección del daño',
    example: 'Rivadavia 4500, esquina Boyacá',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;
}

export class StartRepairDto {
  @ApiPropertyOptional({
    description: 'Orden de trabajo de M3, si la informaron',
    example: 'OT-2026-01188',
    maxLength: 64,
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  workOrderId?: string;
}

export class ClosureSectionDto {
  @ApiProperty({ description: 'Calle afectada', example: 'Rivadavia', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  streetName: string;

  @ApiProperty({ description: 'Cruce donde empieza el tramo', example: 'Mitre', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  fromCross: string;

  @ApiProperty({
    description: 'Cruce donde termina el tramo',
    example: 'San Martín',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  toCross: string;
}

export class CreateStreetClosureRequestDto {
  @ApiProperty({
    description: 'Qué origina el corte',
    enum: ClosureSourceType,
    example: ClosureSourceType.TREE_INTERVENTION,
  })
  @IsEnum(ClosureSourceType)
  sourceType: ClosureSourceType;

  @ApiProperty({
    description:
      'UUID del servicio o de la intervención que lo origina. Es lo que hace que la respuesta de M7 se pueda aplicar sobre el trabajo correcto.',
    format: 'uuid',
  })
  @IsUUID()
  sourceId: string;

  @ApiProperty({
    description: 'Motivo del corte',
    example: 'Extracción de ejemplar con riesgo de caída sobre la calzada',
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;

  @ApiProperty({
    description:
      'Tramos afectados. Al menos uno: el schema del evento exige que affectedSections no viaje vacío.',
    type: [ClosureSectionDto],
    minItems: 1,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ClosureSectionDto)
  sections: ClosureSectionDto[];

  @ApiProperty({
    description: 'Inicio solicitado del corte',
    example: '2026-10-05T07:00:00.000Z',
    format: 'date-time',
  })
  @IsDateString()
  requestedFrom: string;

  @ApiProperty({
    description: 'Fin solicitado del corte',
    example: '2026-10-05T13:00:00.000Z',
    format: 'date-time',
  })
  @IsDateString()
  requestedTo: string;

  @ApiPropertyOptional({
    description:
      'Tipo de corte. Opcional en el esquema unificado con M3; nosotros lo mandamos siempre.',
    enum: StreetClosureType,
    example: StreetClosureType.PARTIAL,
  })
  @IsOptional()
  @IsEnum(StreetClosureType)
  closureType?: StreetClosureType;
}

export class ApproveClosureDto {
  @ApiPropertyOptional({
    description: 'Identificador del corte que asigna M7',
    example: 'CL-2026-0342',
    maxLength: 64,
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  closureId?: string;
}

export class RejectClosureDto {
  @ApiProperty({
    description: 'Motivo del rechazo informado por M7',
    example: 'Se superpone con un corte de Obras en la misma cuadra',
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}
