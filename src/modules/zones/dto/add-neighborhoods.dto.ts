import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, ArrayNotEmpty, IsArray } from 'class-validator';

export class AddNeighborhoodsDto {
  @ApiProperty({
    description: 'IDs de barrios a asignar a la zona (catálogo de M9)',
    example: ['barrio-palermo', 'barrio-belgrano'],
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  neighborhoodIds: string[];
}
