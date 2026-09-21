import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum, IsOptional, MaxLength } from 'class-validator';
import { ToBoolean, Trim, MAX_EXTERNAL_ID_LENGTH } from '../../../common/decorators';
import { CrewType, Shift } from '@prisma/client';

export class CreateCrewDto {
  @ApiProperty({
    description: 'Nombre de la cuadrilla',
    example: 'Cuadrilla Norte - Turno Mañana',
    maxLength: 100,
  })
  @Trim()
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
    maxLength: MAX_EXTERNAL_ID_LENGTH,
    description: 'ID del usuario líder de la cuadrilla (usuario interno de M6)',
    example: 'usr-00001',
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_EXTERNAL_ID_LENGTH)
  leaderUserId?: string;

  @ApiPropertyOptional({
    maxLength: MAX_EXTERNAL_ID_LENGTH,
    description: 'ID de la organización (para cuadrillas de cooperativa o contratista)',
    example: 'org-coop-recicladores',
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_EXTERNAL_ID_LENGTH)
  organizationId?: string;

  @ApiPropertyOptional({
    description: 'Si la cuadrilla está activa y disponible para asignación',
    example: true,
    default: true,
  })
  @IsOptional()
  @ToBoolean()
  active?: boolean;
}
