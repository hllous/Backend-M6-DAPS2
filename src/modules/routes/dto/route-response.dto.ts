import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RouteStopResponseDto {
  @ApiProperty({ description: 'UUID de la parada', format: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Posición en el recorrido (1-indexed)', example: 1 })
  sequence: number;

  @ApiProperty({
    description: 'UUID de la zona operativa',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  zoneId: string;

  @ApiProperty({ description: 'Duración estimada de la parada, en minutos', example: 90 })
  estimatedDurationMin: number;
}

export class RouteResponseDto {
  @ApiProperty({
    description: 'UUID del recorrido',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({ description: 'Código único del recorrido', example: 'R-03' })
  code: string;

  @ApiProperty({
    description: 'Nombre descriptivo del recorrido',
    example: 'Recorrido troncal Norte-Centro',
  })
  name: string;

  @ApiProperty({ description: 'Si está disponible para programar servicios', example: true })
  active: boolean;

  @ApiPropertyOptional({
    description:
      'Paradas en orden. Incluido en el GET por ID y en la respuesta de PUT /routes/:id/stops',
    type: [RouteStopResponseDto],
  })
  stops?: RouteStopResponseDto[];

  @ApiProperty({
    description: 'Fecha de creación',
    example: '2026-09-02T10:00:00.000Z',
    format: 'date-time',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Fecha de última actualización',
    example: '2026-09-02T10:00:00.000Z',
    format: 'date-time',
  })
  updatedAt: Date;
}
