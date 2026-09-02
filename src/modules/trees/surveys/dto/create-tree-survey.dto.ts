import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsBoolean, IsString, IsDateString, MaxLength } from 'class-validator';
import { TreeHealthStatus, RiskLevel, RiskType, TreeInterventionType } from '@prisma/client';

export class CreateTreeSurveyDto {
  @ApiProperty({
    description: 'Fecha y hora del relevamiento fitosanitario',
    example: '2026-08-15T09:30:00.000Z',
    format: 'date-time',
  })
  @IsDateString()
  surveyedAt: string;

  @ApiProperty({
    description: 'Estado sanitario del árbol',
    enum: TreeHealthStatus,
    example: TreeHealthStatus.HEALTHY,
  })
  @IsEnum(TreeHealthStatus)
  healthStatus: TreeHealthStatus;

  @ApiProperty({
    description: 'Nivel de riesgo evaluado',
    enum: RiskLevel,
    example: RiskLevel.LOW,
  })
  @IsEnum(RiskLevel)
  riskLevel: RiskLevel;

  @ApiPropertyOptional({
    description: 'Tipo de riesgo detectado (requerido si riskLevel >= HIGH)',
    enum: RiskType,
    example: RiskType.FALLING_BRANCH,
  })
  @IsOptional()
  @IsEnum(RiskType)
  riskType?: RiskType;

  @ApiPropertyOptional({
    description: 'Intervención sugerida por el inspector',
    enum: TreeInterventionType,
    example: TreeInterventionType.SAFETY_PRUNING,
  })
  @IsOptional()
  @IsEnum(TreeInterventionType)
  suggestedIntervention?: TreeInterventionType;

  @ApiPropertyOptional({
    description: 'ID del inspector que realizó el relevamiento (usuario interno M6)',
    example: 'usr-00015',
  })
  @IsOptional()
  @IsString()
  inspectorId?: string;

  @ApiPropertyOptional({
    description: 'Si la intervención sugerida requiere corte de calle (señal para evento a M5)',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  requiresStreetClosure?: boolean;

  @ApiPropertyOptional({
    description: 'Si se detectó daño que involucra infraestructura civil (señal para evento a M3)',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  requiresPublicWorks?: boolean;

  @ApiPropertyOptional({
    description: 'Notas adicionales del inspector',
    example: 'Rama principal con inclinación peligrosa hacia la vereda',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
