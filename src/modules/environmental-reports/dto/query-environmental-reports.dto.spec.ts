import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { QueryEnvironmentalReportsDto } from './query-environmental-reports.dto';

describe('QueryEnvironmentalReportsDto from/to', () => {
  // Mismas opciones que main.ts.
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
  const validar = (value: object) =>
    pipe.transform(value, { type: 'query', metatype: QueryEnvironmentalReportsDto });

  it.each(['20260901', '2026-02-30', '2026-09-31', '2026-09-01T10:00:00-03:00'])(
    'rechaza %s con 400',
    async (fecha) => {
      await expect(validar({ from: fecha })).rejects.toBeInstanceOf(BadRequestException);
      await expect(validar({ to: fecha })).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  it('acepta días reales, incluido el 29 de febrero bisiesto', async () => {
    await expect(validar({ from: '2024-02-29', to: '2026-09-30' })).resolves.toMatchObject({
      from: '2024-02-29',
      to: '2026-09-30',
    });
  });
});

describe('QueryEnvironmentalReportsDto status', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    // Igual que configure-app.ts: con otro transformOptions el test dejaría de ver lo que ve producción.
    transformOptions: { enableImplicitConversion: true },
  });
  const validar = (value: object) =>
    pipe.transform(value, { type: 'query', metatype: QueryEnvironmentalReportsDto });

  it.each([
    ['uno', 'RECEIVED', ['RECEIVED']],
    ['repetido', ['RECEIVED', 'UNDER_REVIEW'], ['RECEIVED', 'UNDER_REVIEW']],
    ['coma', 'RECEIVED,UNDER_REVIEW', ['RECEIVED', 'UNDER_REVIEW']],
    ['coma con espacios', 'RECEIVED, UNDER_REVIEW', ['RECEIVED', 'UNDER_REVIEW']],
    ['mezcla y duplicados', ['RECEIVED,UNDER_REVIEW', 'RECEIVED'], ['RECEIVED', 'UNDER_REVIEW']],
  ])('%s', async (_n, status, esperado) => {
    await expect(validar({ status })).resolves.toMatchObject({ status: esperado });
  });

  it('sin status queda undefined', async () => {
    expect(((await validar({})) as { status?: unknown }).status).toBeUndefined();
  });

  it.each<unknown>([
    'NOPE',
    'RECEIVED,NOPE',
    '',
    'RECEIVED,',
    [''],
    { a: 'RECEIVED' },
    { 0: 'RECEIVED' },
  ])('rechaza %j con 400 listando los válidos', async (status) => {
    const err = await validar({ status }).catch((e: BadRequestException) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect(JSON.stringify((err as BadRequestException).getResponse())).toContain('RECEIVED');
  });
});

describe('QueryEnvironmentalReportsDto status vacío', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  });

  it('rechaza una lista vacía con 400', async () => {
    await expect(
      pipe.transform({ status: [] }, { type: 'query', metatype: QueryEnvironmentalReportsDto }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
