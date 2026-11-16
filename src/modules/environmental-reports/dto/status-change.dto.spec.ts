import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CloseReportDto } from './status-change.dto';

describe('CloseReportDto', () => {
  // Mismas opciones que main.ts.
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
  const validar = (value: object) =>
    pipe.transform(value, { type: 'body', metatype: CloseReportDto });

  it('acepta el body vacío', async () => {
    await expect(validar({})).resolves.toMatchObject({});
  });

  it('recorta el motivo', async () => {
    await expect(validar({ reason: '  Archivo  ' })).resolves.toMatchObject({ reason: 'Archivo' });
  });

  it('acepta el largo máximo', async () => {
    await expect(validar({ reason: 'a'.repeat(500) })).resolves.toBeDefined();
  });

  it.each([{ reason: 'a'.repeat(501) }, { reason: '   ' }, { reason: 5 }, { extra: 1 }])(
    'rechaza %j con 400',
    async (body) => {
      await expect(validar(body)).rejects.toBeInstanceOf(BadRequestException);
    },
  );
});
