import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { IngestEventDto, toInboundEnvelope } from './ingest-event.dto';

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

  describe('sobre del Core', () => {
    // El ejemplo de M9 tal cual, con `causationId: null`.
    const core = {
      eventId: '3f6c1b7e-9d24-4a1f-9f2a-2b0f0c7d5e11',
      eventType: 'workOrderCompleted',
      eventVersion: '1.0',
      occurredAt: '2026-09-29T18:00:00Z',
      sourceModule: 'obras',
      correlationId: '8a1f0c22-5d3e-4b77-9c10-6e2b4a90f3d5',
      causationId: null,
      data: {},
    };
    const validarCore = (over: Record<string, unknown> = {}) =>
      pipe.transform({ ...core, ...over }, { type: 'body', metatype: IngestEventDto });

    it('lo acepta tal cual y toInboundEnvelope conserva la correlación', async () => {
      const dto = await validarCore();

      expect(toInboundEnvelope(dto)).toMatchObject(core);
    });

    it('acepta un causationId UUID', async () => {
      const causationId = '646d19f5-5670-4a7b-9442-30e13b02ba11';
      await expect(validarCore({ causationId })).resolves.toMatchObject({ causationId });
    });

    it.each([
      ['correlationId no UUID', { correlationId: 'corr-1' }],
      ['causationId no UUID', { causationId: 'cause-1' }],
      ['sourceModule de más de 60', { sourceModule: 'x'.repeat(61) }],
      ['eventVersion de más de 20', { eventVersion: '1'.repeat(21) }],
      ['eventType de más de 120', { eventType: 'x'.repeat(121) }],
    ])('rechaza %s', async (_caso, over) => {
      await expect(validarCore(over)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('un eventId que no es UUID sigue entrando: no se exige para no rechazar a quien no migró', async () => {
      await expect(validarCore({ eventId: 'e-1' })).resolves.toMatchObject({ eventId: 'e-1' });
    });
  });

  describe('occurredAt', () => {
    const conFecha = (occurredAt: unknown) =>
      pipe.transform(
        { eventId: 'e-1', eventType: 'ticketUpdated', data: {}, occurredAt },
        { type: 'body', metatype: IngestEventDto },
      );

    it.each([
      ['2026-09-18T10:00:00Z'],
      ['2026-09-18T10:00:00.123Z'],
      ['2026-09-18T10:00:00-03:00'],
      ['2026-09-18T10:00:00.123+00:00'],
    ])('acepta ISO 8601: %s', async (valor) => {
      await expect(conFecha(valor)).resolves.toMatchObject({ occurredAt: valor });
    });

    it.each([['ayer'], ['18/09/2026'], ['2026-13-45T00:00:00Z'], [42]])(
      'rechaza un occurredAt inválido: %j',
      async (valor) => {
        await expect(conFecha(valor)).rejects.toBeInstanceOf(BadRequestException);
      },
    );
  });
});
