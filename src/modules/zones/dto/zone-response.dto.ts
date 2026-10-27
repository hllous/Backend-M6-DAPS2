import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CommuneRefDto {
  @ApiProperty({
    description: 'UUID de la comuna',
    format: 'uuid',
    example: 'c0a80101-0000-4000-8000-000000000014',
  })
  id: string;

  @ApiProperty({ description: 'Código de M9 de la comuna', example: 'comuna-14' })
  code: string;

  @ApiProperty({ description: 'Nombre de la comuna', example: 'Comuna 14' })
  name: string;
}

export class NeighborhoodRefDto {
  @ApiProperty({
    description: 'UUID del barrio en M9',
    example: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  })
  id: string;

  @ApiPropertyOptional({
    description: 'Slug del barrio en M9. Ausente si el catálogo de M9 no está disponible',
    example: 'palermo',
  })
  codigo?: string;

  @ApiPropertyOptional({
    description: 'Nombre del barrio en M9. Ausente si el catálogo de M9 no está disponible',
    example: 'Palermo',
  })
  nombre?: string;
}

export class ZoneNeighborhoodResponseDto {
  @ApiProperty({
    description: 'UUID del barrio asignado (catálogo externo de M9)',
    example: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  })
  neighborhoodId: string;
}

export class ZoneResponseDto {
  @ApiProperty({
    description: 'UUID de la zona',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({
    description: 'Código único de la zona operativa',
    example: 'ZN-NORTE-01',
  })
  code: string;

  @ApiProperty({
    description: 'Nombre descriptivo de la zona',
    example: 'Zona Norte - Sector 1',
  })
  name: string;

  @ApiProperty({
    description: 'Si la zona está activa para asignación de servicios',
    example: true,
  })
  active: boolean;

  @ApiPropertyOptional({
    description: 'Comuna que agrupa a la zona; null si todavía no se la asignó',
    type: CommuneRefDto,
    nullable: true,
  })
  commune?: CommuneRefDto | null;

  @ApiPropertyOptional({
    description:
      'Barrio de la zona (una zona es un barrio); null si no tiene barrio asignado. Codigo y nombre salen del catálogo cacheado de M9',
    type: NeighborhoodRefDto,
    nullable: true,
  })
  neighborhood?: NeighborhoodRefDto | null;

  @ApiPropertyOptional({
    description: 'Barrios asignados a esta zona. Incluido solo en GET por ID',
    type: [ZoneNeighborhoodResponseDto],
  })
  neighborhoods?: ZoneNeighborhoodResponseDto[];

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
