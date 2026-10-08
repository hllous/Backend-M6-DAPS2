import { currentTrace, esUuidRfc, eventContext, trazaDelConsumido } from './event-context';

const V4 = '646d19f5-5670-4a7b-9442-30e13b02ba11';
const OTRO_V4 = '8a1f0c22-5d3e-4b77-9c10-6e2b4a90f3d5';
const NULO = '00000000-0000-0000-0000-000000000000';
const MAXIMO = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

describe('event-context', () => {
  describe('esUuidRfc', () => {
    it.each([
      V4,
      V4.toUpperCase(),
      '1b4e28ba-2fa1-11d2-883f-0016d3cca427', // v1
      '01890a5d-ac96-774b-bcce-b302099a8057', // v7
    ])('acepta %s', (v) => expect(esUuidRfc(v)).toBe(true));

    it.each([
      NULO,
      MAXIMO,
      '646d19f5-5670-0a7b-9442-30e13b02ba11', // versión 0
      '646d19f5-5670-9a7b-9442-30e13b02ba11', // versión 9
      '646d19f5-5670-4a7b-c442-30e13b02ba11', // variante Microsoft
      '646d19f5-5670-4a7b-9442-30e13b02ba1', // corto
      'm2-evt-001',
      undefined,
      42,
    ])('rechaza %s', (v) => expect(esUuidRfc(v)).toBe(false));
  });

  describe('trazaDelConsumido', () => {
    it('hereda el correlationId y cita el eventId como causa', () => {
      expect(trazaDelConsumido(V4, OTRO_V4)).toEqual({ correlationId: OTRO_V4, causationId: V4 });
    });

    it('sin correlationId, el eventId abre el hilo', () => {
      expect(trazaDelConsumido(V4)).toEqual({ correlationId: V4, causationId: V4 });
    });

    it.each([NULO, MAXIMO])('un correlationId %s no se hereda: abre el eventId', (c) => {
      expect(trazaDelConsumido(V4, c)).toEqual({ correlationId: V4, causationId: V4 });
    });

    it.each([NULO, 'm2-evt-001'])('un eventId %s no es causa y el hilo es nuevo', (eventId) => {
      const traza = trazaDelConsumido(eventId, MAXIMO);

      expect(traza.causationId).toBeNull();
      expect(esUuidRfc(traza.correlationId)).toBe(true);
      expect(traza.correlationId).not.toBe(MAXIMO);
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
