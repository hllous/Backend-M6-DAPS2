import { ApiProperty } from '@nestjs/swagger';
import { ServiceCategory, ServiceMode } from '@prisma/client';

export class ServiceTypeResponseDto {
  @ApiProperty({
    description: 'UUID del tipo de servicio',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({ description: 'Código único del tipo de servicio', example: 'REC-DOM' })
  code: string;

  @ApiProperty({
    description: 'Nombre descriptivo del tipo de servicio',
    example: 'Recolección domiciliaria',
  })
  name: string;

  @ApiProperty({
    description: 'Área operativa a la que pertenece',
    enum: ServiceCategory,
    example: ServiceCategory.WASTE_COLLECTION,
  })
  category: ServiceCategory;

  @ApiProperty({
    description: 'Modo de ejecución',
    enum: ServiceMode,
    example: ServiceMode.ROUTE,
  })
  mode: ServiceMode;

  @ApiProperty({
    description: 'Si la programación exige asignar un vehículo',
    example: true,
  })
  requiresVehicle: boolean;

  @ApiProperty({ description: 'Si está disponible para programar', example: true })
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
