import { OutboxEntry, OutboxService } from './outbox.service';
import { AggregateType, EventType } from '../event-types';

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
});
