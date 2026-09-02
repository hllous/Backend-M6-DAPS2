import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WasteType } from '@prisma/client';

export class GreenPointResponseDto {
  @ApiProperty({
    description: 'UUID del punto verde',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({ description: 'Código único', example: 'GP-0012' })
  code: string;

  @ApiProperty({ description: 'Nombre del punto verde', example: 'Punto verde Plaza Mitre' })
  name: string;

  @ApiProperty({ description: 'Zona operativa', format: 'uuid' })
  zoneId: string;

  @ApiProperty({
    description: 'Tipos de residuo aceptados, ordenados',
    enum: WasteType,
    isArray: true,
    example: [WasteType.GREEN, WasteType.RECYCLABLE],
  })
  wasteTypes: WasteType[];

  @ApiPropertyOptional({
    description: 'Dirección del emplazamiento',
    example: 'Av. Mitre 1200',
    nullable: true,
  })
  address: string | null;

  @ApiPropertyOptional({ description: 'Latitud', example: -34.6037, nullable: true })
  lat: number | null;

  @ApiPropertyOptional({ description: 'Longitud', example: -58.3816, nullable: true })
  lng: number | null;

  @ApiProperty({ description: 'Si está habilitado', example: true })
  active: boolean;

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
