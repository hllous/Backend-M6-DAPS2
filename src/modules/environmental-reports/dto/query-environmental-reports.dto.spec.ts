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
