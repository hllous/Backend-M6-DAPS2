/**
 * Helpers para que cada consumer declare qué campos de `data` necesita para
 * que el evento tenga efecto. Devuelven la descripción del problema (nombre del
 * campo y tipo esperado), nunca el valor recibido: es contenido de terceros.
 * Los campos extra no se miran.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type Data = Record<string, unknown>;

export const esObjeto = (v: unknown): v is Data =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export const esTexto = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

export const esUuid = (v: unknown): boolean => typeof v === 'string' && UUID.test(v);

export const esFecha = (v: unknown): boolean =>
  typeof v === 'string' && !isNaN(new Date(v).getTime());

/** Exige el primero de los nombres (alias) que venga informado, y que cumpla `check`. */
export function requerido(
  data: Data,
  nombres: string[],
  tipo: string,
  check: (v: unknown) => boolean,
): string[] {
  const valor = nombres.map((n) => data[n]).find((v) => v !== undefined && v !== null);
  return valor !== undefined && check(valor) ? [] : [`${nombres.join(' o ')} (${tipo})`];
}
