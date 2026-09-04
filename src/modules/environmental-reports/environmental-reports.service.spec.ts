import { ConflictException, NotFoundException } from '@nestjs/common';
import { EnvironmentalReport, EnvironmentalReportStatus as S, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OutboxService } from '../../events/outbox/outbox.service';
import { EnvironmentalReportsService, REPORT_TRANSITIONS } from './environmental-reports.service';

const ID = '11111111-1111-1111-1111-111111111111';
const ACTOR = 'inspector-7';

/** Todos los estados, para poder recorrer la tabla entera. */
const ESTADOS = Object.keys(REPORT_TRANSITIONS) as S[];

describe('EnvironmentalReportsService', () => {
  let prisma: any;
  let outbox: any;
  let service: EnvironmentalReportsService;

  const expediente = (over: Partial<EnvironmentalReport> = {}): EnvironmentalReport =>
    ({
      id: ID,
      reportType: 'NOISE',
      status: S.RECEIVED,
      address: 'Av. Rivadavia 4500',
      lat: new Prisma.Decimal('-34.6037'),
      lng: null,
      ticketId: 'TCK-2026-004512',
      reporterSnapshot: null,
      priority: 'HIGH',
      escalated: false,
      citizenResponse: null,
      deadlineAt: null,
      createdAt: new Date('2026-08-01T10:00:00.000Z'),
      updatedAt: new Date('2026-08-02T10:00:00.000Z'),
      ...over,
    }) as EnvironmentalReport;

  beforeEach(() => {
    prisma = {
      environmentalReport: {
        create: jest.fn().mockResolvedValue(expediente()),
        findUnique: jest.fn().mockResolvedValue(expediente()),
        findMany: jest.fn().mockResolvedValue([expediente()]),
        count: jest.fn().mockResolvedValue(1),
        update: jest.fn(),
      },
      // Prisma acepta callback o array; los tests usan siempre el callback.
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    outbox = { enqueueMany: jest.fn().mockResolvedValue(undefined) };
    service = new EnvironmentalReportsService(
      prisma as unknown as PrismaService,
      outbox as unknown as OutboxService,
    );
  });

  /** Mueve el expediente y devuelve lo que se escribió y lo que se encoló. */
  async function transicionar(
    desde: S,
    accion: (s: EnvironmentalReportsService) => Promise<unknown>,
  ) {
    prisma.environmentalReport.findUnique.mockResolvedValue(expediente({ status: desde }));
    prisma.environmentalReport.update.mockImplementation(({ data }: any) =>
      Promise.resolve(expediente({ status: data.status })),
    );
    await accion(service);
    return {
      escrito: prisma.environmentalReport.update.mock.calls[0]?.[0],
      encolado: outbox.enqueueMany.mock.calls[0]?.[1] ?? [],
    };
  }

  // ─── La tabla de transiciones ───────────────────────

  describe('REPORT_TRANSITIONS', () => {
    it('cubre los once estados: ninguno queda sin fila', () => {
      expect(ESTADOS).toHaveLength(11);
      for (const estado of ESTADOS) {
        expect(REPORT_TRANSITIONS[estado]).toBeDefined();
      }
    });

    it('nunca apunta a un estado que no existe', () => {
      for (const estado of ESTADOS) {
        for (const destino of REPORT_TRANSITIONS[estado]) {
          expect(ESTADOS).toContain(destino);
        }
      }
    });

    // El criterio de la Fase 6: la reapertura no revierte lo que resolvió M4.
    it('SANCTIONED no admite reapertura, los otros cierres sí', () => {
      expect(REPORT_TRANSITIONS.SANCTIONED).not.toContain(S.UNDER_REVIEW);
      for (const cierre of [S.CLOSED, S.DISMISSED, S.NO_VIOLATION, S.FORWARDED]) {
        expect(REPORT_TRANSITIONS[cierre]).toContain(S.UNDER_REVIEW);
      }
    });

    it('ningún estado se transiciona a sí mismo', () => {
      for (const estado of ESTADOS) {
        expect(REPORT_TRANSITIONS[estado]).not.toContain(estado);
      }
    });
  });

  describe('assertTransition', () => {
    it('deja pasar lo que la tabla permite', () => {
      expect(() => service.assertTransition(S.RECEIVED, S.UNDER_REVIEW)).not.toThrow();
    });

    it('el 409 nombra las transiciones válidas desde donde está', () => {
      expect(() => service.assertTransition(S.RECEIVED, S.CLOSED)).toThrow(ConflictException);
      try {
        service.assertTransition(S.RECEIVED, S.CLOSED);
      } catch (error) {
        // Sin esto el operador ve "no se puede" y no sabe qué sí puede.
        expect((error as Error).message).toContain('UNDER_REVIEW');
      }
    });

    it.each(ESTADOS)('desde %s, la tabla y el guard dicen lo mismo', (desde) => {
      for (const hasta of ESTADOS) {
        const permitida = REPORT_TRANSITIONS[desde].includes(hasta);
        const lanza = (() => {
          try {
            service.assertTransition(desde, hasta);
            return false;
          } catch {
            return true;
          }
        })();
        expect(lanza).toBe(!permitida);
      }
    });
  });

  // ─── Las acciones ───────────────────────────────────

  describe('acciones del expediente', () => {
    it('startReview lo pone en análisis y le avisa al vecino', async () => {
      const { escrito, encolado } = await transicionar(S.RECEIVED, (s) => s.startReview(ID, ACTOR));

      expect(escrito.data.status).toBe(S.UNDER_REVIEW);
      expect(encolado).toHaveLength(1);
      expect(encolado[0].payload).toMatchObject({
        ticketId: 'TCK-2026-004512',
        updateType: 'STARTED',
        // M2 quiere saber si lo movió un vecino o un agente del área.
        updatedBy: { type: 'AREA_USER', id: ACTOR },
      });
    });

    /**
     * Devolver un reclamo que no es de nuestra área no es desestimarlo: son dos
     * mensajes distintos para el vecino, y M2 los muestra distinto.
     */
    it('forward sale hacia M2 como RETURNED, no como REJECTED', async () => {
      const { escrito, encolado } = await transicionar(S.UNDER_REVIEW, (s) =>
        s.forward(ID, 'Corresponde a Obras Públicas', ACTOR),
      );

      expect(escrito.data.status).toBe(S.FORWARDED);
      expect(encolado[0].payload).toMatchObject({
        updateType: 'RETURNED',
        internalMessage: 'Corresponde a Obras Públicas',
        details: { returnInfo: { reasonCode: 'REQUEST_TYPE_MISMATCH' } },
      });
    });

    it('dismiss sale como REJECTED', async () => {
      const { encolado } = await transicionar(S.UNDER_REVIEW, (s) =>
        s.dismiss(ID, 'No se constató el ruido', ACTOR),
      );

      expect(encolado[0].payload).toMatchObject({
        updateType: 'REJECTED',
        details: { cancellation: { reasonCode: 'DOES_NOT_APPLY' } },
      });
    });

    it('close avisa la resolución', async () => {
      const { escrito, encolado } = await transicionar(S.NO_VIOLATION, (s) => s.close(ID, ACTOR));

      expect(escrito.data.status).toBe(S.CLOSED);
      expect(encolado[0].payload).toMatchObject({
        updateType: 'RESOLVED',
        details: { resolution: { type: 'ACTION_COMPLETED' } },
      });
    });

    /**
     * `SANCTIONED` es el único cierre que no se reabre: eso ya lo resolvió M4 y
     * no es nuestro para revertir. Desde `CLOSED` sí se puede, que es lo que
     * permite la reapertura por `ticketUpdated/REOPENED`.
     */
    it('una acción que la tabla no permite no escribe nada', async () => {
      prisma.environmentalReport.findUnique.mockResolvedValue(expediente({ status: S.SANCTIONED }));

      await expect(service.startReview(ID, ACTOR)).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.environmentalReport.update).not.toHaveBeenCalled();
      expect(outbox.enqueueMany).not.toHaveBeenCalled();
    });

    it('un expediente cerrado sí se puede reabrir', async () => {
      const { escrito } = await transicionar(S.CLOSED, (s) => s.startReview(ID, ACTOR));

      expect(escrito.data.status).toBe(S.UNDER_REVIEW);
    });

    it('un expediente inexistente da 404', async () => {
      prisma.environmentalReport.findUnique.mockResolvedValue(null);

      await expect(service.startReview(ID, ACTOR)).rejects.toBeInstanceOf(NotFoundException);
    });

    /**
     * Lo que hace que el evento no pueda quedar huérfano: la fila del outbox y
     * el cambio de estado son la misma transacción.
     */
    it('el evento y el cambio de estado van en la misma transacción', async () => {
      await transicionar(S.RECEIVED, (s) => s.startReview(ID, ACTOR));

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      const [tx] = outbox.enqueueMany.mock.calls[0];
      expect(tx).toBe(prisma); // el cliente de la transacción, no el servicio
    });
  });

  // ─── La proyección hacia M2 ─────────────────────────

  describe('ticketEvents', () => {
    /**
     * Una detección de oficio no tiene a quién contestarle: sin `ticketId` no
     * existe el reclamo del otro lado.
     */
    it('un expediente sin ticketId no proyecta nada hacia M2', () => {
      const eventos = service.ticketEvents(expediente({ ticketId: null }), ACTOR, {
        updateType: 'STARTED',
      });

      expect(eventos).toEqual([]);
    });

    it('con ticketId arma un solo updateTicketStatus', () => {
      const eventos = service.ticketEvents(expediente(), ACTOR, { updateType: 'STARTED' });

      expect(eventos).toHaveLength(1);
      expect(eventos[0]).toMatchObject({
        eventType: 'updateTicketStatus',
        aggregateType: 'ENVIRONMENTAL_REPORT',
        aggregateId: ID,
      });
    });

    it('una acción sobre un expediente de oficio no encola nada', async () => {
      prisma.environmentalReport.findUnique.mockResolvedValue(
        expediente({ status: S.RECEIVED, ticketId: null }),
      );
      prisma.environmentalReport.update.mockResolvedValue(expediente({ status: S.UNDER_REVIEW }));

      await service.startReview(ID, ACTOR);

      expect(outbox.enqueueMany).toHaveBeenCalledWith(prisma, []);
    });
  });

  // ─── applyTransition, la puerta para inspección y acta ──

  describe('applyTransition', () => {
    it('escribe sobre el tx que le pasan, no sobre el servicio', async () => {
      const tx = { environmentalReport: { update: jest.fn() } };

      await service.applyTransition(
        tx as any,
        expediente({ status: S.INSPECTED }),
        S.VIOLATION_FOUND,
      );

      expect(tx.environmentalReport.update).toHaveBeenCalledWith({
        where: { id: ID },
        data: { status: S.VIOLATION_FOUND },
      });
      expect(prisma.environmentalReport.update).not.toHaveBeenCalled();
    });

    it('valida la transición igual que las acciones propias', async () => {
      const tx = { environmentalReport: { update: jest.fn() } };

      await expect(
        service.applyTransition(tx as any, expediente({ status: S.RECEIVED }), S.SANCTIONED),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(tx.environmentalReport.update).not.toHaveBeenCalled();
    });

    it('deja pasar datos extra junto con el estado', async () => {
      const tx = { environmentalReport: { update: jest.fn() } };
      const deadlineAt = new Date('2026-10-01T00:00:00.000Z');

      await service.applyTransition(
        tx as any,
        expediente({ status: S.VIOLATION_FOUND }),
        S.NOTICE_ISSUED,
        { deadlineAt },
      );

      expect(tx.environmentalReport.update.mock.calls[0][0].data).toEqual({
        status: S.NOTICE_ISSUED,
        deadlineAt,
      });
    });
  });

  // ─── CRUD ───────────────────────────────────────────

  describe('create y listado', () => {
    it('nace en RECEIVED aunque el DTO no lo diga', async () => {
      await service.create({ reportType: 'NOISE' } as any);

      expect(prisma.environmentalReport.create.mock.calls[0][0].data.status).toBe(S.RECEIVED);
    });

    it('los campos opcionales ausentes se guardan como null, no undefined', async () => {
      await service.create({ reportType: 'NOISE' } as any);

      expect(prisma.environmentalReport.create.mock.calls[0][0].data).toMatchObject({
        address: null,
        lat: null,
        lng: null,
        ticketId: null,
        priority: null,
      });
    });

    it('la búsqueda por texto va contra la dirección, sin distinguir mayúsculas', async () => {
      await service.findAll({ page: 1, pageSize: 20, search: 'rivadavia' } as any);

      expect(prisma.environmentalReport.findMany.mock.calls[0][0].where.address).toEqual({
        contains: 'rivadavia',
        mode: 'insensitive',
      });
    });

    it('sin filtros no arma ningún where', async () => {
      await service.findAll({ page: 1, pageSize: 20 } as any);

      expect(prisma.environmentalReport.findMany.mock.calls[0][0].where).toEqual({});
    });

    it('lista de más nuevo a más viejo', async () => {
      await service.findAll({ page: 1, pageSize: 20 } as any);

      expect(prisma.environmentalReport.findMany.mock.calls[0][0].orderBy).toEqual({
        createdAt: 'desc',
      });
    });

    it('findOne devuelve el detalle y 404 si no está', async () => {
      await expect(service.findOne(ID)).resolves.toMatchObject({ id: ID });

      prisma.environmentalReport.findUnique.mockResolvedValue(null);
      await expect(service.findOne(ID)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('las coordenadas salen como número, y las ausentes como null', async () => {
      const dto = await service.findOne(ID);

      expect(dto.lat).toBe(-34.6037);
      expect(dto.lng).toBeNull();
    });
  });
});
