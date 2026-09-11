import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EnvironmentalReportType, ServiceCategory, WasteType } from '@prisma/client';

/**
 * La etapa que ve el vecino.
 *
 * Los once `EnvironmentalReportStatus` son vocabulario interno: distinguen
 * cosas que le importan al inspector y al supervisor, no al denunciante. Acá se
 * colapsan a siete etapas que se pueden leer sin conocer el procedimiento.
 */
export enum PublicReportStage {
  RECIBIDA = 'RECIBIDA',
  EN_ANALISIS = 'EN_ANALISIS',
  INSPECCION_PROGRAMADA = 'INSPECCION_PROGRAMADA',
  INSPECCIONADA = 'INSPECCIONADA',
  EN_TRAMITE_SANCIONATORIO = 'EN_TRAMITE_SANCIONATORIO',
  DERIVADA = 'DERIVADA',
  CERRADA = 'CERRADA',
}

export class PublicReportResponseDto {
  @ApiProperty({
    description: 'Reclamo de M2 (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  ticketId: string;

  @ApiPropertyOptional({
    description: 'Referencia humana del reclamo de M2, para mostrar. Null si M2 no la envió',
    example: 'TK-2026-000123',
    nullable: true,
  })
  publicId: string | null;

  @ApiProperty({ enum: EnvironmentalReportType, description: 'Tipo de denuncia ambiental' })
  reportType: EnvironmentalReportType;

  @ApiProperty({ enum: PublicReportStage, description: 'Etapa del trámite' })
  stage: PublicReportStage;

  @ApiProperty({
    description: 'La etapa explicada en una frase, lista para mostrar',
    example: 'Un inspector ya visitó el lugar y estamos evaluando lo que encontró.',
  })
  stageLabel: string;

  @ApiPropertyOptional({ description: 'Dirección denunciada', example: 'Av. Rivadavia 4500' })
  address: string | null;

  @ApiProperty({ description: 'Cuándo se abrió el expediente' })
  openedAt: Date;

  @ApiProperty({ description: 'Última novedad del expediente' })
  lastUpdateAt: Date;

  @ApiPropertyOptional({
    description: 'Fecha de la inspección, si ya se realizó. Sin hallazgos ni inspector',
  })
  inspectedAt: Date | null;

  @ApiProperty({ description: 'Si el trámite ya terminó' })
  closed: boolean;
}

export class PublicServiceResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Tipo de servicio', example: 'Recolección domiciliaria' })
  serviceTypeName: string;

  @ApiProperty({ enum: ServiceCategory })
  category: ServiceCategory;

  @ApiProperty({ description: 'Fecha programada', example: '2026-09-15' })
  scheduledDate: Date;

  @ApiPropertyOptional({ description: 'Desde qué hora', example: '06:00' })
  windowFrom: string | null;

  @ApiPropertyOptional({ description: 'Hasta qué hora', example: '10:00' })
  windowTo: string | null;

  @ApiProperty({
    description: 'Estado en lenguaje del vecino: PROGRAMADO, EN_CURSO, REALIZADO o REPROGRAMADO',
    example: 'PROGRAMADO',
  })
  stage: string;

  @ApiProperty({ description: 'Zonas por las que pasa', type: [String] })
  zones: string[];
}

export class PublicGreenPointResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'PV-014' })
  code: string;

  @ApiProperty({ example: 'Punto Verde Plaza Mitre' })
  name: string;

  @ApiPropertyOptional({ example: 'Av. Mitre 1200' })
  address: string | null;

  @ApiPropertyOptional({ example: -34.6037 })
  lat: number | null;

  @ApiPropertyOptional({ example: -58.3816 })
  lng: number | null;

  @ApiProperty({ description: 'Zona operativa', example: 'Centro' })
  zoneName: string;

  @ApiProperty({ enum: WasteType, isArray: true, description: 'Qué residuos recibe' })
  wasteTypes: WasteType[];
}

export class PublicZoneResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Z-CENTRO' })
  code: string;

  @ApiProperty({ example: 'Centro' })
  name: string;
}
