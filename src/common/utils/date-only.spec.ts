import { todayArgentina, toDateOnly } from './date-only';

describe('todayArgentina', () => {
  const dia = (d: Date) => d.toISOString().slice(0, 10);

  it('a las 00:59 UTC todavia es el dia anterior en Argentina (21:59 locales)', () => {
    expect(dia(todayArgentina(new Date('2026-09-20T00:59:59Z')))).toBe('2026-09-19');
  });

  it('a las 03:00 UTC ya es el dia nuevo en Argentina (00:00 locales)', () => {
    expect(dia(todayArgentina(new Date('2026-09-20T03:00:00Z')))).toBe('2026-09-20');
  });

  it('un instante justo antes de la medianoche local sigue siendo el mismo dia', () => {
    expect(dia(todayArgentina(new Date('2026-09-20T02:59:59Z')))).toBe('2026-09-19');
  });

  it('devuelve medianoche UTC, apta para comparar con columnas @db.Date', () => {
    expect(todayArgentina(new Date('2026-09-20T15:30:00Z')).toISOString()).toBe(
      '2026-09-20T00:00:00.000Z',
    );
  });

  it('cruza el fin de anio sin perder un dia', () => {
    expect(dia(todayArgentina(new Date('2027-01-01T02:00:00Z')))).toBe('2026-12-31');
  });
});

describe('toDateOnly', () => {
  it('descarta la hora y deja medianoche UTC', () => {
    expect(toDateOnly('2026-09-20T23:59:59.999Z').toISOString()).toBe('2026-09-20T00:00:00.000Z');
  });
});
