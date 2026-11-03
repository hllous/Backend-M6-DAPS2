import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { OutboxController } from './outbox.controller';
import { OutboxAdminService } from './outbox-admin.service';
import { QueryOutboxDto, RetryFailedOutboxDto } from './dto';

const ID = '11111111-1111-4111-8111-111111111111';

describe('OutboxController', () => {
  let service: jest.Mocked<OutboxAdminService>;
  let controller: OutboxController;

  beforeEach(() => {
    service = {
      findAll: jest.fn().mockResolvedValue('lista'),
      findOne: jest.fn().mockResolvedValue('detalle'),
      retry: jest.fn().mockResolvedValue('reintento'),
      retryFailed: jest.fn().mockResolvedValue('lote'),
    } as unknown as jest.Mocked<OutboxAdminService>;
    controller = new OutboxController(service);
  });

  it('delega cada endpoint en el service', async () => {
    const q = new QueryOutboxDto();
    const dto = plainToInstance(RetryFailedOutboxDto, { confirm: true });

    await expect(controller.findAll(q)).resolves.toBe('lista');
    await expect(controller.findOne(ID)).resolves.toBe('detalle');
    await expect(controller.retry(ID, 'usr-1')).resolves.toBe('reintento');
    await expect(controller.retryFailed(dto, 'usr-1')).resolves.toBe('lote');

    expect(service.findAll).toHaveBeenCalledWith(q);
    expect(service.findOne).toHaveBeenCalledWith(ID);
    // El actor sale del token (@CurrentUser), nunca del body.
    expect(service.retry).toHaveBeenCalledWith(ID, 'usr-1');
    expect(service.retryFailed).toHaveBeenCalledWith(dto, 'usr-1');
  });
});

describe('RetryFailedOutboxDto', () => {
  // Mismas opciones que el ValidationPipe global (configure-app.ts): con
  // enableImplicitConversion, Boolean("false") sería true si el DTO no lo evitara.
  const errores = async (plain: object) =>
    (
      await validate(
        plainToInstance(RetryFailedOutboxDto, plain, { enableImplicitConversion: true }),
        { whitelist: true, forbidNonWhitelisted: true },
      )
    ).map((e) => e.property);

  it.each([{ confirm: 'false' }, { confirm: 'x' }, { confirm: 1 }, { confirm: 0 }, {}])(
    'rechaza %j',
    async (body) => {
      expect(await errores(body)).toContain('confirm');
    },
  );

  it.each([{ confirm: false }, { confirm: null }, { confirm: 'false ' }])(
    'rechaza %j (no es true)',
    async (body) => {
      expect(await errores(body)).toContain('confirm');
    },
  );

  it.each([{ confirm: true }, { confirm: 'true' }])('acepta %j', async (body) => {
    expect(await errores(body)).toEqual([]);
  });

  it('el limit por omisión es el tope y no pasa de él', async () => {
    const dto = plainToInstance(RetryFailedOutboxDto, { confirm: true });
    expect(dto.limit).toBe(100);
    expect(await errores({ confirm: true, limit: 101 })).toContain('limit');
    expect(await errores({ confirm: true, limit: 0 })).toContain('limit');
    expect(await errores({ confirm: true, limit: 50 })).toEqual([]);
  });

  it('limit null se rechaza', async () => {
    expect(await errores({ confirm: true, limit: null })).toContain('limit');
  });
});
