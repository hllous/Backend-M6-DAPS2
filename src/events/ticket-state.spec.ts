import { TicketStateSource } from '@prisma/client';
import {
  deducirEstado,
  leerEstado,
  registrarDeducido,
  registrarRecibido,
  scheduleUpdate,
  startUpdate,
  textoProgramacion,
} from './ticket-state';

const fecha = new Date('2026-10-21T00:00:00.000Z');
const hora = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`);

describe('ticket-state', () => {
  describe('deducirEstado', () => {
    it.each([
      ['STARTED', 'IN_PROGRESS'],
      ['INFORMATION_REQUIRED', 'PENDING_INFORMATION'],
      ['RETURNED', 'IN_REVIEW'],
      ['RESOLVED', 'RESOLVED'],
      ['REJECTED', 'CANCELLED'],
    ] as const)('%s deja el ticket en %s', (updateType, estado) => {
      expect(deducirEstado(updateType)).toBe(estado);
    });

    it('PROGRESS no cambia el estado', () => {
      expect(deducirEstado('PROGRESS')).toBeNull();
    });
  });

  describe('textoProgramacion', () => {
    it('fecha y franja, en es-AR', () => {
      expect(textoProgramacion(fecha, hora('08:00'), hora('12:30'))).toBe(
        'Su servicio fue programado para el miércoles 21 de octubre de 2026, entre las 08:00 y las 12:30 hs.',
      );
    });

    it('sin franja, solo la fecha', () => {
      expect(textoProgramacion(fecha, null, null)).toBe(
        'Su servicio fue programado para el miércoles 21 de octubre de 2026.',
      );
    });

    it('una sola punta de la franja no se inventa', () => {
      const solo = 'Su servicio fue programado para el miércoles 21 de octubre de 2026.';
      expect(textoProgramacion(fecha, hora('08:00'), null)).toBe(solo);
      expect(textoProgramacion(fecha, null, hora('12:30'))).toBe(solo);
    });

    it('una reprogramación lo dice', () => {
      expect(textoProgramacion(fecha, hora('08:00'), hora('12:30'), true)).toMatch(
        /^Su servicio fue reprogramado para el miércoles 21/,
      );
    });

    it('la fecha es un día de calendario: no se corre con la zona horaria', () => {
      // 1 de enero a las 00:00 UTC seguiría siendo 1 de enero; pasado a UTC-3 sería 31/12.
      expect(textoProgramacion(new Date('2027-01-01T00:00:00.000Z'), null, null)).toContain(
        'viernes 1 de enero de 2027',
      );
    });
  });

  describe('scheduleUpdate', () => {
    const texto = 'Su servicio fue programado para el lunes.';

    it.each(['ROUTED', null, undefined])('con el ticket en %s: STARTED', (estado) => {
      expect(scheduleUpdate(estado, texto)).toEqual({
        updateType: 'STARTED',
        publicMessage: texto,
      });
    });

    it('con el ticket IN_PROGRESS: PROGRESS', () => {
      expect(scheduleUpdate('IN_PROGRESS', texto)).toEqual({
        updateType: 'PROGRESS',
        publicMessage: texto,
      });
    });

    it.each([
      'REGISTERED',
      'IN_REVIEW',
      'PENDING_INFORMATION',
      'RESOLVED',
      'CLOSED',
      'CANCELLED',
      'DUPLICATE',
      'LO_QUE_SEA',
    ])('con el ticket en %s: no publica', (estado) => {
      expect(scheduleUpdate(estado, texto)).toBeNull();
    });
  });

  describe('startUpdate', () => {
    it('IN_PROGRESS manda PROGRESS para no repetir STARTED', () => {
      expect(startUpdate('IN_PROGRESS')).toBe('PROGRESS');
    });

    it.each(['ROUTED', null, undefined])('con %s es STARTED', (estado) => {
      expect(startUpdate(estado)).toBe('STARTED');
    });

    it.each([
      'REGISTERED',
      'IN_REVIEW',
      'PENDING_INFORMATION',
      'RESOLVED',
      'CLOSED',
      'CANCELLED',
      'DUPLICATE',
    ])('con %s no publica', (estado) => {
      expect(startUpdate(estado)).toBeNull();
    });
  });

  describe('persistencia', () => {
    let db: { ticketM2State: { findUnique: jest.Mock; upsert: jest.Mock } };

    beforeEach(() => {
      db = { ticketM2State: { findUnique: jest.fn(), upsert: jest.fn() } };
    });

    it('leerEstado devuelve el status o null', async () => {
      db.ticketM2State.findUnique.mockResolvedValueOnce({ status: 'ROUTED' });
      expect(await leerEstado(db as never, 'tck-1')).toBe('ROUTED');

      db.ticketM2State.findUnique.mockResolvedValueOnce(null);
      expect(await leerEstado(db as never, 'tck-1')).toBeNull();
    });

    it('registrarDeducido guarda la deducción sin tocar receivedAt', async () => {
      await registrarDeducido(db as never, 'tck-1', 'STARTED');

      expect(db.ticketM2State.upsert).toHaveBeenCalledWith({
        where: { ticketId: 'tck-1' },
        create: { ticketId: 'tck-1', status: 'IN_PROGRESS', source: TicketStateSource.DEDUCED },
        update: { status: 'IN_PROGRESS', source: TicketStateSource.DEDUCED },
      });
    });

    it('registrarDeducido de PROGRESS no escribe nada', async () => {
      await registrarDeducido(db as never, 'tck-1', 'PROGRESS');
      expect(db.ticketM2State.upsert).not.toHaveBeenCalled();
    });

    it('registrarRecibido guarda el estado de M2 con su marca de orden', async () => {
      db.ticketM2State.findUnique.mockResolvedValue(null);
      const at = new Date('2026-10-20T10:00:00.000Z');

      expect(await registrarRecibido(db as never, 'tck-1', 'ROUTED', at)).toBe(true);

      expect(db.ticketM2State.upsert).toHaveBeenCalledWith({
        where: { ticketId: 'tck-1' },
        create: {
          ticketId: 'tck-1',
          status: 'ROUTED',
          source: TicketStateSource.RECEIVED,
          receivedAt: at,
        },
        update: { status: 'ROUTED', source: TicketStateSource.RECEIVED, receivedAt: at },
      });
    });

    it('un recibido más viejo que el último recibido no lo pisa', async () => {
      db.ticketM2State.findUnique.mockResolvedValue({
        receivedAt: new Date('2026-10-20T10:00:00.000Z'),
      });

      const aplicado = await registrarRecibido(
        db as never,
        'tck-1',
        'ROUTED',
        new Date('2026-10-20T09:00:00.000Z'),
      );

      expect(aplicado).toBe(false);
      expect(db.ticketM2State.upsert).not.toHaveBeenCalled();
    });

    it('un recibido con la misma marca se reaplica (reintento idempotente)', async () => {
      const at = new Date('2026-10-20T10:00:00.000Z');
      db.ticketM2State.findUnique.mockResolvedValue({ receivedAt: at });

      expect(await registrarRecibido(db as never, 'tck-1', 'ROUTED', at)).toBe(true);
    });

    it('un recibido manda sobre una deducción, aunque no tenga receivedAt', async () => {
      db.ticketM2State.findUnique.mockResolvedValue({ receivedAt: null });

      const aplicado = await registrarRecibido(
        db as never,
        'tck-1',
        'IN_REVIEW',
        new Date('2026-10-20T09:00:00.000Z'),
      );

      expect(aplicado).toBe(true);
    });

    describe('solo se persiste lo que M2 puede mandar', () => {
      it.each([
        'REGISTERED',
        'IN_REVIEW',
        'ROUTED',
        'IN_PROGRESS',
        'PENDING_INFORMATION',
        'DUPLICATE',
        'RESOLVED',
        'CLOSED',
        'CANCELLED',
      ])('el estado %s de §3 se guarda', async (estado) => {
        db.ticketM2State.findUnique.mockResolvedValue(null);

        expect(await registrarRecibido(db as never, 'tck-1', estado, null)).toBe(true);
        expect(db.ticketM2State.upsert).toHaveBeenCalled();
      });

      it.each(['LO_QUE_SEA', 'in_progress', 'IN_PROGRESS ', 'X'.repeat(5000), '', 'REOPENED'])(
        'un valor fuera de la lista (%.20s) no se persiste',
        async (valor) => {
          expect(await registrarRecibido(db as never, 'tck-1', valor, null)).toBe(false);
          expect(db.ticketM2State.upsert).not.toHaveBeenCalled();
        },
      );

      it('un ticketId vacío o demasiado largo no se persiste, ni recibido ni deducido', async () => {
        for (const id of ['', 'T'.repeat(65)]) {
          expect(await registrarRecibido(db as never, id, 'ROUTED', null)).toBe(false);
          await registrarDeducido(db as never, id, 'STARTED');
        }
        expect(db.ticketM2State.upsert).not.toHaveBeenCalled();
      });

      it('un ticketId de 64 caracteres sí', async () => {
        db.ticketM2State.findUnique.mockResolvedValue(null);
        expect(await registrarRecibido(db as never, 'T'.repeat(64), 'ROUTED', null)).toBe(true);
      });

      // Un string basura no puede dejar al ticket en un estado "raro" que haga
      // callar el aviso de programación: simplemente no se guarda.
      it('con basura recibida el aviso de programación se sigue emitiendo', async () => {
        db.ticketM2State.findUnique.mockResolvedValue(null);
        await registrarRecibido(db as never, 'tck-1', 'BASURA', null);

        const estado = await leerEstado(db as never, 'tck-1');

        expect(scheduleUpdate(estado, 'texto')).toEqual({
          updateType: 'STARTED',
          publicMessage: 'texto',
        });
      });
    });

    it('sin marca de orden se aplica y no pisa la que había', async () => {
      db.ticketM2State.findUnique.mockResolvedValue({ receivedAt: new Date() });

      expect(await registrarRecibido(db as never, 'tck-1', 'RESOLVED', null)).toBe(true);
      expect(db.ticketM2State.upsert.mock.calls[0][0].update).toEqual({
        status: 'RESOLVED',
        source: TicketStateSource.RECEIVED,
      });
    });
  });
});
