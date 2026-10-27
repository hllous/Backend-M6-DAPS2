import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  ArrayNotEmpty,
  IsString,
  IsNotEmpty,
  ArrayMaxSize,
  MaxLength,
} from 'class-validator';
import { IsM1UserId, MAX_EXTERNAL_ID_LENGTH, MAX_LIST_SIZE } from '../../../common/decorators';

export class AddCrewMembersDto {
  @ApiProperty({
    description:
      'Ids de M1 (numéricos, solo dígitos) de los usuarios a agregar como integrantes de la cuadrilla. Es lo que habilita a cada uno a ejecutar los servicios de la cuadrilla',
    example: ['10', '11', '12'],
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
  @IsM1UserId(true)
  userIds: string[];
}
