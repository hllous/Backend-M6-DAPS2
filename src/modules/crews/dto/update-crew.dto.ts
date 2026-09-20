import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, MaxLength, IsNotEmpty } from 'class-validator';
import { ToBoolean, Trim, MAX_EXTERNAL_ID_LENGTH } from '../../../common/decorators';
import { Shift } from '@prisma/client';

export class UpdateCrewDto {
  @ApiPropertyOptional({
    description: 'Nombre de la cuadrilla',
    example: 'Cuadrilla Norte - Turno Tarde',
    maxLength: 100,
  })
  @IsOptional()
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
  @IsOptional()
  @IsEnum(Shift)
  defaultShift?: Shift;

  @ApiPropertyOptional({
    maxLength: MAX_EXTERNAL_ID_LENGTH,
    description: 'ID del usuario líder de la cuadrilla',
    example: 'usr-00002',
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_EXTERNAL_ID_LENGTH)
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
    description: 'Si la cuadrilla está activa',
    example: false,
  })
  @IsOptional()
  @ToBoolean()
  active?: boolean;
}
