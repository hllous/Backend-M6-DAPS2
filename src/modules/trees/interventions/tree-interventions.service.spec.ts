import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  ServiceMode,
  TreeInterventionStatus as I,
  TreeInterventionType as T,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { OutboxService } from '../../../events/outbox/outbox.service';
import { TreeInterventionsService } from './tree-interventions.service';

const ID = '11111111-1111-1111-1111-111111111111';
const SRV = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

describe('TreeInterventionsService', () => {
  let prisma: any;
  let outbox: any;
  let service: TreeInterventionsService;

  const intervencion = (over: Record<string, unknown> = {}) => ({
    id: ID,
    interventionType: T.REMOVAL,
    status: I.REQUESTED,
    serviceId: null,
    address: 'Av. Mitre 1200',
    requiresStreetClosure: false,
    priority: null,
    justification: null,
    authorizedByUserId: null,
    authorizedAt: null,
    createdAt: new Date('2026-08-01T10:00:00.000Z'),
    updatedAt: new Date('2026-08-02T10:00:00.000Z'),
    trees: [{ treeId: 'ar-1' }],
    ...over,
  });

  /** Un servicio POINT listo para ejecutar: con cuadrilla y franja horaria. */
  const servicio = (over: Record<string, unknown> = {}) => ({
    id: SRV,
    mode: ServiceMode.POINT,
    scheduledDate: new Date('2026-09-15T00:00:00.000Z'),
    windowFrom: new Date('1970-01-01T07:00:00.000Z'),
    windowTo: new Date('1970-01-01T11:00:00.000Z'),
    crewId: 'crew-1',
    zones: [{ zoneId: 'z-centro' }],
    ...over,
  });

  const arbol = () => ({
    id: 'ar-1',
    address: 'Av. Mitre 1200',
    lat: new Prisma.Decimal('-34.6037'),
    lng: new Prisma.Decimal('-58.3816'),
  });

  beforeEach(() => {
    prisma = {
      tree: {
        findMany: jest.fn().mockResolvedValue([{ id: 'ar-1' }]),
        findUnique: jest.fn().mockResolvedValue(arbol()),
      },
      treeIntervention: {
        create: jest.fn().mockResolvedValue(intervencion()),
        findUnique: jest.fn().mockResolvedValue(intervencion()),
        findMany: jest.fn().mockResolvedValue([intervencion()]),
        count: jest.fn().mockResolvedValue(1),
        update: jest.fn(({ data }: any) => Promise.resolve(intervencion(data))),
      },
      service: { findUnique: jest.fn().mockResolvedValue(servicio()) },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    outbox = { enqueue: jest.fn().mockResolvedValue(undefined), enqueueMany: jest.fn() };
    service = new TreeInterventionsService(
      prisma as unknown as PrismaService,
      outbox as unknown as OutboxService,
    );
  });

  // ─── Autorización ───────────────────────────────────

  describe('autorización', () => {
    /**
     * La tabla habilita REQUESTED → AUTHORIZED porque las podas no requieren
     * autorización. Sin este chequeo una extracción se colaría por esa puerta.
     */
    it('no deja autorizar una extracción que sigue en REQUESTED', async () => {
      prisma.treeIntervention.findUnique.mockResolvedValue(intervencion());

      await expect(service.authorize(ID, {})).rejects.toThrow(ConflictException);
      expect(prisma.treeIntervention.update).not.toHaveBeenCalled();
    });

    it('autoriza una extracción que ya pasó por PENDING_AUTHORIZATION', async () => {
      prisma.treeIntervention.findUnique.mockResolvedValue(
        intervencion({ status: I.PENDING_AUTHORIZATION }),
      );

      await service.authorize(ID, { authorizedByUserId: 'user-1' });

      expect(prisma.treeIntervention.update.mock.calls[0][0].data).toMatchObject({
        status: I.AUTHORIZED,
        authorizedByUserId: 'user-1',
      });
    });

    it('autoriza una poda directo desde REQUESTED', async () => {
      prisma.treeIntervention.findUnique.mockResolvedValue(
        intervencion({ interventionType: T.SAFETY_PRUNING }),
      );

      await service.authorize(ID, {});

      expect(prisma.treeIntervention.update).toHaveBeenCalled();
    });

    it('sella la fecha de autorización', async () => {
      prisma.treeIntervention.findUnique.mockResolvedValue(
        intervencion({ status: I.PENDING_AUTHORIZATION }),
      );

      await service.authorize(ID, {});

      expect(prisma.treeIntervention.update.mock.calls[0][0].data.authorizedAt).toBeInstanceOf(
        Date,
      );
    });

    it('la justificación solo se pisa si viene', async () => {
      prisma.treeIntervention.findUnique.mockResolvedValue(
        intervencion({ status: I.PENDING_AUTHORIZATION }),
      );

      await service.authorize(ID, {});
      expect(prisma.treeIntervention.update.mock.calls[0][0].data.justification).toBeUndefined();

      await service.authorize(ID, { justification: 'Riesgo de caída' });
      expect(prisma.treeIntervention.update.mock.calls[1][0].data.justification).toBe(
        'Riesgo de caída',
      );
    });

    it('solo las extracciones se mandan a autorizar', async () => {
      prisma.treeIntervention.findUnique.mockResolvedValue(
        intervencion({ interventionType: T.SAFETY_PRUNING }),
      );

      await expect(service.submitForAuthorization(ID)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('una extracción se manda a autorizar y queda pendiente', async () => {
      await service.submitForAuthorization(ID);

      expect(prisma.treeIntervention.update.mock.calls[0][0].data.status).toBe(
        I.PENDING_AUTHORIZATION,
      );
    });

    it('el rechazo solo sale de PENDING_AUTHORIZATION', async () => {
      prisma.treeIntervention.findUnique.mockResolvedValue(intervencion());
      await expect(service.reject(ID)).rejects.toBeInstanceOf(ConflictException);

      prisma.treeIntervention.findUnique.mockResolvedValue(
        intervencion({ status: I.PENDING_AUTHORIZATION }),
      );
      await service.reject(ID);
      expect(prisma.treeIntervention.update.mock.calls[0][0].data.status).toBe(I.REJECTED);
    });

    it('AUTHORIZED y REJECTED son finales', async () => {
      for (const estado of [I.AUTHORIZED, I.REJECTED]) {
        prisma.treeIntervention.findUnique.mockResolvedValue(intervencion({ status: estado }));
        await expect(service.reject(ID)).rejects.toBeInstanceOf(ConflictException);
      }
    });

    it('una intervención inexistente da 404', async () => {
      prisma.treeIntervention.findUnique.mockResolvedValue(null);

      await expect(service.authorize(ID, {})).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ─── Alta ───────────────────────────────────────────

  describe('create', () => {
    it('nace en REQUESTED con sus árboles', async () => {
      await service.create({ interventionType: T.REMOVAL, treeIds: ['ar-1'] } as any);

      const { data } = prisma.treeIntervention.create.mock.calls[0][0];
      expect(data.status).toBe(I.REQUESTED);
      expect(data.trees.createMany.data).toEqual([{ treeId: 'ar-1' }]);
    });

    /** Si un árbol no existe, la intervención apuntaría al vacío. */
    it('nombra los árboles que no existen y no crea nada', async () => {
      prisma.tree.findMany.mockResolvedValue([{ id: 'ar-1' }]);

      await expect(
        service.create({ interventionType: T.REMOVAL, treeIds: ['ar-1', 'ar-9'] } as any),
      ).rejects.toThrow('ar-9');
      expect(prisma.treeIntervention.create).not.toHaveBeenCalled();
    });

    it('los opcionales ausentes quedan en null o false', async () => {
      await service.create({ interventionType: T.REMOVAL, treeIds: ['ar-1'] } as any);

      expect(prisma.treeIntervention.create.mock.calls[0][0].data).toMatchObject({
        address: null,
        priority: null,
        justification: null,
        requiresStreetClosure: false,
      });
    });
  });

  describe('listado y detalle', () => {
    it('filtra por tipo y estado', async () => {
      await service.findAll({
        page: 1,
        pageSize: 20,
        interventionType: T.REMOVAL,
        status: I.AUTHORIZED,
      } as any);

      expect(prisma.treeIntervention.findMany.mock.calls[0][0].where).toEqual({
        interventionType: T.REMOVAL,
        status: I.AUTHORIZED,
      });
    });

    it('findOne da 404 si no está', async () => {
      prisma.treeIntervention.findUnique.mockResolvedValue(null);

      await expect(service.findOne(ID)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ─── Programación y el evento hacia M7 ──────────────

  describe('assignService', () => {
    const autorizada = () => intervencion({ status: I.AUTHORIZED });

    beforeEach(() => {
      prisma.treeIntervention.findUnique.mockResolvedValue(autorizada());
      prisma.treeIntervention.update.mockImplementation(({ data }: any) =>
        Promise.resolve(intervencion({ status: I.AUTHORIZED, ...data })),
      );
    });

    it('solo se programa lo autorizado', async () => {
      prisma.treeIntervention.findUnique.mockResolvedValue(intervencion());

      await expect(service.assignService(ID, { serviceId: SRV })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('una intervención ya programada no se reprograma', async () => {
      prisma.treeIntervention.findUnique.mockResolvedValue(
        intervencion({ status: I.AUTHORIZED, serviceId: 'otro' }),
      );

      await expect(service.assignService(ID, { serviceId: SRV })).rejects.toThrow('otro');
    });

    it('un servicio inexistente da 404', async () => {
      prisma.service.findUnique.mockResolvedValue(null);

      await expect(service.assignService(ID, { serviceId: SRV })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    /** La intervención se ejecuta sobre árboles concretos, no sobre un recorrido. */
    it('el servicio tiene que ser de modo POINT', async () => {
      prisma.service.findUnique.mockResolvedValue(servicio({ mode: ServiceMode.ROUTE }));

      await expect(service.assignService(ID, { serviceId: SRV })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('asocia el servicio y publica treePruningScheduled', async () => {
      await service.assignService(ID, { serviceId: SRV });

      expect(prisma.treeIntervention.update.mock.calls[0][0].data).toEqual({ serviceId: SRV });
      expect(outbox.enqueue).toHaveBeenCalledTimes(1);
      const [tx, entrada] = outbox.enqueue.mock.calls[0];
      expect(tx).toBe(prisma);
      expect(entrada.eventType).toBe('treePruningScheduled');
      expect(entrada.payload).toMatchObject({
        interventionId: ID,
        serviceId: SRV,
        treeIds: ['ar-1'],
        zoneId: 'z-centro',
        crewId: 'crew-1',
      });
    });

    /**
     * M7 declara `crewId` y `timeWindow` como requeridos y en nuestro modelo son
     * opcionales hasta que se asignan. Antes que emitir un evento incompleto que
     * su validador va a rechazar, se difiere.
     */
    it('sin cuadrilla el evento se difiere, pero la asociación se guarda', async () => {
      prisma.service.findUnique.mockResolvedValue(servicio({ crewId: null }));

      await service.assignService(ID, { serviceId: SRV });

      expect(prisma.treeIntervention.update).toHaveBeenCalled();
      expect(outbox.enqueue).not.toHaveBeenCalled();
    });

    it('sin franja horaria también se difiere', async () => {
      prisma.service.findUnique.mockResolvedValue(servicio({ windowFrom: null, windowTo: null }));

      await service.assignService(ID, { serviceId: SRV });

      expect(outbox.enqueue).not.toHaveBeenCalled();
    });

    /** Un servicio ejecuta una sola intervención: `serviceId` es @unique. */
    it('un servicio que ya ejecuta otra intervención da 409', async () => {
      prisma.$transaction.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('dup', {
          code: 'P2002',
          clientVersion: '5.22.0',
        }),
      );

      await expect(service.assignService(ID, { serviceId: SRV })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('un error ajeno a Prisma se propaga', async () => {
      prisma.$transaction.mockRejectedValue(new Error('la base se cayó'));

      await expect(service.assignService(ID, { serviceId: SRV })).rejects.toThrow(
        'la base se cayó',
      );
    });

    it('una intervención sin árboles ubica el evento por la dirección', async () => {
      prisma.treeIntervention.findUnique.mockResolvedValue(
        intervencion({ status: I.AUTHORIZED, trees: [] }),
      );
      prisma.treeIntervention.update.mockResolvedValue(
        intervencion({ status: I.AUTHORIZED, trees: [] }),
      );

      await service.assignService(ID, { serviceId: SRV });

      expect(prisma.tree.findUnique).not.toHaveBeenCalled();
      expect(outbox.enqueue.mock.calls[0][1].payload.location).toEqual({
        street: 'Av. Mitre 1200',
      });
    });
  });
});
