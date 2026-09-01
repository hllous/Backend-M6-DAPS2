import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ArrayNotEmpty, IsString, IsNotEmpty } from 'class-validator';

export class AddCrewMembersDto {
  @ApiProperty({
    description: 'IDs de usuarios a agregar como miembros de la cuadrilla (usuarios internos de M6)',
    example: ['usr-00010', 'usr-00011', 'usr-00012'],
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  userIds: string[];
}
