import { ConflictException } from '@nestjs/common';
import { M6Role, TreeInterventionStatus as I, TreeInterventionType as T } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { TreeInterventionsService, VALID_TRANSITIONS } from './tree-interventions.service';

/**
 * #570: toda transición que VALID_TRANSITIONS no permite devuelve 409 y no
 * escribe nada. Los pares salen de la tabla importada.
 */
describe('TreeInterventionsService — transiciones inválidas (409)', () => {
  const ID = '11111111-1111-1111-1111-111111111111';
  const ACTOR = { userId: 'user-7', roles: [M6Role.M6_ADMIN] };
  const ESTADOS = Object.keys(VALID_TRANSITIONS) as I[];

  let prisma: any;
  let audit: any;
  let service: TreeInterventionsService;

  beforeEach(() => {
    prisma = {
      treeIntervention: { findUnique: jest.fn(), update: jest.fn() },
      $transaction: jest.fn(),
    };
    audit = { record: jest.fn() };
    service = new TreeInterventionsService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
    );
  });

  const acciones: Record<string, { to: I; run: () => Promise<unknown> }> = {
    submitForAuthorization: {
      to: I.PENDING_AUTHORIZATION,
      run: () => service.submitForAuthorization(ID, ACTOR),
    },
    authorize: { to: I.AUTHORIZED, run: () => service.authorize(ID, {}, ACTOR) },
    reject: { to: I.REJECTED, run: () => service.reject(ID, ACTOR) },
  };

  const casos: [string, I, I][] = Object.entries(acciones).flatMap(([nombre, { to }]) =>
    ESTADOS.filter((from) => !VALID_TRANSITIONS[from].includes(to)).map(
      (from) => [nombre, from, to] as [string, I, I],
    ),
  );

  it.each(casos)('%s desde %s hacia %s: 409 y no escribe nada', async (nombre, from) => {
    prisma.treeIntervention.findUnique.mockResolvedValue({
      id: ID,
      interventionType: T.REMOVAL,
      status: from,
      trees: [],
    });

    const p = acciones[nombre].run();

    await expect(p).rejects.toBeInstanceOf(ConflictException);
    await expect(p).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining(`'${from}'`),
    });
    expect(prisma.treeIntervention.update).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });
});
