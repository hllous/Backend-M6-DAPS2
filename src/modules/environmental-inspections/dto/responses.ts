import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  InspectionNextStep,
  InspectionOutcome,
  Severity,
  SuggestedAction,
  ViolationType,
} from '@prisma/client';

export class ChecklistItemResponseDto {
  @ApiProperty({ description: 'UUID del ítem', format: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Código del ítem', example: 'RES-01' })
  itemCode: string;

  @ApiProperty({ description: 'Qué se verifica' })
  label: string;

  @ApiProperty({ description: 'Si el ítem se cumple' })
  result: boolean;

  @ApiPropertyOptional({ description: 'Observaciones', nullable: true })
  observations: string | null;
}

export class InspectionResponseDto {
  @ApiProperty({ description: 'UUID de la inspección', format: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Expediente al que pertenece', format: 'uuid' })
  reportId: string;

  @ApiPropertyOptional({
    description: 'Servicio que la ejecuta. Null hasta que se asocia.',
    format: 'uuid',
    nullable: true,
  })
  serviceId: string | null;

  @ApiPropertyOptional({
    description: 'Inspector asignado. **Interno: nunca sale hacia M2.**',
    nullable: true,
  })
  inspectorId: string | null;

  @ApiPropertyOptional({
    description: 'Cuándo se realizó',
    format: 'date-time',
    nullable: true,
  })
  inspectedAt: Date | null;

  @ApiPropertyOptional({
    description: 'Qué encontró el inspector. **Interno: nunca sale hacia M2.**',
    nullable: true,
  })
  findings: string | null;

  @ApiPropertyOptional({ description: 'Resultado', enum: InspectionOutcome, nullable: true })
  outcome: InspectionOutcome | null;

  @ApiPropertyOptional({ description: 'Paso siguiente', enum: InspectionNextStep, nullable: true })
  nextStep: InspectionNextStep | null;

  @ApiPropertyOptional({
    description: 'Checklist relevado. **Interno: nunca sale hacia M2.**',
    type: [ChecklistItemResponseDto],
  })
  checklistItems?: ChecklistItemResponseDto[];

  @ApiProperty({ description: 'Fecha de creación', format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ description: 'Fecha de última actualización', format: 'date-time' })
  updatedAt: Date;
}

export class ViolationNoticeResponseDto {
  @ApiProperty({ description: 'UUID del acta', format: 'uuid' })
  id: string;

  @ApiProperty({
    description: 'Número de acta correlativo. Es lo que identifica el acto administrativo.',
    example: 'ACTA-2026-000012',
  })
  noticeNumber: string;

  @ApiProperty({ description: 'Inspección que la fundamenta', format: 'uuid' })
  inspectionId: string;

  @ApiProperty({ description: 'Cuándo se emitió', format: 'date-time' })
  issuedAt: Date;

  @ApiPropertyOptional({
    description:
      'Establecimiento de M4. Si es null el acta no se derivó y el expediente cierra de nuestro lado.',
    nullable: true,
  })
  establishmentId: string | null;

  @ApiProperty({ description: 'Tipo de infracción', enum: ViolationType })
  violationType: ViolationType;

  @ApiProperty({ description: 'Gravedad', enum: Severity })
  severity: Severity;

  @ApiProperty({
    description: 'Acción sugerida a M4. No vinculante.',
    enum: SuggestedAction,
  })
  suggestedAction: SuggestedAction;

  @ApiProperty({
    description:
      'Actas previas al mismo establecimiento en nuestro histórico. Le adelanta la reincidencia a M4.',
    example: 2,
  })
  priorNoticeCount: number;

  @ApiProperty({ description: 'Fecha de creación', format: 'date-time' })
  createdAt: Date;
}
