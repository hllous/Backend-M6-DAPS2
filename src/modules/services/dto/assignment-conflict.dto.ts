import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ServiceStatus } from '@prisma/client';
import { IsOptional, IsUUID } from 'class-validator';

/** Qué recurso está tomado. */
export enum ConflictResource {
  CREW = 'CREW',
  VEHICLE = 'VEHICLE',
}

/** Por qué la cuadrilla elegida no encaja con el servicio, aunque esté libre. */
export enum AssignmentWarningCode {
  CREW_ZONE_MISMATCH = 'CREW_ZONE_MISMATCH',
  CREW_SPECIALTY_MISMATCH = 'CREW_SPECIALTY_MISMATCH',
}

export class QueryAssignmentConflictsDto {
  @ApiPropertyOptional({ description: 'Cuadrilla a evaluar', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  crewId?: string;

  @ApiPropertyOptional({ description: 'Vehículo a evaluar', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  vehicleId?: string;
}

export class AssignmentConflictDto {
  @ApiProperty({ enum: ConflictResource, description: 'Qué recurso ya está tomado' })
  resource: ConflictResource;

  @ApiProperty({ description: 'UUID del recurso', format: 'uuid' })
  resourceId: string;

  @ApiProperty({
    description: 'Nombre de la cuadrilla o patente del vehículo',
    example: 'Cuadrilla Centro 1',
  })
  resourceName: string;

  @ApiProperty({ description: 'El otro servicio que lo tiene tomado', format: 'uuid' })
  serviceId: string;

  @ApiProperty({ enum: ServiceStatus })
  serviceStatus: ServiceStatus;

  @ApiProperty({ example: 'Recolección domiciliaria' })
  serviceTypeName: string;

  @ApiProperty({ example: '2026-09-15', format: 'date' })
  scheduledDate: string;

  @ApiProperty({
    description: 'Franja del otro servicio. `null` en las dos puntas significa todo el día.',
    example: '06:00',
    nullable: true,
    type: String,
  })
  windowFrom: string | null;

  @ApiProperty({ example: '11:00', nullable: true, type: String })
  windowTo: string | null;
}

export class AssignmentWarningDto {
  @ApiProperty({
    enum: AssignmentWarningCode,
    description:
      '`CREW_ZONE_MISMATCH`: la zona del servicio no es la zona efectiva de la cuadrilla en la fecha. `CREW_SPECIALTY_MISMATCH`: la especialidad de la cuadrilla no corresponde al tipo de servicio.',
  })
  code: AssignmentWarningCode;

  @ApiProperty({
    description: 'Explicación lista para mostrar al planificador',
    example:
      "La cuadrilla 'Cuadrilla Recolección — Palermo' trabaja en Palermo y el servicio es en otra zona",
  })
  message: string;
}

/**
 * Lo que devuelve la consulta de disponibilidad.
 *
 * Existe para que el frontend pueda **avisar antes de enviar**, en vez de
 * enterarse por un 409. Es lo que hace que el aviso sea un aviso y no un
 * rechazo disfrazado.
 */
export class AssignmentConflictsResponseDto {
  @ApiProperty({ format: 'uuid', description: 'Servicio que se quiere asignar' })
  serviceId: string;

  @ApiProperty({
    description:
      'Si hay algún solapamiento o aviso de encaje. Con `true`, asignar exige `overrideNote`; la asignación se permite igual.',
    example: true,
  })
  hasConflicts: boolean;

  @ApiProperty({ type: [AssignmentConflictDto] })
  conflicts: AssignmentConflictDto[];

  @ApiProperty({
    type: [AssignmentWarningDto],
    description:
      'Avisos de que la cuadrilla no es la esperable para el servicio (zona o especialidad). Vacío si no hay cuadrilla o ella no tiene zona ni especialidad cargadas. Cuentan igual que los solapamientos: exigen `overrideNote`, no bloquean.',
  })
  warnings: AssignmentWarningDto[];
}
