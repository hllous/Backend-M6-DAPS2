import { ApiProperty } from '@nestjs/swagger';
import { DisposalSiteType } from '@prisma/client';

export class DisposalSiteResponseDto {
  @ApiProperty({
    description: 'UUID del sitio de disposición',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({ description: 'Código único del sitio', example: 'DS-CEAMSE' })
  code: string;

  @ApiProperty({ description: 'Nombre del sitio', example: 'Relleno sanitario Norte III' })
  name: string;

  @ApiProperty({
    description: 'Tipo de destino final',
    enum: DisposalSiteType,
    example: DisposalSiteType.LANDFILL,
  })
  siteType: DisposalSiteType;

  @ApiProperty({ description: 'Si el sitio está operativo', example: true })
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
