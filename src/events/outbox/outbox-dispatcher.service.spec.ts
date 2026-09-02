import { OutboxEventStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EventPublisher } from '../publishers/event-publisher.port';
import { EventEnvelope } from '../envelope';
import { MAX_ATTEMPTS, OutboxDispatcher } from './outbox-dispatcher.service';

describe('OutboxDispatcher', () => {
  const ROW_ID = '11111111-1111-1111-1111-111111111111';
  const SUBJECT = '22222222-2222-2222-2222-222222222222';

  let prisma: any;
  let publisher: { publish: jest.Mock; transport: string };
  let dispatcher: OutboxDispatcher;

  const row = (over: Record<string, unknown> = {}) => ({
    id: ROW_ID,
    eventType: 'urbanServiceScheduled',
    aggregateType: 'SERVICE',
    aggregateId: SUBJECT,
    payload: { serviceId: SUBJECT },
    status: OutboxEventStatus.PENDING,
    attempts: 0,
    lastError: null,
    occurredAt: new Date('2026-09-02T10:00:00.000Z'),
    publishedAt: null,
    ...over,
  });

  beforeEach(() => {
    prisma = {
      outboxEvent: {
        findMany: jest.fn().mockResolvedValue([row()]),
        update: jest.fn().mockResolvedValue({}),
        groupBy: jest.fn().mockResolvedValue([]),
      },
    };
    publisher = { publish: jest.fn().mockResolvedValue(undefined), transport: 'test' };
    dispatcher = new OutboxDispatcher(
      prisma as unknown as PrismaService,
      publisher as unknown as EventPublisher,
    );
  });

  const publicado = (): EventEnvelope => publisher.publish.mock.calls[0][0];

  it('envuelve el payload en el sobre de la cohorte', async () => {
    await dispatcher.dispatchPending();

    expect(publicado()).toEqual({
      specVersion: '1.5',
      eventId: ROW_ID,
      eventType: 'urbanServiceScheduled',
      eventVersion: '1.0',
      occurredAt: '2026-09-02T10:00:00.000Z',
      producer: 'M6',
      subject: SUBJECT,
      data: { serviceId: SUBJECT },
    });
  });

  it('el eventId es el id de la fila, para que el consumidor pueda deduplicar', async () => {
    await dispatcher.dispatchPending();

    expect(publicado().eventId).toBe(ROW_ID);
  });

  it('marca SENT con publishedAt cuando la publicacion sale bien', async () => {
    await dispatcher.dispatchPending();

    const [[args]] = prisma.outboxEvent.update.mock.calls;
    expect(args.where).toEqual({ id: ROW_ID });
    expect(args.data).toMatchObject({
      status: OutboxEventStatus.SENT,
      lastError: null,
      attempts: { increment: 1 },
    });
    expect(args.data.publishedAt).toBeInstanceOf(Date);
  });

  it('una falla la deja PENDING para que la proxima barrida reintente', async () => {
    publisher.publish.mockRejectedValue(new Error('broker caido'));

    await dispatcher.dispatchPending();

    const [[args]] = prisma.outboxEvent.update.mock.calls;
    expect(args.data).toMatchObject({
      status: OutboxEventStatus.PENDING,
      attempts: 1,
      lastError: 'broker caido',
    });
  });

  it('al agotar los intentos la marca FAILED y deja de tomarla', async () => {
    prisma.outboxEvent.findMany.mockResolvedValue([row({ attempts: MAX_ATTEMPTS - 1 })]);
    publisher.publish.mockRejectedValue(new Error('payload invalido'));

    await dispatcher.dispatchPending();

    const [[args]] = prisma.outboxEvent.update.mock.calls;
    expect(args.data).toMatchObject({
      status: OutboxEventStatus.FAILED,
      attempts: MAX_ATTEMPTS,
    });
  });

  it('una fila que falla no frena a las que vienen detras', async () => {
    prisma.outboxEvent.findMany.mockResolvedValue([
      row({ id: 'a' }),
      row({ id: 'b' }),
      row({ id: 'c' }),
    ]);
    publisher.publish.mockRejectedValueOnce(new Error('transitorio'));

    await dispatcher.dispatchPending();

    expect(publisher.publish).toHaveBeenCalledTimes(3);
    expect(prisma.outboxEvent.update).toHaveBeenCalledTimes(3);
  });

  it('barre en orden de ocurrencia, no de insercion', async () => {
    await dispatcher.dispatchPending();

    expect(prisma.outboxEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: OutboxEventStatus.PENDING },
        orderBy: { occurredAt: 'asc' },
      }),
    );
  });

  it('no hace nada si no hay pendientes', async () => {
    prisma.outboxEvent.findMany.mockResolvedValue([]);

    await dispatcher.dispatchPending();

    expect(publisher.publish).not.toHaveBeenCalled();
    expect(prisma.outboxEvent.update).not.toHaveBeenCalled();
  });

  it('recorta el error largo para que entre en la columna', async () => {
    publisher.publish.mockRejectedValue(new Error('x'.repeat(900)));

    await dispatcher.dispatchPending();

    const [[args]] = prisma.outboxEvent.update.mock.calls;
    expect(args.data.lastError).toHaveLength(500);
  });

  it('stats devuelve los tres estados aunque la base no traiga ninguno', async () => {
    expect(await dispatcher.stats()).toEqual({ PENDING: 0, SENT: 0, FAILED: 0 });
  });
});
