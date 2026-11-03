import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContainerStatus } from '@prisma/client';

export class ContainerStatusHistoryResponseDto {
  @ApiProperty({
    description: 'UUID de la fila del historial',
    example: 'e5f6a7b8-c9d0-4123-8efa-567890123456',
    format: 'uuid',
  })
  id: string;

  @ApiPropertyOptional({
    description:
      'Estado de origen. Null en el alta del contenedor (y en la fila base de la migración)',
    enum: ContainerStatus,
    example: ContainerStatus.ACTIVE,
    nullable: true,
  })
  fromStatus: ContainerStatus | null;

  @ApiProperty({
    description: 'Estado de destino',
    enum: ContainerStatus,
    example: ContainerStatus.OVERFLOWED,
  })
  toStatus: ContainerStatus;

  @ApiProperty({
    description: 'Instante del cambio',
    example: '2026-08-20T10:00:00.000Z',
    format: 'date-time',
  })
  changedAt: Date;
}
