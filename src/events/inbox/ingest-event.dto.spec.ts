import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { IngestEventDto } from './ingest-event.dto';

describe('IngestEventDto', () => {
  // Las mismas opciones que main.ts: forbidNonWhitelisted es lo que rechazaba
  // el sobre v1.6 cuando producer era solo @IsString().
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  });
  const validar = (producer: unknown) =>
    pipe.transform(
      { eventId: 'e-1', eventType: 'ticketUpdated', data: {}, producer },
      { type: 'body', metatype: IngestEventDto },
    );

  it('acepta producer como objeto { moduleId, service } (v1.6/v1.70) y lo deja intacto', async () => {
    const dto = await validar({ moduleId: 'M2', service: 'tickets-service' });

    expect(dto.producer).toEqual({ moduleId: 'M2', service: 'tickets-service' });
  });

  it('sigue aceptando producer como string (v1.5)', async () => {
    const dto = await validar('M7');

    expect(dto.producer).toBe('M7');
  });

  it('sin producer también pasa: el campo es opcional', async () => {
    const dto = await validar(undefined);

    expect(dto.producer).toBeUndefined();
  });

  it.each([[{ moduleId: 'M2' }], [{ moduleId: '', service: 'x' }], [''], [42], [['M2']]])(
    'rechaza un producer mal formado: %j',
    async (producer) => {
      await expect(validar(producer)).rejects.toBeInstanceOf(BadRequestException);
    },
  );
});
