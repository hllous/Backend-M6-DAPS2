import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ContainerType,
  ContainerStatus,
  DamageType,
  Severity,
} from '@prisma/client';

export class ContainerResponseDto {
  @ApiProperty({
    description: 'UUID del contenedor',
    example: 'd4e5f6a7-b8c9-0123-defg-456789012345',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({
    description: 'Código único del contenedor',
    example: 'CT-0442',
  })
  code: string;

  @ApiProperty({
    description: 'Tipo de contenedor',
    enum: ContainerType,
    example: ContainerType.HOUSEHOLD,
  })
  containerType: ContainerType;

  @ApiProperty({
    description: 'UUID de la zona operativa',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  zoneId: string;

  @ApiPropertyOptional({
    description: 'Dirección del contenedor',
    example: 'Av. Rivadavia 4500, esquina Medrano',
  })
  address: string | null;

  @ApiPropertyOptional({
    description: 'Latitud',
    example: -34.6037,
  })
  lat: number | null;

  @ApiPropertyOptional({
    description: 'Longitud',
    example: -58.3816,
  })
  lng: number | null;

  @ApiProperty({
    description: 'Capacidad en litros',
    example: 1100,
  })
  capacityLiters: number;

  @ApiProperty({
    description: 'Estado actual del contenedor',
    enum: ContainerStatus,
    example: ContainerStatus.ACTIVE,
  })
  status: ContainerStatus;

  @ApiPropertyOptional({
    description: 'Tipo de daño (solo cuando status = DAMAGED)',
    enum: DamageType,
    example: DamageType.LID_BROKEN,
  })
  damageType: DamageType | null;

  @ApiPropertyOptional({
    description: 'Severidad del daño (solo cuando status = DAMAGED)',
    enum: Severity,
    example: Severity.MEDIUM,
  })
  severity: Severity | null;

  @ApiPropertyOptional({
    description: 'Si requiere derivación a Obras Públicas (solo cuando status = DAMAGED)',
    example: false,
  })
  requiresPublicWorks: boolean | null;

  @ApiProperty({
    description: 'Fecha de creación',
    example: '2026-08-20T10:00:00.000Z',
    format: 'date-time',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Fecha de última actualización',
    example: '2026-08-20T10:00:00.000Z',
    format: 'date-time',
  })
  updatedAt: Date;
}
