import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength, IsNotEmpty, IsUUID } from 'class-validator';
import { ToBoolean, Trim } from '../../../common/decorators';

export class UpdateZoneDto {
  @ApiPropertyOptional({
    description: 'Nombre descriptivo de la zona',
    example: 'Zona Norte - Sector 1 (ampliada)',
    maxLength: 100,
  })
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description: 'Si la zona está activa para asignación de servicios',
    example: false,
  })
  @IsOptional()
  @ToBoolean()
  active?: boolean;

  @ApiPropertyOptional({
    description: 'UUID de la comuna que agrupa a la zona (debe existir)',
    example: 'c0a80101-0000-4000-8000-000000000014',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  communeId?: string;
}
