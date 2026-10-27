import { ApiProperty } from '@nestjs/swagger';
import { NeighborhoodRefDto } from '../../zones/dto';

export class CommuneZoneResponseDto {
  @ApiProperty({
    description: 'UUID de la zona',
    format: 'uuid',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  id: string;

  @ApiProperty({ description: 'Código de la zona (slug del barrio en M9)', example: 'palermo' })
  code: string;

  @ApiProperty({ description: 'Nombre de la zona (el del barrio)', example: 'Palermo' })
  name: string;

  @ApiProperty({
    description: 'Barrios de la zona. Codigo y nombre salen del catálogo cacheado de M9',
    type: [NeighborhoodRefDto],
  })
  neighborhoods: NeighborhoodRefDto[];
}

export class CommuneResponseDto {
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

  @ApiProperty({ description: 'Si la comuna está activa', example: true })
  active: boolean;

  @ApiProperty({
    description: 'Zonas (barrios) que agrupa la comuna',
    type: [CommuneZoneResponseDto],
  })
  zones: CommuneZoneResponseDto[];
}
