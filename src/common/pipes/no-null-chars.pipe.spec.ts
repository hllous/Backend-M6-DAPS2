import { BadRequestException } from '@nestjs/common';
import { MAX_PROFUNDIDAD_JSON, NoNullCharsPipe } from './no-null-chars.pipe';

describe('NoNullCharsPipe', () => {
  const pipe = new NoNullCharsPipe();

  it.each([
    ['string en body', { name: 'QA\u0000x' }],
    ['string anidado', { payload: { a: [{ b: 'x\u0000' }] } }],
    ['clave con nulo', { ['a\u0000b']: 1 }],
  ])('rechaza %s con 400', (_n, body) => {
    expect(() => pipe.transform(body, { type: 'body' })).toThrow(BadRequestException);
  });

  it('rechaza nulos en query', () => {
    expect(() => pipe.transform({ q: 'a\u0000' }, { type: 'query' })).toThrow(BadRequestException);
  });

  it('deja pasar texto normal y no strings', () => {
    const body = { name: 'ok', n: 1, l: [null, true], o: null };
    expect(pipe.transform(body, { type: 'body' })).toBe(body);
  });

  it('rechaza nulos en parametros de ruta (rutas publicas sin ParseUUIDPipe)', () => {
    expect(() => pipe.transform('x\u0000y', { type: 'param' })).toThrow(BadRequestException);
  });

  it('no mira los tipos que no son body, query ni param', () => {
    expect(pipe.transform('a\u0000', { type: 'custom' })).toBe('a\u0000');
  });

  it('el mensaje muestra el texto \\u0000 y no un byte nulo', () => {
    try {
      pipe.transform('x\u0000', { type: 'param' });
      throw new Error('tendria que haber rechazado');
    } catch (e) {
      const mensaje = (e as BadRequestException).message;
      expect(mensaje).toContain('\\u0000');
      expect(mensaje).not.toContain('\u0000');
    }
  });

  describe('profundidad del JSON', () => {
    const anidar = (profundidad: number, hoja: unknown): unknown => {
      let nodo: unknown = hoja;
      for (let i = 0; i < profundidad; i++) nodo = [nodo];
      return nodo;
    };

    it('acepta un JSON justo en el tope', () => {
      const body = { payload: anidar(MAX_PROFUNDIDAD_JSON - 1, 'ok') };
      expect(pipe.transform(body, { type: 'body' })).toBe(body);
    });

    it('rechaza con 400 un JSON un nivel por encima del tope', () => {
      expect(() =>
        pipe.transform({ payload: anidar(MAX_PROFUNDIDAD_JSON, 'ok') }, { type: 'body' }),
      ).toThrow(/niveles de anidado/);
    });

    it('un anidado enorme da 400 y no desborda la pila del propio pipe', () => {
      expect(() => pipe.transform({ payload: anidar(200_000, 'ok') }, { type: 'body' })).toThrow(
        BadRequestException,
      );
    });

    it('cuenta tambien la profundidad de objetos anidados', () => {
      let nodo: Record<string, unknown> = { fin: 'ok' };
      for (let i = 0; i < MAX_PROFUNDIDAD_JSON + 1; i++) nodo = { hijo: nodo };
      expect(() => pipe.transform(nodo, { type: 'body' })).toThrow(BadRequestException);
    });
  });
});
