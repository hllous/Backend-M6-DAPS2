import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CrewType, Shift } from '@prisma/client';

class CrewMemberResponseDto {
  @ApiProperty({
    description: 'ID del usuario miembro (usuario interno de M6)',
    example: 'usr-00010',
  })
  userId: string;
}

export class CrewResponseDto {
  @ApiProperty({
    description: 'UUID de la cuadrilla',
    example: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({
    description: 'Nombre de la cuadrilla',
    example: 'Cuadrilla Norte - Turno Mañana',
  })
  name: string;

  @ApiProperty({
    description: 'Tipo de cuadrilla',
    enum: CrewType,
    example: CrewType.MUNICIPAL,
  })
  crewType: CrewType;

  @ApiProperty({
    description: 'Turno por defecto',
    enum: Shift,
    example: Shift.MORNING,
  })
  defaultShift: Shift;

  @ApiPropertyOptional({
    description: 'ID del usuario líder',
    example: 'usr-00001',
  })
  leaderUserId: string | null;

  @ApiPropertyOptional({
    description: 'ID de la organización (cooperativa/contratista)',
    example: 'org-coop-recicladores',
  })
  organizationId: string | null;

  @ApiProperty({
    description: 'Si la cuadrilla está activa',
    example: true,
  })
  active: boolean;

  @ApiPropertyOptional({
    description: 'Miembros de la cuadrilla. Incluido solo en GET por ID',
    type: [CrewMemberResponseDto],
  })
  members?: CrewMemberResponseDto[];

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
