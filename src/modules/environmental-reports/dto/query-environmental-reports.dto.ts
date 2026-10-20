import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateOnly, SearchText, MAX_EXTERNAL_ID_LENGTH } from '../../../common/decorators';
import { EnvironmentalReportStatus, EnvironmentalReportType, Severity } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto';

export class QueryEnvironmentalReportsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filtrar por estado', enum: EnvironmentalReportStatus })
  @IsOptional()
  @IsEnum(EnvironmentalReportStatus)
  status?: EnvironmentalReportStatus;

  @ApiPropertyOptional({ description: 'Filtrar por tipo', enum: EnvironmentalReportType })
  @IsOptional()
  @IsEnum(EnvironmentalReportType)
  reportType?: EnvironmentalReportType;

  @ApiPropertyOptional({ description: 'Filtrar por prioridad', enum: Severity })
  @IsOptional()
  @IsEnum(Severity)
  priority?: Severity;

  @ApiPropertyOptional({
    maxLength: MAX_EXTERNAL_ID_LENGTH,
    description: 'Filtrar por el reclamo de M2 que lo originó (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_EXTERNAL_ID_LENGTH)
  ticketId?: string;

  @ApiPropertyOptional({
    maxLength: MAX_EXTERNAL_ID_LENGTH,
    description: 'Filtrar por la referencia humana del reclamo de M2 (coincidencia exacta)',
    example: 'TK-2026-000123',
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_EXTERNAL_ID_LENGTH)
  publicId?: string;

  @ApiPropertyOptional({
    description:
      'Filtrar los expedientes con alguna inspección cuyo servicio vigente tenga esta cuadrilla (no solo la más reciente; los servicios CANCELLED no cuentan)',
    example: 'e5f6a7b8-c9d0-4234-8fab-345678901234',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  crewId?: string;

  @ApiPropertyOptional({
    description:
      'Actualizados desde este día, inclusive (YYYY-MM-DD, día argentino UTC-3). Filtra por la fecha de última actualización («Actualizado» de la cola)',
    example: '2026-09-01',
    format: 'date',
  })
  @IsOptional()
  @IsDateOnly()
  from?: string;

  @ApiPropertyOptional({
    description:
      'Actualizados hasta este día, inclusive: hasta las 23:59:59 ART (YYYY-MM-DD). No puede ser anterior a `from`',
    example: '2026-09-30',
    format: 'date',
  })
  @IsOptional()
  @IsDateOnly()
  to?: string;

  @ApiPropertyOptional({
    description: 'Buscar por dirección (parcial, case-insensitive)',
    example: 'Cintura',
  })
  @IsOptional()
  @SearchText()
  search?: string;
}
