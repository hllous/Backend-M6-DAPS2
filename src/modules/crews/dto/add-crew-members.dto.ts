import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  ArrayNotEmpty,
  IsString,
  IsNotEmpty,
  ArrayMaxSize,
  MaxLength,
} from 'class-validator';
import { MAX_EXTERNAL_ID_LENGTH, MAX_LIST_SIZE } from '../../../common/decorators';

export class AddCrewMembersDto {
  @ApiProperty({
    description:
      'IDs de usuarios a agregar como miembros de la cuadrilla (usuarios internos de M6)',
    example: ['usr-00010', 'usr-00011', 'usr-00012'],
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
  userIds: string[];
}
