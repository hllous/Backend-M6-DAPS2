import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  EnvironmentalReportType,
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

  @ApiPropertyOptional({ description: 'Observaciones', nullable: true, type: String })
  observations: string | null;
}

export class AllowedActionsDto {
  @ApiProperty({
    description:
      'Se puede derivar una reparación a Obras Públicas (M3): el tipo de expediente admite daño de infraestructura y la inspección está cerrada con un resultado distinto de NO_VIOLATION. Aun así, `POST /repair-requests` rechaza con 409 un duplicado abierto.',
    example: false,
  })
  repair: boolean;

  @ApiProperty({
    description:
      'Se puede emitir el acta (POST /environmental-inspections/:id/violation-notice): el tipo de expediente admite acta, el resultado es VIOLATION_FOUND y todavía no se emitió una (el acta es inmutable: una segunda da 409).',
    example: true,
  })
  notice: boolean;

  @ApiProperty({
    description:
      'Tipo de infracción que corresponde al tipo de expediente. Null si no hay uno canónico.',
    enum: ViolationType,
    nullable: true,
  })
  suggestedViolationType: ViolationType | null;
}

export class InspectionResponseDto {
  @ApiProperty({ description: 'UUID de la inspección', format: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Expediente al que pertenece', format: 'uuid' })
  reportId: string;

  @ApiProperty({
    description: 'Tipo del expediente (solo lectura, copiado del expediente)',
    enum: EnvironmentalReportType,
  })
  reportType: EnvironmentalReportType;

  @ApiProperty({
    description: 'Dirección del expediente de origen (solo lectura)',
    nullable: true,
    type: String,
    example: 'Frente a Almte. Guillermo Brown',
  })
  address: string | null;

  @ApiProperty({
    description: 'Latitud del expediente de origen (solo lectura)',
    nullable: true,
    type: Number,
    example: -34.6037,
  })
  lat: number | null;

  @ApiProperty({
    description: 'Longitud del expediente de origen (solo lectura)',
    nullable: true,
    type: Number,
    example: -58.3816,
  })
  lng: number | null;

  @ApiProperty({
    description:
      'Qué se puede derivar a partir de esta inspección hoy, según el tipo de expediente, el resultado y si ya tiene acta. No cubre los duplicados de reparación: eso lo rechaza `POST /repair-requests` con 409.',
    type: AllowedActionsDto,
  })
  allowedActions: AllowedActionsDto;

  @ApiPropertyOptional({
    description: 'Servicio que la ejecuta. Null hasta que se asocia.',
    format: 'uuid',
    nullable: true,
    type: String,
  })
  serviceId: string | null;

  @ApiPropertyOptional({
    description:
      'Inspector que Oficina asignó al programar, si lo hizo. **Interno: nunca sale hacia M2.**',
    nullable: true,
    type: String,
  })
  inspectorId: string | null;

  @ApiPropertyOptional({
    description:
      'Usuario que cerró la inspección (siempre el del token, aunque no sea el asignado). Null hasta que se cierra. **Interno: nunca sale hacia M2.**',
    nullable: true,
    type: String,
  })
  completedByUserId: string | null;

  @ApiPropertyOptional({
    description: 'Cuándo se realizó',
    format: 'date-time',
    nullable: true,
    type: String,
  })
  inspectedAt: Date | null;

  @ApiPropertyOptional({
    description: 'Qué encontró el inspector. **Interno: nunca sale hacia M2.**',
    nullable: true,
    type: String,
  })
  findings: string | null;

  @ApiPropertyOptional({ description: 'Resultado', enum: InspectionOutcome, nullable: true })
  outcome: InspectionOutcome | null;

  @ApiPropertyOptional({ description: 'Paso siguiente', enum: InspectionNextStep, nullable: true })
  nextStep: InspectionNextStep | null;

  @ApiPropertyOptional({
    description: 'Conclusión del inspector. **Interno: nunca sale hacia M2.**',
    nullable: true,
    type: String,
  })
  conclusion: string | null;

  @ApiPropertyOptional({ description: 'Tipo de infracción', enum: ViolationType, nullable: true })
  violationType: ViolationType | null;

  @ApiPropertyOptional({ description: 'Gravedad', enum: Severity, nullable: true })
  severity: Severity | null;

  @ApiPropertyOptional({
    description: 'Acción sugerida por el inspector',
    enum: SuggestedAction,
    nullable: true,
  })
  suggestedAction: SuggestedAction | null;

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
    type: String,
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
