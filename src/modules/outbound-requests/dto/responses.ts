import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  RepairDamageType,
  RepairRequestStatus,
  Severity,
  StreetClosureRequestStatus,
  StreetClosureType,
} from '@prisma/client';

export class RepairRequestResponseDto {
  @ApiProperty({ description: 'UUID de la solicitud', format: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Tipo de daño', enum: RepairDamageType })
  damageType: RepairDamageType;

  @ApiProperty({ description: 'Gravedad', enum: Severity })
  severity: Severity;

  @ApiProperty({ description: 'Si representa riesgo para la seguridad pública' })
  publicSafetyRisk: boolean;

  @ApiProperty({
    description: 'Qué originó la detección: SERVICE o INSPECTION',
    example: 'SERVICE',
  })
  detectedInType: string;

  @ApiProperty({ description: 'UUID del servicio o inspección de origen', format: 'uuid' })
  detectedInId: string;

  @ApiPropertyOptional({ description: 'Dirección del daño', nullable: true })
  address: string | null;

  @ApiProperty({
    description:
      'Tres estados, no una máquina: pedida, en curso, cerrada. Las mueve M3 con sus eventos.',
    enum: RepairRequestStatus,
  })
  status: RepairRequestStatus;

  @ApiPropertyOptional({
    description: 'Orden de trabajo de M3. Null hasta que la informan.',
    nullable: true,
  })
  workOrderId: string | null;

  @ApiProperty({ description: 'Cuándo se pidió', format: 'date-time' })
  requestedAt: Date;

  @ApiProperty({ description: 'Fecha de creación', format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ description: 'Fecha de última actualización', format: 'date-time' })
  updatedAt: Date;
}

export class ClosureSectionResponseDto {
  @ApiProperty({ description: 'UUID del tramo', format: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Calle afectada', example: 'Rivadavia' })
  streetName: string;

  @ApiProperty({ description: 'Cruce inicial', example: 'Mitre' })
  fromCross: string;

  @ApiProperty({ description: 'Cruce final', example: 'San Martín' })
  toCross: string;
}

export class StreetClosureRequestResponseDto {
  @ApiProperty({ description: 'UUID de la solicitud', format: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Qué origina el corte: SERVICE o TREE_INTERVENTION' })
  sourceType: string;

  @ApiProperty({ description: 'UUID del origen', format: 'uuid' })
  sourceId: string;

  @ApiProperty({ description: 'Motivo del corte' })
  reason: string;

  @ApiProperty({ description: 'Tramos afectados', type: [ClosureSectionResponseDto] })
  sections: ClosureSectionResponseDto[];

  @ApiPropertyOptional({ description: 'Inicio solicitado', format: 'date-time', nullable: true })
  closureFrom: Date | null;

  @ApiPropertyOptional({ description: 'Fin solicitado', format: 'date-time', nullable: true })
  closureTo: Date | null;

  @ApiPropertyOptional({ description: 'Tipo de corte', enum: StreetClosureType, nullable: true })
  closureType: StreetClosureType | null;

  @ApiProperty({
    description: 'Estado de la solicitud. Lo mueven las tres respuestas de M7.',
    enum: StreetClosureRequestStatus,
  })
  status: StreetClosureRequestStatus;

  @ApiPropertyOptional({
    description: 'Identificador del corte que asigna M7. Null hasta que responden.',
    nullable: true,
  })
  closureId: string | null;

  @ApiProperty({ description: 'Fecha de creación', format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ description: 'Fecha de última actualización', format: 'date-time' })
  updatedAt: Date;
}
