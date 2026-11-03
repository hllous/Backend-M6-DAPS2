import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  MaxLength,
  IsNotEmpty,
  ValidateIf,
} from 'class-validator';
import {
  IsM1UserId,
  ToBoolean,
  Trim,
  MAX_EXTERNAL_ID_LENGTH,
  MAX_PERSON_NAME_LENGTH,
} from '../../../common/decorators';
import { CrewSpecialty, Shift } from '@prisma/client';

export class UpdateCrewDto {
  @ApiPropertyOptional({
    description: 'Nombre de la cuadrilla',
    example: 'Cuadrilla Norte - Turno Tarde',
    maxLength: 100,
  })
  // Opcional pero nunca null: toda cuadrilla tiene nombre. (IsOptional dejaría pasar null.)
  @ValidateIf((_o, v) => v !== undefined)
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description: 'Turno por defecto de la cuadrilla',
    enum: Shift,
    example: Shift.AFTERNOON,
  })
  @ValidateIf((_o, v) => v !== undefined)
  @IsEnum(Shift)
  defaultShift?: Shift;

  @ApiPropertyOptional({
    maxLength: MAX_EXTERNAL_ID_LENGTH,
    description: 'Id de M1 (numérico, solo dígitos) del líder de la cuadrilla',
    example: '2',
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_EXTERNAL_ID_LENGTH)
  @IsM1UserId()
  leaderUserId?: string;

  @ApiPropertyOptional({
    maxLength: MAX_EXTERNAL_ID_LENGTH,
    description: 'ID de la organización',
    example: 'org-coop-recicladores',
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_EXTERNAL_ID_LENGTH)
  organizationId?: string;

  @ApiPropertyOptional({
    maxLength: MAX_PERSON_NAME_LENGTH,
    description: 'Nombre del líder (copia del dato de M1). Vacío o `null` lo borra',
    example: 'Marta Gómez',
    nullable: true,
    type: String,
  })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(MAX_PERSON_NAME_LENGTH)
  leaderName?: string | null;

  @ApiPropertyOptional({
    maxLength: MAX_PERSON_NAME_LENGTH,
    description: 'Nombre de la organización (copia del dato de M1). Vacío o `null` lo borra',
    example: 'Cooperativa Recicladores del Sur',
    nullable: true,
    type: String,
  })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(MAX_PERSON_NAME_LENGTH)
  organizationName?: string | null;

  @ApiPropertyOptional({
    description: 'Especialidad de la cuadrilla',
    enum: CrewSpecialty,
    example: CrewSpecialty.SWEEPING,
  })
  // Nunca null: la especialidad no se borra, se cambia.
  @ValidateIf((_o, v) => v !== undefined)
  @IsEnum(CrewSpecialty)
  specialty?: CrewSpecialty;

  @ApiPropertyOptional({
    description: 'Zona base de la cuadrilla (UUID). `null` la deja sin zona base',
    example: 'a1b2c3d4-e5f6-4789-8abc-def012345678',
    format: 'uuid',
    nullable: true,
    type: String,
  })
  @IsOptional()
  @IsUUID()
  homeZoneId?: string | null;

  @ApiPropertyOptional({
    description: 'Si la cuadrilla está activa',
    example: false,
  })
  @IsOptional()
  @ToBoolean()
  active?: boolean;
}
