import { applyDecorators } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from './pagination-query.dto';

export const SORT_ORDERS = ['asc', 'desc'] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];

/**
 * Valida `sort` contra la lista cerrada del recurso. Lista cerrada y no texto
 * libre: el valor termina como clave de `orderBy` de Prisma, y solo deben poder
 * pedirse columnas visibles en la respuesta.
 */
export const SortField = (fields: readonly string[], example: string) =>
  applyDecorators(
    ApiPropertyOptional({
      enum: fields,
      example,
      description:
        'Campo por el que se ordena todo el resultado (antes de paginar). Sin él se usa el orden por defecto del recurso.',
    }),
    IsOptional(),
    IsIn(fields),
  );

/** Base de los Query DTOs de listados ordenables: suma `order` (y `sort`, que cada recurso valida con `@SortField`). */
export class SortablePaginationQueryDto extends PaginationQueryDto {
  sort?: string;

  @ApiPropertyOptional({
    enum: SORT_ORDERS,
    default: 'asc',
    description: 'Sentido del orden. Sin `sort` aplica al orden por defecto del recurso.',
  })
  @IsOptional()
  @IsIn(SORT_ORDERS)
  order: SortOrder = 'asc';
}

/** `id` desempata para que la paginación sea estable entre páginas. Sin `sort` ni `order` el resultado es el orden por defecto del recurso. */
export function buildOrderBy(
  query: { sort?: string; order?: SortOrder },
  defaultField: string,
): Record<string, SortOrder>[] {
  const order = query.order ?? 'asc';
  return [{ [query.sort ?? defaultField]: order }, { id: order }];
}
