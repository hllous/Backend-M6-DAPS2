import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ServiceOrigin } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

/**
 * Bienes del inventario sobre los que se puede programar un servicio POINT.
 *
 * `Service.targetType` es un String en el schema, no un enum de Prisma: la
 * referencia es polimórfica y sigue el mismo criterio que `Attachment.ownerType`
 * y `RepairRequest.detectedInType`. La validación del conjunto cerrado vive acá.
 */
export enum ServiceTargetType {
  CONTAINER = 'CONTAINER',
  TREE = 'TREE',
  GREEN_SPACE = 'GREEN_SPACE',
  GREEN_POINT = 'GREEN_POINT',
}

const TIME_HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateServiceDto {
  @ApiProperty({
    description:
      'Tipo de servicio. Define el modo de ejecución: el Service no elige si es ROUTE o POINT, lo copia de acá.',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  @IsUUID()
  serviceTypeId: string;

  @ApiProperty({
    description: 'Fecha en la que se agenda el servicio (YYYY-MM-DD)',
    example: '2026-09-15',
    format: 'date',
  })
  @IsDateString()
  scheduledDate: string;

  @ApiProperty({
    description: 'Origen de la programación. TICKET exige ticketId; el resto no lo admite.',
    enum: ServiceOrigin,
    example: ServiceOrigin.PLANNED,
  })
  @IsEnum(ServiceOrigin)
  origin: ServiceOrigin;

  @ApiPropertyOptional({
    description: 'Recorrido a ejecutar. Obligatorio si el tipo de servicio es de modo ROUTE.',
    example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  routeId?: string;

  @ApiPropertyOptional({
    description:
      'Tipo del bien sobre el que se ejecuta. Solo para servicios POINT, junto con targetId.',
    enum: ServiceTargetType,
    example: ServiceTargetType.CONTAINER,
  })
  @IsOptional()
  @IsEnum(ServiceTargetType)
  targetType?: ServiceTargetType;

  @ApiPropertyOptional({
    description: 'UUID del bien sobre el que se ejecuta. La zona se deriva del bien.',
    example: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  targetId?: string;

  @ApiPropertyOptional({
    description:
      'Zona del servicio POINT cuando el objetivo es una ubicación suelta y no un bien del inventario. Se ignora si viene targetType/targetId.',
    example: 'd4e5f6a7-b8c9-0123-defa-234567890123',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  zoneId?: string;

  @ApiPropertyOptional({
    description: 'Cuadrilla asignada. Es opcional al programar; se puede asignar después.',
    example: 'e5f6a7b8-c9d0-1234-efab-345678901234',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  crewId?: string;

  @ApiPropertyOptional({
    description:
      'Vehículo asignado. Si el tipo de servicio exige vehículo, hace falta antes de iniciar.',
    example: 'f6a7b8c9-d0e1-2345-fabc-456789012345',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @ApiPropertyOptional({
    description: 'Inicio de la ventana horaria (HH:mm)',
    example: '08:00',
  })
  @IsOptional()
  @Matches(TIME_HHMM, { message: 'windowFrom debe tener formato HH:mm' })
  windowFrom?: string;

  @ApiPropertyOptional({
    description: 'Fin de la ventana horaria (HH:mm)',
    example: '12:00',
  })
  @IsOptional()
  @Matches(TIME_HHMM, { message: 'windowTo debe tener formato HH:mm' })
  windowTo?: string;

  @ApiPropertyOptional({
    description:
      'Reclamo de M2 que originó el servicio. Obligatorio si origin = TICKET, y rechazado en cualquier otro origen.',
    example: 'TCK-2026-004821',
    maxLength: 64,
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  ticketId?: string;

  @ApiPropertyOptional({
    description: 'Notas internas de la programación',
    example: 'Coordinar con la cooperativa antes de las 7.',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
