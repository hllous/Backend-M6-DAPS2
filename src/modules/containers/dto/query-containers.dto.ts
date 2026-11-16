import { ApiPropertyOptional } from '@nestjs/swagger';
import { SearchText } from '../../../common/decorators';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ContainerType, ContainerStatus } from '@prisma/client';
import { SortablePaginationQueryDto, SortField } from '../../../common/dto';

export const CONTAINERS_SORT_FIELDS = [
  'code',
  'containerType',
  'status',
  'capacityLiters',
  'createdAt',
] as const;

export class QueryContainersDto extends SortablePaginationQueryDto {
  @SortField(CONTAINERS_SORT_FIELDS, 'code')
  sort?: (typeof CONTAINERS_SORT_FIELDS)[number];

  @ApiPropertyOptional({
    description: 'Filtrar por estado del contenedor',
    enum: ContainerStatus,
    example: ContainerStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(ContainerStatus)
  status?: ContainerStatus;

  @ApiPropertyOptional({
    description: 'Filtrar por tipo de contenedor',
    enum: ContainerType,
    example: ContainerType.HOUSEHOLD,
  })
  @IsOptional()
  @IsEnum(ContainerType)
  containerType?: ContainerType;

  @ApiPropertyOptional({
    description: 'Filtrar por zona operativa',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  zoneId?: string;

  @ApiPropertyOptional({
    description: 'Buscar por código o dirección (coincidencia parcial, case-insensitive)',
    example: 'Rivadavia',
  })
  @IsOptional()
  @SearchText()
  search?: string;
}
