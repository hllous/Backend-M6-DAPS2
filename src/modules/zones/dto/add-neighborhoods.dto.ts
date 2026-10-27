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
    example: ['7c9e6679-7425-40de-944b-e07fc1f90ae7', '0b8f1a52-3c4d-4e6f-9a1b-2c3d4e5f6a7b'],
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
