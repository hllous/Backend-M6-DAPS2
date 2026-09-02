import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsUUID, Max, Min, ValidateNested } from 'class-validator';

export class RouteStopInputDto {
  @ApiProperty({
    description: 'UUID de la zona operativa por la que pasa el recorrido',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  @IsUUID()
  zoneId: string;

  @ApiProperty({
    description: 'Duración estimada de la parada, en minutos',
    example: 90,
    minimum: 1,
    maximum: 1440,
  })
  @IsInt()
  @Min(1)
  @Max(1440)
  estimatedDurationMin: number;
}

/**
 * Reemplaza la secuencia completa de paradas del recorrido.
 *
 * Un solo endpoint cubre alta, baja y reordenamiento: el orden del array es
 * el orden del recorrido (`sequence` = índice + 1). Mover una parada de a una
 * chocaría con la restricción `@@unique([routeId, sequence])` a mitad de camino.
 */
export class SetRouteStopsDto {
  @ApiProperty({
    description:
      'Paradas en el orden del recorrido. El array vacío deja el recorrido sin paradas. Una zona no puede repetirse.',
    type: [RouteStopInputDto],
  })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => RouteStopInputDto)
  stops: RouteStopInputDto[];
}
