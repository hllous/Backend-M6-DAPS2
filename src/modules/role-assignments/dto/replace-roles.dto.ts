import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayUnique, IsArray, IsEnum } from 'class-validator';
import { M6_ROLES, M6Role } from '../../../auth/m6-role';

export class ReplaceRolesDto {
  @ApiProperty({
    enum: M6_ROLES,
    isArray: true,
    example: ['M6_OFICINA_OPERACIONES', 'M6_OFICINA_AMBIENTAL'],
    description:
      'Conjunto completo de roles de M6 del usuario: reemplaza al anterior. Vacío equivale a quitarle todos. No se pueden mezclar roles de Oficina (M6_ADMIN, M6_OFICINA_*) con roles de Campo (M6_CAMPO_*)',
  })
  @IsArray()
  @ArrayMaxSize(M6_ROLES.length)
  @ArrayUnique()
  @IsEnum(M6Role, { each: true })
  roles: M6Role[];
}
