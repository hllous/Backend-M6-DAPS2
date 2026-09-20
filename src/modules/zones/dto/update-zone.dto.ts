import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ToBoolean } from '../../../common/decorators';

export class UpdateZoneDto {
  @ApiPropertyOptional({
    description: 'Nombre descriptivo de la zona',
    example: 'Zona Norte - Sector 1 (ampliada)',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description: 'Si la zona está activa para asignación de servicios',
    example: false,
  })
  @IsOptional()
  @ToBoolean()
  active?: boolean;
}
