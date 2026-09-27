/** Argentina no tiene horario de verano: el desfasaje con UTC es fijo. */
const ARGENTINA_OFFSET_MS = 3 * 3_600_000;

/** Fecha sin hora: los campos @db.Date comparados contra una fecha con hora dan off-by-one. */
export function toDateOnly(value: string | Date): Date {
  return new Date(`${new Date(value).toISOString().slice(0, 10)}T00:00:00.000Z`);
}

/**
 * "Hoy" en Argentina (UTC-3) como fecha sin hora. Entre las 21:00 y las 24:00
 * locales el día UTC ya es el siguiente, y compararlo así rechazaría la fecha de hoy.
 * Con `now` sirve para cualquier instante: devuelve el día argentino en que cayó.
 */
export function todayArgentina(now: Date = new Date()): Date {
  return toDateOnly(new Date(now.getTime() - ARGENTINA_OFFSET_MS));
}

/**
 * El instante en que empieza el día `date` en Argentina (00:00 locales = 03:00 UTC).
 * Es el límite correcto para filtrar timestamps por un día pedido como fecha.
 */
export function startOfDayArgentina(date: string | Date): Date {
  return new Date(toDateOnly(date).getTime() + ARGENTINA_OFFSET_MS);
}
