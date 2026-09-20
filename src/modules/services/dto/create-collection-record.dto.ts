import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WasteType } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsUUID, Min, Max } from 'class-validator';
import { MAX_DECIMAL_10_2 } from '../../../common/decorators/numeric-limits';

export class CreateCollectionRecordDto {
  @ApiProperty({
    description: 'Tipo de residuo recolectado',
    enum: WasteType,
    example: WasteType.HOUSEHOLD,
  })
  @IsEnum(WasteType)
  wasteType: WasteType;

  @ApiProperty({
    description: 'Sitio de disposición final al que se derivó. Tiene que estar activo.',
    example: 'a7b8c9d0-e1f2-3456-abcd-567890123456',
    format: 'uuid',
  })
  @IsUUID()
  disposalSiteId: string;

  @ApiPropertyOptional({
    description:
      'Resultado de zona al que corresponde. Solo en servicios ROUTE, y tiene que ser del mismo servicio.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  zoneResultId?: string;

  @ApiPropertyOptional({
    description: 'Volumen recolectado en m³',
    example: 12.5,
    minimum: 0,
    maximum: MAX_DECIMAL_10_2,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_DECIMAL_10_2)
  volumeM3?: number;

  @ApiPropertyOptional({
    description: 'Peso recolectado en kg',
    example: 3400.75,
    minimum: 0,
    maximum: MAX_DECIMAL_10_2,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_DECIMAL_10_2)
  weightKg?: number;
}
