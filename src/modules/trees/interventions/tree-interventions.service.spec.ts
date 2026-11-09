import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  PreconditionFailedException,
} from '@nestjs/common';
import {
  M6Role,
  Prisma,
  ServiceMode,
  TreeInterventionStatus as I,
  TreeInterventionType as T,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { ACTOR } from '../../../common/audit/audit-test-actor';
import { AuditService } from '../../../common/audit/audit.service';
import { etagOf } from '../../../common/etag';
import { TreeInterventionsService } from './tree-interventions.service';
import { QueryTreeInterventionsDto } from './dto';

const ID = '11111111-1111-1111-1111-111111111111';
const SRV = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const ADMIN = [M6Role.M6_ADMIN];
const actorOf = (userId: string, roles: M6Role[] = []) => ({ userId, roles });
const OPERACIONES = [M6Role.M6_OFICINA_OPERACIONES];

describe('TreeInterventionsService', () => {
  let prisma: any;
  let audit: any;
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
    requestedByUserId: 'user-2',
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
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    service = new TreeInterventionsService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
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

      await expect(service.authorize(ID, {}, actorOf('user-7', ADMIN))).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.treeIntervention.update).not.toHaveBeenCalled();
    });

    it('autoriza una extracción que ya pasó por PENDING_AUTHORIZATION, a nombre del token', async () => {
      prisma.treeIntervention.findUnique.mockResolvedValue(
        intervencion({ status: I.PENDING_AUTHORIZATION }),
      );

      // El body trae otro id (campo deprecado): no cambia quién queda registrado.
      await service.authorize(ID, { authorizedByUserId: 'user-1' }, actorOf('user-7', ADMIN));

      expect(prisma.treeIntervention.update.mock.calls[0][0].data).toMatchObject({
        status: I.AUTHORIZED,
        authorizedByUserId: 'user-7',
      });
    });

    it('una extracción no la autoriza ni la rechaza quien no es M6_ADMIN (403 ROLE_REQUIRED)', async () => {
      prisma.treeIntervention.findUnique.mockResolvedValue(
        intervencion({ status: I.PENDING_AUTHORIZATION }),
      );

      const authorize = service.authorize(ID, {}, actorOf('user-7', OPERACIONES));
      await expect(authorize).rejects.toBeInstanceOf(ForbiddenException);
      await expect(authorize).rejects.toMatchObject({
        response: { code: 'ROLE_REQUIRED' },
      });
      await expect(service.reject(ID, actorOf('user-7', OPERACIONES))).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.treeIntervention.update).not.toHaveBeenCalled();
    });

    it('sin roles en el request tampoco decide una extracción', async () => {
      prisma.treeIntervention.findUnique.mockResolvedValue(
        intervencion({ status: I.PENDING_AUTHORIZATION }),
      );

      await expect(service.authorize(ID, {}, actorOf('user-7'))).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(service.reject(ID, actorOf('user-7'))).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('un M6_ADMIN autoriza lo que él mismo solicitó y quedan registrados los dos', async () => {
      const propia = intervencion({ status: I.PENDING_AUTHORIZATION, requestedByUserId: 'user-7' });
      prisma.treeIntervention.findUnique.mockResolvedValue(propia);
      prisma.treeIntervention.update.mockImplementation(({ data }: any) =>
        Promise.resolve({ ...propia, ...data }),
      );

      const res = await service.authorize(ID, {}, actorOf('user-7', ADMIN));

      expect(res).toMatchObject({ requestedByUserId: 'user-7', authorizedByUserId: 'user-7' });
    });

    it('una poda la autoriza quien tiene rol de operaciones, sin M6_ADMIN', async () => {
      prisma.treeIntervention.findUnique.mockResolvedValue(
        intervencion({ interventionType: T.SAFETY_PRUNING }),
      );

      await service.authorize(ID, {}, actorOf('user-7', OPERACIONES));

      expect(prisma.treeIntervention.update).toHaveBeenCalled();
    });

    it('autoriza una poda directo desde REQUESTED', async () => {
      prisma.treeIntervention.findUnique.mockResolvedValue(
        intervencion({ interventionType: T.SAFETY_PRUNING }),
      );

      await service.authorize(ID, {}, actorOf('user-7', ADMIN));

      expect(prisma.treeIntervention.update).toHaveBeenCalled();
    });

    it('sella la fecha de autorización', async () => {
      prisma.treeIntervention.findUnique.mockResolvedValue(
        intervencion({ status: I.PENDING_AUTHORIZATION }),
      );

      await service.authorize(ID, {}, actorOf('user-7', ADMIN));

      expect(prisma.treeIntervention.update.mock.calls[0][0].data.authorizedAt).toBeInstanceOf(
        Date,
      );
    });

    it('la justificación solo se pisa si viene', async () => {
      prisma.treeIntervention.findUnique.mockResolvedValue(
        intervencion({ status: I.PENDING_AUTHORIZATION }),
      );

      await service.authorize(ID, {}, actorOf('user-7', ADMIN));
      expect(prisma.treeIntervention.update.mock.calls[0][0].data.justification).toBeUndefined();

      await service.authorize(ID, { justification: 'Riesgo de caída' }, actorOf('user-7', ADMIN));
      expect(prisma.treeIntervention.update.mock.calls[1][0].data.justification).toBe(
        'Riesgo de caída',
      );
    });

    it('solo las extracciones se mandan a autorizar', async () => {
      prisma.treeIntervention.findUnique.mockResolvedValue(
        intervencion({ interventionType: T.SAFETY_PRUNING }),
      );

      await expect(service.submitForAuthorization(ID, ACTOR)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('una extracción se manda a autorizar y queda pendiente', async () => {
      await service.submitForAuthorization(ID, ACTOR);

      expect(prisma.treeIntervention.update.mock.calls[0][0].data.status).toBe(
        I.PENDING_AUTHORIZATION,
      );
    });

    it('el rechazo solo sale de PENDING_AUTHORIZATION', async () => {
      prisma.treeIntervention.findUnique.mockResolvedValue(intervencion());
      await expect(service.reject(ID, actorOf('user-7', ADMIN))).rejects.toBeInstanceOf(
        ConflictException,
      );

      prisma.treeIntervention.findUnique.mockResolvedValue(
        intervencion({ status: I.PENDING_AUTHORIZATION }),
      );
      await service.reject(ID, actorOf('user-7', ADMIN));
      expect(prisma.treeIntervention.update.mock.calls[0][0].data.status).toBe(I.REJECTED);
    });

    it('AUTHORIZED y REJECTED son finales', async () => {
      for (const estado of [I.AUTHORIZED, I.REJECTED]) {
        prisma.treeIntervention.findUnique.mockResolvedValue(intervencion({ status: estado }));
        await expect(service.reject(ID, actorOf('user-7', ADMIN))).rejects.toBeInstanceOf(
          ConflictException,
        );
      }
    });

    it('una intervención inexistente da 404', async () => {
      prisma.treeIntervention.findUnique.mockResolvedValue(null);

      await expect(service.authorize(ID, {}, actorOf('user-7', ADMIN))).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  // ─── Alta ───────────────────────────────────────────

  describe('create', () => {
    it('nace en REQUESTED con sus árboles', async () => {
      await service.create(
        { interventionType: T.REMOVAL, treeIds: ['ar-1'] } as any,
        actorOf('user-2'),
      );

      const { data } = prisma.treeIntervention.create.mock.calls[0][0];
      expect(data.status).toBe(I.REQUESTED);
      expect(data.requestedByUserId).toBe('user-2');
      expect(data.trees.createMany.data).toEqual([{ treeId: 'ar-1' }]);
    });

    /** Si un árbol no existe, la intervención apuntaría al vacío. */
    it('nombra los árboles que no existen y no crea nada', async () => {
      prisma.tree.findMany.mockResolvedValue([{ id: 'ar-1' }]);

      await expect(
        service.create(
          { interventionType: T.REMOVAL, treeIds: ['ar-1', 'ar-9'] } as any,
          actorOf('user-2'),
        ),
      ).rejects.toThrow('ar-9');
      expect(prisma.treeIntervention.create).not.toHaveBeenCalled();
    });

    it('los opcionales ausentes quedan en null o false', async () => {
      await service.create(
        { interventionType: T.REMOVAL, treeIds: ['ar-1'] } as any,
        actorOf('user-2'),
      );

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

    it('filtra por prioridad combinada con tipo y estado', async () => {
      await service.findAll(
        Object.assign(new QueryTreeInterventionsDto(), {
          interventionType: T.REMOVAL,
          status: I.AUTHORIZED,
          priority: 'HIGH',
        }),
      );

      const where = { interventionType: T.REMOVAL, status: I.AUTHORIZED, priority: 'HIGH' };
      expect(prisma.treeIntervention.findMany.mock.calls[0][0].where).toEqual(where);
      expect(prisma.treeIntervention.count).toHaveBeenCalledWith({ where });
    });

    /** El árbol no es un campo de la intervención: viaja en la tabla InterventionTree. */
    it('filtra por árbol con el mismo where en listado y conteo', async () => {
      const TREE = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
      await service.findAll(Object.assign(new QueryTreeInterventionsDto(), { treeId: TREE }));

      const where = { trees: { some: { treeId: TREE } } };
      expect(prisma.treeIntervention.findMany.mock.calls[0][0].where).toEqual(where);
      expect(prisma.treeIntervention.count).toHaveBeenCalledWith({ where });
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

      await expect(service.assignService(ID, { serviceId: SRV }, ACTOR)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('una intervención ya programada no se reprograma', async () => {
      prisma.treeIntervention.findUnique.mockResolvedValue(
        intervencion({ status: I.AUTHORIZED, serviceId: 'otro' }),
      );

      await expect(service.assignService(ID, { serviceId: SRV }, ACTOR)).rejects.toThrow('otro');
    });

    it('un servicio inexistente da 404', async () => {
      prisma.service.findUnique.mockResolvedValue(null);

      await expect(service.assignService(ID, { serviceId: SRV }, ACTOR)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    /** La intervención se ejecuta sobre árboles concretos, no sobre un recorrido. */
    it('el servicio tiene que ser de modo POINT', async () => {
      prisma.service.findUnique.mockResolvedValue(servicio({ mode: ServiceMode.ROUTE }));

      await expect(service.assignService(ID, { serviceId: SRV }, ACTOR)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    /** M7 solo consume streetClosureRequested: asociar el servicio no emite nada (#345). */
    it('asocia el servicio sin encolar eventos', async () => {
      await service.assignService(ID, { serviceId: SRV }, ACTOR);

      expect(prisma.treeIntervention.update).toHaveBeenCalledTimes(1);
      expect(prisma.treeIntervention.update.mock.calls[0][0].data).toEqual({ serviceId: SRV });
    });

    /** Un servicio ejecuta una sola intervención: `serviceId` es @unique. */
    it('un servicio que ya ejecuta otra intervención da 409', async () => {
      prisma.treeIntervention.update.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('dup', {
          code: 'P2002',
          clientVersion: '5.22.0',
        }),
      );

      await expect(service.assignService(ID, { serviceId: SRV }, ACTOR)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('un error ajeno a Prisma se propaga', async () => {
      prisma.treeIntervention.update.mockRejectedValue(new Error('la base se cayó'));

      await expect(service.assignService(ID, { serviceId: SRV }, ACTOR)).rejects.toThrow(
        'la base se cayó',
      );
    });
  });

  describe('auditoría (#460)', () => {
    it('el alta audita el estado inicial con el actor del token', async () => {
      await service.create(
        { interventionType: T.REMOVAL, treeIds: ['ar-1'] } as any,
        actorOf('user-2'),
      );

      expect(audit.record).toHaveBeenCalledWith(prisma, {
        entityType: 'TREE_INTERVENTION',
        entityId: expect.any(String),
        action: 'CREATE',
        toStatus: I.REQUESTED,
        actor: actorOf('user-2'),
      });
    });

    it('autorizar audita estados y quién autorizó', async () => {
      prisma.treeIntervention.findUnique.mockResolvedValue({
        id: ID,
        interventionType: T.REMOVAL,
        status: I.PENDING_AUTHORIZATION,
        trees: [],
      });

      await service.authorize(ID, {}, actorOf('user-7', ADMIN));

      expect(audit.record).toHaveBeenCalledWith(prisma, {
        entityType: 'TREE_INTERVENTION',
        entityId: ID,
        action: 'AUTHORIZE',
        fromStatus: I.PENDING_AUTHORIZATION,
        toStatus: I.AUTHORIZED,
        actor: actorOf('user-7', ADMIN),
      });
    });

    it('rechazar y enviar a autorización también auditan', async () => {
      prisma.treeIntervention.findUnique.mockResolvedValue({
        id: ID,
        interventionType: T.REMOVAL,
        status: I.PENDING_AUTHORIZATION,
        trees: [],
      });
      await service.reject(ID, actorOf('user-7', ADMIN));
      expect(audit.record).toHaveBeenLastCalledWith(
        prisma,
        expect.objectContaining({ action: 'REJECT', toStatus: I.REJECTED }),
      );

      prisma.treeIntervention.findUnique.mockResolvedValue({
        id: ID,
        interventionType: T.REMOVAL,
        status: I.REQUESTED,
        trees: [],
      });
      await service.submitForAuthorization(ID, actorOf('user-7'));
      expect(audit.record).toHaveBeenLastCalledWith(
        prisma,
        expect.objectContaining({
          action: 'SUBMIT_FOR_AUTHORIZATION',
          toStatus: I.PENDING_AUTHORIZATION,
        }),
      );
    });

    it('una transición rechazada no audita', async () => {
      prisma.treeIntervention.findUnique.mockResolvedValue({
        id: ID,
        interventionType: T.REMOVAL,
        status: I.REJECTED,
        trees: [],
      });

      await expect(service.reject(ID, actorOf('user-7', ADMIN))).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(audit.record).not.toHaveBeenCalled();
    });
  });

  // ─── If-Match (ADR-012) ─────────────────────────────

  describe('If-Match', () => {
    const vigente = etagOf(intervencion().updatedAt as Date);
    const pendiente = () => intervencion({ status: I.PENDING_AUTHORIZATION });

    it('con un ETag viejo da 412 y no escribe ni audita', async () => {
      prisma.treeIntervention.findUnique.mockResolvedValue(pendiente());
      await expect(service.reject(ID, actorOf('user-7', ADMIN), 'W/"1"')).rejects.toBeInstanceOf(
        PreconditionFailedException,
      );
      expect(prisma.treeIntervention.update).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('con el vigente condiciona el UPDATE por updatedAt', async () => {
      prisma.treeIntervention.findUnique.mockResolvedValue(pendiente());
      await service.reject(ID, actorOf('user-7', ADMIN), vigente);
      expect(prisma.treeIntervention.update.mock.calls[0][0].where).toEqual({
        id: ID,
        updatedAt: intervencion().updatedAt,
      });
    });

    it('sin If-Match el where no cambia', async () => {
      prisma.treeIntervention.findUnique.mockResolvedValue(pendiente());
      await service.reject(ID, actorOf('user-7', ADMIN));
      expect(prisma.treeIntervention.update.mock.calls[0][0].where).toEqual({ id: ID });
    });

    it('P2025 con If-Match da 412; sin If-Match se propaga tal cual', async () => {
      const err = new Prisma.PrismaClientKnownRequestError('x', {
        code: 'P2025',
        clientVersion: '5',
      });
      prisma.treeIntervention.findUnique.mockResolvedValue(pendiente());
      prisma.treeIntervention.update.mockRejectedValue(err);
      await expect(service.reject(ID, actorOf('user-7', ADMIN), vigente)).rejects.toBeInstanceOf(
        PreconditionFailedException,
      );
      await expect(service.reject(ID, actorOf('user-7', ADMIN))).rejects.toBe(err);
    });
  });
});
