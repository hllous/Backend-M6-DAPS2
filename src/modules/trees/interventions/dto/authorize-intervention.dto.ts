import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * DTO para autorizar una extracción (REMOVAL).
 * Transición: PENDING_AUTHORIZATION → AUTHORIZED.
 */
export class AuthorizeInterventionDto {
  @ApiPropertyOptional({
    description: 'ID del usuario que autoriza la extracción',
    example: 'usr-00003',
  })
  @IsOptional()
  @IsString()
  authorizedByUserId?: string;

  @ApiPropertyOptional({
    description: 'Justificación adicional de la autorización',
    example: 'Aprobado por jefe de arbolado urbano',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  justification?: string;
}
