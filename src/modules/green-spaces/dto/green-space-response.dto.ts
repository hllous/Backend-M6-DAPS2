import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GreenSpaceType } from '@prisma/client';

export class GreenSpaceResponseDto {
  @ApiProperty({
    description: 'UUID del espacio verde',
    example: 'e5f6a7b8-c9d0-1234-efgh-567890123456',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({
    description: 'Nombre del espacio verde',
    example: 'Plaza Miserere',
  })
  name: string;

  @ApiProperty({
    description: 'Tipo de espacio verde',
    enum: GreenSpaceType,
    example: GreenSpaceType.SQUARE,
  })
  spaceType: GreenSpaceType;

  @ApiProperty({
    description: 'UUID de la zona operativa',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  zoneId: string;

  @ApiPropertyOptional({
    description: 'Superficie en metros cuadrados',
    example: 12500.5,
  })
  areaM2: number | null;

  @ApiProperty({
    description: 'Si el espacio verde está activo',
    example: true,
  })
  active: boolean;

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
