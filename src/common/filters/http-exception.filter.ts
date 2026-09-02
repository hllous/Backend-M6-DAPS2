import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

/**
 * Filtro global de excepciones HTTP.
 * Normaliza la respuesta de error al formato definido en
 * docs/api/estandar-swagger.md §5.3:
 *
 * {
 *   statusCode: number,
 *   message: string,
 *   error: string,
 *   timestamp: string,
 *   path: string
 * }
 */

/** 'NOT_FOUND' → 'Not Found'. El estándar pide la frase, no la constante. */
function reasonPhrase(status: number): string {
  const name = HttpStatus[status];
  if (!name) return 'Internal Server Error';
  return name
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Errores de Prisma que llegan sin traducir desde un servicio.
 *
 * Los servicios mapean a mano los casos con mensaje propio (P2002 en un código
 * duplicado, P2003 en una zona inexistente). Este mapeo es la red: sin él, un
 * P2025 —el registro desaparece entre el ensureExists() y el update()— sale
 * como 500 en vez de 404.
 */
const PRISMA_STATUS: Record<string, { status: HttpStatus; message: string }> = {
  P2025: {
    status: HttpStatus.NOT_FOUND,
    message: 'El registro solicitado no existe',
  },
  P2002: {
    status: HttpStatus.CONFLICT,
    message: 'Ya existe un registro con ese valor único',
  },
  P2003: {
    status: HttpStatus.NOT_FOUND,
    message: 'Una de las entidades referenciadas no existe',
  },
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Error interno del servidor';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const resp = exceptionResponse as Record<string, unknown>;
        message = (resp.message as string) || message;

        // class-validator devuelve un array de mensajes
        if (Array.isArray(resp.message)) {
          message = (resp.message as string[]).join('; ');
        }
      }

      error = reasonPhrase(status);
    } else if (
      exception instanceof Prisma.PrismaClientKnownRequestError &&
      PRISMA_STATUS[exception.code]
    ) {
      const mapped = PRISMA_STATUS[exception.code];
      status = mapped.status;
      message = mapped.message;
      error = reasonPhrase(status);
    } else {
      // Error no controlado — loguear para debugging
      this.logger.error(
        `Unhandled exception: ${exception}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(status).json({
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
