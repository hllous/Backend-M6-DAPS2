import { ConflictException } from '@nestjs/common';
import { TreeInterventionStatus, TreeInterventionType } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { TreeInterventionsService } from './tree-interventions.service';

describe('TreeInterventionsService — autorización', () => {
  let prisma: { treeIntervention: { findUnique: jest.Mock; update: jest.Mock } };
  let service: TreeInterventionsService;

  const intervention = (over: Partial<Record<string, unknown>> = {}) => ({
    id: '11111111-1111-1111-1111-111111111111',
    interventionType: TreeInterventionType.REMOVAL,
    status: TreeInterventionStatus.REQUESTED,
    trees: [],
    ...over,
  });

  beforeEach(() => {
    prisma = {
      treeIntervention: {
        findUnique: jest.fn(),
        update: jest.fn((args) => ({ ...intervention(), ...args.data, trees: [] })),
      },
    };
    service = new TreeInterventionsService(prisma as unknown as PrismaService);
  });

  it('no deja autorizar una extraccion que sigue en REQUESTED', async () => {
    prisma.treeIntervention.findUnique.mockResolvedValue(intervention());

    await expect(service.authorize(intervention().id, {})).rejects.toThrow(ConflictException);
    expect(prisma.treeIntervention.update).not.toHaveBeenCalled();
  });

  it('autoriza una extraccion que ya paso por PENDING_AUTHORIZATION', async () => {
    prisma.treeIntervention.findUnique.mockResolvedValue(
      intervention({ status: TreeInterventionStatus.PENDING_AUTHORIZATION }),
    );

    await service.authorize(intervention().id, { authorizedByUserId: 'user-1' });

    expect(prisma.treeIntervention.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: TreeInterventionStatus.AUTHORIZED }),
      }),
    );
  });

  it('autoriza una poda directo desde REQUESTED, que no requiere autorizacion', async () => {
    prisma.treeIntervention.findUnique.mockResolvedValue(
      intervention({ interventionType: TreeInterventionType.SAFETY_PRUNING }),
    );

    await service.authorize(intervention().id, {});

    expect(prisma.treeIntervention.update).toHaveBeenCalled();
  });
});
