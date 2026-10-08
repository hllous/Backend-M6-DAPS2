import { OutboxEntry, OutboxService } from './outbox.service';
import { AggregateType, EventType } from '../event-types';
import { eventContext } from '../event-context';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('OutboxService', () => {
  let tx: any;
  let outbox: OutboxService;

  const entrada = (over: Partial<OutboxEntry> = {}): OutboxEntry => ({
    eventType: EventType.URBAN_SERVICE_SCHEDULED,
    aggregateType: AggregateType.SERVICE,
    aggregateId: '99999999-9999-9999-9999-999999999999',
    payload: { serviceId: 'srv-1' },
    ...over,
  });

  beforeEach(() => {
    tx = { outboxEvent: { create: jest.fn(), createMany: jest.fn() } };
    outbox = new OutboxService();
  });

  describe('enqueue', () => {
    /**
     * El punto del patrón: la fila del outbox se escribe con el cliente de la
     * transacción que le pasan, no con uno propio. Si el servicio tuviera su
     * propio Prisma podrían quedar el evento sin el cambio, o al revés.
     */
    it('escribe con el cliente de transacción que recibe', async () => {
      await outbox.enqueue(tx, entrada());

      expect(tx.outboxEvent.create).toHaveBeenCalledTimes(1);
      expect(tx.outboxEvent.create.mock.calls[0][0].data).toMatchObject({
        eventType: 'urbanServiceScheduled',
        aggregateType: 'SERVICE',
        payload: { serviceId: 'srv-1' },
      });
    });

    it('la fila nace sin publishedAt: publicar es del dispatcher', async () => {
      await outbox.enqueue(tx, entrada());

      const { data } = tx.outboxEvent.create.mock.calls[0][0];
      expect(data.publishedAt).toBeUndefined();
      expect(data.status).toBeUndefined(); // el default del schema es PENDING
    });

    it('sin occurredAt usa el momento del encolado', async () => {
      const antes = Date.now();

      await outbox.enqueue(tx, entrada());

      const { occurredAt } = tx.outboxEvent.create.mock.calls[0][0].data;
      expect(occurredAt).toBeInstanceOf(Date);
      expect(occurredAt.getTime()).toBeGreaterThanOrEqual(antes);
    });

    /** El hecho puede ser anterior a su registro: un relevamiento de ayer. */
    it('respeta un occurredAt explícito', async () => {
      const cuando = new Date('2026-08-20T10:00:00.000Z');

      await outbox.enqueue(tx, entrada({ occurredAt: cuando }));

      expect(tx.outboxEvent.create.mock.calls[0][0].data.occurredAt).toEqual(cuando);
    });
  });

  describe('enqueueMany', () => {
    it('escribe todas las filas de una sola vez', async () => {
      await outbox.enqueueMany(tx, [entrada(), entrada({ aggregateId: 'otro' })]);

      expect(tx.outboxEvent.createMany).toHaveBeenCalledTimes(1);
      expect(tx.outboxEvent.createMany.mock.calls[0][0].data).toHaveLength(2);
    });

    /**
     * Es el caso normal, no un borde: un expediente sin `ticketId` no proyecta
     * nada hacia M2 y llega acá con la lista vacía.
     */
    it('una lista vacía no escribe nada', async () => {
      await outbox.enqueueMany(tx, []);

      expect(tx.outboxEvent.createMany).not.toHaveBeenCalled();
    });

    it('cada fila conserva su propio occurredAt', async () => {
      const cuando = new Date('2026-08-20T10:00:00.000Z');

      await outbox.enqueueMany(tx, [entrada({ occurredAt: cuando }), entrada()]);

      const [primera, segunda] = tx.outboxEvent.createMany.mock.calls[0][0].data;
      expect(primera.occurredAt).toEqual(cuando);
      expect(segunda.occurredAt).not.toEqual(cuando);
    });
  });

  describe('correlationId y causationId (#267)', () => {
    const TRAZA = {
      correlationId: '8a1f0c22-5d3e-4b77-9c10-6e2b4a90f3d5',
      causationId: '646d19f5-5670-4a7b-9442-30e13b02ba11',
    };

    /** Un endpoint o un barrido: el evento abre un hilo propio y no tiene causa. */
    it('fuera de un handler genera un correlationId nuevo y sin causationId', async () => {
      await outbox.enqueue(tx, entrada());
      await outbox.enqueue(tx, entrada());

      const [[uno], [otro]] = tx.outboxEvent.create.mock.calls;
      expect(uno.data.correlationId).toMatch(UUID);
      expect(uno.data.causationId).toBeNull();
      expect(otro.data.correlationId).not.toBe(uno.data.correlationId);
    });

    it('dentro de un handler hereda la traza del evento consumido', async () => {
      await eventContext.run(TRAZA, () => outbox.enqueue(tx, entrada()));

      expect(tx.outboxEvent.create.mock.calls[0][0].data).toMatchObject(TRAZA);
    });

    /**
     * Lo que hace el dominio de verdad: encolar dentro del callback de
     * `$transaction`, después de varios `await`. El contexto tiene que llegar.
     */
    it('la traza sobrevive a los await de una transacción', async () => {
      const transaccion = async (fn: (t: typeof tx) => Promise<void>) => {
        await new Promise((r) => setImmediate(r));
        return fn(tx);
      };

      await eventContext.run(TRAZA, () =>
        transaccion(async (t) => {
          await Promise.resolve();
          await outbox.enqueueMany(t, [entrada()]);
        }),
      );

      expect(tx.outboxEvent.createMany.mock.calls[0][0].data[0]).toMatchObject(TRAZA);
    });

    it('un lote fuera de un handler comparte un único hilo', async () => {
      await outbox.enqueueMany(tx, [entrada(), entrada()]);

      const [a, b] = tx.outboxEvent.createMany.mock.calls[0][0].data;
      expect(a.correlationId).toMatch(UUID);
      expect(b.correlationId).toBe(a.correlationId);
      expect(a.causationId).toBeNull();
    });
  });
});
