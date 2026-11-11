import { ConflictException } from '@nestjs/common';
import { RepairRequestStatus as R, StreetClosureRequestStatus as C } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { ACTOR } from '../../common/audit/audit-test-actor';
import { OutboundRequestsService } from './outbound-requests.service';
import {
  CLOSURE_TRANSITIONS,
  REPAIR_TRANSITIONS,
  assertTransition,
} from './outbound-requests.transitions';

/**
 * #570: toda transición que REPAIR_/CLOSURE_TRANSITIONS no permite devuelve 409
 * y no escribe nada. Los pares salen de las tablas importadas.
 */
describe('OutboundRequestsService — transiciones inválidas (409)', () => {
  const ID = '22222222-2222-2222-2222-222222222222';

  let prisma: any;
  let outbox: any;
  let audit: any;
  let service: OutboundRequestsService;

  beforeEach(() => {
    prisma = {
      repairRequest: { findUnique: vi.fn(), update: vi.fn() },
      streetClosureRequest: { findUnique: vi.fn(), update: vi.fn() },
      $transaction: vi.fn(),
    };
    outbox = { enqueue: vi.fn(), enqueueMany: vi.fn() };
    audit = { record: vi.fn() };
    service = new OutboundRequestsService(
      prisma as unknown as PrismaService,
      outbox,
      audit as unknown as AuditService,
    );
  });

  const sinEscrituras = (model: 'repairRequest' | 'streetClosureRequest') => {
    expect(prisma[model].update).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(outbox.enqueue).not.toHaveBeenCalled();
    expect(outbox.enqueueMany).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  };

  const complemento = <S extends string>(tabla: Record<S, S[]>, destinos: S[]) =>
    (Object.keys(tabla) as S[]).flatMap((from) =>
      destinos.filter((to) => !tabla[from].includes(to)).map((to) => [from, to] as [S, S]),
    );

  describe('reparación', () => {
    const acciones: [string, R, (id: string) => Promise<unknown>][] = [
      ['startRepair', R.IN_PROGRESS, (id) => service.startRepair(id, {}, ACTOR)],
      ['closeRepair', R.CLOSED, (id) => service.closeRepair(id, ACTOR)],
    ];
    const casos = acciones.flatMap(([nombre, to, run]) =>
      complemento(REPAIR_TRANSITIONS, [to]).map(
        ([from]) => [nombre, from, to, run] as [string, R, R, typeof run],
      ),
    );

    it.each(casos)('%s desde %s hacia %s: 409 y no escribe nada', async (_n, from, _to, run) => {
      prisma.repairRequest.findUnique.mockResolvedValue({ id: ID, status: from });

      const p = run(ID);

      await expect(p).rejects.toBeInstanceOf(ConflictException);
      await expect(p).rejects.toMatchObject({ status: 409 });
      sinEscrituras('repairRequest');
    });
  });

  describe('corte de calle', () => {
    const acciones: [string, C, (id: string) => Promise<unknown>][] = [
      ['approveClosure', C.APPROVED, (id) => service.approveClosure(id, {}, ACTOR)],
      ['rejectClosure', C.REJECTED, (id) => service.rejectClosure(id, 'obra', ACTOR)],
      ['endClosure', C.ENDED, (id) => service.endClosure(id, ACTOR)],
    ];
    const casos = acciones.flatMap(([nombre, to, run]) =>
      complemento(CLOSURE_TRANSITIONS, [to]).map(
        ([from]) => [nombre, from, to, run] as [string, C, C, typeof run],
      ),
    );

    it.each(casos)('%s desde %s hacia %s: 409 y no escribe nada', async (_n, from, _to, run) => {
      prisma.streetClosureRequest.findUnique.mockResolvedValue({
        id: ID,
        status: from,
        streets: [],
      });

      const p = run(ID);

      await expect(p).rejects.toBeInstanceOf(ConflictException);
      await expect(p).rejects.toMatchObject({ status: 409 });
      sinEscrituras('streetClosureRequest');
    });
  });

  // Pares fijos, independientes de las tablas: CLOSED, REJECTED y ENDED son
  // terminales y un evento tardío o una llamada manual no los reabre.
  describe('críticos: salidas de estados terminales', () => {
    it.each([
      ['startRepair', R.CLOSED],
      ['closeRepair', R.CLOSED],
    ] as [string, R][])('reparación: %s desde %s es 409', async (nombre, from) => {
      prisma.repairRequest.findUnique.mockResolvedValue({ id: ID, status: from });
      const run =
        nombre === 'startRepair'
          ? service.startRepair(ID, {}, ACTOR)
          : service.closeRepair(ID, ACTOR);

      await expect(run).rejects.toBeInstanceOf(ConflictException);
      sinEscrituras('repairRequest');
    });

    it.each([
      ['approveClosure', C.REJECTED],
      ['approveClosure', C.ENDED],
      ['rejectClosure', C.ENDED],
      ['rejectClosure', C.REJECTED],
      ['endClosure', C.REJECTED],
      ['endClosure', C.ENDED],
    ] as [string, C][])('corte: %s desde %s es 409', async (nombre, from) => {
      prisma.streetClosureRequest.findUnique.mockResolvedValue({
        id: ID,
        status: from,
        streets: [],
      });
      const run =
        nombre === 'approveClosure'
          ? service.approveClosure(ID, {}, ACTOR)
          : nombre === 'rejectClosure'
            ? service.rejectClosure(ID, 'obra', ACTOR)
            : service.endClosure(ID, ACTOR);

      await expect(run).rejects.toBeInstanceOf(ConflictException);
      sinEscrituras('streetClosureRequest');
    });
  });

  // Incluye destinos sin endpoint (REQUESTED, EXPIRED, que fija el sweeper) y
  // los pares de estado a sí mismo: complemento completo contra la regla compartida.
  describe('assertTransition: complemento completo de cada tabla', () => {
    const reparacion = complemento(REPAIR_TRANSITIONS, Object.keys(REPAIR_TRANSITIONS) as R[]);
    const corte = complemento(CLOSURE_TRANSITIONS, Object.keys(CLOSURE_TRANSITIONS) as C[]);

    it.each(reparacion)('reparación %s → %s lanza 409', (from, to) => {
      expect(() => assertTransition(REPAIR_TRANSITIONS, from, to)).toThrow(ConflictException);
    });

    it.each(corte)('corte %s → %s lanza 409', (from, to) => {
      expect(() => assertTransition(CLOSURE_TRANSITIONS, from, to)).toThrow(ConflictException);
    });
  });
});
