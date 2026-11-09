import { PreconditionFailedException } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { ETagInterceptor, etagOf, ifMatchWhere, isConditional } from './etag';

describe('etag', () => {
  const updatedAt = new Date('2026-01-01T10:00:00.123Z');
  const etag = etagOf(updatedAt);

  it('etagOf es débil y distingue milisegundos', () => {
    expect(etag).toBe(`W/"${updatedAt.getTime()}"`);
    expect(etagOf(new Date(updatedAt.getTime() + 1))).not.toBe(etag);
  });

  describe('ifMatchWhere', () => {
    it('sin header o con "*" no condiciona el UPDATE', () => {
      expect(ifMatchWhere(undefined, { updatedAt })).toEqual({});
      expect(ifMatchWhere('*', { updatedAt })).toEqual({});
      expect(isConditional(' * ')).toBe(false);
    });

    it('con el ETag vigente (débil, fuerte o en lista) devuelve updatedAt para el where', () => {
      expect(ifMatchWhere(etag, { updatedAt })).toEqual({ updatedAt });
      expect(ifMatchWhere(etag.replace('W/', ''), { updatedAt })).toEqual({ updatedAt });
      expect(ifMatchWhere(`W/"1", ${etag}`, { updatedAt })).toEqual({ updatedAt });
    });

    it('con uno que no coincide lanza 412', () => {
      expect(() => ifMatchWhere('W/"1"', { updatedAt })).toThrow(PreconditionFailedException);
      expect(() => ifMatchWhere('basura', { updatedAt })).toThrow(PreconditionFailedException);
    });
  });

  describe('ETagInterceptor', () => {
    const run = async (body: unknown, params: Record<string, string>) => {
      const setHeader = jest.fn();
      const ctx = {
        switchToHttp: () => ({
          getRequest: () => ({ params }),
          getResponse: () => ({ setHeader }),
        }),
      };
      await lastValueFrom(
        new ETagInterceptor().intercept(ctx as never, { handle: () => of(body) }),
      );
      return setHeader;
    };

    it('pone el ETag cuando el cuerpo es el recurso de la ruta', async () => {
      const setHeader = await run({ id: 'a', updatedAt }, { id: 'a' });
      expect(setHeader).toHaveBeenCalledWith('ETag', etag);
    });

    it('no lo pone en listados ni en sub-recursos', async () => {
      expect(await run({ data: [] }, {})).not.toHaveBeenCalled();
      expect(await run({ id: 'otro', updatedAt }, { id: 'a' })).not.toHaveBeenCalled();
      expect(await run(null, { id: 'a' })).not.toHaveBeenCalled();
    });
  });
});
