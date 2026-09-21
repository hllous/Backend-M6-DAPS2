import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsArray,
  IsUUID,
  ArrayMaxSize,
  ArrayNotEmpty,
  MaxLength,
} from 'class-validator';
import { ToBoolean, MAX_LIST_SIZE } from '../../../../common/decorators';
import { TreeInterventionType, Severity } from '@prisma/client';

export class CreateTreeInterventionDto {
  @ApiProperty({
    description: 'Tipo de intervención',
    enum: TreeInterventionType,
    example: TreeInterventionType.SAFETY_PRUNING,
  })
  @IsEnum(TreeInterventionType)
  interventionType: TreeInterventionType;

  @ApiProperty({
    maxItems: MAX_LIST_SIZE,
    description: 'UUIDs de los árboles incluidos en esta intervención',
    example: ['f6a7b8c9-d0e1-2345-fghi-678901234567'],
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MAX_LIST_SIZE)
  @IsUUID('4', { each: true })
  treeIds: string[];

  @ApiPropertyOptional({
    description: 'Dirección de referencia para la intervención',
    example: 'Av. del Libertador 4200',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @ApiPropertyOptional({
    description: 'Si la intervención requiere corte de calle (señal para evento a M5)',
    example: false,
    default: false,
  })
  @IsOptional()
  @ToBoolean()
  requiresStreetClosure?: boolean;

  @ApiPropertyOptional({
    description: 'Prioridad de la intervención',
    enum: Severity,
    example: Severity.MEDIUM,
  })
  @IsOptional()
  @IsEnum(Severity)
  priority?: Severity;

  @ApiPropertyOptional({
    description: 'Justificación (obligatorio para REMOVAL, opcional para el resto)',
    example: 'Árbol muerto con riesgo de caída inminente',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  justification?: string;
}
