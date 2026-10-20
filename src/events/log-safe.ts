/**
 * Controles C0 y C1 (incluye ESC, NUL y NEL) y los separadores de línea
 * U+2028/U+2029: con ellos un valor ajeno falsifica o rompe una línea de log.
 */
// eslint-disable-next-line no-control-regex -- los controles son justamente lo que se busca
const CONTROL = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g;

/**
 * Un valor de un tercero (eventId, headers del Core) listo para interpolar en
 * un log: sin caracteres de control y acotado. Un tipo que no es texto,
 * número ni Buffer no se interpola.
 */
export function paraLog(valor: unknown, max = 100): string {
  if (typeof valor !== 'string' && typeof valor !== 'number' && !Buffer.isBuffer(valor)) return '-';
  return String(valor).replace(CONTROL, ' ').slice(0, max);
}
