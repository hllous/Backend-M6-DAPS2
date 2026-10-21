import { currentTrace, esUuidHeredable, eventContext, trazaDelConsumido } from './event-context';

const V4 = '646d19f5-5670-4a7b-9442-30e13b02ba11';
const OTRO_V4 = '8a1f0c22-5d3e-4b77-9c10-6e2b4a90f3d5';
const NULO = '00000000-0000-0000-0000-000000000000';
const MAXIMO = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
const V4_RFC = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('event-context', () => {
  describe('esUuidHeredable', () => {
    // La forma 8-4-4-4-12 que el Core entrega siempre normalizada (#296): su
    // `uuid.UUID` de Python acepta cualquier versión y variante.
    it.each([
      V4,
      V4.toUpperCase(),
      '1b4e28ba-2fa1-11d2-883f-0016d3cca427', // v1
      '01890a5d-ac96-774b-bcce-b302099a8057', // v7
      NULO,
      MAXIMO,
      '646d19f5-5670-0a7b-9442-30e13b02ba11', // versión 0
      '646d19f5-5670-9a7b-9442-30e13b02ba11', // versión 9
      '646d19f5-5670-4a7b-c442-30e13b02ba11', // variante Microsoft
    ])('acepta %s', (v) => expect(esUuidHeredable(v)).toBe(true));

    it.each([
      '646d19f5-5670-4a7b-9442-30e13b02ba1', // corto
      '646d19f5567044a7b944230e13b02ba11', // sin guiones: el Core ya lo normalizó
      '{646d19f5-5670-4a7b-9442-30e13b02ba11}',
      'urn:uuid:646d19f5-5670-4a7b-9442-30e13b02ba11',
      '646d19f5-5670-4a7b-9442-30e13b02ba1z', // no hex
      'CORR-2026-00184',
      'm2-evt-001',
      undefined,
      42,
    ])('rechaza %s', (v) => expect(esUuidHeredable(v)).toBe(false));
  });

  describe('trazaDelConsumido', () => {
    it('hereda el correlationId y cita el eventId como causa', () => {
      expect(trazaDelConsumido(V4, OTRO_V4)).toEqual({ correlationId: OTRO_V4, causationId: V4 });
    });

    it('sin correlationId, el eventId abre el hilo', () => {
      expect(trazaDelConsumido(V4)).toEqual({ correlationId: V4, causationId: V4 });
    });

    // Lo que el Core acepta de un módulo no corta la correlación (#296).
    it.each([NULO, MAXIMO, '1b4e28ba-2fa1-11d2-883f-0016d3cca427'])(
      'un correlationId %s se hereda',
      (c) => {
        expect(trazaDelConsumido(V4, c)).toEqual({ correlationId: c, causationId: V4 });
      },
    );

    it('un eventId con la forma de UUID es causa aunque no sea RFC', () => {
      expect(trazaDelConsumido(NULO, OTRO_V4)).toEqual({
        correlationId: OTRO_V4,
        causationId: NULO,
      });
    });

    it.each(['m2-evt-001', 'CORR-2026-00184'])(
      'un correlationId %s no se hereda: abre el eventId',
      (c) => {
        expect(trazaDelConsumido(V4, c)).toEqual({ correlationId: V4, causationId: V4 });
      },
    );

    it('un eventId que no es UUID no es causa y el hilo nuevo es un v4 generado por nosotros', () => {
      const traza = trazaDelConsumido('m2-evt-001', 'CORR-2026-00184');

      expect(traza.causationId).toBeNull();
      expect(traza.correlationId).toMatch(V4_RFC);
    });
  });

  describe('currentTrace', () => {
    it('dentro de un contexto devuelve el del contexto', () => {
      const traza = { correlationId: V4, causationId: OTRO_V4 };
      eventContext.run(traza, () => expect(currentTrace()).toBe(traza));
    });

    it('fuera de un contexto abre un hilo nuevo por llamada', () => {
      const [a, b] = [currentTrace(), currentTrace()];

      expect(a.causationId).toBeNull();
      expect(a.correlationId).not.toBe(b.correlationId);
    });
  });
});
