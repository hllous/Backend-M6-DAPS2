import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { VehicleType } from '@prisma/client';
import { PaginationQueryDto } from '../../../common/dto';

export class QueryVehiclesDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filtrar por estado activo/inactivo',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
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
