import { NextFunction, Request, Response } from 'express';

/**
 * Cabeceras de seguridad básicas, sin dependencia (helmet no está instalado).
 *
 * No se define Content-Security-Policy a propósito: la API solo devuelve JSON
 * y una CSP restrictiva rompería Swagger UI (/api/docs), que carga scripts y
 * estilos en línea.
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  // same-site y no same-origin: el frontend (otro dominio) consume la API por CORS.
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  // Solo en producción: en desarrollo se sirve por http y HSTS no aplica.
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }
  next();
}
