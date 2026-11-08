import { ConflictException } from '@nestjs/common';
import { RepairRequestStatus, StreetClosureRequestStatus } from '@prisma/client';
import {
  assertTransition,
  CLOSURE_TRANSITIONS,
  REPAIR_TRANSITIONS,
  sourcesOf,
} from './outbound-requests.transitions';

describe('outbound-requests.transitions', () => {
  it('REPAIR_TRANSITIONS: tabla exacta (CLOSED terminal)', () => {
    expect(REPAIR_TRANSITIONS).toEqual({
      REQUESTED: ['IN_PROGRESS', 'CLOSED'],
      IN_PROGRESS: ['CLOSED'],
      CLOSED: [],
    });
  });

  it('CLOSURE_TRANSITIONS: tabla exacta (REJECTED y ENDED terminales)', () => {
    expect(CLOSURE_TRANSITIONS).toEqual({
      REQUESTED: ['APPROVED', 'REJECTED', 'ENDED'],
      APPROVED: ['ENDED', 'EXPIRED'],
      EXPIRED: ['ENDED'],
      REJECTED: [],
      ENDED: [],
    });
  });

  describe('sourcesOf', () => {
    it('devuelve los estados de origen que llegan a `to`', () => {
      expect(sourcesOf(CLOSURE_TRANSITIONS, StreetClosureRequestStatus.ENDED)).toEqual([
        'REQUESTED',
        'APPROVED',
        'EXPIRED',
      ]);
      expect(sourcesOf(REPAIR_TRANSITIONS, RepairRequestStatus.IN_PROGRESS)).toEqual(['REQUESTED']);
    });

    it('devuelve vacío si nada llega a `to`', () => {
      expect(sourcesOf(REPAIR_TRANSITIONS, RepairRequestStatus.REQUESTED)).toEqual([]);
    });
  });

  describe('assertTransition', () => {
    it('acepta una transición válida', () => {
      expect(() =>
        assertTransition(
          CLOSURE_TRANSITIONS,
          StreetClosureRequestStatus.APPROVED,
          StreetClosureRequestStatus.EXPIRED,
        ),
      ).not.toThrow();
    });

    it('rechaza con 409 y el mensaje lista origen, destino y válidas', () => {
      const run = () =>
        assertTransition(
          CLOSURE_TRANSITIONS,
          StreetClosureRequestStatus.APPROVED,
          StreetClosureRequestStatus.REJECTED,
        );
      expect(run).toThrow(ConflictException);
      expect(run).toThrow(
        "No se puede pasar de 'APPROVED' a 'REJECTED'. Transiciones válidas desde 'APPROVED': [ENDED, EXPIRED]",
      );
    });

    it('rechaza desde un estado terminal y lista []', () => {
      expect(() =>
        assertTransition(
          REPAIR_TRANSITIONS,
          RepairRequestStatus.CLOSED,
          RepairRequestStatus.REQUESTED,
        ),
      ).toThrow("Transiciones válidas desde 'CLOSED': []");
    });
  });
});
