import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EnvironmentalReportStatus, EnvironmentalReportType, Severity } from '@prisma/client';

export class EnvironmentalReportResponseDto {
  @ApiProperty({ description: 'UUID del expediente', format: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Tipo de denuncia', enum: EnvironmentalReportType })
  reportType: EnvironmentalReportType;

  @ApiProperty({ description: 'Estado del expediente', enum: EnvironmentalReportStatus })
  status: EnvironmentalReportStatus;

  @ApiPropertyOptional({ description: 'Dirección denunciada', nullable: true })
  address: string | null;

  @ApiPropertyOptional({ description: 'Latitud', nullable: true })
  lat: number | null;

  @ApiPropertyOptional({ description: 'Longitud', nullable: true })
  lng: number | null;

  @ApiPropertyOptional({
    description: 'Reclamo de M2 que lo originó. Null si es una detección de oficio.',
    nullable: true,
  })
  ticketId: string | null;

  @ApiPropertyOptional({ description: 'Prioridad', enum: Severity, nullable: true })
  priority: Severity | null;

  @ApiPropertyOptional({
    description:
      'Fecha límite para que M4 resuelva el acta. Al vencer, el expediente cierra sin sanción: M4 no publica nada cuando decide que no corresponde castigo.',
    format: 'date-time',
    nullable: true,
  })
  deadlineAt: Date | null;

  @ApiProperty({ description: 'Fecha de creación', format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ description: 'Fecha de última actualización', format: 'date-time' })
  updatedAt: Date;
}
