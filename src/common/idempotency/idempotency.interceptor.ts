import { createHash } from 'crypto';
import {
  BadRequestException,
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
  UnprocessableEntityException,
} from '@nestjs/common';
import { IdempotencyStatus, Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { Observable, catchError, from, mergeMap, of, throwError } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';

export const IDEMPOTENCY_HEADER = 'Idempotency-Key';
export const IDEMPOTENCY_REPLAYED_HEADER = 'Idempotency-Replayed';
/** 1 a 255 caracteres ASCII imprimibles. */
export const IDEMPOTENCY_KEY_REGEX = /^[\x20-\x7E]{1,255}$/;
/** Un registro «en curso» más viejo que esto se considera abandonado (caída del proceso) y se puede retomar. */
export const IN_PROGRESS_STALE_MS = 60_000;

/** JSON con las claves ordenadas: el orden de las propiedades del body no cambia la huella. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj)
      .sort()
      .filter((k) => obj[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export function hashBody(body: unknown): string {
  return createHash('sha256')
    .update(canonical(body ?? {}))
    .digest('hex');
}

/**
 * `Idempotency-Key` opcional en los POST de creación (ADR-013). Se activa con
 * `@Idempotent()`. Sin el header no hace nada.
 *
 * Corre antes de los pipes, así que ve el body crudo: un body inválido da 400
 * del `ValidationPipe`, no se guarda (solo se guardan 2xx) y la clave queda
 * libre para reintentar.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request & { user?: { userId?: string } }>();
    const res = http.getResponse<Response>();

    const raw = req.headers[IDEMPOTENCY_HEADER.toLowerCase()];
    if (raw === undefined) return next.handle();
    if (typeof raw !== 'string' || !IDEMPOTENCY_KEY_REGEX.test(raw)) {
      throw new BadRequestException(
        `${IDEMPOTENCY_HEADER} debe tener entre 1 y 255 caracteres imprimibles`,
      );
    }

    // Principal + método + ruta real (con el id): la misma clave en otra ruta o de otro usuario no choca.
    const path = req.originalUrl.split('?')[0];
    const scope = `${req.user?.userId ?? 'anon'}|${req.method}|${path}`;
    const requestHash = hashBody(req.body);

    return from(this.claim(scope, raw, requestHash)).pipe(
      mergeMap((replay) => {
        if (replay) {
          res.setHeader(IDEMPOTENCY_REPLAYED_HEADER, 'true');
          res.status(replay.status);
          return of(replay.body);
        }
        return next.handle().pipe(
          mergeMap((body) => from(this.complete(scope, raw, res.statusCode, body))),
          catchError((err) =>
            // Solo se guardan 2xx: un fallo libera la clave para reintentar.
            from(this.release(scope, raw)).pipe(mergeMap(() => throwError(() => err))),
          ),
        );
      }),
    );
  }

  /** Devuelve la respuesta guardada, o `null` si hay que ejecutar el handler. */
  private async claim(
    scope: string,
    key: string,
    requestHash: string,
  ): Promise<{ status: number; body: unknown } | null> {
    try {
      // El unique (scope, key) resuelve la carrera: solo uno de dos requests concurrentes inserta.
      await this.prisma.idempotencyRecord.create({ data: { scope, key, requestHash } });
      return null;
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
        throw error;
      }
    }

    const existing = await this.prisma.idempotencyRecord.findUnique({
      where: { scope_key: { scope, key } },
    });
    // Lo borró el barrido o un fallo entre el insert y el find: que reintente.
    if (!existing)
      throw new ConflictException('Reintentá la solicitud con la misma Idempotency-Key');

    if (existing.requestHash !== requestHash) {
      throw new UnprocessableEntityException('La Idempotency-Key ya se usó con un cuerpo distinto');
    }
    if (existing.status === IdempotencyStatus.COMPLETED) {
      return { status: existing.responseStatus ?? 200, body: existing.responseBody };
    }

    // En curso. Si es viejo, el proceso que lo tomó cayó: se retoma con un guard
    // por estado y antigüedad para que solo un reintento lo gane.
    const taken = await this.prisma.idempotencyRecord.updateMany({
      where: {
        id: existing.id,
        status: IdempotencyStatus.IN_PROGRESS,
        createdAt: { lt: new Date(Date.now() - IN_PROGRESS_STALE_MS) },
      },
      data: { createdAt: new Date() },
    });
    if (taken.count === 1) return null;
    throw new ConflictException('Hay una solicitud con esta Idempotency-Key todavía en curso');
  }

  private async complete(
    scope: string,
    key: string,
    status: number,
    body: unknown,
  ): Promise<unknown> {
    try {
      await this.prisma.idempotencyRecord.update({
        where: { scope_key: { scope, key } },
        data: {
          status: IdempotencyStatus.COMPLETED,
          responseStatus: status,
          // Lo que viaja por el cable, para que el replay sea idéntico (fechas como string).
          responseBody: (body === undefined
            ? Prisma.JsonNull
            : JSON.parse(JSON.stringify(body))) as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      // El recurso ya se creó: no se le falla al cliente. Limitación del ADR-013.
      this.logger.warn(`No se pudo guardar la respuesta idempotente: ${(error as Error).message}`);
    }
    return body;
  }

  private async release(scope: string, key: string): Promise<void> {
    try {
      await this.prisma.idempotencyRecord.deleteMany({
        where: { scope, key, status: IdempotencyStatus.IN_PROGRESS },
      });
    } catch (error) {
      this.logger.warn(`No se pudo liberar la Idempotency-Key: ${(error as Error).message}`);
    }
  }
}
