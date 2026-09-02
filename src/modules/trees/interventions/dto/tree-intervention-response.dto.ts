import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TreeInterventionType, TreeInterventionStatus, Severity } from '@prisma/client';

class InterventionTreeResponseDto {
  @ApiProperty({
    description: 'UUID del árbol incluido',
    example: 'f6a7b8c9-d0e1-2345-fghi-678901234567',
    format: 'uuid',
  })
  treeId: string;
}

export class TreeInterventionResponseDto {
  @ApiProperty({
    description: 'UUID de la intervención',
    example: 'b8c9d0e1-f2a3-4567-hijk-901234567890',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({
    description: 'Tipo de intervención',
    enum: TreeInterventionType,
    example: TreeInterventionType.SAFETY_PRUNING,
  })
  interventionType: TreeInterventionType;

  @ApiProperty({
    description: 'Estado actual de la intervención',
    enum: TreeInterventionStatus,
    example: TreeInterventionStatus.REQUESTED,
  })
  status: TreeInterventionStatus;

  @ApiPropertyOptional({
    description: 'UUID del servicio programado (null hasta que se programe)',
    format: 'uuid',
  })
  serviceId: string | null;

  @ApiPropertyOptional({
    description: 'Dirección de referencia',
    example: 'Av. del Libertador 4200',
  })
  address: string | null;

  @ApiProperty({
    description: 'Si requiere corte de calle',
    example: false,
  })
  requiresStreetClosure: boolean;

  @ApiPropertyOptional({
    description: 'Prioridad',
    enum: Severity,
  })
  priority: Severity | null;

  @ApiPropertyOptional({
    description: 'ID del usuario que autorizó (solo REMOVAL)',
  })
  authorizedByUserId: string | null;

  @ApiPropertyOptional({
    description: 'Fecha de autorización (solo REMOVAL)',
    format: 'date-time',
  })
  authorizedAt: Date | null;

  @ApiPropertyOptional({
    description: 'Justificación',
  })
  justification: string | null;

  @ApiPropertyOptional({
    description: 'Árboles incluidos en la intervención',
    type: [InterventionTreeResponseDto],
  })
  trees?: InterventionTreeResponseDto[];

  @ApiProperty({ description: 'Fecha de creación', format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ description: 'Fecha de última actualización', format: 'date-time' })
  updatedAt: Date;
}
