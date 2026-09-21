/** Fecha sin hora: los campos @db.Date comparados contra una fecha con hora dan off-by-one. */
export function toDateOnly(value: string | Date): Date {
  return new Date(`${new Date(value).toISOString().slice(0, 10)}T00:00:00.000Z`);
}

/**
 * "Hoy" en Argentina (UTC-3) como fecha sin hora. Entre las 21:00 y las 24:00
 * locales el día UTC ya es el siguiente, y compararlo así rechazaría la fecha de hoy.
 */
export function todayArgentina(now: Date = new Date()): Date {
  return toDateOnly(new Date(now.getTime() - 3 * 3_600_000));
}
