import { ApiPropertyOptional } from '@nestjs/swagger';
import { SearchText, MAX_EXTERNAL_ID_LENGTH } from '../../../common/decorators';
import { EnvironmentalReportStatus, EnvironmentalReportType, Severity } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
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
    description: 'Buscar por dirección (parcial, case-insensitive)',
    example: 'Cintura',
  })
  @IsOptional()
  @SearchText()
  search?: string;
}
