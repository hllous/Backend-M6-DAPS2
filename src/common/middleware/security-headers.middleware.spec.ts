import { Request, Response } from 'express';
import { securityHeaders } from './security-headers.middleware';

describe('securityHeaders', () => {
  const run = () => {
    const headers: Record<string, string> = {};
    const res = {
      setHeader: (k: string, v: string) => {
        headers[k] = v;
      },
    } as unknown as Response;
    const next = jest.fn();
    securityHeaders({} as Request, res, next);
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
    expect(headers['Strict-Transport-Security']).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it('agrega HSTS solo en producción', () => {
    process.env.NODE_ENV = 'production';
    expect(run().headers['Strict-Transport-Security']).toContain('max-age');
  });
});
