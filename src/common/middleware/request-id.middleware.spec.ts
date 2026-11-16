import { Request, Response } from 'express';
import { requestId } from './request-id.middleware';

describe('requestId', () => {
  const run = (headers: Record<string, unknown> = {}) => {
    const set: Record<string, string> = {};
    const res = {
      locals: {} as Record<string, unknown>,
      setHeader: (k: string, v: string) => {
        set[k] = v;
      },
    };
    const next = vi.fn();
    requestId({ headers } as unknown as Request, res as unknown as Response, next);
    return { id: res.locals.traceId as string, header: set['X-Request-Id'], next };
  };
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  it('genera un UUID por request, lo deja en locals y en el header, y sigue la cadena', () => {
    const a = run();
    const b = run();
    expect(a.id).toMatch(UUID);
    expect(a.header).toBe(a.id);
    expect(b.id).not.toBe(a.id);
    expect(a.next).toHaveBeenCalled();
  });

  it('adopta el X-Request-Id del cliente si es un UUID', () => {
    const id = '3f0c1a52-9a43-4b47-8f2c-1d3e5b7a9c01';
    expect(run({ 'x-request-id': id }).id).toBe(id);
  });

  it.each(['abc', 'x\nFALSO log', '3f0c1a52-9a43-4b47-8f2c-1d3e5b7a9c01 extra', ['a', 'b']])(
    'ignora un X-Request-Id que no es UUID: %j',
    (valor) => {
      const { id } = run({ 'x-request-id': valor });
      expect(id).toMatch(UUID);
      expect(id).not.toBe(valor);
    },
  );
});
