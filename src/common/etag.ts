import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  PreconditionFailedException,
  applyDecorators,
  createParamDecorator,
} from '@nestjs/common';
import { ApiHeader, ApiResponse } from '@nestjs/swagger';
import { DECORATORS } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ErrorResponseDto } from './dto';

/**
 * Concurrencia optimista (ADR-012). El ETag es débil y sale de `updatedAt`
 * (Prisma lo actualiza en cada escritura, con precisión de milisegundos), así
 * que no hace falta una columna de versión.
 */
export function etagOf(updatedAt: Date): string {
  return `W/"${updatedAt.getTime()}"`;
}

/** `*` es "cualquier versión": equivale a no mandar el header. */
export function isConditional(ifMatch: string | undefined): ifMatch is string {
  return ifMatch !== undefined && ifMatch.trim() !== '*';
}

export function preconditionFailed(): PreconditionFailedException {
  return new PreconditionFailedException(
    'El recurso cambió desde que se leyó (If-Match no coincide con el ETag actual); volver a leerlo y reintentar',
  );
}

/**
 * Valida `If-Match` contra la fila ya leída y devuelve el fragmento de `where`
 * que hace atómica la escritura: `updatedAt` se vuelve parte del UPDATE, así que
 * si otro request escribió entre la lectura y acá, el UPDATE no encuentra fila
 * (P2025) y el service lo traduce a 412 con `isConditional` + `preconditionFailed`.
 * Sin header (o con `*`) devuelve `{}`: el comportamiento de siempre.
 *
 * Comparación débil (se ignora `W/`), y acepta una lista separada por comas.
 */
export function ifMatchWhere(
  ifMatch: string | undefined,
  current: { updatedAt: Date },
): { updatedAt?: Date } {
  if (!isConditional(ifMatch)) return {};
  const actual = etagOf(current.updatedAt).replace(/^W\//, '');
  const matches = ifMatch.split(',').some((e) => e.trim().replace(/^W\//, '') === actual);
  if (!matches) throw preconditionFailed();
  return { updatedAt: current.updatedAt };
}

/** El header `If-Match` del request, tal cual vino (lo valida `ifMatchWhere`). */
export const IfMatch = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const value = ctx.switchToHttp().getRequest<Request>().headers['if-match'];
  return Array.isArray(value) ? value.join(',') : value;
});

/**
 * Pone `ETag` en toda respuesta que sea el recurso de `:id` (el cuerpo trae el
 * mismo `id` que la ruta). El cuerpo de un listado o de un sub-recurso no
 * cumple eso y queda sin header.
 */
@Injectable()
export class ETagInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const { params } = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    return next.handle().pipe(
      tap((body: unknown) => {
        const b = body as { id?: unknown; updatedAt?: unknown } | null;
        if (b?.updatedAt instanceof Date && b.id === params?.id) {
          res.setHeader('ETag', etagOf(b.updatedAt));
        }
      }),
    );
  }
}

const ETAG_HEADER = {
  ETag: {
    description: 'Versión actual del recurso (débil, derivada de updatedAt). Mandarla en If-Match.',
    schema: { type: 'string', example: 'W/"1760000000000"' },
  },
};

/**
 * Documenta el ETag en las respuestas 2xx y, con `ifMatch`, el header `If-Match`
 * opcional y el 412. Va ARRIBA de los `@ApiResponse` del método: Swagger se queda
 * con el último decorador por status, así que acá se lee lo ya declarado y se le
 * agrega el header en vez de pisarlo.
 */
export function ApiETag({ ifMatch = false } = {}): MethodDecorator {
  const addHeader: MethodDecorator = (_target, _key, descriptor) => {
    const fn = descriptor.value as object;
    const responses: Record<string, object> =
      Reflect.getMetadata(DECORATORS.API_RESPONSE, fn) ?? {};
    const merged = Object.fromEntries(
      Object.entries(responses).map(([status, r]) => [
        status,
        status.startsWith('2') ? { ...r, headers: ETAG_HEADER } : r,
      ]),
    );
    Reflect.defineMetadata(DECORATORS.API_RESPONSE, merged, fn);
  };
  return applyDecorators(
    addHeader,
    ...(ifMatch
      ? [
          ApiHeader({
            name: 'If-Match',
            required: false,
            description:
              'ETag que el cliente leyó (o `*`). Si no coincide con el actual responde 412 y no escribe nada. Sin el header, la acción se aplica como siempre.',
            example: 'W/"1760000000000"',
          }),
          ApiResponse({
            status: 412,
            description: 'If-Match no coincide con el ETag actual: el recurso cambió',
            type: ErrorResponseDto,
          }),
        ]
      : []),
  );
}
