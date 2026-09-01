import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class ZoneNeighborhoodResponseDto {
  @ApiProperty({
    description: 'ID del barrio asignado (catálogo externo de M9)',
    example: 'barrio-palermo',
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
