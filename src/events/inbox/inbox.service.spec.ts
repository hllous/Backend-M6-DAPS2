import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { InboxService, REDACTED_PAYLOAD } from './inbox.service';
import { InboundEnvelope } from '../envelope';
import { OutboxService } from '../outbox/outbox.service';
import { AggregateType, EventType } from '../event-types';

describe('InboxService', () => {
  const MESSAGE_ID = '646d19f5-5670-4a7b-9442-30e13b02ba11';

  let prisma: any;
  let inbox: InboxService;

  // Un sobre entrante de M7, que todavía manda `producer` como string suelto:
  // el inbox es tolerante a propósito y no exige la forma de la v1.6.
  const sobre = (over: Partial<InboundEnvelope> = {}): InboundEnvelope => ({
    specVersion: '1.0',
    eventId: MESSAGE_ID,
    eventType: 'streetClosureApproved',
    occurredAt: '2026-09-02T10:00:00.000Z',
    producer: 'M7',
    subject: 'abc',
    data: { closureRequestId: 'xyz' },
    ...over,
  });

  const OCURRIDO = new Date('2026-09-02T10:00:00.000Z');

  const duplicado = () =>
    new Prisma.PrismaClientKnownRequestError('dup', {
      code: 'P2002',
      clientVersion: '5.22.0',
    });

  beforeEach(() => {
    prisma = {
      inboxEvent: {
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        // Por defecto, un messageId repetido ya está procesado: no hay fila que tomar.
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUniqueOrThrow: jest.fn(),
      },
    };
    inbox = new InboxService(prisma as unknown as PrismaService);
  });

  it('procesa el evento y lo marca como procesado', async () => {
    const handler = jest.fn().mockResolvedValue(undefined);
    inbox.register('streetClosureApproved', handler);

    const result = await inbox.ingest(sobre());

    expect(result.status).toBe('processed');
    expect(handler).toHaveBeenCalledWith({ closureRequestId: 'xyz' }, OCURRIDO);
    const [[args]] = prisma.inboxEvent.update.mock.calls;
    expect(args.data.processedAt).toBeInstanceOf(Date);
  });

  // #270: el handler ordena con occurredAt, y el reintento lo lee de la fila.
  it('guarda el occurredAt del sobre en la fila', async () => {
    inbox.register('streetClosureApproved', jest.fn());

    await inbox.ingest(sobre());

    expect(prisma.inboxEvent.create.mock.calls[0][0].data.occurredAt).toEqual(OCURRIDO);
  });

  it.each([undefined, 'no-es-fecha'])(
    'sin un occurredAt legible (%s) el handler recibe null',
    async (occurredAt) => {
      const handler = jest.fn().mockResolvedValue(undefined);
      inbox.register('streetClosureApproved', handler);

      await inbox.ingest(sobre({ occurredAt }));

      expect(handler).toHaveBeenCalledWith({ closureRequestId: 'xyz' }, null);
      expect(prisma.inboxEvent.create.mock.calls[0][0].data.occurredAt).toBeNull();
    },
  );

  // El criterio central: la regla 1 del enunciado.
  it('un messageId ya procesado NO vuelve a aplicar el efecto', async () => {
    const handler = jest.fn();
    inbox.register('streetClosureApproved', handler);
    prisma.inboxEvent.create.mockRejectedValue(duplicado());

    const result = await inbox.ingest(sobre());

    expect(result.status).toBe('duplicate');
    expect(handler).not.toHaveBeenCalled();
    expect(prisma.inboxEvent.update).not.toHaveBeenCalled();
  });

  describe('reintento de un evento cuyo handler falló (#264)', () => {
    const GUARDADO = { closureRequestId: 'guardado' };
    const GUARDADA = new Date('2026-09-01T08:00:00.000Z');

    beforeEach(() => {
      prisma.inboxEvent.create.mockRejectedValue(duplicado());
      prisma.inboxEvent.updateMany.mockResolvedValue({ count: 1 });
      prisma.inboxEvent.findUniqueOrThrow.mockResolvedValue({
        payload: GUARDADO,
        occurredAt: GUARDADA,
      });
    });

    it('toma la fila con un update condicional y corre el handler con lo guardado', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      inbox.register('streetClosureApproved', handler);

      const result = await inbox.ingest(sobre({ data: { closureRequestId: 'otro' } }));

      expect(result.status).toBe('processed');
      expect(prisma.inboxEvent.updateMany).toHaveBeenCalledWith({
        where: {
          messageId: MESSAGE_ID,
          eventType: 'streetClosureApproved',
          processedAt: null,
          error: { not: null },
        },
        data: { error: null },
      });
      // El data y el occurredAt del sobre nuevo no entran: se reproduce lo de
      // la primera entrega (#270: con otra fecha podría adelantarse).
      expect(handler).toHaveBeenCalledWith(GUARDADO, GUARDADA);
      const [[args]] = prisma.inboxEvent.update.mock.calls;
      expect(args.data.processedAt).toBeInstanceOf(Date);
      expect(args.data.error).toBeNull();
    });

    it('si vuelve a fallar, sigue failed y sin processedAt', async () => {
      inbox.register('streetClosureApproved', jest.fn().mockRejectedValue(new Error('otra vez')));

      const result = await inbox.ingest(sobre());

      expect(result).toEqual({ status: 'failed', detail: 'otra vez' });
      const [[args]] = prisma.inboxEvent.update.mock.calls;
      expect(args.data).toEqual({ error: 'otra vez' });
    });

    it('dos entregas solapadas del mismo eventId corren el handler una sola vez', async () => {
      let liberar!: () => void;
      const handler = jest.fn(() => new Promise<void>((r) => (liberar = r)));
      inbox.register('streetClosureApproved', handler);
      // La base deja que solo uno de los dos updates tome la fila.
      prisma.inboxEvent.updateMany
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 0 });

      const primera = inbox.ingest(sobre());
      const segunda = await inbox.ingest(sobre());
      liberar();

      expect(segunda.status).toBe('duplicate');
      expect((await primera).status).toBe('processed');
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('una fila en curso, con otro eventType o ya procesada sale duplicate sin correr nada', async () => {
      const handler = jest.fn();
      inbox.register('streetClosureApproved', handler);
      inbox.register('workOrderCompleted', handler);
      prisma.inboxEvent.updateMany.mockResolvedValue({ count: 0 });

      const result = await inbox.ingest(sobre({ eventType: 'workOrderCompleted' }));

      expect(result.status).toBe('duplicate');
      expect(prisma.inboxEvent.updateMany.mock.calls[0][0].where.eventType).toBe(
        'workOrderCompleted',
      );
      expect(handler).not.toHaveBeenCalled();
      expect(prisma.inboxEvent.findUniqueOrThrow).not.toHaveBeenCalled();
      expect(prisma.inboxEvent.update).not.toHaveBeenCalled();
    });

    it('si la fila quedó redactada, reintenta con el data del sobre', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      inbox.register('streetClosureApproved', handler);
      prisma.inboxEvent.findUniqueOrThrow.mockResolvedValue({
        payload: REDACTED_PAYLOAD,
        occurredAt: null,
      });

      await inbox.ingest(sobre());

      expect(handler).toHaveBeenCalledWith({ closureRequestId: 'xyz' }, null);
    });
  });

  it('la idempotencia la decide el unique de la base, no una consulta previa', async () => {
    inbox.register('streetClosureApproved', jest.fn());

    await inbox.ingest(sobre());

    // Si consultara antes de insertar, entre la consulta y el insert podria
    // entrar el mismo mensaje otra vez.
    expect(prisma.inboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ messageId: MESSAGE_ID }),
    });
  });

  it('un evento sin handler se registra y se descarta sin romper', async () => {
    const result = await inbox.ingest(sobre({ eventType: 'eventoAjeno' }));

    expect(result.status).toBe('ignored');
    const [[args]] = prisma.inboxEvent.update.mock.calls;
    expect(args.data.processedAt).toBeInstanceOf(Date);
    expect(args.data.error).toBe('sin handler registrado');
  });

  it('un handler que falla deja la fila SIN procesar y con el error', async () => {
    inbox.register('streetClosureApproved', jest.fn().mockRejectedValue(new Error('boom')));

    const result = await inbox.ingest(sobre());

    expect(result.status).toBe('failed');
    const [[args]] = prisma.inboxEvent.update.mock.calls;
    expect(args.data).toEqual({ error: 'boom' });
    expect(args.data).not.toHaveProperty('processedAt');
  });

  it('recorta el error largo para que entre en la columna', async () => {
    inbox.register(
      'streetClosureApproved',
      jest.fn().mockRejectedValue(new Error('x'.repeat(900))),
    );

    await inbox.ingest(sobre());

    const [[args]] = prisma.inboxEvent.update.mock.calls;
    expect(args.data.error).toHaveLength(500);
  });

  it('no deja registrar dos handlers para el mismo tipo', () => {
    inbox.register('streetClosureApproved', jest.fn());

    expect(() => inbox.register('streetClosureApproved', jest.fn())).toThrow();
  });

  it('lista los tipos registrados, ordenados', () => {
    inbox.register('workOrderCompleted', jest.fn());
    inbox.register('streetClosureApproved', jest.fn());

    expect(inbox.registeredTypes()).toEqual(['streetClosureApproved', 'workOrderCompleted']);
  });

  it('un error que no es P2002 se propaga: no es un duplicado', async () => {
    inbox.register('streetClosureApproved', jest.fn());
    prisma.inboxEvent.create.mockRejectedValue(new Error('la base se cayó'));

    await expect(inbox.ingest(sobre())).rejects.toThrow('la base se cayó');
  });

  describe('persistencia del payload', () => {
    const payloadGuardado = () => prisma.inboxEvent.create.mock.calls[0][0].data.payload;

    it('sin handler: redacta el payload y sigue devolviendo ignored', async () => {
      const result = await inbox.ingest(sobre({ eventType: 'eventoAjeno' }));

      expect(result.status).toBe('ignored');
      expect(payloadGuardado()).toEqual(REDACTED_PAYLOAD);
      expect(prisma.inboxEvent.create.mock.calls[0][0].data).toMatchObject({
        messageId: MESSAGE_ID,
        eventType: 'eventoAjeno',
      });
    });

    it('con persistPayload en false: redacta pero igual ejecuta el handler', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      inbox.register('ticketUpdated', handler, { persistPayload: () => false });

      const result = await inbox.ingest(sobre({ eventType: 'ticketUpdated' }));

      expect(result.status).toBe('processed');
      expect(handler).toHaveBeenCalledWith({ closureRequestId: 'xyz' }, OCURRIDO);
      expect(payloadGuardado()).toEqual(REDACTED_PAYLOAD);
      expect(prisma.inboxEvent.update.mock.calls[0][0].data.processedAt).toBeInstanceOf(Date);
    });

    it('con persistPayload en true: conserva el payload completo', async () => {
      inbox.register('ticketUpdated', jest.fn(), { persistPayload: () => true });

      await inbox.ingest(sobre({ eventType: 'ticketUpdated' }));

      expect(payloadGuardado()).toEqual({ closureRequestId: 'xyz' });
    });

    it('persistPayload en true y handler que falla: payload completo, sin processedAt y failed', async () => {
      inbox.register('ticketUpdated', jest.fn().mockRejectedValue(new Error('boom')), {
        persistPayload: () => true,
      });

      const result = await inbox.ingest(sobre({ eventType: 'ticketUpdated' }));

      expect(result.status).toBe('failed');
      expect(payloadGuardado()).toEqual({ closureRequestId: 'xyz' });
      const [[args]] = prisma.inboxEvent.update.mock.calls;
      expect(args.data).toEqual({ error: 'boom' });
    });

    it('si persistPayload lanza, redacta y el ingest sigue', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      inbox.register('ticketUpdated', handler, {
        persistPayload: () => {
          throw new Error('regla rota');
        },
      });

      const result = await inbox.ingest(sobre({ eventType: 'ticketUpdated' }));

      expect(result.status).toBe('processed');
      expect(handler).toHaveBeenCalled();
      expect(payloadGuardado()).toEqual(REDACTED_PAYLOAD);
    });

    it('el marcador es inmutable', () => {
      expect(Object.isFrozen(REDACTED_PAYLOAD)).toBe(true);
    });

    it('sin la opción conserva el payload', async () => {
      inbox.register('streetClosureApproved', jest.fn());

      await inbox.ingest(sobre());

      expect(payloadGuardado()).toEqual({ closureRequestId: 'xyz' });
    });

    it('un duplicado redactado sigue dando duplicate', async () => {
      inbox.register('ticketUpdated', jest.fn(), { persistPayload: () => false });
      prisma.inboxEvent.create.mockRejectedValue(duplicado());

      const result = await inbox.ingest(sobre({ eventType: 'ticketUpdated' }));

      expect(result.status).toBe('duplicate');
    });
  });

  /**
   * #267: lo que un handler publica sigue el hilo del evento que lo causó. Se
   * usa el OutboxService real, encolando dentro de una transacción como lo
   * hace el dominio, para que el contexto tenga que atravesar los `await`.
   */
  describe('traza hacia los eventos publicados (#267)', () => {
    const CORRELATION = '8a1f0c22-5d3e-4b77-9c10-6e2b4a90f3d5';
    const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    let tx: { outboxEvent: { create: jest.Mock; createMany: jest.Mock } };

    beforeEach(() => {
      tx = { outboxEvent: { create: jest.fn(), createMany: jest.fn() } };
      prisma.$transaction = jest.fn(async (fn: (t: unknown) => Promise<void>) => {
        await new Promise((r) => setImmediate(r));
        return fn(tx);
      });
      const outbox = new OutboxService();
      inbox.register('streetClosureApproved', () =>
        prisma.$transaction((t: Prisma.TransactionClient) =>
          outbox.enqueue(t, {
            eventType: EventType.UPDATE_TICKET_STATUS,
            aggregateType: AggregateType.ENVIRONMENTAL_REPORT,
            aggregateId: '99999999-9999-9999-9999-999999999999',
            payload: {},
          }),
        ),
      );
    });

    const encolado = () => tx.outboxEvent.create.mock.calls[0][0].data;

    it('copia el correlationId del consumido y usa su eventId como causationId', async () => {
      await inbox.ingest(sobre({ sourceModule: 'transito', correlationId: CORRELATION }));

      expect(encolado()).toMatchObject({ correlationId: CORRELATION, causationId: MESSAGE_ID });
      expect(prisma.inboxEvent.create.mock.calls[0][0].data).toMatchObject({
        correlationId: CORRELATION,
        sourceModule: 'transito',
      });
    });

    /** Un módulo que todavía no migró al sobre del Core: el hilo no se corta. */
    it('sin correlationId en el sobre, el eventId del consumido abre el hilo', async () => {
      await inbox.ingest(sobre());

      expect(encolado()).toMatchObject({ correlationId: MESSAGE_ID, causationId: MESSAGE_ID });
      expect(prisma.inboxEvent.create.mock.calls[0][0].data.correlationId).toBe(MESSAGE_ID);
    });

    /** Ni el Core ni las columnas uuid admiten otra cosa: el hilo arranca acá. */
    it('si el eventId no es uuid, genera un correlationId y no cita causa', async () => {
      await inbox.ingest(sobre({ eventId: 'm2-evt-001' }));

      expect(encolado().correlationId).toMatch(UUID);
      expect(encolado().causationId).toBeNull();
    });

    /**
     * `@IsUUID()` deja pasar el nulo y el máximo. Reenviarlos en nuestro sobre
     * arriesga que el Core rechace el derivado: no se heredan, pero el
     * consumido se procesa igual.
     */
    it.each(['00000000-0000-0000-0000-000000000000', 'ffffffff-ffff-ffff-ffff-ffffffffffff'])(
      'un correlationId %s no se hereda y el evento se procesa',
      async (correlationId) => {
        const res = await inbox.ingest(sobre({ correlationId }));

        expect(res.status).toBe('processed');
        expect(encolado()).toMatchObject({ correlationId: MESSAGE_ID, causationId: MESSAGE_ID });
      },
    );

    it('un eventId UUID nulo no es causa: hilo nuevo, sin rechazar el evento', async () => {
      const res = await inbox.ingest(
        sobre({ eventId: '00000000-0000-0000-0000-000000000000', correlationId: CORRELATION }),
      );

      expect(res.status).toBe('processed');
      expect(encolado()).toMatchObject({ correlationId: CORRELATION, causationId: null });
    });

    /**
     * El contexto es por cadena asincrónica, no global: dos consumidos que se
     * intercalan (el `$transaction` del beforeEach cede con setImmediate) no se
     * pisan la traza.
     */
    it('dos ingest concurrentes no mezclan sus trazas', async () => {
      const OTRO_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
      const OTRA_CORRELATION = '2b1d7f3e-0c4a-4e8b-9f6d-3a5c1e7b9d20';

      await Promise.all([
        inbox.ingest(sobre({ correlationId: CORRELATION })),
        inbox.ingest(sobre({ eventId: OTRO_ID, correlationId: OTRA_CORRELATION })),
      ]);

      const filas = tx.outboxEvent.create.mock.calls.map(([{ data }]) => data);
      expect(filas).toHaveLength(2);
      expect(filas).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ correlationId: CORRELATION, causationId: MESSAGE_ID }),
          expect.objectContaining({ correlationId: OTRA_CORRELATION, causationId: OTRO_ID }),
        ]),
      );
    });

    it('el reintento usa el correlationId guardado, no el del reenvío', async () => {
      const GUARDADO = '11111111-2222-4333-8444-555555555555';
      prisma.inboxEvent.create.mockRejectedValue(duplicado());
      prisma.inboxEvent.updateMany.mockResolvedValue({ count: 1 });
      prisma.inboxEvent.findUniqueOrThrow.mockResolvedValue({
        payload: { closureRequestId: 'xyz' },
        correlationId: GUARDADO,
      });

      await inbox.ingest(sobre({ correlationId: CORRELATION }));

      expect(encolado()).toMatchObject({ correlationId: GUARDADO, causationId: MESSAGE_ID });
    });

    /** Filas anteriores a la columna: no hay hilo guardado y vale el del sobre. */
    it('el reintento de una fila sin correlationId guardado usa el del sobre', async () => {
      prisma.inboxEvent.create.mockRejectedValue(duplicado());
      prisma.inboxEvent.updateMany.mockResolvedValue({ count: 1 });
      prisma.inboxEvent.findUniqueOrThrow.mockResolvedValue({
        payload: { closureRequestId: 'xyz' },
        correlationId: null,
      });

      await inbox.ingest(sobre({ correlationId: CORRELATION }));

      expect(encolado().correlationId).toBe(CORRELATION);
    });
  });
});
