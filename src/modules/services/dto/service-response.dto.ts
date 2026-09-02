import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  NotServicedReason,
  ServiceMode,
  ServiceOrigin,
  ServiceStatus,
  WasteType,
  ZoneResultStatus,
} from '@prisma/client';
import { ServiceTargetType } from './create-service.dto';

export class ServiceZoneResponseDto {
  @ApiProperty({ description: 'UUID de la zona operativa', format: 'uuid' })
  zoneId: string;

  @ApiProperty({
    description: 'Posición en el recorrido, copiada al programar. Siempre 1 en los POINT.',
    example: 1,
  })
  sequence: number;
}

export class ZoneResultResponseDto {
  @ApiProperty({ description: 'UUID del resultado', format: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Zona sobre la que se informa', format: 'uuid' })
  zoneId: string;

  @ApiProperty({
    description: 'Cómo quedó la zona',
    enum: ZoneResultStatus,
    example: ZoneResultStatus.SERVICED,
  })
  status: ZoneResultStatus;

  @ApiPropertyOptional({
    description: 'Por qué no se atendió. Obligatorio si el status no es SERVICED.',
    enum: NotServicedReason,
    nullable: true,
  })
  reason: NotServicedReason | null;

  @ApiPropertyOptional({
    description: 'Fecha propuesta para reintentar',
    format: 'date-time',
    nullable: true,
  })
  proposedDate: Date | null;

  @ApiPropertyOptional({ description: 'Notas de la cuadrilla', nullable: true })
  notes: string | null;

  @ApiProperty({ description: 'Cuándo se registró', format: 'date-time' })
  recordedAt: Date;
}

export class CollectionRecordResponseDto {
  @ApiProperty({ description: 'UUID del registro', format: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Tipo de residuo', enum: WasteType, example: WasteType.HOUSEHOLD })
  wasteType: WasteType;

  @ApiProperty({ description: 'Sitio de disposición final', format: 'uuid' })
  disposalSiteId: string;

  @ApiPropertyOptional({
    description: 'Resultado de zona al que corresponde. Null en los servicios POINT.',
    format: 'uuid',
    nullable: true,
  })
  zoneResultId: string | null;

  @ApiPropertyOptional({ description: 'Volumen en m³', example: 12.5, nullable: true })
  volumeM3: number | null;

  @ApiPropertyOptional({ description: 'Peso en kg', example: 3400.75, nullable: true })
  weightKg: number | null;
}

export class ServiceResponseDto {
  @ApiProperty({ description: 'UUID del servicio', format: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Tipo de servicio', format: 'uuid' })
  serviceTypeId: string;

  @ApiProperty({
    description: 'Modo de ejecución, copiado del tipo de servicio',
    enum: ServiceMode,
    example: ServiceMode.ROUTE,
  })
  mode: ServiceMode;

  @ApiProperty({ description: 'Estado actual', enum: ServiceStatus })
  status: ServiceStatus;

  @ApiPropertyOptional({
    description: 'Motivo del último cambio de estado (suspensión, cancelación, reprogramación)',
    nullable: true,
  })
  statusReason: string | null;

  @ApiProperty({ description: 'Origen de la programación', enum: ServiceOrigin })
  origin: ServiceOrigin;

  @ApiPropertyOptional({
    description: 'Recorrido ejecutado. Null en los servicios POINT.',
    format: 'uuid',
    nullable: true,
  })
  routeId: string | null;

  @ApiPropertyOptional({
    description: 'Tipo del bien sobre el que se ejecuta. Null en los ROUTE.',
    enum: ServiceTargetType,
    nullable: true,
  })
  targetType: string | null;

  @ApiPropertyOptional({ description: 'UUID del bien', format: 'uuid', nullable: true })
  targetId: string | null;

  @ApiProperty({ description: 'Fecha agendada', format: 'date-time' })
  scheduledDate: Date;

  @ApiPropertyOptional({ description: 'Inicio de la ventana horaria (HH:mm)', nullable: true })
  windowFrom: string | null;

  @ApiPropertyOptional({ description: 'Fin de la ventana horaria (HH:mm)', nullable: true })
  windowTo: string | null;

  @ApiPropertyOptional({ description: 'Cuadrilla asignada', format: 'uuid', nullable: true })
  crewId: string | null;

  @ApiPropertyOptional({ description: 'Vehículo asignado', format: 'uuid', nullable: true })
  vehicleId: string | null;

  @ApiPropertyOptional({
    description: 'Reclamo de M2 que lo originó. Solo cuando origin = TICKET.',
    nullable: true,
  })
  ticketId: string | null;

  @ApiPropertyOptional({ description: 'Notas internas', nullable: true })
  notes: string | null;

  @ApiProperty({
    description:
      'Zonas cubiertas, copiadas al programar. Editar el recorrido después no las cambia.',
    type: [ServiceZoneResponseDto],
  })
  zones: ServiceZoneResponseDto[];

  @ApiPropertyOptional({
    description: 'Resultado por zona. Incluido en el GET por ID.',
    type: [ZoneResultResponseDto],
  })
  zoneResults?: ZoneResultResponseDto[];

  @ApiPropertyOptional({
    description: 'Registros de recolección. Incluido en el GET por ID.',
    type: [CollectionRecordResponseDto],
  })
  collectionRecords?: CollectionRecordResponseDto[];

  @ApiPropertyOptional({ description: 'Usuario que lo programó', nullable: true })
  createdBy: string | null;

  @ApiProperty({ description: 'Fecha de creación', format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ description: 'Fecha de última actualización', format: 'date-time' })
  updatedAt: Date;
}
