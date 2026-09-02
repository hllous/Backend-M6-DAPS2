import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum, IsOptional, IsBoolean, MaxLength } from 'class-validator';
import { CrewType, Shift } from '@prisma/client';

export class CreateCrewDto {
  @ApiProperty({
    description: 'Nombre de la cuadrilla',
    example: 'Cuadrilla Norte - Turno Mañana',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Tipo de cuadrilla',
    enum: CrewType,
    example: CrewType.MUNICIPAL,
  })
  @IsEnum(CrewType)
  crewType: CrewType;

  @ApiProperty({
    description: 'Turno por defecto de la cuadrilla',
    enum: Shift,
    example: Shift.MORNING,
  })
  @IsEnum(Shift)
  defaultShift: Shift;

  @ApiPropertyOptional({
    description: 'ID del usuario líder de la cuadrilla (usuario interno de M6)',
    example: 'usr-00001',
  })
  @IsOptional()
  @IsString()
  leaderUserId?: string;

  @ApiPropertyOptional({
    description: 'ID de la organización (para cuadrillas de cooperativa o contratista)',
    example: 'org-coop-recicladores',
  })
  @IsOptional()
  @IsString()
  organizationId?: string;

  @ApiPropertyOptional({
    description: 'Si la cuadrilla está activa y disponible para asignación',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
