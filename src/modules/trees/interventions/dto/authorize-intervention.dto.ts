import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { MAX_EXTERNAL_ID_LENGTH } from '../../../../common/decorators';

/**
 * DTO para autorizar una extracción (REMOVAL).
 * Transición: PENDING_AUTHORIZATION → AUTHORIZED.
 */
export class AuthorizeInterventionDto {
  @ApiPropertyOptional({
    maxLength: MAX_EXTERNAL_ID_LENGTH,
    description: 'ID del usuario que autoriza la extracción',
    example: 'usr-00003',
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_EXTERNAL_ID_LENGTH)
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
