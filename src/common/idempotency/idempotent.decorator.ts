import { applyDecorators, UseInterceptors } from '@nestjs/common';
import { ApiHeader, ApiResponse } from '@nestjs/swagger';
import { ErrorResponseDto } from '../dto';
import { IdempotencyInterceptor } from './idempotency.interceptor';

/**
 * Habilita `Idempotency-Key` opcional en un POST de creación (ADR-013).
 * Swagger (desde la v12) concatena las descripciones de un mismo status: los
 * `@ApiResponse` propios del endpoint (409/422) se suman a los genéricos de acá.
 * Va como último decorador del handler para que el genérico quede primero.
 */
export const Idempotent = () =>
  applyDecorators(
    UseInterceptors(IdempotencyInterceptor),
    ApiHeader({
      name: 'Idempotency-Key',
      required: false,
      description:
        'Opcional. 1 a 255 caracteres imprimibles (se recomienda un UUID por intento de creación). ' +
        'Repetir la misma clave con el mismo cuerpo devuelve la respuesta original (mismo status y cuerpo, ' +
        'header Idempotency-Replayed: true) sin crear nada de nuevo. Misma clave con otro cuerpo: 422. ' +
        'Misma clave mientras la primera sigue en curso: 409. Solo se guardan respuestas 2xx; la clave vale 24 h. ' +
        'Clave con formato inválido: 400.',
      schema: { type: 'string', minLength: 1, maxLength: 255 },
    }),
    ApiResponse({
      status: 409,
      description:
        'Conflicto de estado o duplicado; con Idempotency-Key, también si la primera solicitud sigue en curso',
      type: ErrorResponseDto,
    }),
    ApiResponse({
      status: 422,
      description: 'La Idempotency-Key ya se usó con un cuerpo distinto',
      type: ErrorResponseDto,
    }),
  );
