/** Fecha sin hora: los campos @db.Date comparados contra una fecha con hora dan off-by-one. */
export function toDateOnly(value: string | Date): Date {
  return new Date(`${new Date(value).toISOString().slice(0, 10)}T00:00:00.000Z`);
}
