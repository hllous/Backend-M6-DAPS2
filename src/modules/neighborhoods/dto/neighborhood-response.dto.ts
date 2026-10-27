import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Un barrio del catálogo de M9, tal como lo publica el Core. */
export class NeighborhoodResponseDto {
  @ApiProperty({
    description: 'UUID del barrio en M9: es lo que se guarda en una zona y viaja en los eventos',
    example: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  })
  id: string;

  @ApiProperty({ description: 'Slug legible sin acentos', example: 'palermo' })
  codigo: string;

  @ApiProperty({ description: 'Nombre del barrio', example: 'Palermo' })
  nombre: string;

  @ApiProperty({
    description: 'Comuna administrativa de M9 (solo referencia, no es una zona operativa)',
    example: 'comuna-14',
  })
  zona: string;

  @ApiProperty({ description: 'Nombre de la comuna', example: 'Comuna 14' })
  zonaNombre: string;

  @ApiPropertyOptional({
    description: 'Datos adicionales que carga M9',
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  metadatos?: Record<string, unknown> | null;

  @ApiProperty({ description: 'M9 no borra barrios: una baja es activo=false', example: true })
  activo: boolean;
}
