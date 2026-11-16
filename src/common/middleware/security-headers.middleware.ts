import { NextFunction, Request, Response } from 'express';

/** La API solo devuelve JSON: no carga nada ni se deja embeber. */
export const API_CSP = "default-src 'none'; frame-ancestors 'none'";

/**
 * Swagger UI en /api/docs (DEF-19): sus scripts son archivos propios
 * (swagger-ui-bundle.js, swagger-ui-init.js), pero el HTML y la librería usan
 * estilos en línea y los íconos van como `data:` en el CSS. "Try it out" llama
 * a la misma API ('self'). Sin 'unsafe-eval' ni scripts en línea.
 */
export const DOCS_CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

/**
 * Cabeceras de seguridad básicas, sin dependencia (helmet no está instalado).
 * CSP restrictiva en toda ruta y una propia, compatible con Swagger UI, en /api/docs.
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  const path = req.path ?? '';
  const esDocs = path === '/api/docs' || path.startsWith('/api/docs/');
  res.setHeader('Content-Security-Policy', esDocs ? DOCS_CSP : API_CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  // same-site y no same-origin: el frontend (otro dominio) consume la API por CORS.
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  // La API no usa ninguna capacidad del navegador.
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  // Solo en producción: en desarrollo se sirve por http y HSTS no aplica.
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }
  next();
}
