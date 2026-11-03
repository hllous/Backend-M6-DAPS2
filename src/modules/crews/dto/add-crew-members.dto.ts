import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  ArrayNotEmpty,
  IsString,
  IsNotEmpty,
  IsOptional,
  ArrayMaxSize,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  IsM1UserId,
  MAX_EXTERNAL_ID_LENGTH,
  MAX_LIST_SIZE,
  MAX_PERSON_NAME_LENGTH,
  Trim,
} from '../../../common/decorators';

export class CrewMemberInputDto {
  @ApiProperty({
    description: 'Id de M1 (numérico, solo dígitos) del integrante',
    example: '10',
    maxLength: MAX_EXTERNAL_ID_LENGTH,
  })
  @IsString()
  @MaxLength(MAX_EXTERNAL_ID_LENGTH)
  @IsNotEmpty()
  @IsM1UserId()
  userId: string;

  @ApiPropertyOptional({
    description:
      'Nombre del integrante, tal como figura en M1. Se guarda como copia para poder mostrarlo: M6 no consulta a M1',
    example: 'Lucía Fernández',
    maxLength: MAX_PERSON_NAME_LENGTH,
  })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(MAX_PERSON_NAME_LENGTH)
  displayName?: string;
}

/**
 * Hay que mandar `members`, `userIds` o los dos. Cada campo que viene se valida
 * siempre; si falta uno, el otro pasa a ser obligatorio, así el pedido vacío
 * falla con el error del campo. (Condicionar la validación a "el otro no vino"
 * dejaba sin validar uno de los dos cuando venían ambos.)
 */
export class AddCrewMembersDto {
  @ApiPropertyOptional({
    description:
      'Integrantes con su nombre opcional. Hace falta al menos uno de `members` o `userIds`. Si el integrante ya estaba, se le actualiza el nombre cuando viene. Forma recomendada; `userIds` se mantiene por compatibilidad',
    type: [CrewMemberInputDto],
    maxItems: MAX_LIST_SIZE,
  })
  @ValidateIf((o: AddCrewMembersDto) => o.members !== undefined || o.userIds === undefined)
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MAX_LIST_SIZE)
  @ValidateNested({ each: true })
  @Type(() => CrewMemberInputDto)
  members?: CrewMemberInputDto[];

  @ApiPropertyOptional({
    description:
      'Ids de M1 (numéricos, solo dígitos) de los usuarios a agregar como integrantes de la cuadrilla, sin nombre. Hace falta al menos uno de `members` o `userIds`. Es lo que habilita a cada uno a ejecutar los servicios de la cuadrilla',
    example: ['10', '11', '12'],
    type: 'array',
    items: { type: 'string', maxLength: MAX_EXTERNAL_ID_LENGTH },
    maxItems: MAX_LIST_SIZE,
  })
  @ValidateIf((o: AddCrewMembersDto) => o.userIds !== undefined || o.members === undefined)
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MAX_LIST_SIZE)
  @IsString({ each: true })
  @MaxLength(MAX_EXTERNAL_ID_LENGTH, { each: true })
  @IsNotEmpty({ each: true })
  @IsM1UserId(true)
  userIds?: string[];
}
