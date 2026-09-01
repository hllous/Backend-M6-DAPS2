import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  TreeHealthStatus,
  RiskLevel,
  RiskType,
  TreeInterventionType,
} from '@prisma/client';

export class TreeSurveyResponseDto {
  @ApiProperty({
    description: 'UUID del relevamiento',
    example: 'a7b8c9d0-e1f2-3456-ghij-890123456789',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({
    description: 'UUID del árbol relevado',
    example: 'f6a7b8c9-d0e1-2345-fghi-678901234567',
    format: 'uuid',
  })
  treeId: string;

  @ApiProperty({
    description: 'Fecha y hora del relevamiento',
    example: '2026-08-15T09:30:00.000Z',
    format: 'date-time',
  })
  surveyedAt: Date;

  @ApiPropertyOptional({
    description: 'ID del inspector',
    example: 'usr-00015',
  })
  inspectorId: string | null;

  @ApiProperty({
    description: 'Estado sanitario del árbol',
    enum: TreeHealthStatus,
    example: TreeHealthStatus.HEALTHY,
  })
  healthStatus: TreeHealthStatus;

  @ApiProperty({
    description: 'Nivel de riesgo evaluado',
    enum: RiskLevel,
    example: RiskLevel.LOW,
  })
  riskLevel: RiskLevel;

  @ApiPropertyOptional({
    description: 'Tipo de riesgo detectado',
    enum: RiskType,
  })
  riskType: RiskType | null;

  @ApiPropertyOptional({
    description: 'Intervención sugerida',
    enum: TreeInterventionType,
  })
  suggestedIntervention: TreeInterventionType | null;

  @ApiProperty({ description: 'Si requiere corte de calle', example: false })
  requiresStreetClosure: boolean;

  @ApiProperty({ description: 'Si requiere derivación a Obras Públicas', example: false })
  requiresPublicWorks: boolean;

  @ApiPropertyOptional({ description: 'Notas del inspector' })
  notes: string | null;

  @ApiProperty({ description: 'Fecha de creación del registro', format: 'date-time' })
  createdAt: Date;
}
