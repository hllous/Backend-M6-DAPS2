import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  ArrayNotEmpty,
  IsArray,
  ArrayMaxSize,
  MaxLength,
} from 'class-validator';
import { MAX_EXTERNAL_ID_LENGTH, MAX_LIST_SIZE } from '../../../common/decorators';

export class AddNeighborhoodsDto {
  @ApiProperty({
    description: 'IDs de barrios a asignar a la zona (catálogo de M9)',
    example: ['barrio-palermo', 'barrio-belgrano'],
    type: 'array',
    items: { type: 'string', maxLength: MAX_EXTERNAL_ID_LENGTH },
    maxItems: MAX_LIST_SIZE,
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MAX_LIST_SIZE)
  @IsString({ each: true })
  @MaxLength(MAX_EXTERNAL_ID_LENGTH, { each: true })
  @IsNotEmpty({ each: true })
  neighborhoodIds: string[];
}
