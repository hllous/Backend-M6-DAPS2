import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CrewSpecialty, CrewType, Shift } from '@prisma/client';

class CrewMemberResponseDto {
  @ApiProperty({
    description: 'ID del usuario miembro (usuario interno de M6)',
    example: '10',
  })
  userId: string;

  @ApiProperty({
    description: 'Nombre del integrante (copia del dato de M1). `null` si no se informó',
    example: 'Lucía Fernández',
    type: String,
    nullable: true,
  })
  displayName: string | null;
}

export class CrewResponseDto {
  @ApiProperty({
    description: 'UUID de la cuadrilla',
    example: 'c3d4e5f6-a7b8-4012-8def-123456789012',
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
    description: 'Nombre del líder (copia del dato de M1). `null` si no se informó',
    example: 'Marta Gómez',
    type: String,
    nullable: true,
  })
  leaderName: string | null;

  @ApiProperty({
    description: 'Nombre de la organización (copia del dato de M1). `null` si no se informó',
    example: 'Cooperativa Recicladores del Sur',
    type: String,
    nullable: true,
  })
  organizationName: string | null;

  @ApiProperty({
    description: 'Especialidad. `null` en cuadrillas anteriores a que existiera el campo',
    enum: CrewSpecialty,
    example: CrewSpecialty.COLLECTION,
    nullable: true,
  })
  specialty: CrewSpecialty | null;

  @ApiProperty({
    description: 'UUID de la zona base. `null` si la cuadrilla no tiene una',
    example: 'a1b2c3d4-e5f6-4789-8abc-def012345678',
    format: 'uuid',
    type: String,
    nullable: true,
  })
  homeZoneId: string | null;

  @ApiProperty({
    description:
      'UUID de la zona donde trabaja hoy: la de la reubicación vigente o, si no hay, la zona base. `null` si no tiene ninguna',
    example: 'a1b2c3d4-e5f6-4789-8abc-def012345678',
    format: 'uuid',
    type: String,
    nullable: true,
  })
  effectiveZoneId: string | null;

  @ApiProperty({
    description: 'Cantidad de integrantes (el líder no se cuenta aparte)',
    example: 4,
  })
  membersCount: number;

  @ApiProperty({
    description: 'Turno por defecto',
    enum: Shift,
    example: Shift.MORNING,
  })
  defaultShift: Shift;

  @ApiPropertyOptional({
    description: 'ID del usuario líder',
    example: '1',
    type: String,
    nullable: true,
  })
  leaderUserId: string | null;

  @ApiPropertyOptional({
    description: 'ID de la organización (cooperativa/contratista)',
    example: 'org-coop-recicladores',
    type: String,
    nullable: true,
  })
  organizationId: string | null;

  @ApiProperty({
    description: 'Si la cuadrilla está activa',
    example: true,
  })
  active: boolean;

  @ApiPropertyOptional({
    description:
      'Miembros de la cuadrilla. Se incluye en el detalle (GET por ID) y al agregar integrantes (POST /crews/:id/members); el listado trae solo `membersCount`',
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
