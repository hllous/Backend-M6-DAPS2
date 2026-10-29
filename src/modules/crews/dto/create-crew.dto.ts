import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum, IsOptional, IsUUID, MaxLength } from 'class-validator';
import {
  IsM1UserId,
  ToBoolean,
  Trim,
  MAX_EXTERNAL_ID_LENGTH,
  MAX_PERSON_NAME_LENGTH,
} from '../../../common/decorators';
import { CrewSpecialty, CrewType, Shift } from '@prisma/client';

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
    description:
      'Id de M1 (numérico, solo dígitos) del líder de la cuadrilla. El líder puede ejecutar los servicios de la cuadrilla',
    example: '1',
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_EXTERNAL_ID_LENGTH)
  @IsM1UserId()
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
    maxLength: MAX_PERSON_NAME_LENGTH,
    description:
      'Nombre del líder, tal como figura en M1. Se guarda como copia para poder mostrarlo: M6 no consulta a M1',
    example: 'Marta Gómez',
  })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(MAX_PERSON_NAME_LENGTH)
  leaderName?: string;

  @ApiPropertyOptional({
    maxLength: MAX_PERSON_NAME_LENGTH,
    description: 'Nombre de la organización (cooperativa o contratista), copia del dato de M1',
    example: 'Cooperativa Recicladores del Sur',
  })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(MAX_PERSON_NAME_LENGTH)
  organizationName?: string;

  @ApiProperty({
    description: 'Especialidad de la cuadrilla: con qué tipos de servicio se la espera ver',
    enum: CrewSpecialty,
    example: CrewSpecialty.COLLECTION,
  })
  @IsEnum(CrewSpecialty)
  specialty: CrewSpecialty;

  @ApiPropertyOptional({
    description: 'Zona base de la cuadrilla (UUID). Una sola; las reubicaciones van aparte',
    example: 'a1b2c3d4-e5f6-4789-8abc-def012345678',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  homeZoneId?: string;

  @ApiPropertyOptional({
    description: 'Si la cuadrilla está activa y disponible para asignación',
    example: true,
    default: true,
  })
  @IsOptional()
  @ToBoolean()
  active?: boolean;
}
