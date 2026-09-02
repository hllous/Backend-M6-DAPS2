import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ServiceCategory, ServiceMode } from '@prisma/client';
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateServiceTypeDto {
  @ApiProperty({
    description: 'Código único del tipo de servicio',
    example: 'REC-DOM',
    maxLength: 20,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code: string;

  @ApiProperty({
    description: 'Nombre descriptivo del tipo de servicio',
    example: 'Recolección domiciliaria',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Área operativa a la que pertenece el tipo de servicio',
    enum: ServiceCategory,
    example: ServiceCategory.WASTE_COLLECTION,
  })
  @IsEnum(ServiceCategory)
  category: ServiceCategory;

  @ApiProperty({
    description:
      'Modo de ejecución. ROUTE se programa sobre un recorrido de zonas; POINT sobre un bien del inventario o una ubicación puntual.',
    enum: ServiceMode,
    example: ServiceMode.ROUTE,
  })
  @IsEnum(ServiceMode)
  mode: ServiceMode;

  @ApiPropertyOptional({
    description: 'Si la programación de este tipo de servicio exige asignar un vehículo',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  requiresVehicle?: boolean;

  @ApiPropertyOptional({
    description: 'Si el tipo de servicio está disponible para programar',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
