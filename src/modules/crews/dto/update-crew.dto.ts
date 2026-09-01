import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsEnum, MaxLength } from 'class-validator';
import { Shift } from '@prisma/client';

export class UpdateCrewDto {
  @ApiPropertyOptional({
    description: 'Nombre de la cuadrilla',
    example: 'Cuadrilla Norte - Turno Tarde',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
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
    description: 'ID del usuario líder de la cuadrilla',
    example: 'usr-00002',
  })
  @IsOptional()
  @IsString()
  leaderUserId?: string;

  @ApiPropertyOptional({
    description: 'ID de la organización',
    example: 'org-coop-recicladores',
  })
  @IsOptional()
  @IsString()
  organizationId?: string;

  @ApiPropertyOptional({
    description: 'Si la cuadrilla está activa',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
