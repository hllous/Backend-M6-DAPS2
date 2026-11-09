import {
  BadRequestException,
  CallHandler,
  ConflictException,
  ExecutionContext,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { lastValueFrom, of, throwError } from 'rxjs';
import { hashBody, IdempotencyInterceptor, IN_PROGRESS_STALE_MS } from './idempotency.interceptor';
import { IdempotencyRetentionSweeper } from './idempotency-retention.sweeper';

const p2002 = () =>
  new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' });

function setup(headers: Record<string, unknown>, body: unknown = { a: 1 }) {
  const res = { statusCode: 201, setHeader: jest.fn(), status: jest.fn() };
  const ctx = {
    switchToHttp: () => ({
      getRequest: () => ({
        headers,
        method: 'POST',
        originalUrl: '/zones?x=1',
        body,
        user: { userId: 'u1' },
      }),
      getResponse: () => res,
    }),
  } as unknown as ExecutionContext;
  const prisma = {
    idempotencyRecord: {
      create: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn(),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const interceptor = new IdempotencyInterceptor(prisma as any);
  return { res, ctx, prisma, interceptor };
}

const run = (i: IdempotencyInterceptor, ctx: ExecutionContext, next: CallHandler) =>
  lastValueFrom(i.intercept(ctx, next) as ReturnType<CallHandler['handle']>);

describe('IdempotencyInterceptor', () => {
  it('sin header no toca la base', async () => {
    const { ctx, prisma, interceptor } = setup({});
    await expect(run(interceptor, ctx, { handle: () => of('ok') })).resolves.toBe('ok');
    expect(prisma.idempotencyRecord.create).not.toHaveBeenCalled();
  });

  it.each([['' as unknown], ['a'.repeat(256)], ['ñ'], [['a', 'b']]])(
    'clave inválida (%p) da 400',
    (key) => {
      const { ctx, interceptor } = setup({ 'idempotency-key': key });
      expect(() => interceptor.intercept(ctx, { handle: () => of(1) })).toThrow(
        BadRequestException,
      );
    },
  );

  it('primera vez: ejecuta y guarda la respuesta serializada', async () => {
    const { ctx, prisma, interceptor } = setup({ 'idempotency-key': 'k1' });
    const out = await run(interceptor, ctx, { handle: () => of({ at: new Date(0) }) });
    expect(out).toEqual({ at: new Date(0) });
    expect(prisma.idempotencyRecord.create).toHaveBeenCalledWith({
      data: { scope: 'u1|POST|/zones', key: 'k1', requestHash: hashBody({ a: 1 }) },
    });
    expect(prisma.idempotencyRecord.update.mock.calls[0][0].data).toMatchObject({
      status: 'COMPLETED',
      responseStatus: 201,
      responseBody: { at: '1970-01-01T00:00:00.000Z' },
    });
  });

  it('el fallo del handler libera la clave y propaga el error', async () => {
    const { ctx, prisma, interceptor } = setup({ 'idempotency-key': 'k1' });
    await expect(
      run(interceptor, ctx, { handle: () => throwError(() => new Error('boom')) }),
    ).rejects.toThrow('boom');
    expect(prisma.idempotencyRecord.deleteMany).toHaveBeenCalled();
    expect(prisma.idempotencyRecord.update).not.toHaveBeenCalled();
  });

  it('si no puede guardar la respuesta igual la devuelve', async () => {
    const { ctx, prisma, interceptor } = setup({ 'idempotency-key': 'k1' });
    prisma.idempotencyRecord.update.mockRejectedValue(new Error('db'));
    await expect(run(interceptor, ctx, { handle: () => of('ok') })).resolves.toBe('ok');
  });

  it('un error de create que no es P2002 se propaga', async () => {
    const { ctx, prisma, interceptor } = setup({ 'idempotency-key': 'k1' });
    prisma.idempotencyRecord.create.mockRejectedValue(new Error('db'));
    await expect(run(interceptor, ctx, { handle: () => of('ok') })).rejects.toThrow('db');
  });

  describe('clave repetida', () => {
    const handle = jest.fn(() => of('nuevo'));
    beforeEach(() => handle.mockClear());

    it('mismo cuerpo, completada: replay sin ejecutar', async () => {
      const { ctx, res, prisma, interceptor } = setup({ 'idempotency-key': 'k1' });
      prisma.idempotencyRecord.create.mockRejectedValue(p2002());
      prisma.idempotencyRecord.findUnique.mockResolvedValue({
        requestHash: hashBody({ a: 1 }),
        status: 'COMPLETED',
        responseStatus: 201,
        responseBody: { id: 'x' },
      });
      await expect(run(interceptor, ctx, { handle })).resolves.toEqual({ id: 'x' });
      expect(handle).not.toHaveBeenCalled();
      expect(res.setHeader).toHaveBeenCalledWith('Idempotency-Replayed', 'true');
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('otro cuerpo da 422', async () => {
      const { ctx, prisma, interceptor } = setup({ 'idempotency-key': 'k1' });
      prisma.idempotencyRecord.create.mockRejectedValue(p2002());
      prisma.idempotencyRecord.findUnique.mockResolvedValue({ requestHash: 'otro' });
      await expect(run(interceptor, ctx, { handle })).rejects.toThrow(UnprocessableEntityException);
    });

    it('en curso y reciente da 409', async () => {
      const { ctx, prisma, interceptor } = setup({ 'idempotency-key': 'k1' });
      prisma.idempotencyRecord.create.mockRejectedValue(p2002());
      prisma.idempotencyRecord.findUnique.mockResolvedValue({
        id: 'i',
        requestHash: hashBody({ a: 1 }),
        status: 'IN_PROGRESS',
      });
      prisma.idempotencyRecord.updateMany.mockResolvedValue({ count: 0 });
      await expect(run(interceptor, ctx, { handle })).rejects.toThrow(ConflictException);
      const where = prisma.idempotencyRecord.updateMany.mock.calls[0][0].where;
      expect(where.createdAt.lt.getTime()).toBeLessThanOrEqual(Date.now() - IN_PROGRESS_STALE_MS);
    });

    it('en curso y viejo se retoma y ejecuta', async () => {
      const { ctx, prisma, interceptor } = setup({ 'idempotency-key': 'k1' });
      prisma.idempotencyRecord.create.mockRejectedValue(p2002());
      prisma.idempotencyRecord.findUnique.mockResolvedValue({
        id: 'i',
        requestHash: hashBody({ a: 1 }),
        status: 'IN_PROGRESS',
      });
      prisma.idempotencyRecord.updateMany.mockResolvedValue({ count: 1 });
      await expect(run(interceptor, ctx, { handle })).resolves.toBe('nuevo');
    });

    it('si el registro desapareció da 409', async () => {
      const { ctx, prisma, interceptor } = setup({ 'idempotency-key': 'k1' });
      prisma.idempotencyRecord.create.mockRejectedValue(p2002());
      prisma.idempotencyRecord.findUnique.mockResolvedValue(null);
      await expect(run(interceptor, ctx, { handle })).rejects.toThrow(ConflictException);
    });
  });

  it('la huella ignora el orden de las claves y distingue valores', () => {
    expect(hashBody({ a: 1, b: [{ y: 1, x: 2 }] })).toBe(hashBody({ b: [{ x: 2, y: 1 }], a: 1 }));
    expect(hashBody({ a: 1 })).not.toBe(hashBody({ a: 2 }));
    expect(hashBody(undefined)).toBe(hashBody({}));
  });
});

describe('IdempotencyRetentionSweeper', () => {
  it('borra lo de más de 24 h', async () => {
    const deleteMany = jest.fn().mockResolvedValue({ count: 2 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = new IdempotencyRetentionSweeper({ idempotencyRecord: { deleteMany } } as any);
    await s.purge(new Date('2026-01-02T00:00:00Z'));
    expect(deleteMany.mock.calls[0][0].where.createdAt.lt).toEqual(
      new Date('2026-01-01T00:00:00Z'),
    );
  });

  it('no propaga errores', async () => {
    const deleteMany = jest.fn().mockRejectedValue(new Error('db'));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = new IdempotencyRetentionSweeper({ idempotencyRecord: { deleteMany } } as any);
    await expect(s.purge()).resolves.toBeUndefined();
  });
});
