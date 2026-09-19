import { ApiPropertyOptional } from '@nestjs/swagger';
import { EnvironmentalReportStatus, EnvironmentalReportType, Severity } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
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
    description: 'Filtrar por el reclamo de M2 que lo originó (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsString()
  ticketId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por la referencia humana del reclamo de M2 (coincidencia exacta)',
    example: 'TK-2026-000123',
  })
  @IsOptional()
  @IsString()
  publicId?: string;

  @ApiPropertyOptional({
    description: 'Buscar por dirección (parcial, case-insensitive)',
    example: 'Cintura',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
