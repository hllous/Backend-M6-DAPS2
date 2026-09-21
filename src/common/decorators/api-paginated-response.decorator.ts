import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';
import { PaginationMeta } from '../dto/paginated-response.dto';

/**
 * Documenta un listado paginado `{ data: T[], meta }`.
 *
 * `PaginatedResponseDto<T>` es genérico y Swagger no puede inferir `T` de un
 * tipo genérico, por eso el schema se arma acá con el modelo del ítem.
 */
export const ApiPaginatedResponse = <T extends Type<unknown>>(model: T, description: string) =>
  applyDecorators(
    ApiExtraModels(PaginationMeta, model),
    ApiOkResponse({
      description,
      schema: {
        type: 'object',
        required: ['data', 'meta'],
        properties: {
          data: { type: 'array', items: { $ref: getSchemaPath(model) } },
          meta: { $ref: getSchemaPath(PaginationMeta) },
        },
      },
    }),
  );
