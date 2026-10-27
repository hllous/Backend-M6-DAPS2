import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, MaxLength, IsUUID } from 'class-validator';
import { ToBoolean, Trim } from '../../../common/decorators';

export class CreateZoneDto {
  @ApiProperty({
    description: 'Código único de la zona operativa (ej. ZN-NORTE-01)',
    example: 'ZN-NORTE-01',
    maxLength: 20,
  })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code: string;

  @ApiProperty({
    description: 'Nombre descriptivo de la zona',
    example: 'Zona Norte - Sector 1',
    maxLength: 100,
  })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    description: 'Si la zona está activa para asignación de servicios',
    example: true,
    default: true,
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
