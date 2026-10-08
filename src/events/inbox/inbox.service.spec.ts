import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { InboxService, REDACTED_PAYLOAD } from './inbox.service';
import { InboundEnvelope } from '../envelope';

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
    expect(handler).toHaveBeenCalledWith({ closureRequestId: 'xyz' });
    const [[args]] = prisma.inboxEvent.update.mock.calls;
    expect(args.data.processedAt).toBeInstanceOf(Date);
  });

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

    beforeEach(() => {
      prisma.inboxEvent.create.mockRejectedValue(duplicado());
      prisma.inboxEvent.updateMany.mockResolvedValue({ count: 1 });
      prisma.inboxEvent.findUniqueOrThrow.mockResolvedValue({ payload: GUARDADO });
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
      // El data del sobre nuevo no entra: se reproduce lo de la primera entrega.
      expect(handler).toHaveBeenCalledWith(GUARDADO);
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
      prisma.inboxEvent.findUniqueOrThrow.mockResolvedValue({ payload: REDACTED_PAYLOAD });

      await inbox.ingest(sobre());

      expect(handler).toHaveBeenCalledWith({ closureRequestId: 'xyz' });
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
      expect(handler).toHaveBeenCalledWith({ closureRequestId: 'xyz' });
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
});
