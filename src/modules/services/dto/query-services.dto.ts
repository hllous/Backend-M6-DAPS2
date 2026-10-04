import { ApiPropertyOptional } from '@nestjs/swagger';
import { ServiceMode, ServiceOrigin, ServiceStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { MAX_EXTERNAL_ID_LENGTH } from '../../../common/decorators';
import { PaginationQueryDto } from '../../../common/dto';
import { ServiceTargetType } from './create-service.dto';

export class QueryServicesDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filtrar por estado',
    enum: ServiceStatus,
    example: ServiceStatus.SCHEDULED,
  })
  @IsOptional()
  @IsEnum(ServiceStatus)
  status?: ServiceStatus;

  @ApiPropertyOptional({ description: 'Filtrar por tipo de servicio', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  serviceTypeId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por modo de ejecución',
    enum: ServiceMode,
    example: ServiceMode.ROUTE,
  })
  @IsOptional()
  @IsEnum(ServiceMode)
  mode?: ServiceMode;

  @ApiPropertyOptional({
    description: 'Filtrar por origen de la programación',
    enum: ServiceOrigin,
    example: ServiceOrigin.TICKET,
  })
  @IsOptional()
  @IsEnum(ServiceOrigin)
  origin?: ServiceOrigin;

  @ApiPropertyOptional({ description: 'Filtrar por cuadrilla asignada', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  crewId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por vehículo asignado', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar los servicios que cubren una zona operativa',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  zoneId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por tipo del bien sobre el que se ejecuta (servicios POINT)',
    enum: ServiceTargetType,
    example: ServiceTargetType.TREE,
  })
  @IsOptional()
  @IsEnum(ServiceTargetType)
  targetType?: ServiceTargetType;

  @ApiPropertyOptional({
    description:
      'Filtrar por el bien sobre el que se ejecuta. Se combina con targetType o se usa solo: los UUID no se repiten entre inventarios.',
    example: 'c3d4e5f6-a7b8-4012-8def-123456789012',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  targetId?: string;

  @ApiPropertyOptional({
    maxLength: MAX_EXTERNAL_ID_LENGTH,
    description: 'Filtrar por el reclamo de M2 que lo originó',
    example: 'TCK-2026-004821',
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_EXTERNAL_ID_LENGTH)
  ticketId?: string;

  @ApiPropertyOptional({
    description: 'Agendados desde esta fecha, inclusive (YYYY-MM-DD)',
    example: '2026-09-01',
    format: 'date',
  })
  @IsOptional()
  @IsDateString()
  scheduledFrom?: string;

  @ApiPropertyOptional({
    description: 'Agendados hasta esta fecha, inclusive (YYYY-MM-DD)',
    example: '2026-09-30',
    format: 'date',
  })
  @IsOptional()
  @IsDateString()
  scheduledTo?: string;
}
