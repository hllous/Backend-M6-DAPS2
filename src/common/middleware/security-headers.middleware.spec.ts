import { Request, Response } from 'express';
import { API_CSP, DOCS_CSP, securityHeaders } from './security-headers.middleware';

describe('securityHeaders', () => {
  const run = (path = '/services') => {
    const headers: Record<string, string> = {};
    const res = {
      setHeader: (k: string, v: string) => {
        headers[k] = v;
      },
    } as unknown as Response;
    const next = vi.fn();
    securityHeaders({ path } as Request, res, next);
    return { headers, next };
  };
  const env = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = env;
  });

  it('pone las cabeceras base y sigue la cadena', () => {
    process.env.NODE_ENV = 'test';
    const { headers, next } = run();
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['Referrer-Policy']).toBe('no-referrer');
    expect(headers['Cross-Origin-Resource-Policy']).toBe('same-site');
    expect(headers['Permissions-Policy']).toBe(
      'camera=(), microphone=(), geolocation=(), payment=()',
    );
    expect(headers['Strict-Transport-Security']).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it('manda una CSP restrictiva en las rutas de la API', () => {
    expect(run('/zones').headers['Content-Security-Policy']).toBe(
      "default-src 'none'; frame-ancestors 'none'",
    );
    // Una ruta que solo empieza parecido no hereda la CSP de Swagger.
    expect(run('/api/docsx').headers['Content-Security-Policy']).toBe(API_CSP);
  });

  it.each(['/api/docs', '/api/docs/', '/api/docs/swagger-ui-bundle.js'])(
    'pone la CSP de Swagger UI en %s (DEF-19)',
    (p) => {
      expect(run(p).headers['Content-Security-Policy']).toBe(DOCS_CSP);
    },
  );

  it('la CSP de Swagger UI no permite scripts en línea, eval ni orígenes externos', () => {
    const scripts = /script-src ([^;]+)/.exec(DOCS_CSP)?.[1];
    expect(scripts).toBe("'self'");
    expect(DOCS_CSP).not.toContain('unsafe-eval');
    expect(DOCS_CSP).not.toMatch(/https?:/);
    expect(DOCS_CSP).toContain("frame-ancestors 'none'");
  });

  it('agrega HSTS solo en producción', () => {
    process.env.NODE_ENV = 'production';
    expect(run().headers['Strict-Transport-Security']).toContain('max-age');
  });
});
