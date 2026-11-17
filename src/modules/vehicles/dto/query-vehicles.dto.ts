import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { ToBoolean } from '../../../common/decorators';
import { VehicleType } from '@prisma/client';
import { SortablePaginationQueryDto, SortField } from '../../../common/dto';

export const VEHICLES_SORT_FIELDS = [
  'plate',
  'vehicleType',
  'capacity',
  'active',
  'createdAt',
] as const;

export class QueryVehiclesDto extends SortablePaginationQueryDto {
  @SortField(VEHICLES_SORT_FIELDS, 'plate')
  sort?: (typeof VEHICLES_SORT_FIELDS)[number];

  @ApiPropertyOptional({
    description: 'Filtrar por estado activo/inactivo',
    example: true,
  })
  @IsOptional()
  @ToBoolean()
  active?: boolean;

  @ApiPropertyOptional({
    description: 'Filtrar por tipo de vehículo',
    enum: VehicleType,
    example: VehicleType.COMPACTOR_TRUCK,
  })
  @IsOptional()
  @IsEnum(VehicleType)
  vehicleType?: VehicleType;
}
