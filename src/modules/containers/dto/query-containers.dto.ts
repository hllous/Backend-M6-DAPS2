import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { ContainerType, ContainerStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../../common/dto';

export class QueryContainersDto extends PaginationQueryDto {
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
    description: 'Buscar por dirección (coincidencia parcial)',
    example: 'Rivadavia',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
