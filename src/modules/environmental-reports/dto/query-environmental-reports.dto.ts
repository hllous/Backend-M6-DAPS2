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
    description: 'Filtrar por el reclamo de M2 que lo originó',
    example: 'TCK-2026-004821',
  })
  @IsOptional()
  @IsString()
  ticketId?: string;

  @ApiPropertyOptional({
    description: 'Buscar por dirección (parcial, case-insensitive)',
    example: 'Cintura',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
