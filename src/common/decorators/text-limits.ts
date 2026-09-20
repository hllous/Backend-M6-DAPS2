import { applyDecorators } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

// Topes de entrada que no salen de una columna VarChar. `search` termina en un
// ILIKE, asi que se acota; los ids externos (M1/M2/M9) no tienen formato fijo:
// los del seed miden hasta ~24 caracteres.
export const MAX_SEARCH_LENGTH = 100;
export const MAX_EXTERNAL_ID_LENGTH = 100;
export const MAX_REASON_LENGTH = 500;
// Notas libres: las columnas son Text, se alinea con `justification`.
export const MAX_NOTES_LENGTH = 2000;
// Listas de ids/enums que terminan en createMany: mas de esto no es un caso real.
export const MAX_LIST_SIZE = 100;

export function SearchText(): PropertyDecorator {
  return applyDecorators(
    ApiPropertyOptional({ maxLength: MAX_SEARCH_LENGTH }),
    IsString(),
    MaxLength(MAX_SEARCH_LENGTH),
  );
}
