import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { ToBoolean } from '../../../common/decorators';
import { VehicleType } from '@prisma/client';
import { PaginationQueryDto } from '../../../common/dto';

export class QueryVehiclesDto extends PaginationQueryDto {
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
