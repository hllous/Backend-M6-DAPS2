import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  InspectionNextStep,
  InspectionOutcome,
  Severity,
  SuggestedAction,
  ViolationType,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class CreateInspectionDto {
  @ApiPropertyOptional({
    description:
      'Servicio que la ejecuta. La inspección guarda qué se buscó; el servicio, cuándo y con qué cuadrilla. Se puede asociar después.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @ApiPropertyOptional({
    description: 'Inspector asignado. Interno: nunca sale hacia M2.',
    example: 'user-014',
    maxLength: 64,
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  inspectorId?: string;
}

export class ChecklistItemDto {
  @ApiProperty({ description: 'Código del ítem del checklist', example: 'RES-01' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  itemCode: string;

  @ApiProperty({
    description: 'Qué se verifica',
    example: 'Cuenta con plan de gestión de residuos vigente',
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  label: string;

  @ApiProperty({ description: 'Si el ítem se cumple', example: false })
  @IsBoolean()
  result: boolean;

  @ApiPropertyOptional({ description: 'Observaciones del inspector', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observations?: string;
}

export class CompleteInspectionDto {
  @ApiProperty({
    description: 'Fecha y hora en que se realizó la inspección',
    example: '2026-09-10T11:30:00.000Z',
    format: 'date-time',
  })
  @IsDateString()
  inspectedAt: string;

  @ApiProperty({
    description: 'Resultado de la inspección. Determina cómo sigue el expediente.',
    enum: InspectionOutcome,
    example: InspectionOutcome.VIOLATION_FOUND,
  })
  @IsEnum(InspectionOutcome)
  outcome: InspectionOutcome;

  @ApiPropertyOptional({
    description: 'Qué corresponde hacer después',
    enum: InspectionNextStep,
    example: InspectionNextStep.NOTICE_TO_BE_ISSUED,
  })
  @IsOptional()
  @IsEnum(InspectionNextStep)
  nextStep?: InspectionNextStep;

  @ApiPropertyOptional({
    description: 'Qué encontró el inspector. **Interno: nunca sale hacia M2.**',
    example: 'Vertido de efluentes sin tratar al pluvial en el fondo del predio.',
  })
  @IsOptional()
  @IsString()
  findings?: string;

  @ApiPropertyOptional({
    description: 'Checklist relevado. **Interno: nunca sale hacia M2.**',
    type: [ChecklistItemDto],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ChecklistItemDto)
  checklist?: ChecklistItemDto[];
}

export class IssueViolationNoticeDto {
  @ApiProperty({
    description: 'Tipo de infracción constatada',
    enum: ViolationType,
    example: ViolationType.UNTREATED_DISCHARGE,
  })
  @IsEnum(ViolationType)
  violationType: ViolationType;

  @ApiProperty({ description: 'Gravedad de la infracción', enum: Severity, example: Severity.HIGH })
  @IsEnum(Severity)
  severity: Severity;

  @ApiProperty({
    description:
      'Acción sugerida a M4. **No es vinculante**: la decisión sancionatoria es de ellos.',
    enum: SuggestedAction,
    example: SuggestedAction.FINE,
  })
  @IsEnum(SuggestedAction)
  suggestedAction: SuggestedAction;

  @ApiPropertyOptional({
    description:
      'Establecimiento habilitado de M4. **Sin esto el acta no se deriva** y el expediente cierra de nuestro lado: es lo único sobre lo que M4 puede actuar.',
    example: 'EST-004512',
    maxLength: 64,
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  establishmentId?: string;
}
