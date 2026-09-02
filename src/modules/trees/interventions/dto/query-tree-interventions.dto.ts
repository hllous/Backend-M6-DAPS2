import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { TreeInterventionType, TreeInterventionStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../../../common/dto';

export class QueryTreeInterventionsDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filtrar por tipo de intervención',
    enum: TreeInterventionType,
    example: TreeInterventionType.SAFETY_PRUNING,
  })
  @IsOptional()
  @IsEnum(TreeInterventionType)
  interventionType?: TreeInterventionType;

  @ApiPropertyOptional({
    description: 'Filtrar por estado de la intervención',
    enum: TreeInterventionStatus,
    example: TreeInterventionStatus.REQUESTED,
  })
  @IsOptional()
  @IsEnum(TreeInterventionStatus)
  status?: TreeInterventionStatus;
}
