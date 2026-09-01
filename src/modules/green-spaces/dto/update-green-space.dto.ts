import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsNumber, IsUUID, Min, MaxLength } from 'class-validator';

export class UpdateGreenSpaceDto {
  @ApiPropertyOptional({
    description: 'Nombre del espacio verde',
    example: 'Plaza Miserere (ampliada)',
    maxLength: 150,
  })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({
    description: 'UUID de la zona operativa',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  zoneId?: string;

  @ApiPropertyOptional({
    description: 'Superficie en metros cuadrados',
    example: 13000.0,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  areaM2?: number;

  @ApiPropertyOptional({
    description: 'Si el espacio verde está activo',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
