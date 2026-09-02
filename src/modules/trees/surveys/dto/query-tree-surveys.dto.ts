import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { TreeHealthStatus, RiskLevel } from '@prisma/client';
import { PaginationQueryDto } from '../../../../common/dto';

export class QueryTreeSurveysDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filtrar por estado sanitario',
    enum: TreeHealthStatus,
    example: TreeHealthStatus.DISEASED,
  })
  @IsOptional()
  @IsEnum(TreeHealthStatus)
  healthStatus?: TreeHealthStatus;

  @ApiPropertyOptional({
    description: 'Filtrar por nivel de riesgo',
    enum: RiskLevel,
    example: RiskLevel.HIGH,
  })
  @IsOptional()
  @IsEnum(RiskLevel)
  riskLevel?: RiskLevel;
}
