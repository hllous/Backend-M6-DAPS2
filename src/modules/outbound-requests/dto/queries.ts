import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  RepairDamageType,
  RepairRequestStatus,
  Severity,
  StreetClosureRequestStatus,
} from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto';

export class QueryRepairRequestsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filtrar por estado', enum: RepairRequestStatus })
  @IsOptional()
  @IsEnum(RepairRequestStatus)
  status?: RepairRequestStatus;

  @ApiPropertyOptional({ description: 'Filtrar por tipo de daño', enum: RepairDamageType })
  @IsOptional()
  @IsEnum(RepairDamageType)
  damageType?: RepairDamageType;

  @ApiPropertyOptional({ description: 'Filtrar por gravedad', enum: Severity })
  @IsOptional()
  @IsEnum(Severity)
  severity?: Severity;

  @ApiPropertyOptional({
    description: 'Filtrar por el servicio o inspección que lo detectó',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  detectedInId?: string;
}

export class QueryStreetClosureRequestsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filtrar por estado', enum: StreetClosureRequestStatus })
  @IsOptional()
  @IsEnum(StreetClosureRequestStatus)
  status?: StreetClosureRequestStatus;

  @ApiPropertyOptional({
    description: 'Filtrar por el servicio o intervención que lo origina',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  sourceId?: string;
}
