import { NextFunction, Request, Response } from 'express';

/**
 * Cabeceras de seguridad básicas, sin dependencia (helmet no está instalado).
 *
 * CSP restrictiva en toda ruta menos /api/docs: la API solo devuelve JSON, pero
 * Swagger UI carga scripts y estilos en línea y se rompería.
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  const path = req.path ?? '';
  if (path !== '/api/docs' && !path.startsWith('/api/docs/')) {
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  }
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
