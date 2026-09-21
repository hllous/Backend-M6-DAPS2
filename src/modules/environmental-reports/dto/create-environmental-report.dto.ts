import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EnvironmentalReportType, Severity } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { Latitude, Longitude, MAX_NOTES_LENGTH, Trim } from '../../../common/decorators';

export class CreateEnvironmentalReportDto {
  @ApiProperty({
    description: 'Tipo de denuncia ambiental',
    enum: EnvironmentalReportType,
    example: EnvironmentalReportType.ILLEGAL_DUMPSITE,
  })
  @IsEnum(EnvironmentalReportType)
  reportType: EnvironmentalReportType;

  @ApiPropertyOptional({
    description: 'Dirección donde se denuncia el hecho',
    example: 'Camino de Cintura 4500',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @ApiPropertyOptional({
    description:
      'Descripción del hallazgo. Opcional: los expedientes que abre un reclamo de M2 no la traen. Es interna: no se muestra en el portal ciudadano ni viaja en eventos.',
    example: 'Acopio de escombros sobre la vereda, frente al número 4500.',
    maxLength: MAX_NOTES_LENGTH,
  })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(MAX_NOTES_LENGTH)
  description?: string;

  @ApiPropertyOptional({ description: 'Latitud', example: -34.7 })
  @IsOptional()
  @Latitude()
  lat?: number;

  @ApiPropertyOptional({ description: 'Longitud', example: -58.5 })
  @IsOptional()
  @Longitude()
  lng?: number;

  @ApiPropertyOptional({
    description:
      'Reclamo de M2 que originó el expediente. Si no viene, es una detección de oficio y no se proyecta nada hacia M2.',
    example: 'TCK-2026-004821',
    maxLength: 64,
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  ticketId?: string;

  @ApiPropertyOptional({
    description: 'Prioridad asignada al expediente',
    enum: Severity,
    example: Severity.HIGH,
  })
  @IsOptional()
  @IsEnum(Severity)
  priority?: Severity;
}
