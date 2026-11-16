import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';

/** Header con el id de correlación de cada request (DEF-19, ADR-011). */
export const REQUEST_ID_HEADER = 'X-Request-Id';

/** Solo se adopta el id que manda el cliente (p. ej. el BFF) si es un UUID: nada de texto libre en los logs. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Un id por request, en `res.locals.traceId` y en el header de respuesta. El
 * filtro de errores lo devuelve como `traceId` y lo escribe en el log del 500:
 * con ese id el equipo encuentra la traza sin que el cliente vea el stack.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const recibido = req.headers?.['x-request-id'];
  const id = typeof recibido === 'string' && UUID.test(recibido) ? recibido : randomUUID();
  res.locals.traceId = id;
  res.setHeader(REQUEST_ID_HEADER, id);
  next();
}
