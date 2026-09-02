import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EnvironmentalReportType, Severity } from '@prisma/client';
import { IsEnum, IsLatitude, IsLongitude, IsOptional, IsString, MaxLength } from 'class-validator';

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

  @ApiPropertyOptional({ description: 'Latitud', example: -34.7 })
  @IsOptional()
  @IsLatitude()
  lat?: number;

  @ApiPropertyOptional({ description: 'Longitud', example: -58.5 })
  @IsOptional()
  @IsLongitude()
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
